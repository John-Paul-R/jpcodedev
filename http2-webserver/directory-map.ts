import fs from "fs-extra";
import Path, { ParsedPath } from "path";
import dirUtil from "node-dir";
import stringify from "json-stable-stringify";
import { FormatInputPathObject } from "path/win32";
import { OutgoingHttpHeader } from "http";
import { OutgoingHttpHeaders } from "http2";

type AliasesEntry = {
    urls: string[];
    destination: string;
};

// This type is only accurate for leaf nodes.
type DirectoryMapEntry = OutgoingHttpHeaders;
// {
//     headers?: OutgoingHttpHeader[];
// };

export default class DirectoryMap {
    static map_filename = "directory-map.json";
    static aliases_filename = "aliases.json";
    map_path: string;
    ignoreTerms: string[];
    private _urls: Map<string, number>;
    private _destinations: string[];
    loaded: boolean;
    private _dirmap: {};
    config: any;
    constructor(map_path: string, arrIgnoreTerms: string[]) {
        this.map_path = map_path;
        this.ignoreTerms = arrIgnoreTerms;
        this._urls = new Map<string, number>();
        this._destinations = [];
        this.loaded = false;
        this._dirmap = {};
    }

    load() {
        const config_file_path = Path.join(
            this.map_path,
            DirectoryMap.aliases_filename
        );
        fs.ensureFileSync(config_file_path);
        let configRaw: AliasesEntry[];
        try {
            configRaw = JSON.parse(
                fs.readFileSync(config_file_path).toString()
            );
        } catch (err) {
            console.warn(`Could not load aliases file: ${config_file_path}`);
            console.error(err);
            configRaw = [];
        }

        this._urls.clear();
        const destinations = [];
        let idx = 0;
        for (const el of configRaw) {
            for (const url of el.urls) {
                this._urls.set(Path.format(Path.parse(url)), idx);
                console.log(this._urls.has(Path.format(Path.parse(url))));
            }
            destinations.push(el.destination);

            idx++;
        }
        this._destinations = destinations;
        this.loaded = true;
    }
    loadDirmap() {
        const dirmapFilePath = Path.join(
            this.map_path,
            DirectoryMap.map_filename
        );
        let existingDirmap: {};
        try {
            existingDirmap = JSON.parse(
                fs.readFileSync(dirmapFilePath).toString()
            );
        } catch (err) {
            existingDirmap = {};
            console.warn(
                "No dirmap file was found. Creating default based on supplied pubpath."
            );
            console.warn(err);
        }

        const dirmap = {};
        dirUtil.paths(this.map_path, (err, objPaths) => {
            console.info("--- LOAD DIRMAP START ---");
            if (!objPaths) {
                console.warn(
                    `No files found in pubpath '${this.map_path}'. Ensure that the path to the directory is correct and that the directory is not empty.`
                );
                return;
            }

            // Handle/Initialize directories
            const dirs = objPaths.dirs;
            if (dirs) {
                for (const dirPath of dirs) {
                    if (filterIgnore(dirPath, this.ignoreTerms)) {
                        const dirPathFrags = Path.relative(
                            this.map_path,
                            Path.dirname(dirPath)
                        ).split(Path.sep);
                        const name = Path.basename(dirPath);
                        const dir = dirmapResolvePath(
                            existingDirmap,
                            dirPathFrags
                        );
                        const newDir = dirmapResolvePath(dirmap, dirPathFrags);
                        newDir[name] = dir[name] || {};
                    }
                }
            }

            const files = objPaths.files;
            for (const filePath of files) {
                const relPath = Path.parse(
                    Path.relative(this.map_path, filePath)
                );
                const dirPathFrags = relPath.dir.split(Path.sep);

                const dir = dirmapResolvePath(existingDirmap, dirPathFrags);

                // Add file to directory entry if not already there
                const newDir = dirmapResolvePath(dirmap, dirPathFrags);
                newDir[relPath.base] = dir[relPath.base] || {};
            }

            this._dirmap = dirmap;
            console.info(`Writing dirmap to ${dirmapFilePath}...`);
            fs.writeFileSync(
                dirmapFilePath,
                stringify(dirmap, {
                    space: 2,
                }),
                {
                    encoding: "utf8",
                    flag: "w+",
                }
            );
            console.info("--- LOAD DIRMAP END ---");
        });
    }
    _get(requestPath: FormatInputPathObject) {
        const idx = this._urls.get(Path.format(requestPath));
        if (idx === undefined) {
            console.error(
                `ERR, directory-map failed to retrieve data for requested path ${requestPath} (${Path.format(
                    requestPath
                )})`
            );
            return undefined;
        }
        return this._destinations[idx];
    }
    /**
     * Gets the dirmap entry for the file specified by the provided path.
     * If this entry cannot be found, it attempts to return the entry for its parent (not recursively).
     */
    get(requestPath: ParsedPath): DirectoryMapEntry | undefined {
        try {
            const dir = dirmapResolvePath(
                this._dirmap,
                Path.format(requestPath).split(Path.sep).slice(1)
            );
            // console.log("GETMETHOD", dir, requestPath.base, dir[requestPath.base], Path.format(requestPath));
            return (dir[requestPath.base] || (dir as unknown)) as
                | DirectoryMapEntry
                | undefined;
        } catch (err) {
            console.warn(requestPath);
            console.warn(err);
            return undefined;
        }
    }
    // TODO Fix server crash on non-existant widget ex: https://www.jpcode.dev/dnd/ian-oota/(ign)template%20structure.md
    getItemConfig(requestPath: ParsedPath) {
        let out;

        try {
            out = this._get(requestPath);
        } catch (err) {
            if (this.loaded)
                console.error(
                    "Attempted to retrieve ServableConfig info before the object was initialized. Use ServableConfig.load()!"
                );
            else console.error(err);
        }

        return out;
    }
}

function filterIgnore(path: string, ignoreTerms: string[]) {
    for (const term of ignoreTerms) {
        if (path.includes(term)) return false;
    }
    return true;
}

function dirmapResolvePath(
    cDirObj: { [key: string]: {} },
    subdirs: string[]
): { [key: string]: {} } {
    const nDirObj = cDirObj[subdirs[0]];
    if (nDirObj) return dirmapResolvePath(nDirObj, subdirs.slice(1));
    else return cDirObj;
}
exports.DirectoryMap = DirectoryMap;
// TODO Purge files that no longer exist from dirmap on load.
