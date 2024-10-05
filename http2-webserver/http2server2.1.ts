import commandLineArgs from "command-line-args";
import fs, { PathLike } from "node:fs";
import log4js from "log4js";
import http2, {
    Http2Session,
    IncomingHttpHeaders,
    OutgoingHttpHeaders,
    SecureServerOptions,
    ServerHttp2Stream,
    createSecureServer
} from "node:http2";
import Path from "node:path";
import pug from "pug";
import __ from '@x/dirname';

import * as fm from "./files-manager.ts";
import * as imgDir from "./img_dir.ts";
import { getDirReportFiles } from "./json-dir-index.ts";
import * as widgets from "./timeline-notes.ts";

// TODO: .env.<environment-type> files (public data)
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

// todo Config should be done in external, json file
//   @body (ex: widgets should be defined in external config file that is then passed via start args to this js program)

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

const { __filename } = __(import.meta);
const FILENAME = Path.basename(__filename);
const execModeString = runOpts.debug ? "DEBUG" : "PRODUCTION";
export const URL_ROOT = `https://${websiteRoot}`;

const {
    HTTP2_HEADER_METHOD,
    HTTP2_HEADER_PATH,
    HTTP2_HEADER_CONTENT_LENGTH,
    HTTP2_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN,
} = http2.constants;

const DEFAULT_HEADERS = {
    link: [
        '<https://static.jpcode.dev/css/core_style.css>; rel="preload"; as="style"',
        '<https://static.jpcode.dev/js/multi-palette.min.js>; rel="preload"; as="script"',
    ],
};

export type JPServerConsts = {
    exec_path: string;
    websiteRoot: string;
    URL_ROOT: string;
    DEFAULT_HEADERS: {
        link: string[];
    };
};

const consts = {
    exec_path,
    websiteRoot,
    URL_ROOT,
    DEFAULT_HEADERS,
} as JPServerConsts;

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
    socket: Http2Session["socket"] | undefined
) => void;
if (runOpts.log === "simple") {
    logStream = (headers: IncomingHttpHeaders) => {
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
        socket: Http2Session["socket"] | undefined
    ) => {
        logger.info(
            `${socket?.remoteFamily}, ${socket?.remoteAddress}, ${socket?.remotePort
            }, ${headers[':method']} '${headers[':path']
            }', ${headers['referer']}, '${headers['user-agent']
            }'`
        );
    };
    // + headers[http2.constants.HTTP2_HEADER]
    // +` - pushList[reqPath]: ${pushList[reqPath]}`
} else {
    logStream = () => { };
}

// Load Pug Templates
await widgets.loadTemplates("../pug");
const pugOptions = {
    basedir: "../pug",
    globals: ["linkify"],
} as pug.Options & pug.LocalsObject;

const supportedTimelineNotesRootFragments: string[] = ["dnd", "thoughts"];

// Initialize dnd/ian-oota Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/ian-oota/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/ian-oota",
    plugins: ["dnd-api"],
});
// Initialize dnd/jay-waterdeep Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/jay-waterdeep/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/jay-waterdeep",
    plugins: ["dnd-api"],
});
// Initialize dnd/jp-icewind Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/jp-icewind/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/jp-icewind",
    plugins: ["dnd-api"],
});

// Initialize dnd/ian-theros Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/ian-theros/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/ian-theros",
    plugins: ["dnd-api"],
});

// Initialize dnd/caillen-wildweirdwest Notes Widgets
await widgets.init({
    widget_directory: Path.join(
        runOpts.pubpath,
        "dnd/caillen-wildweirdwest/widgets"
    ),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/caillen-wildweirdwest",
    plugins: ["dnd-api"],
});

// Initialize dnd/ian-strahd Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/ian-strahd/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/ian-strahd",
    plugins: ["dnd-api"],
});

// Initialize `thoughts/software` Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "thoughts/software/src"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "thoughts/software",
    plugins: [],
});

// Initialize `thoughts/politics` Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "thoughts/politics/src"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "thoughts/politics",
    plugins: [],
});

// Init file manager
fm.init(runOpts, pugOptions, DEFAULT_HEADERS, logger);
await fm.load(exec_path);

// Img Dir
imgDir.init(widgets.getPugTemplate("img_dir"), consts, logger);

const port = runOpts.port || 8089;

const serverOpts = {
    allowHTTP1: runOpts.allowHTTP1,
    timeout: 3000,
} as SecureServerOptions;

// Whether or not to use HTTPS on webserver
const useSecure = runOpts.key && runOpts.cert;

