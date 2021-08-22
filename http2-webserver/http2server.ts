import http2, {
    Http2SecureServer,
    Http2Session,
    SecureServerOptions,
    ServerHttp2Stream,
} from "http2";
import fs, { PathLike } from "fs";
import Path from "path/posix";
import log4js from "log4js";
import commandLineArgs from "command-line-args";
import pug from "pug";

import widgets from "./timeline-notes";
import * as fm from "./files-manager";
import imgDir from "./img_dir";
import { IncomingHttpHeaders } from "http";

//  Load ArgV
const optionDefinitions = [
    { name: "key", alias: "k", type: String },
    { name: "cert", alias: "c", type: String },
    { name: "debug", alias: "d", type: Boolean },
    {
        name: "pubpath",
        type: String,
        multiple: false,
        defaultOption: true,
        defaultValue: "../public",
    },
    { name: "port", alias: "p", type: Number },
    { name: "server-push", type: Boolean },
    { name: "early-hints", type: Boolean },
    { name: "allowHTTP1", type: Boolean, defaultValue: false },
    { name: "log", type: String },
    { name: "use-br-if-available", type: String, defaultValue: false },
    { name: "maxAge", type: String },
    { name: "static", type: Boolean, defaultValue: false },
    {
        name: "host",
        type: String,
        multiple: false,
        defaultValue: "www.jpcode.dev",
    },
];
export type JPServerOptions = {
    key: string;
    cert: string;
    debug: boolean;
    pubpath: string;
    port: number;
    server_push: boolean;
    early_hints: boolean;
    allowHTTP1: boolean;
    log: string;
    use_br_if_available: string;
    maxAge: string;
    static: boolean;
    host: string;
};

const runOpts = commandLineArgs(optionDefinitions) as JPServerOptions;

const { host: websiteRoot, pubpath: exec_path } = runOpts;

const FILENAME = Path.basename(__filename);
const exec_dirname = Path.basename(exec_path);
const execModeString = runOpts.debug ? "DEBUG" : "PRODUCTION";
const URL_ROOT = `https://${websiteRoot}`;
const DEFAULT_HEADERS = {
    link: [
        '<https://static.jpcode.dev/css/core_style.css>; rel="preload"; as="style"',
        '<https://static.jpcode.dev/js/multi-palette.min.js>; rel="preload"; as="script"',
    ],
};
const consts = {
    exec_path,
    websiteRoot,
    URL_ROOT,
    DEFAULT_HEADERS,
};

const {
    HTTP2_HEADER_METHOD,
    HTTP2_HEADER_PATH,
    HTTP2_HEADER_STATUS,
    HTTP2_HEADER_CONTENT_TYPE,
    HTTP2_HEADER_LINK,
    HTTP2_HEADER_ACCEPT_ENCODING,
    HTTP2_HEADER_CONTENT_LENGTH,
    HTTP2_HEADER_LAST_MODIFIED,
    HTTP2_HEADER_CACHE_CONTROL,
    HTTP2_HEADER_CONTENT_ENCODING,
} = http2.constants;

// Init logger
const logger = log4js.getLogger();
log4js.configure({
    appenders: {
        logfile: {
            type: "file",
            filename: Path.join("log", `${websiteRoot}-${execModeString}.log`), //${Date.now()}
            maxLogSize: 10485760,
            backups: 10,
            compress: true,
        },
        console: { type: "console" },
    },
    categories: {
        default: { appenders: ["logfile", "console"], level: "INFO" },
    },
});
logger.info(`Starting ${FILENAME} in ${execModeString} mode.`);

// Set Logging Format based on runOpts
let logStream: (
    headers: IncomingHttpHeaders,
    socket: Http2Session["socket"]
) => void;
if (runOpts.log === "simple") {
    logStream = function (
        headers: IncomingHttpHeaders,
        socket: Http2Session["socket"]
    ) {
        logger.info(
            "Req: " +
                JSON.stringify([
                    headers[HTTP2_HEADER_METHOD],
                    headers[HTTP2_HEADER_PATH],
                    headers[http2.constants.HTTP2_HEADER_REFERER],
                    headers[http2.constants.HTTP2_HEADER_USER_AGENT],
                ])
        );
    };
} else if (runOpts.log === "verbose") {
    logStream = (
        headers: IncomingHttpHeaders,
        socket: Http2Session["socket"]
    ) => {
        logger.info(
            `${socket.remoteFamily}, ${socket.remoteAddress}, ${
                socket.remotePort
            }, ${headers[HTTP2_HEADER_METHOD]} '${
                headers[HTTP2_HEADER_PATH]
            }', ${headers[http2.constants.HTTP2_HEADER_REFERER]}, '${
                headers[http2.constants.HTTP2_HEADER_USER_AGENT]
            }'`
        );
    };
    // + headers[http2.constants.HTTP2_HEADER]
    // +` - pushList[reqPath]: ${pushList[reqPath]}`
} else {
    logStream = () => {};
}

// eslint-disable-next-line no-unused-vars
const linkify = (pathend: string) => `https://${websiteRoot}/${pathend}`;
// Load Pug Templates
widgets.loadTemplates("../pug");
const pugOptions = {
    basedir: "../pug",
    globals: ["linkify"],
} as pug.Options & pug.LocalsObject;
// Initialize dnd/ian-oota Notes Widgets
widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/ian-oota/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/ian-oota",
    plugins: ["dnd-api"],
});
// Initialize dnd/jay-waterdeep Notes Widgets
widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/jay-waterdeep/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/jay-waterdeep",
    plugins: ["dnd-api"],
});

