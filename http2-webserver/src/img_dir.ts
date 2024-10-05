/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import fs from "node:fs";
import Path from "node:path";
import pug from "pug";

import { notFound } from "@http/response/not-found";
import { ok } from "@http/response/ok";
import { readJson } from "@x/jsonfile";
import { Buffer } from "node:buffer";
import { promisify } from "node:util";
import log4js from "npm:log4js";
import { JPServerConsts } from "./http2server2.1.ts";
import type { OutgoingHeaders } from "./files-manager.ts";

let imgDirPug: pug.compileTemplate;
let consts: JPServerConsts;
const logger = log4js.getLogger("img_dir");
let IMG_DIR: string;
let files: { curatedConfig: any; stats: any };
const readdir = promisify(fs.readdir);

function assertIsStringIndexableObject(v: unknown): asserts v is Record<string, unknown> {
    if (typeof v !== 'object') {
        throw new Error("Expected an 'object', got a " + typeof v);
    }
}

const getImageFiles = async (source: string) => {
    const file_end_len = "-thumb.webp".length;
    const statsFile = await readJson(Path.join(source, "_stats.json"));
    assertIsStringIndexableObject(statsFile);

    const dirEntries = await readdir(source, { withFileTypes: true });
    return  dirEntries
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
        })
        .sort((a, b) => b.dateModified - a.dateModified);
};

function init(
    pugFunction: pug.compileTemplate,
    constants: JPServerConsts,
) {
    imgDirPug = pugFunction;
    consts = constants;
    IMG_DIR = Path.join(consts.exec_path, "/img/3d");
    console.log("IMG_DIR", IMG_DIR);

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

async function handleRequest(
    path: string,
    _query: string
): Promise<Response | undefined> {
    const isStatic = consts.websiteRoot.startsWith("static.");
    const validPaths = ["/3d", "/3d/all"];
    const parsedPath = stripTrailingSlash(path);
    if (parsedPath === "/3d") {
        return viewSpecified(path);
    } else {
        if (!isStatic) {
            if (validPaths.includes(parsedPath)) {
                return await reverseProxy(path);
            }
        } else {
            if (parsedPath === "/3d/all") {
                await viewAll();
            }
        }
    }
    return undefined;
}

// FIXME @jp: oh, this is going to be... ew.. without streams access
function reverseProxy(path: string): Promise<Response> {
    logger.log("pinging static server...");    
    return fetch(`https://static.jpcode.dev:443/${path}`)
        .then((rb) => {
            const reader = rb.body?.getReader();
            if (reader === undefined) {
                return undefined;
            }
        
            return new ReadableStream({
                start(controller) {
                    // The following function handles each data chunk
                    function push() {
                        // "done" is a Boolean and value a "Uint8Array"
                        reader!.read().then(({ done, value }) => {
                            // If there is no more data to read
                            if (done) {
                            console.log("done", done);
                            controller.close();
                            return;
                            }
                            // Get the data and send it to the browser via the controller
                            controller.enqueue(value);
                            // Check chunks by logging to the console
                            console.log(done, value);
                            push();
                        });
                    }
            
                    push();
                },
            });
        })
        .then((stream) => stream === undefined
            ? notFound()
            : new Response(stream, { headers: { "Content-Type": "text/html" } }),
        )
}

async function viewAll(): Promise<Response> {
    const imgFiles = await getImageFiles(IMG_DIR);
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

    return ok(imgDirPug({ cards: images }))
}

function viewSpecified(path: string) {
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
    const headers: OutgoingHeaders = {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": Buffer.byteLength(data).toString(),
    };
    Object.assign(headers, consts.DEFAULT_HEADERS);
    // @ts-expect-error holy hell these types are from hell
    return ok(data, headers);
}

export { handleRequest, init };