if (useSecure) {
    serverOpts.key = fs.readFileSync(runOpts.key);
    serverOpts.cert = fs.readFileSync(runOpts.cert);
    logger.info("Key and Cert Loaded. Running server with encryption enabled.");
} else if (runOpts.key || runOpts.cert) {
    logger.warn(
        `CommandLineArguments Error: A ${runOpts.key ? "key" : "cert"
        } was specified, but a ${runOpts.key ? "cert" : "key"
        } was not. In order to enable SSL/TLS, both must be specified. Starting server without SSL/TLS.`
    );
} else {
    logger.info("Key and Cert Unspecified. Running server without encryption.");
}

//  Create server

// NOTE WELL:
// - You MUST have a key+cert for browsers to accept these http2 connections at
//   all!
// - Even for cURL, you must specify a special flag to signal that it's http2!
//   like so: `curl -D - --http2-prior-knowledge http://localhost:8443`
const server = useSecure
    ? http2.createServer(serverOpts)
    : http2.createServer(serverOpts);

//  Handle Errors
server.on("error", (err) => logger.error(err));

enum ResponseExitCode {
    Success,
    UnsupportedMethod,
    NotFound_NoHandler,
}

//  Handle streams (requests are streams)
server.on("stream", (stream, headers) => {
    logStream(headers, stream.session?.socket);
    respond(stream, headers)
        .catch(err => logger.error("Critical unhandled request exception", err));
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
async function respond(
    stream: ServerHttp2Stream,
    headers: IncomingHttpHeaders
): Promise<ResponseExitCode> {
    stream.setTimeout(3000, () => {
        stream.destroy();
    });
    // stream is a Duplex
    const method = headers[HTTP2_HEADER_METHOD];
    if (method != http2.constants.HTTP2_METHOD_GET) {
        stream.respond({ status: 404 });
        stream.end();
        return ResponseExitCode.UnsupportedMethod;
    }
    const reqUrl = new URL(headers[HTTP2_HEADER_PATH] as string, URL_ROOT);
    const path = decodeURIComponent(reqUrl.pathname);
    const query = reqUrl.search;

    const resHeaders: OutgoingHttpHeaders = {
        "content-type": "text/html; charset=utf-8",
        ":status": 200,
    };
    if (websiteRoot === "static.jpcode.dev") {
        resHeaders[HTTP2_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN] = "*";
    }
    if (path.includes("dotnet/files.json")) {
        stream.respond({ ...resHeaders, "cache-control": "max-age=900" });

        const reportFiles = await getDirReportFiles(
            `${exec_path}/benchmarks/dotnet`
        );

        stream.end(JSON.stringify(reportFiles));

        return ResponseExitCode.Success;
    }

    const requestedFile = fm.getFile(path);
    // Set content length header, if requested file is found by file manager.
    if (requestedFile) {
        requestedFile.headers[HTTP2_HEADER_CONTENT_LENGTH] = Buffer.byteLength(
            requestedFile.data,
            "utf8"
        );
    }

    // Try widget
    if (!requestedFile) {
        const successCode = widgets.handleRequest(
            stream,
            headers,
            supportedTimelineNotesRootFragments
        );
        if (successCode === 0) {
            return ResponseExitCode.Success;
        }
    }
    if (!requestedFile && path.startsWith("/3d")) {
        try {
            const successCode = await imgDir.handleRequest(
                stream,
                headers,
                path,
                query
            );
            if (successCode === 0) {
                return ResponseExitCode.Success;
            }
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
                stream.respond(resHeaders);
                stream.write(dirIndexPug(opts));
                stream.end();
                return ResponseExitCode.Success;
            }
        } catch (error) {
            logger.warn(error);
        }
    }

    // Send successful response
    if (requestedFile) {
        const resHeaders2 =
            websiteRoot === "static.jpcode.dev"
                ? {
                    // This is absolutely cursed. For some incomprehensable
                    // reason, explicitly setting the access control header
                    // below results in "*, *" if the requestedFile.headers
                    // already has "*" set. This filter will exclude the
                    // requestedFile value... in theory.
                    // Ah, I think it has to do with case sensitivity.
                    //   ...Object.fromEntries(
                    //       Object.entries(requestedFile.headers).filter(
                    //           ([k, v]) =>
                    //               k.toLowerCase() ===
                    //               HTTP2_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN.toLowerCase()
                    //       )
                    //   ),
                    ...requestedFile.headers,
                    ":status": 200,
                    [HTTP2_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN]: "*",
                }
                : requestedFile.headers;

        stream.respond(resHeaders2);
        stream.end(requestedFile.data);
        return ResponseExitCode.Success;
    }

    // Handle 404
    logger.warn(`404 Not Found: ${path}`);
    handle404(stream);
    return ResponseExitCode.NotFound_NoHandler;
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
logger.info(`'${FILENAME}' is listening on port ${port}`);