// Init file manager
fm.init(runOpts, pugOptions, DEFAULT_HEADERS, logger);
fm.load(exec_path);

// Img Dir
imgDir.init(widgets.getPugTemplate("img_dir"), consts, fm, logger);

const port = runOpts.port || 8080;

const serverOpts = {
    allowHTTP1: runOpts.allowHTTP1 as boolean,
    timeout: 3000,
} as SecureServerOptions;

// Whether or not to use HTTPS on webserver
let useSecure = false;
if (runOpts.key && runOpts.cert) {
    serverOpts.key = fs.readFileSync(runOpts.key);
    serverOpts.cert = fs.readFileSync(runOpts.cert);
    useSecure = true;
    logger.info("Key and Cert Loaded. Running server with encryption enabled.");
} else if (runOpts.key || runOpts.cert) {
    logger.warn(
        `CommandLineArguments Error: A ${
            runOpts.key ? "key" : "cert"
        } was specified, but a ${
            runOpts.key ? "cert" : "key"
        } was not. In order to enable SSL/TLS, both must be specified. Starting server without SSL/TLS.`
    );
} else {
    logger.info("Key and Cert Unspecified. Running server without encryption.");
}

//  Create server
const server = useSecure
    ? http2.createSecureServer(serverOpts)
    : http2.createServer(serverOpts);

//  Handle Errors
server.on("error", (err) => logger.error(err));

//  Handle streams (requests are streams)
server.on("stream", (stream, headers) => {
    logStream(headers, stream.session.socket);
    try {
        const successCode = respond(stream, headers);
    } catch (err) {
        logger.error(err);
    }
});

const getDirectoriesOrHtml = (source: PathLike) =>
    fs
        .readdirSync(source, { withFileTypes: true })
        // .filter(dirent => dirent.isDirectory() || dirent.name.endsWith(".html"))
        .map((dirent) => dirent.name);

const dirIndexPug = widgets.getPugTemplate("dir_list");

/**
 * Request Handler / Response Generator
 */
function respond(stream: ServerHttp2Stream, headers: IncomingHttpHeaders) {
    stream.setTimeout(3000, () => {
        stream.destroy();
    });
    // stream is a Duplex
    const method = headers[HTTP2_HEADER_METHOD];
    if (method != http2.constants.HTTP2_METHOD_GET) {
        stream.respond({ status: 404 });
        stream.end();
        return;
    }
    const reqUrl = new URL(headers[HTTP2_HEADER_PATH] as string, URL_ROOT);
    const path = decodeURIComponent(reqUrl.pathname);
    const query = reqUrl.search;
    const socket = stream.session.socket;
    const encodings = headers[HTTP2_HEADER_ACCEPT_ENCODING];

    const requestedFile = fm.getFile(path);
    // Set content length header, if requested file is found by file manager.
    if (requestedFile)
        requestedFile.headers[HTTP2_HEADER_CONTENT_LENGTH] = Buffer.byteLength(
            requestedFile.data,
            "utf8"
        );
    //Try widget
    if (!requestedFile) {
        const successCode = widgets.handleRequest(stream, headers);
        if (successCode === 0) return 0;
    }
    if (!requestedFile && path.startsWith("/3d")) {
        try {
            const successCode = imgDir.handleRequest(
                stream,
                headers,
                path,
                query
            );
            if (successCode === 0) return 0;
        } catch (error) {
            logger.error(error);
        }
    }
    // TODO Add watermark to all images in a certain dir automatically.
    // @body atm I have local scripts to add them to files before uploading them to server.
    if (!requestedFile) {
        try {
            const fpath = Path.join(exec_path, path);
            const fd = fs.openSync(fpath, "r");
            if (fs.fstatSync(fd).isFile()) {
                stream.respondWithFD(fd);
                stream.on("close", () => fs.closeSync(fd));
                return 0;
            } else if (fs.fstatSync(fd).isDirectory()) {
                fs.closeSync(fd);
                // DO directory index things
                const opts = {
                    dir: Path.basename(path),
                    widgets: getDirectoriesOrHtml(fpath).map((name) => {
                        return {
                            name: name,
                            link:
                                "https://" + Path.join(websiteRoot, path, name),
                        };
                    }),
                };
                stream.respond({
                    "content-type": "text/html; charset=utf-8",
                    ":status": 200,
                });
                stream.write(dirIndexPug(opts));
                stream.end();
                return 0;
            }
        } catch (error) {
            logger.warn(error);
        }
    }

    // Send successful response
    if (requestedFile) {
        const resHeaders = requestedFile.headers;
        resHeaders[":status"] = 200;

        stream.respond(resHeaders);
        stream.end(requestedFile.data);
        return 0;
    }

    // Handle 404
    logger.warn(`404 Not Found: ${path}`);
    handle404(stream);
    return -1;
}

const pug404 = widgets.getPugTemplate("404")();
function handle404(stream: ServerHttp2Stream) {
    if (runOpts.static) {
        stream.respond({
            ":status": 404,
        });
        stream.end();
    } else {
        stream.respond({
            "content-type": "text/html; charset=utf-8",
            ":status": 404,
        });

        stream.end(pug404);
    }

    return -1;
}

// Start Server
server.listen(port);
logger.info(`'${FILENAME}' is listening on port ${port}`);
