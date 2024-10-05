import { PathLike } from "node:fs";
import Mime from "mime";
import Path from "node:path";
import pug from "pug";
import DirectoryMap from "./directory-map.ts";
import type { JPServerOptions } from "./http2server2.1.ts";
import * as widgets from "./timeline-notes.ts";
import { Logger } from "log4js";
import { walk } from "@std/fs/walk";
import { JsonParseStream } from "@std/json/parse-stream";
import type { Header } from "@std/http/unstable-header";

let logger: Logger;
let runOpts: JPServerOptions;
let pugOptions: pug.Options & pug.LocalsObject;
let defaultHeaders: OutgoingHeaders;
let isLogVerbose = false;
const init = (
    rOpts: JPServerOptions,
    pugOpts: pug.Options & pug.LocalsObject,
    defHeaders: OutgoingHeaders,
    lgr: Logger
) => {
    runOpts = rOpts;
    logger = lgr;
    pugOptions = pugOpts;
    defaultHeaders = defHeaders;
    isLogVerbose = runOpts.log === "verbose";
};

type JpPugConfig = {
    template: string;
    data: Record<string, unknown>;
};

export type OutgoingHeaders = { [key in Header]?: string } & Partial<Record<string, string>>;

type FileInfo = {
    absPath: PathLike;
    data: Uint8Array | string;
    fileName: string;
    headers: OutgoingHeaders;
};

async function loadFiles(dir_path: PathLike) {
    const files = new Map<string, FileInfo>();
    logger.info("Load Site Files..");
    const dirPath = dir_path.toString();
    for await (const entry of walk(dirPath)) {
        await preloadFiles(entry.path);
    }

    /**
     * Load files into memory
     */
    async function preloadFiles(filePath: string) {
        if (filePath.includes(".git")) return;

        const tempPath = Path.parse("/" + Path.relative(dirPath, filePath));
        const relFilePath = Path.format(tempPath);

        const fileDescriptor = await Deno.open(filePath, {read: true});
        const fileStats = await fileDescriptor.stat();
        if (fileStats.isDirectory) {
            fileDescriptor.close();
            return; // we're recursing dirs, so skip
        }
        
        // let fileContents: Uint8Array | string = new Uint8Array(fileStats.size);
        // await fileDescriptor.readable.(fileContents);


        const contentType = Mime.getType(relFilePath);
        if (isLogVerbose) console.log(tempPath.base, contentType);

        let headers: OutgoingHeaders = {
            "Content-Length": fileStats.size.toString(),
            "Last-Modified": fileStats.mtime?.toUTCString(),
            "Content-Type": contentType ?? "text/raw",
        };

        function pugCompileJson(jsonContents: JpPugConfig) {
            const template = widgets.getPugTemplate(jsonContents.template);
            return template({...pugOptions, ...jsonContents.data });
        }

        let fileContents: string | undefined;
        let shouldOverwiteDefaultHeaders = false;
        if (filePath.endsWith(".html")) {
            Object.assign(headers, defaultHeaders);
        } else if (filePath.endsWith(".pug.json")) {
            // Data files to be inserted into pug templates. (My thing)
            const jsonContents = (await Array.fromAsync(
                fileDescriptor.readable
                    .pipeThrough(new TextDecoderStream())
                    .pipeThrough(new JsonParseStream())
            ))[0] as JpPugConfig;

            try {
                fileContents = pugCompileJson(jsonContents);
            } catch (err) {
                logger.error(err);
                return null;
            }
            shouldOverwiteDefaultHeaders = true;
        } else if (filePath.endsWith(".pug")) {
            const textContent = (await Array.fromAsync(
                fileDescriptor.readable
                    .pipeThrough(new TextDecoderStream())
            ))[0] as string;

            fileContents = pug.render(textContent, pugOptions);
            shouldOverwiteDefaultHeaders = true;
        }

        if (shouldOverwiteDefaultHeaders) {
            const resHeaders: OutgoingHeaders = { ...defaultHeaders };
            resHeaders['Content-Type'] = "text/html; charset=utf-8";
            resHeaders["Last-Modified"] = headers["Last-Modified"];
            headers = resHeaders;
        }

        if (fileContents === undefined) {
            fileContents = (await Array.fromAsync(
                fileDescriptor.readable
                    .pipeThrough(new TextDecoderStream())
            ))[0] as string;
        }

        files.set(`${relFilePath}`, {
            absPath: filePath,
            data: fileContents,
            fileName: relFilePath,
            headers: headers,
        });
    }

    return files;
}

