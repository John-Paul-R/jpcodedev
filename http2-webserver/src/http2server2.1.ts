import { ok } from '@http/response/ok';
import { serveFile } from "@std/http";
import { Header as HeaderKey } from "@std/http/unstable-header";
import __ from '@x/dirname';
import log4js from "log4js";
import fs, { PathLike } from "node:fs";
import Path from "node:path";
import pug from "pug";

import { notFound } from "@http/response/not-found";
import { Buffer } from "node:buffer";
import * as fm from "./files-manager.ts";
import * as imgDir from "./img_dir.ts";
import { getDirReportFiles } from "./json-dir-index.ts";
import * as widgets from "./timeline-notes.ts";

import { parseFlags } from "https://deno.land/x/cliffy@v1.0.0-rc.4/flags/mod.ts";

const { flags } = parseFlags(Deno.args, {
    flags: [
        { name: "key", aliases: ["k"], type: "string" },
        { name: "cert", aliases: ["c"], type: "string" },
        { name: "debug", aliases: ["d"] },
        { name: "pubpath", type: "string", default: "../public" },
        { name: "port", aliases: ["p"], type: "number" },
        { name: "server-push" },
        { name: "early-hints" },
        { name: "allowHTTP1", default: false },
        { name: "log", type: "string" },
        { name: "use-br-if-available" },
        { name: "maxAge", type: "string" },
        { name: "static" },
        { name: "urlAuthority", type: "string", default: "www.jpcode.dev" },
    ],
});

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
    urlAuthority: string;
};

const runOpts = flags as JPServerOptions;

const { 
    urlAuthority: websiteRoot,
    pubpath: exec_path
} = runOpts;
const staticServerUrlAuthority = websiteRoot.includes('localhost')
    ? 'localhost:8083'
    : 'static.jpcode.dev';

    console.log(runOpts)
const isApplicationServer = !runOpts.static;

const { __filename } = __(import.meta);
const FILENAME = Path.basename(__filename);
const execModeString = runOpts.debug ? "DEBUG" : "PRODUCTION";
export const URL_ROOT = `https://${websiteRoot}`;

const DEFAULT_HEADERS = {
    link: [
        `<https://${staticServerUrlAuthority}/css/core_style.css>; rel="preload"; as="style"`,
        `<https://${staticServerUrlAuthority}/js/multi-palette.min.js>; rel="preload"; as="script"`,
        `<https://${staticServerUrlAuthority}/fonts/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2>; rel="preload"; as="font"; type="font/woff2"; crossorigin`,
    ],
};

export type JPServerConsts = {
    exec_path: string;
    websiteRoot: string;
    URL_ROOT: string;
    DEFAULT_HEADERS: {
        link: string[];
    };
    isApplicationServer: boolean;
};

const consts = {
    exec_path,
    websiteRoot,
    URL_ROOT,
    DEFAULT_HEADERS,
    isApplicationServer,
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
logger.info(`Starting ${FILENAME} (${isApplicationServer ? 'Application' : 'Static'}) in ${execModeString} mode.`);

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

const linkify = (path: string) => path.startsWith('https://') || path.startsWith('http://')
    ? path
    : `https://${websiteRoot}${path}`;

const linkifyStatic = (path: string) => `https://${staticServerUrlAuthority}${path}`;

// Load Pug Templates
await widgets.loadTemplates("../pug");
const pugOptions = {
    basedir: "../pug",
    linkify,
    linkifyStatic,
} as pug.Options & pug.LocalsObject;

const supportedTimelineNotesRootFragments: string[] = ["dnd", "thoughts"];

// Initialize dnd/ian-oota Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/ian-oota/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/ian-oota",
    plugins: ["dnd-api"],
    pugVariables: pugOptions,
});
// Initialize dnd/jay-waterdeep Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/jay-waterdeep/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/jay-waterdeep",
    plugins: ["dnd-api"],
    pugVariables: pugOptions,
});
// Initialize dnd/jp-icewind Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/jp-icewind/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/jp-icewind",
    plugins: ["dnd-api"],
    pugVariables: pugOptions,
});

// Initialize dnd/ian-theros Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/ian-theros/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/ian-theros",
    plugins: ["dnd-api"],
    pugVariables: pugOptions,
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
    pugVariables: pugOptions,
});

// Initialize dnd/ian-strahd Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "dnd/ian-strahd/widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "dnd/ian-strahd",
    plugins: ["dnd-api"],
    pugVariables: pugOptions,
});

// Initialize `thoughts/software` Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "thoughts/software/src"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "thoughts/software",
    plugins: [],
    pugVariables: pugOptions,
});

// Initialize `thoughts/politics` Notes Widgets
await widgets.init({
    widget_directory: Path.join(runOpts.pubpath, "thoughts/politics/src"),
    preload_widgets: true,
    lazy_load_allowed: true,
    web_root: "thoughts/politics",
    plugins: [],
    pugVariables: pugOptions,
});

