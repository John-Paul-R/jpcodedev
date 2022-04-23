import http2, { OutgoingHttpHeaders } from "http2";
import fs, { PathLike } from "fs";
import Mime from "mime";
import dir from "node-dir";
import Path from "path";
import pug from "pug";
import DirectoryMap from "./directory-map";
import { JPServerOptions } from "./http2server2.1";
import * as widgets from "./timeline-notes";
import { Logger } from "./node_modules/log4js/types/log4js";

const {
    // HTTP2_HEADER_METHOD,
    // HTTP2_HEADER_PATH,
    // HTTP2_HEADER_STATUS,
    HTTP2_HEADER_CONTENT_TYPE,
    // HTTP2_HEADER_LINK,
    // HTTP2_HEADER_ACCEPT_ENCODING,
    HTTP2_HEADER_CONTENT_LENGTH,
    HTTP2_HEADER_LAST_MODIFIED,
    HTTP2_HEADER_CACHE_CONTROL,
    // HTTP2_HEADER_CONTENT_ENCODING,
} = http2.constants;

let logger: Logger;
let runOpts: JPServerOptions;
let pugOptions: pug.Options & pug.LocalsObject;
let defaultHeaders: OutgoingHttpHeaders;
let isLogVerbose = false;
const init = (
    rOpts: JPServerOptions,
    pugOpts: pug.Options & pug.LocalsObject,
    defHeaders: OutgoingHttpHeaders,
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
    data: object;
};

type FileInfo = {
    absPath: PathLike;
    data: string | Buffer;
    fileName: string;
    headers: OutgoingHttpHeaders;
};

function loadFiles(dir_path: PathLike) {
    const files = new Map<string, FileInfo>();
    logger.info("Load Site Files..");
    const dirPath = dir_path.toString();
    dir.files(dirPath.toString(), (err: any, arrFilePaths: string[]) => {
        if (arrFilePaths) {
            arrFilePaths.forEach(preloadFiles);
        } else {
            logger.warn(
                `No files found in pubpath '${dirPath}'. Ensure that the path to the directory is correct and that the directory is not empty.`
            );
        }
    });

    /**
     * Load files into memory
     */
    function preloadFiles(filePath: string) {
        if (filePath.includes(".git")) return;

        const tempPath = Path.parse("/" + Path.relative(dirPath, filePath));
        const relFilePath = Path.format(tempPath);

        const fileDescriptor = fs.openSync(filePath, "r");
        const fileStats = fs.fstatSync(fileDescriptor);
        let fileContents: Buffer | string = fs.readFileSync(fileDescriptor, {
            flag: "r",
        });
        fs.closeSync(fileDescriptor);

        const contentType = Mime.getType(relFilePath);
        if (isLogVerbose) console.log(tempPath.base, contentType);

        let headers = {
            [HTTP2_HEADER_CONTENT_LENGTH]: fileStats.size,
            [HTTP2_HEADER_LAST_MODIFIED]: fileStats.mtime.toUTCString(),
            [HTTP2_HEADER_CONTENT_TYPE]: contentType ?? "text/raw",
        } as OutgoingHttpHeaders;

        function pugCompileJson(jsonContents: JpPugConfig) {
            const template = widgets.getPugTemplate(jsonContents.template);
            return template(jsonContents.data);
        }

        let shouldOverwiteDefaultHeaders = false;
        if (filePath.endsWith(".html")) {
            Object.assign(headers, defaultHeaders);
        } else if (filePath.endsWith(".pug.json")) {
            // Data files to be inserted into pug templates. (My thing)
            const jsonContents = JSON.parse(
                fileContents.toString()
            ) as JpPugConfig;
            try {
                fileContents = pugCompileJson(jsonContents);
            } catch (err) {
                logger.error(err);
                return null;
            }
            shouldOverwiteDefaultHeaders = true;
        } else if (filePath.endsWith(".pug")) {
            fileContents = pug.render(fileContents.toString(), pugOptions);
            shouldOverwiteDefaultHeaders = true;
        }

        if (shouldOverwiteDefaultHeaders) {
            const resHeaders = { ...defaultHeaders } as OutgoingHttpHeaders;
            resHeaders[HTTP2_HEADER_CONTENT_TYPE] = "text/html; charset=utf-8";
            resHeaders[HTTP2_HEADER_LAST_MODIFIED] =
                headers[HTTP2_HEADER_LAST_MODIFIED];
            headers = resHeaders;
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
            const headerOverrides = fileInfo.headers;
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
            out.headers[
                HTTP2_HEADER_CACHE_CONTROL
            ] = `max-age=${runOpts.maxAge}`;
        }
    } else {
        out = null;
    }

    function logErr(err: any) {
        logger.error("Error retrieving file: " + adjustedPath);
        logger.error(err);
    }

    return out;
}

/**
 * @param {string} root_dir The directory to index / load files from
 */
function load(root_dir: string) {
    _files = loadFiles(root_dir);
    directory_map = new DirectoryMap(root_dir, [".git", ".well-known"]);
    directory_map.loadDirmap();
    directory_map.load();
    console.log(directory_map);
}

export { init, load, getFile };
