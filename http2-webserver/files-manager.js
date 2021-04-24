
const http2 = require('http2');
const fs = require('fs');
const Mime = require('mime');
const dir = require('node-dir');
const Path = require('path');

const {
    HTTP2_HEADER_METHOD,
    HTTP2_HEADER_PATH,
    HTTP2_HEADER_STATUS,
    HTTP2_HEADER_CONTENT_TYPE,
    HTTP2_HEADER_LINK,
    HTTP2_HEADER_ACCEPT_ENCODING,
    HTTP2_HEADER_CONTENT_LENGTH,
    HTTP2_HEADER_LAST_MODIFIED,
    HTTP2_HEADER_CACHE_CONTROL,
    HTTP2_HEADER_CONTENT_ENCODING
  } = http2.constants;

let logger;
let runOpts;
let exec_dirname; 

exports.init = (rOpts, lgr) => {
    runOpts = rOpts;
    logger = lgr;
    exec_dirname = Path.basename(runOpts.pubpath);
}

// FUNCTIONS

function loadFiles(dir_path) {
    const files = new Map();
    logger.info("Load Site Files..");

    dir.files(dir_path, (err, arrFilePaths) => {
        if (arrFilePaths) {
            arrFilePaths.forEach(preloadFiles);
        } else {
            logger.warn(`No files found in pubpath '${dir_path}'. Ensure that the path to the directory is correct and that the directory is not empty.`)
        }
    });

    // Load files into memory
    function preloadFiles(filePath) {
        if (filePath.includes("git"))
            return;

        const relFilePath = Path.relative(dir_path, filePath).replace('\\', '/');
        const fileDescriptor = fs.openSync(filePath, "r");
        const stat = fs.fstatSync(fileDescriptor);
        const contentType = Mime.getType(relFilePath);
        const headers = {
            "content-length": stat.size,
            "last-modified": stat.mtime.toUTCString(),
            "content-type": contentType,
        };
        if (runOpts['early-hints']) {
            console.log(relFilePath);
            if (pushList[relFilePath]) {
                pList = pushList[relFilePath]
                linkHeaders = [];
                // Add 'Link' headers for all files specified in dirmap json file.
                for (let i = 0; i < pList.length; i++) {
                    linkHeaders.push(`<${pList[i].path}>; rel="${pList[i].rel}"${pList[i].as ? '; as="' + pList[i].as + '"' : ''}${pList[i].crossorigin ? '; crossorigin="anonymous"' : ''}`);
                }
                headers[HTTP2_HEADER_LINK] = linkHeaders;
            }
        }

        // if (runOpts.debug) {
        fs.closeSync(fileDescriptor);
        const fileContents = fs.readFileSync(filePath, { flag: 'r' });
        files.set(`${relFilePath}`, {
            absPath: filePath,
            data: fileContents,
            fileName: relFilePath,
            headers: headers
        });
        console.info(`File registered: ${relFilePath}`)
        // } else {

        //   if (contentType != 'text/html') {
        //     headers["cache-control"] = `max-age=${86400 * 365}`;
        //   }
        //   //  Because these types of files are compressed with brotli...
        //   //TODO - Implement this properly
        //   //TODO ...(So that there is a compressed and uncompressed vers of each...
        //   //TODO ...and it chooses which to use dynamically, based on the request's "AcceptEncoding" header)
        //   // if (!useDebugPath && (
        //   //     contentType === 'application/javascript' 
        //   //     || contentType === 'text/javascript' 
        //   //     || contentType === 'text/css' 
        //   //     || contentType === 'text/html' 
        //   //     || contentType === 'application/json')) {
        //   //     headers["content-encoding"] = "br";
        //   // }

        //   files.set(`${relFilePath}`, {
        //     fileName: relFilePath,
        //     fileDescriptor,
        //     headers: headers
        //   });
        //   console.info(`File loaded: ${relFilePath}`)
        //   // console.log(files.get(`/${fileName}`));
        // }        
    }

    return files;
};

function loadDirMap(dir_path) {
    const dirmappath = 'http2-dirmap.json';
    logger.info("Load dirmap...");
    let dirmapjson;
    let dirmap;
    try {
        if (fs.existsSync(dirmappath)) {
            dirmapjson = JSON.parse(fs.readFileSync(dirmappath));
            dirmap = updateDirMap(dir_path, dirmapjson);
            logger.info("Successfully loaded dirmap.");
        } else {
            dirmap = updateDirMap(dir_path);
        }
    } catch (err) {
        logger.error("Unknown Error: Could not load dirmap.");
        logger.error(err);
    }
    return dirmap;
};


function dirmapResolvePath(cDirObj, subdirs) {
    nDirObj = cDirObj[subdirs[0]];
    if (nDirObj)
        return dirmapResolvePath(nDirObj, subdirs.slice(1))
    else return cDirObj;
}

/**
 * 
 * @param {string} reqPath 
 * @param {Map<string, object>} files 
 * @param {object} dirmap 
 * @returns 
 */
