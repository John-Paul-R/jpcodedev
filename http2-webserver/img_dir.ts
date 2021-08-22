import Path from "path";
import fs from "fs";
import { request } from "https";
import pug from "pug";

import { JPServerConsts } from "./http2server2.1";
import { Logger } from "log4js";
import { IncomingHttpHeaders, ServerHttp2Stream } from "http2";

let imgDirPug: pug.compileTemplate;
let consts: JPServerConsts;
let logger;
let IMG_DIR: string;
let files: { curatedConfig: any; stats: any };

const getImageFiles = (source: string) => {
    const file_end_len = "-thumb.webp".length;
    const statsFile = JSON.parse(
        fs.readFileSync(Path.join(source, "_stats.json")).toString()
    );
    let out = fs
        .readdirSync(source, { withFileTypes: true })
        .filter(
            (dirent) =>
                dirent.isFile() && dirent.name.endsWith("-wm-thumb.webp")
        )
        .map((dirent) => {
            const baseName = dirent.name.slice(
                0,
                dirent.name.length - file_end_len - 3
            );
            return {
                name: baseName,
                fileName: dirent.name.slice(
                    0,
                    dirent.name.length - file_end_len
                ),
                dateModified: statsFile[baseName],
            };
        });

    out = out.sort((a, b) => b.dateModified - a.dateModified);

    return out;
};

function init(
    pugFunction: pug.compileTemplate,
    constants: JPServerConsts,
    lgr: Logger
) {
    imgDirPug = pugFunction;
    consts = constants;
    IMG_DIR = Path.join(consts.exec_path, "/img/3d");
    console.log("IMG_DIR", IMG_DIR);
    logger = lgr;

    if (consts.websiteRoot.startsWith("www.")) {
        const baseDir = Path.join(consts.exec_path, "3d");
        files = {
            stats: JSON.parse(
                fs.readFileSync(Path.join(baseDir, "_stats.json")).toString()
            ),
            curatedConfig: JSON.parse(
                fs.readFileSync(Path.join(baseDir, "index.pug.json")).toString()
            ),
        };
    }
}
const stripTrailingSlash = (str: string) => {
    return str.endsWith("/") ? str.slice(0, -1) : str;
};

function handleRequest(
    stream: ServerHttp2Stream,
    headers: IncomingHttpHeaders,
    path: string,
    query: string
) {
    const isStatic = consts.websiteRoot.startsWith("static.");
    const validPaths = ["/3d", "/3d/all"];
    const parsedPath = stripTrailingSlash(path);
    if (parsedPath === "/3d") {
        viewSpecified(stream, path);
    } else {
        if (!isStatic) {
            if (validPaths.includes(parsedPath)) reverseProxy(stream, path);
        } else {
            if (parsedPath === "/3d/all") viewAll(stream);
        }
    }

    return 0;
}

function reverseProxy(stream: ServerHttp2Stream, path: string) {
    console.log("pinging static server...");
    const req = request(
        {
            hostname: "static.jpcode.dev",
            path: path,
            port: 443,
            protocol: "https:",
            method: "GET",
        },
        (res) => {
            res.setEncoding("utf8");
            const headers = {
                "content-type": "text/html; charset=utf-8",
                ":status": 200,
            };
            Object.assign(headers, consts.DEFAULT_HEADERS);

            stream.respond(headers);

            console.log(`STATUS: ${res.statusCode}`);
            res.on("data", (chunk) => {
                stream.write(chunk);
            });
            res.on("end", () => {
                stream.end();
            });
        }
    );
    req.end();
}

function viewAll(stream: ServerHttp2Stream) {
    const imgFiles = getImageFiles(IMG_DIR);
    const images = [];
    for (const imgFile of imgFiles) {
        const base = Path.join("img/3d", imgFile.fileName);
        const date = new Date(imgFile.dateModified);
        date.setUTCSeconds(imgFile.dateModified);
        images.push({
            preview: new URL(`${base}-thumb.webp`, consts.URL_ROOT).toString(),
            link: new URL(`${base}.webp`, consts.URL_ROOT).toString(),
            dateString: date.toLocaleString(),
            title: imgFile.name,
        });
    }

    stream.write(imgDirPug({ cards: images }));
    stream.end();
}

/**
 *
 * @param {import('http2').Http2Stream} stream
 * @param {*} path
 */
function viewSpecified(stream: ServerHttp2Stream, path: string) {
    console.log("View Specified");
    const configData = files.curatedConfig;
    const fileStats = files.stats;
    const imgFileNames = configData.data.cards;
    const images = [];
    const staticURL = "https://static.jpcode.dev";
    for (const imgFileInfo of imgFileNames) {
        const base = Path.join("img/3d", imgFileInfo.basename);

        const date = new Date(0);
        date.setUTCSeconds(fileStats[imgFileInfo.basename]);
        images.push({
            preview: new URL(`${base}-wm-thumb.webp`, staticURL).toString(),
            link: new URL(`${base}-wm.webp`, staticURL).toString(),
            dateString: date.toLocaleString(),
            title: imgFileInfo.displayName,
        });
    }
    const data = imgDirPug({ cards: images });
    const headers = {
        "content-type": "text/html; charset=utf-8",
        "content-length": Buffer.byteLength(data),
        ":status": 200,
    };
    Object.assign(headers, consts.DEFAULT_HEADERS);
    stream.respond(headers);
    stream.end(data);
}

export { init, handleRequest };
