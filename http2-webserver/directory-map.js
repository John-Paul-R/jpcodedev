
const fs = require('fs-extra');
const Path = require('path').posix; 
const dirUtil = require('node-dir');

class DirectoryMap {

    static map_filename = "directory-map.json";
    static aliases_filename = "aliases.json";
    constructor(map_path, arrIgnoreTerms) {
        this.map_path = map_path;
        this.ignoreTerms = arrIgnoreTerms;
    }

    load() {
        const config_file_path = Path.join(this.map_path, DirectoryMap.aliases_filename);
        fs.ensureFileSync(config_file_path);
        let configRaw;
        try {
            configRaw = JSON.parse(fs.readFileSync(config_file_path));
        } catch (err) {
            console.warn(`Could not load aliases file: ${config_file_path}`);
            console.error(err);
            configRaw = [];
        }

        const urls = new Map();
        const destinations = [];
        let idx = 0;
        for (const el of configRaw) {
            
            for (const url of el.urls) {
                urls.set(Path.format(Path.parse(url)), idx);
                console.log(urls.has(Path.format(Path.parse(url))));
            }
            destinations.push(el.destination);
            
            idx++;
        }
        this._urls = urls;
        this._destinations = destinations;
        this.loaded = true;
    }
    loadDirmap() {
        let dirmapFilePath = Path.join(this.map_path, DirectoryMap.map_filename);
        let existingDirmap;
        try {
            existingDirmap = JSON.parse(fs.readFileSync(dirmapFilePath));
        } catch (err) {
            existingDirmap = {};
            console.warn('No dirmap file was found. Creating default based on supplied pubpath.');
            console.warn(err);
        }
        // console.log("EXISTING")
        // console.log(existingDirmap)
        const dirmap = {};
        dirUtil.files(this.map_path, 'all', (err, objPaths) => {
            console.info("--- LOAD DIRMAP START ---");
            if (!objPaths) {
                console.warn(`No files found in pubpath '${this.map_path}'. Ensure that the path to the directory is correct and that the directory is not empty.`)
                return;
            }

            // Handle/Initialize directories
            const dirs = objPaths.dirs;
            if (dirs) {
                for (const dirPath of dirs) {
                    if (filterIgnore(dirPath, this.ignoreTerms)) {
                        let dirPathFrags = Path.relative(this.map_path, Path.dirname(dirPath)).split(Path.sep)
                        const name = Path.basename(dirPath);
                        let dir = dirmapResolvePath(existingDirmap, dirPathFrags);
                        let newDir = dirmapResolvePath(dirmap, dirPathFrags);
                        newDir[name] = dir[name] || {};
                    }
                }
            }
            // console.log(dirmap);
            const files = objPaths.files;
            for (const filePath of files) {
                const relPath = Path.parse(Path.relative(this.map_path, filePath));
                const dirPathFrags = relPath.dir.split(Path.sep);

                let dir = dirmapResolvePath(existingDirmap, dirPathFrags);
                
                // Add file to directory entry if not already there
                let newDir = dirmapResolvePath(dirmap, dirPathFrags);
                // console.log(dir, relPath.base, dir[relPath.base])
                newDir[relPath.base] = dir[relPath.base] || {  };
                
            }
            // console.log(JSON.stringify(dirmap, null, 2));
            this._dirmap = dirmap;
            console.info(`Writing dirmap to ${dirmapFilePath}...`);
            fs.writeFileSync(
                dirmapFilePath,
                JSON.stringify(dirmap, null, 2), {
                    encoding: "utf8",
                    flag: 'w+'
                }
            );
            console.info("--- LOAD DIRMAP END ---");
        });
    }
    _get(requestPath) {
        return this._destinations[this._urls.get(Path.format(requestPath))];
    }
    /**
     * 
     * @param {import('path').ParsedPath} requestPath 
     */
    get(requestPath) {
        try {
            const dir = dirmapResolvePath(this._dirmap, Path.format(requestPath).split(Path.sep).slice(1));
            // console.log("GETMETHOD", dir, requestPath.base, dir[requestPath.base], Path.format(requestPath));
            return dir[requestPath.base] || dir;

        } catch (err) {
            console.warn(requestPath);
            console.warn(err);
            return null;
        }
    }
    // TODO Fix server crash on non-existant widget ex: https://www.jpcode.dev/dnd/ian-oota/(ign)template%20structure.md
    /**
     * 
     * @param {import('path').ParsedPath} requestPath 
     */
    getItemConfig(requestPath) {
        let out;
        
        try {
            out = this._get(requestPath);
        } catch (err) {
            if (this.loaded)
                console.error("Attempted to retrieve ServableConfig info before the object was initialized. Use ServableConfig.load()!");
            else 
                console.error(err);
        }
        
        return out;
    }
    addItemConfig(validRequestPaths, headerOverrides) {
        this.config[Path.format(requestPath)]
    }
}
function filterIgnore(path, ignoreTerms) {
    for (const term of ignoreTerms) {
        if (path.includes(term))
            return false;
    }
    return true;
}
function dirmapResolvePath(cDirObj, subdirs) {
    nDirObj = cDirObj[subdirs[0]];
    if (nDirObj)
        return dirmapResolvePath(nDirObj, subdirs.slice(1))
    else return cDirObj;
}
exports.DirectoryMap = DirectoryMap;