function getFile(reqPath, files, dirmap) {
    let out;
    const adjustPath = (path) => {
        if (path !== '/')
            path = path.slice(1)
        return path;
    }
    reqPath = adjustPath(reqPath);

    let fileName = Path.basename(reqPath);
    if (fileName === '' || fileName === exec_dirname)
        fileName = reqPath; //In theory this should only happen for '/'
    let fileInfo = dirmapGet(reqPath,)[fileName];
    let file;

    try {
        if (fileInfo.alias) {
            file = files.get(fileInfo.alias);

            fileInfo = dirmapGet(fileInfo.alias)[Path.basename(fileInfo.alias)]
        } else {
            file = files.get(reqPath);
        }

    } catch (err) {
        logErr(err);
    }
    if (!file) {
        try {
            if (Object.keys(fileInfo).includes("index.html")) {
                const idxPath = `${reqPath}/index.html`;
                fileInfo = dirmapGet(idxPath)[Path.basename(idxPath)];
                file = files.get(idxPath);
                console.log(`CATCH-GO: ${idxPath}`)
            }
        } catch (err) {
            logErr(err);
        }
    }
    try {
        out = {
            headers: fileInfo.headers,
            data: file.data//(runOpts['use-br-if-available'] && fileInfo['.br']) ? files.get('/' + fileInfo['.br']).data : 
        }
        if (runOpts.maxAge) {
            out.headers[HTTP2_HEADER_CACHE_CONTROL] = `max-age=${runOpts.maxAge}`;
        }
    } catch (err) {
        logErr(err);
        out = null;
    }
    function logErr(err) {
        console.error("Error retrieving file: " + reqPath)
        console.error(err)
    }
    function dirmapGet(path,) {
        let fdirs = Path.dirname(path).split(Path.sep)
    
        return dirmapResolvePath(dirmap, fdirs)
    }
    return out;
}

function updateDirMap(exec_path, existingDirMap = undefined) {
    if (!runOpts.debug) { return; }
    if (existingDirMap === undefined) {
        logger.info('No dirmap file was found. Creating default based on supplied pubpath.');
        existingDirMap = {};
    }
    let dirmap = existingDirMap;
    dir.files(exec_path, 'all', (err, objPaths) => {
        // console.log(objPaths);
        if (objPaths) {
            const dirs = objPaths.dirs;
            const files = objPaths.files;
            if (dirs) {
                for (let i = 0; i < dirs.length; i++) {
                    if (filterIgnore(dirs[i])) {
                        let fdirs = Path.relative(exec_path, Path.dirname(dirs[i])).split(Path.sep)
                        const name = Path.basename(dirs[i]);
                        let dir = dirmapResolvePath(dirmap, fdirs);
                        dir[name] = dir[name] || {};
                    }
                }
            }
            if (files) {
                let brFiles = [];
                for (let i = 0; i < files.length; i++) {
                    if (filterIgnore(files[i])) {
                        const relDirPath = Path.relative(exec_path, Path.dirname(files[i]));
                        const relPath = Path.relative(exec_path, files[i]);
                        let fdirs = relDirPath.split(Path.sep)

                        let name = Path.basename(files[i], '.br');
                        let dir = dirmapResolvePath(dirmap, fdirs);
                        // Add to map if not already there
                        dir[name] = dir[name] || { headers: {} }

                        // Generate/Update certain standard headers
                        let fileDescriptor = fs.openSync(files[i], "r");
                        let stat = fs.fstatSync(fileDescriptor);
                        fs.closeSync(fileDescriptor);

                        let contentEncoding;
                        if (Path.extname(files[i]) === ".br") {
                            dir[name]['.br'] = relPath.replace(/\\/g, '/');

                            name = Path.basename(files[i]);
                            contentEncoding = "br";
                        }

                        const contentType = Mime.getType(files[i]);
                        dir[name] = dir[name] || {};
                        let headers = dir[name]["headers"] || {};
                        dir[name]["headers"] = headers;

                        headers[HTTP2_HEADER_CONTENT_LENGTH] = stat.size;
                        headers[HTTP2_HEADER_LAST_MODIFIED] = stat.mtime.toUTCString();
                        headers[HTTP2_HEADER_CONTENT_TYPE] = headers[HTTP2_HEADER_CONTENT_TYPE] || contentType;
                        
                        if (contentEncoding) {
                            headers[HTTP2_HEADER_CONTENT_ENCODING] = contentEncoding;
                        }
                        if (contentType != 'text/html') {
                            headers[HTTP2_HEADER_CACHE_CONTROL] = `max-age=${86400 * 365}`;
                        } else {
                            headers[HTTP2_HEADER_CACHE_CONTROL] = `max-age=${0}`;
                        }
                    }
                }
            }
        } else {
            logger.warn(`No files found in pubpath '${exec_path}'. Ensure that the path to the directory is correct and that the directory is not empty.`)
        }
        // console.log(dirmap);
        fs.writeFileSync("http2-dirmap.json", JSON.stringify(dirmap, null, 2), encoding = "utf8", flag = 'w+');
    });
    return dirmap;
}

function filterIgnore(path) {
    if (path.includes("git") || path.includes(".well-known"))
        return false;
    return true;
}

/**
 * 
 * @param {string} root_dir The directory to index / load files from 
 * 
 */
function load(root_dir) {
    const files = loadFiles(root_dir);
    const dirmap = loadDirMap(root_dir);
    return {
        files: files,
        dirmap: dirmap,
        getFile: (reqPath) => getFile(reqPath, files, dirmap),
    };
}

exports.load = load;
// exports.loadFiles = loadFiles;
// exports.loadDirMap = loadDirMap;
// exports.getFile = getFile;

