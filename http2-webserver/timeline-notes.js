const { pathToFileURL } = require('url');
const http2 = require('http2');
const fs = require('fs-extra');
const Path = require('path');
const pug = require('pug');
const showdown = require('showdown');
const converter = new showdown.Converter();

exports.testMsg = ()=>console.log("test message!");
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
const defaultHeaders = {}
const baseUrl = "https://www.jpcode.dev/";
/**
 * 
 * @param {http2.ServerHttp2Stream} stream 
 * @param {http2.IncomingHttpHeaders} headers 
 */
function handleRequest(stream, headers) {
    const reqPath = headers[HTTP2_HEADER_PATH];
    const encodings = headers[HTTP2_HEADER_ACCEPT_ENCODING];
    const reqURL = new URL(reqPath, baseUrl);
    let reqPathOnly = reqURL.pathname;
    if (reqPathOnly.endsWith('/'))
        reqPathOnly = reqPathOnly.substr(0, reqPathOnly.length-1);
    let pathFrags = reqPathOnly.split('/');
    if (pathFrags[1] !== "dnd")
        return -1;
    if (pathFrags[1] === "dnd" && pathFrags.length > 2) {
        if (pathFrags[2] === "ian-oota" && (pathFrags.length < 4 || pathFrags[3] === "list")) {
            stream.respond({
                'content-type': 'text/html; charset=utf-8',
                ':status': 200,
            })
            stream.write(_templates['list']({
                "widgets": _widgets,
                "title": "Notes",
            }));
            stream.end();
        } else if (pathFrags[2] === "ian-oota" && pathFrags[3] === "list-json") {
            stream.respond({
                'content-type': 'text/html; charset=utf-8',
                ':status': 200,
            })
            stream.write(JSON.stringify(Object.keys(_widgets)));//sortFromConfig(_widgets, _config['_order'])
            stream.end();
        } else if (pathFrags[2] === "ian-oota") {
            let widgetContents = getWidget(pathFrags.slice(3));
            // TODO Properly handle responding to widgets in subdirs. (atm its reliant solely on basename, subdir has no effect)
            if (widgetContents) {
                stream.respond({
                    'content-type': 'text/html; charset=utf-8',
                    ':status': 200,
                })
                stream.write(widgetContents);
                stream.end();
            } else {
                return -2;
            }
        }
    } else if (pathFrags.length === 2) {
        stream.respond({
            'content-type': 'application/json; charset=utf-8',
            ':status': 200,
        })
        stream.write(JSON.stringify({
            "templates": Object.keys(_templates).sort(),
            "widgets": Object.keys(_widgets).sort(),
            "markdown": Object.keys(_markdown).sort(),
        }, null, 4));
        stream.end();
    } else {
        return -1;
    }
    return 0;
}

/**
 * 
 * @param {String} widget_name 
 */
function getWidget(pathFrags) {
    let out = null;
    let pug_template = _templates[pathFrags[0]];
    let widget;
    try {
        widget = _widgets[pathFrags[1]];
    } catch (err) {

    }
    if (pug_template && widget) {
        // Template and JSON
        out = pug_template(widget);
    } else if (pug_template && pathFrags[1] && _markdown[pathFrags[1]]) {
        // Template and Markdown
        out = pug_template({"content":_markdown[pathFrags[1]]})
    } else if (pathFrags[0] && _markdown[pathFrags[0]]) {
        // Markdown only
        out = _markdown[pathFrags[0]];
    }

    return out;
}


/**
 * 
 * @param {PathLike} directory_path 
 * @param {Array<Dirent>} dirent_arr
 * 
 * @returns {Array<String>} 
 */
function getFilePathsRecursive(directory_path, dirent_arr=[]) {
    let dir = fs.opendirSync(directory_path);
    let widget_dirents = dirent_arr;
    let subdir_dirents = [];
    let lastDirent = null;
    do {
        let dirent = dir.readSync();
        if (dirent === null)
            break;
        let dirent_path = Path.join(directory_path, dirent.name);
        if (dirent.isFile()) {
            widget_dirents.push(dirent_path);
        } else if (dirent.isDirectory()) {
            subdir_dirents.push(dirent_path);
        }
        lastDirent = dirent;
    } while (lastDirent !== null);
    
    for (const subdir of subdir_dirents) {
        widget_dirents.concat(getFilePathsRecursive(subdir, dirent_arr));
    }
    return widget_dirents;
}
var _widgets;
var _templates;
var _markdown;
var _confiig;
/**
 * 
 * @param {String}  options.widget_directory The directory to look inside for widget files
 * @param {boolean} options.preload_widgets Whether widgets should be loaded into memory at startup
 * @param {boolean} options.lazy_load_allowed Whether the service is allowed to check for widgets on disk during runtime (after startup) (if not found in memory)
 */
function init(options={
    widget_directory: Path.join(__dirname, "widgets"),
    preload_widgets: true,
    lazy_load_allowed: true,
}) {
    fs.ensureDirSync(options.widget_directory);
    let widget_paths = getFilePathsRecursive(options.widget_directory);
    console.log(widget_paths);
    let templates = {};
    let widgets = {};
    let markdown = {};
    let config = {};

    if (options.preload_widgets) {
        for (const file_path of widget_paths) {
            let file_name = Path.basename(file_path);
            file_name = file_name.substr(0, file_name.lastIndexOf('.'));
            let ext = Path.extname(file_path);
            let data = fs.readFileSync(file_path, {encoding: 'utf-8'});
            if (file_name[0] === "_" && ext === '.json') {
                config[file_name] = JSON.parse(data);
            } else if (ext === '.pug') {
                templates[file_name] = pug.compile(data, {
                    filename: file_path
                });
            } else if (ext === '.json') {
                widgets[file_name] = JSON.parse(data);
            } else if (ext === '.md') {
                markdown[file_name] = converter.makeHtml(data).replace(/<a\s*?href/gm, '<a noreferrer target="_blank" href');
            } else {
                console.warn("Ignoring file, not a .pug widget or a content .json: "+file_path);
            }
            console.log("Loaded Widget: "+file_path);
            console.log("Widget Name: "+file_name);

            // console.log(`Contents of ${widget_name}:\n---Begin---\n${widgets[widget_name]}\n---End---\n`);
        }
    }
    _templates = templates;
    _widgets = widgets;
    _markdown = markdown;
    _config = config;
    const widget_map_path = Path.join(__dirname, "widget-map.json");
    fs.ensureFileSync(widget_map_path);
    fs.writeFileSync(widget_map_path, JSON.stringify(Object.keys(widgets), null, 4));
    console.log(typeof(widgets));
    for (const widget of Object.values(widgets)) {
        if (widget["content-file"]) {
            widget["content"] = _markdown[Path.basename(widget["content-file"], '.md')];
        }
    }

}

function sortFromConfig(widgets, config) {
    return config.reduce((accumulator, current) => {
        accumulator[current] = widgets[current];
        return accumulator;
    }, {});
}

exports.init = init;
exports.handleRequest = handleRequest;