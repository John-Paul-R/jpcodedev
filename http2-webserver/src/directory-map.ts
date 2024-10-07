import { readJson } from "@x/jsonfile";
import { ensureFile } from "@std/fs";
import stringify from "json-stable-stringify";
import Path, { FormatInputPathObject, ParsedPath } from "node:path";
import { walk } from "@std/fs/walk";
import type { Header } from "@std/http/unstable-header";

type AliasesEntry = {
    urls: string[];
    destination: string;
};

type DirEntry = { [key: string]: DirectoryMapEntry };
type FileEntry =
    & { headers: Record<Header, string> }
    & { [key in string]?: unknown };
type DirectoryMapEntry = DirEntry | FileEntry;

export { DirectoryMap };
export default class DirectoryMap {
    static map_filename = "directory-map.json";
    static aliases_filename = "aliases.json";
    map_path: string;
    ignoreTerms: string[];
    private _urls: Map<string, number>;
    private _destinations: string[];
    loaded: boolean;
    private _dirmap: DirEntry;
    constructor(map_path: string, arrIgnoreTerms: string[]) {
        this.map_path = map_path;
        this.ignoreTerms = arrIgnoreTerms;
        this._urls = new Map<string, number>();
        this._destinations = [];
        this.loaded = false;
        this._dirmap = {};
    }

    async load() {
        const config_file_path = Path.join(
            this.map_path,
            DirectoryMap.aliases_filename,
        );
        await ensureFile(config_file_path);
        let configRaw: AliasesEntry[];
        try {
            configRaw = await readJson(config_file_path);
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
    async loadDirmap() {
        const dirmapFilePath = Path.join(
            this.map_path,
            DirectoryMap.map_filename,
        );
        let existingDirmap: DirEntry;
        try {
            existingDirmap = await readJson(dirmapFilePath);
        } catch (err) {
            existingDirmap = {};
            console.warn(
                "No dirmap file was found. Creating default based on supplied pubpath.",
            );
            console.warn(err);
        }

        const dirmap = {};

        console.info("--- LOAD DIRMAP START ---");
        if (!(await Deno.stat(this.map_path)).isDirectory) {
            console.warn(
                `No directory found at pubpath '${this.map_path}'. Ensure that the path to the directory is correct and that the directory is not empty.`,
            );
            return;
        }
        for await (
            const dirEntry of walk(this.map_path, {
                includeDirs: true,
                includeFiles: false,
            })
        ) {
            // Handle/Initialize directories
            if (filterIgnore(dirEntry.path, this.ignoreTerms)) {
                const dirPathFrags = Path.relative(
                    this.map_path,
                    Path.dirname(dirEntry.path),
                ).split(Path.sep);
                const name = Path.basename(dirEntry.path);
                const dir = dirmapResolvePath(
                    existingDirmap,
                    dirPathFrags,
                );
                const newDir = dirmapResolvePath(dirmap, dirPathFrags);
                newDir[name] = dir[name] || {};
            }
        }

        for await (
            const fileEntry of walk(this.map_path, {
                includeFiles: true,
                includeDirs: false,
            })
        ) {
            const relPath = Path.parse(
                Path.relative(this.map_path, fileEntry.path),
            );
            const dirPathFrags = relPath.dir.split(Path.sep);

            const dir = dirmapResolvePath(existingDirmap, dirPathFrags);

            // Add file to directory entry if not already there
            const newDir = dirmapResolvePath(dirmap, dirPathFrags);
            newDir[relPath.base] = dir[relPath.base] || {};
        }

        this._dirmap = dirmap;
        console.info(`Writing dirmap to ${dirmapFilePath}...`);
        Deno.writeTextFileSync(
            dirmapFilePath,
            stringify(dirmap, {
                space: 2,
            }),
            {
                create: true,
                append: false,
            },
        );
        console.info("--- LOAD DIRMAP END ---");
    }

    _get(requestPath: FormatInputPathObject) {
        const path = Path.format(requestPath);
        const idx = this._urls.get(path);
        if (idx === undefined) {
            console.error(
                `ERR, directory-map failed to retrieve data for requested path '${path}')`,
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
            const frags = Path.format(requestPath).split(Path.sep).slice(1);
            // if (frags.length === 0) {
            //     return this._dirmap;
            // }
            const dir = dirmapResolvePath(
                this._dirmap,
                frags,
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
            if (this.loaded) {
                console.error(
                    "Attempted to retrieve ServableConfig info before the object was initialized. Use ServableConfig.load()!",
                );
            } else console.error(err);
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
    cDirObj: DirectoryMapEntry,
    subdirs: string[],
): DirectoryMapEntry {
    // TODO! Not strictly correct, should add a discriminator so we can know the
    // right type.
    const nDirObj = (cDirObj as DirEntry)[subdirs[0]];
    if (nDirObj) return dirmapResolvePath(nDirObj, subdirs.slice(1));
    else return cDirObj;
}
// TODO Purge files that no longer exist from dirmap on load.