let directory_map: DirectoryMap;
let _files: Map<string, FileInfo>;

/**
 * Get file to serve response.
 */
function getFile(reqPath: string) {
    let out;
    const adjustPath = (path: string) => {
        if (path !== "/") path = path.slice(1);
        return path;
    };
    const adjustedPath = adjustPath(reqPath);
    let rpath = Path.parse(reqPath);

    let fileObj: FileInfo | undefined;

    const alias_destination = directory_map.getItemConfig(rpath);
    if (alias_destination) {
        rpath = Path.parse(alias_destination);
    }
    let fileInfo = directory_map.get(rpath);

    try {
        fileObj = _files.get(Path.format(rpath));
    } catch (err) {
        logErr(err);
    }

    function ifIncludes(f_name: string, keyList: string[], ext = "") {
        const name = f_name + ext;
        if (keyList.includes(name)) {
            const idxPath = Path.parse(Path.join(Path.format(rpath), name));
            fileInfo = directory_map.get(idxPath);
            fileObj = _files.get(Path.format(idxPath));
            // console.log(!fileObj, Path.format(idxPath), fileInfo)
            return true;
        }
        return false;
    }

    // Try some default files for directories
    if (!fileObj && fileInfo) {
        try {
            const keyList = Object.keys(fileInfo);
            // console.log("KEY-LIST", keyList)
            const file_names = ["index", Path.basename(adjustedPath)];
            const extensions = [".html", ".pug.json", ".pug"];
            found: for (let i = 0; i < file_names.length; i++) {
                for (let j = 0; j < extensions.length; j++) {
                    if (ifIncludes(file_names[i], keyList, extensions[j])) {
                        break found;
                    }
                }
            }
        } catch (err) {
            logErr(err);
        }
    }
    if (fileObj) {
        const headers = fileObj.headers;
        if (fileInfo) {
            const headerOverrides = fileInfo;
            console.log(
                fileObj.fileName,
                JSON.stringify({ ...fileObj, data: undefined }),
                JSON.stringify(fileInfo)
            );

            if (fileObj.fileName.startsWith("bundle")) {
                console.log(
                    fileObj.fileName,
                    JSON.stringify({ ...fileObj, data: undefined }),
                    JSON.stringify(fileInfo)
                );
            }
            if (headerOverrides) {
                for (const key in headerOverrides) {
                    headers[key] = headerOverrides[key];
                }
            }
        }

        out = {
            headers: headers,
            data: fileObj.data,
        };
        // console.log("OUT", out);
        if (runOpts.maxAge) {
            out.headers['Cache-Control'] =
                out.headers['Cache-Control'] ??
                `max-age=${runOpts.maxAge}`;
        }
    } else {
        out = null;
    }

    function logErr(err: unknown) {
        logger.error("Error retrieving file: " + adjustedPath);
        logger.error(err);
    }

    return out;
}

/**
 * @param {string} root_dir The directory to index / load files from
 */
async function load(root_dir: string) {
    _files = await loadFiles(root_dir);
    directory_map = new DirectoryMap(root_dir, [".git", ".well-known"]);
    await directory_map.loadDirmap();
    await directory_map.load();
    // console.log(directory_map);
}

export { init, load, getFile };
