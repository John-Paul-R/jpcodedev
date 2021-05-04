
const fs = require('fs');
const Path = require('path').posix; 
const dirUtil = require('node-dir');

class DirectoryMap {

    constructor(map_path, arrIgnoreTerms) {
        this.map_path = map_path;
        this.ignoreTerms = arrIgnoreTerms;
    }

    load() {
        const configRaw = JSON.parse(fs.readFileSync(this.map_path));
        const urls = new Map();
        const fileInfo = [];
        let idx = 0;
        for (const el of configRaw) {
            
            for (const url of el.urls) {
                urls.set(Path.format(Path.parse(url)), idx);
                console.log(urls.has(Path.format(Path.parse(url))));
            }
            urls.set(Path.format(Path.parse(el.file)), idx);

            const opts = {};
            if (el.headers) {
                opts["headers"] = el.headers;
            }
            if (el.file) {
                opts["file"] = el.file;
            }
            fileInfo.push(opts)
            
            idx++;
        }
        this._urls = urls;
        this._fileInfo = fileInfo;
        this.loaded = true;
    }
    loadDirmap() {
        let existingDirmap;
        try {
            existingDirmap = JSON.parse(fs.readFileSync(Path.join(this.map_path, 'directory-map.json')));
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
            fs.writeFileSync(
                Path.join(this.map_path, "directory-map.json"),
                JSON.stringify(dirmap, null, 2), {
                    encoding: "utf8",
                    flag: 'w+'
                }
            );
            console.info("--- LOAD DIRMAP END ---");
        });
    }
    _get(requestPath) {
        return this._fileInfo[this._urls.get(Path.format(requestPath))];
    }
    /**
     * 
     * @param {import('path').ParsedPath} requestPath 
     */
    get(requestPath) {
        return dirmapResolvePath(Path.format(requestPath))[requestPath.base];
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