// Init file manager
fm.init(runOpts, pugOptions, DEFAULT_HEADERS, logger);
await fm.load(exec_path);

// Img Dir
imgDir.init((() => {
    const pugFn = widgets.getPugTemplate("img_dir");
    return (args?: pug.LocalsObject) => pugFn({...pugOptions, ...args})
})(), consts);

const port = runOpts.port || 8089;

type DenoServeOpts = (Deno.ServeTcpOptions | (Deno.ServeTcpOptions & Deno.TlsCertifiedKeyPem))
    & Deno.ServeInit<Deno.NetAddr>;
// Whether or not to use HTTPS on webserver
const useSecure = runOpts.key && runOpts.cert;

const serverTslOpts: Deno.TlsCertifiedKeyPem | undefined = useSecure
    ? await (async () => {
        const keyPromise = Deno.readTextFile(runOpts.key);
        const certPromise = Deno.readTextFile(runOpts.cert);
        const [key, cert] = await Promise.all([keyPromise, certPromise]);
        return { key, cert };
    })()
    : undefined;

if (useSecure) {
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

Deno.serve({
    ...serverTslOpts,
    port,
    onListen: (addr) => logger.info(
        "Server '%s' listening on %s:%s (%s)",
        isApplicationServer ? 'Application' : 'Static',
        addr.hostname,
        addr.port,
        addr.transport),
    onError: (err) => {
        logger.error(err);
        return new Response("An unexpected server error occurred.", {
            status: 500,
        })
    },
    handler: (req, _info) => {
        return respond(req);
    }
})

const getDirectoriesOrHtml = (source: PathLike) =>
    fs
        .readdirSync(source, { withFileTypes: true })
        // .filter(dirent => dirent.isDirectory() || dirent.name.endsWith(".html"))
        .map((dirent) => dirent.name);

const dirIndexPug = widgets.getPugTemplate("dir_list");

// function response(status: number, )

enum RequestMethod
{
    GET = 'GET',
    POST = 'POST',
    PATCH = 'PATCH',
    DELETE = 'DELETE',
    PUT = 'PUT',
}

/**
 * Request Handler / Response Generator
 */
async function respond(
    req: Request,
): Promise<Response> {
    if (req.method !== RequestMethod.GET) {
        return new Response("Not Found", { status: 404 });
    }
    const reqUrl = new URL(req.url, URL_ROOT);
    const path = decodeURIComponent(reqUrl.pathname);
    const query = reqUrl.search;

    const resHeaders: { [key in HeaderKey]?: string } = {
        "Content-Type": "text/html; charset=utf-8",
    };

    if (runOpts.static) {
        resHeaders['Access-Control-Allow-Origin'] = '*';
    } 

    if (path.includes("dotnet/files.json")) {
        const reportFiles = await getDirReportFiles(
            `${exec_path}/benchmarks/dotnet`
        );

        resHeaders['Cache-Control'] = "max-age=900";
        return ok(
            JSON.stringify(reportFiles),
            resHeaders
        );
    }

    const requestedFile = fm.getFile(path);
    // Set content length header, if requested file is found by file manager.
    if (requestedFile) {
        requestedFile.headers['Content-Length'] = Buffer.byteLength(
            requestedFile.data,
            "utf8"
        ).toString();
    }

    // Try widget
    if (!requestedFile) {
        const response = widgets.handleRequest(
            req,
            supportedTimelineNotesRootFragments
        );
        if (response) {
            return response;
        }
    }
    if (!requestedFile && path.startsWith("/3d")) {
        try {
            const response = await imgDir.handleRequest(
                reqUrl.pathname,
                reqUrl.search
            );
            if (response) {
                return response;
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
            const fileStat = (await Deno.stat(fpath));
            if (fileStat.isFile) {
                return await serveFile(req, fpath)
            } else if (fileStat.isDirectory) {
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
                return ok(
                    dirIndexPug(opts),
                    resHeaders
                )
            }
        } catch (error) {
            logger.warn(error);
        }
    }

    // Send successful response
    if (requestedFile) {
        const resHeaders2 =
            runOpts.static
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
                    'Access-Control-Allow-Origin': "*",
                }
                : requestedFile.headers;

            return ok(requestedFile.data, resHeaders2 as any)
    }

    // Handle 404
    return handle404(req.url);
}

const pug404 = widgets.getPugTemplate("404")(pugOptions);
function handle404(url: string) {
    logger.warn(`404 Not Found: ${url}`);
    if (runOpts.static) {
        return notFound();
    } else {
        return new Response(pug404, {
            status: 404,
            headers: {
                'Content-Type': "text/html; charset=utf-8"
            },
          });
    }
}
