
const http2 = require('http2');
const fs = require('fs');
const Mime = require('mime');
const dir = require('node-dir');
const Path = require('path');
const pug = require('pug');
const { DirectoryMap } = require('./directory-map.js');

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
var widgets;
var pugOptions;
exports.init = (rOpts, wdg, pugOpts, lgr) => {
    runOpts = rOpts;
    logger = lgr;
    widgets = wdg;
    pugOptions = pugOpts
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
    /**
     * 
     * @param {string} filePath 
     */
    function preloadFiles(filePath) {
        if (filePath.includes(".git"))
            return;

        const tempPath = Path.parse("/"+Path.relative(dir_path, filePath));
        const relFilePath = Path.format(tempPath);
        // console.log("RELPATH", relFilePath)
        const fileDescriptor = fs.openSync(filePath, "r");
        const stat = fs.fstatSync(fileDescriptor);
        const contentType = Mime.getType(relFilePath);
        if (runOpts.log === "verbose")
            console.log(tempPath.base, contentType);
        let headers = {
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
        let fileContents = fs.readFileSync(filePath, { flag: 'r' });
        if (filePath.endsWith(".pug.json")) {
            function pugCompileJson(jsonContents) {
                let template = widgets.getPugTemplate(jsonContents.template);
                return template(jsonContents.data);
            }
            let jsonContents;
            try {
                jsonContents = JSON.parse(fileContents);
                fileContents = pugCompileJson(jsonContents);
            } catch (err) {
                logger.error(err);
            }
            

            let tempHeaders = {};
            tempHeaders["content-type"] = "text/html; charset=utf-8";
            tempHeaders["last-modified"] = headers["last-modified"];
            // tempHeaders[HTTP2_HEADER_CONTENT_ENCODING] = 
            headers = tempHeaders;
        } else if (filePath.endsWith(".pug")) {
            let opts = {...pugOptions};
            // let jsonText = fmgr.getFile(Path.join(Path.dirname(path), `${Path.basename(path, '.pug')}.json`))
            // let data = JSON.parse(jsonText.data);
            // opts.filename = "../public/index.pug";
            fileContents = pug.render(fileContents, opts);
            
            // let out = temp(data);
            let resHeaders = {};
            resHeaders['content-type'] = 'text/html; charset=utf-8';
            resHeaders["last-modified"] = headers["last-modified"];
            headers = resHeaders;
        }
        // headers[HTTP2_HEADER_CONTENT_LENGTH] = stat.size;
        // headers[HTTP2_HEADER_LAST_MODIFIED] = stat.mtime.toUTCString();
        // headers[HTTP2_HEADER_CONTENT_TYPE] = headers[HTTP2_HEADER_CONTENT_TYPE] || contentType;
        // if (name.endsWith(".pug.json") || name.endsWith(".pug")) {
        //     headers[HTTP2_HEADER_CONTENT_TYPE] = 'text/html; charset=utf-8';
        // }
        // if (contentEncoding) {
        //     headers[HTTP2_HEADER_CONTENT_ENCODING] = contentEncoding;
        // }
        files.set(`${relFilePath}`, {
            absPath: filePath,
            data: fileContents,
            fileName: relFilePath,
            headers: headers
        });
        // console.info(`File registered: ${relFilePath}`)
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


/**
 * 
 * @param {string} apath 
 */
 function getFile(reqPath) {
    let out;
    const adjustPath = (path) => {
        if (path !== '/')
            path = path.slice(1)
        return path;
    }
    let apath = adjustPath(reqPath);
    let rpath = Path.parse(reqPath);

    // let fileName = rpath.base;
    // if (fileName === '' || fileName === exec_dirname)
    //     rpath.base = apath; //In theory this should only happen for '/'
    
    let fileObj;

    let alias_destination = directory_map.getItemConfig(rpath);
    if (alias_destination) {
        rpath = Path.parse(alias_destination);
    }
    let fileInfo = directory_map.get(rpath);
    // console.log(fileInfo, rpath, Path.format(rpath));

    // let dir = info.dir;
    // let fileInfo = info.file;
    // console.log(fileInfo);
    try {
        fileObj = _files.get(Path.format(rpath));

    } catch (err) {
        logErr(err);
    }

    if (!(fileObj && fileInfo)) {
        fileInfo = fileInfo
    }
    // Try some default files for directories
    if (!fileObj && fileInfo) {
        try {
            const keyList = Object.keys(fileInfo);
            // console.log("KEY-LIST", keyList)
            const file_names = [
                'index', Path.basename(apath),
            ]
            const extensions = ['.html', '.pug.json', '.pug']
            found:
            for (let i = 0; i < file_names.length; i++) {
                for (let j = 0; j < extensions.length; j++) {
                    if (ifIncludes(file_names[i], extensions[j])) {
                        break found;
                    }
                }
            }
            function ifIncludes(f_name, ext="") {
                let name = f_name+ext;
                if (keyList.includes(name)) {
                    const idxPath = Path.parse(Path.join(Path.format(rpath), name));
                    fileInfo = directory_map.get(idxPath);
                    fileObj = _files.get(Path.format(idxPath));
                    // console.log(!fileObj, Path.format(idxPath), fileInfo)
                    return true;
                }
                return false;
            }
        } catch (err) {
            logErr(err);
        }
    }
    try {
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
        }
        // console.log("OUT", out);
        if (runOpts.maxAge) {
            out.headers[HTTP2_HEADER_CACHE_CONTROL] = `max-age=${runOpts.maxAge}`;
        }
    } catch (err) {
        out = null;
        // logErr(err)
    }
    function logErr(err) {
        logger.error("Error retrieving file: " + apath)
        logger.error(err)
    }

    return out;
}

var directory_map;
var _files;
/**
 * 
 * @param {string} root_dir The directory to index / load files from 
 * 
 */
function load(root_dir) {
    _files = loadFiles(root_dir);
    directory_map = new DirectoryMap(root_dir, [".git", ".well-known"]);
    directory_map.loadDirmap();
    directory_map.load();
    console.log(directory_map);
    // return {
    //     getFile: (reqPath) => getFile(reqPath, files),
    // };
}

exports.load = load;
exports.getFile = getFile; 
