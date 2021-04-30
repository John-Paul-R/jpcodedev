const { pathToFileURL } = require('url');
const http2 = require('http2');
const fs = require('fs-extra');
const Path = require('path');
const pug = require('pug');
const showdown = require('showdown');
const converter = new showdown.Converter({
    tables: true,
});

exports.testMsg = ()=>console.log("test message!");
const { 
    HTTP2_HEADER_PATH,
  } = http2.constants;
const baseUrl = "https://www.jpcode.dev/";

function respond(stream, contentType, content, statusCode=200) {
    let content_type = contentType || "text/raw";
    stream.respond({
        'content-type': `${content_type}; charset=utf-8`,
        ':status': statusCode,
    })
    stream.write(content);
    stream.end();
    return statusCode === 200 ? 0 : -1;
}
/**
 * 
 * @param {http2.ServerHttp2Stream} stream 
 * @param {http2.IncomingHttpHeaders} headers 
 */
function handleRequest(stream, headers) {
    /**
     * @type {string}
     */
    const reqPath = headers[HTTP2_HEADER_PATH];
    console.log(`reqPath: ${reqPath}`);
    const reqURL = new URL(reqPath, baseUrl);
    let reqPathOnly = reqURL.pathname;
    if (reqPathOnly.endsWith('/'))
        reqPathOnly = reqPathOnly.substr(0, reqPathOnly.length-1);
    let pathFrags = reqPathOnly.split('/');
    if (pathFrags[1] !== "dnd")
        return -1;
    for (const webroot of webroots) {
        let rpath = reqPath.replace(/^\/+/, '');
        if (rpath.startsWith(webroot)) {
            console.log(webroot)
            if ((pathFrags.length < 4 || pathFrags[3] === "list")) {
                return respond(
                    stream,
                     'text/html',
                     _templates['list']({
                        "widgets": _widgets_data[webroot],
                        "title": "Notes",
                        "webroot": webroot,
                    }),
                ); 
            } else if (pathFrags[3] === "list-json") {
                return respond(
                    stream,
                    'application/json',
                    JSON.stringify(Object.keys(_widgets_data)),
                );
            } else {
                
                let frag = pathFrags.slice(3);
                let widgetContents = _markdown[webroot][frag];
                let widgetTitle = _widgets_data[webroot][frag].title;
                console.log(widgetTitle)
                // TODO Properly handle responding to widgets in subdirs. (atm its reliant solely on basename, subdir has no effect)
                if (widgetContents) {
                    return respond(
                        stream,
                        'text/html',
                        _templates['dnd_summary_note']({
                            "widgetContents": widgetContents,
                            "title": widgetTitle,
                        })
                    );
                } else {
                    return -2;
                }
            }
        }
    }
    if (pathFrags[1] === "dnd" && pathFrags.length > 2) {
         if (pathFrags[2] === "debug-widgets") {
            return respond(
                stream,
                'application/json',
                JSON.stringify({
                    "templates": Object.keys(_templates).sort(),
                    "widgets": Object.keys(_widgets_data).sort(),
                    "markdown": Object.keys(_markdown).sort(),
                }, null, 4),
            );
        } else {
            return -1;
        }
    } else {
        return -1;
    }
    return 0;
}

/**
 * 
 * @param {String} reqPath
 * @param {String} widget_name 
 */
function getWidget(reqPath, pathFrags) {
    let out = null;
    Path.dirname
    let web_root = reqPath.startsWith('/') && reqPath.length > 1 ? Path.dirname(reqPath).slice(1) : reqPath;
    console.log("Web Root: " + web_root);
    let pug_template = _templates[pathFrags[0]];
    console.log(pathFrags)
    let widget;
    try {
        widget = _widgets_data[web_root][pathFrags[1]];
    } catch (err) {
        console.error(err);
    }
    if (pug_template && widget) {
        // Template and JSON
        out = pug_template(widget);
    } else if (pug_template && pathFrags[1] && _markdown[web_root][pathFrags[1]]) {
        // Template and Markdown
        out = pug_template({"content":_markdown[web_root][pathFrags[1]]})
    } else if (pathFrags[0] && _markdown[web_root][pathFrags[0]]) {
        // Markdown only
        out = _markdown[web_root][pathFrags[0]];
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
var _widgets_data = {};
var _templates = {};
var _markdown = {};
var _config = {};
var webroots = [];
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
    web_root: "widgets",
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
    webroots.push(options.web_root);
    Object.assign(_templates, templates);
    _widgets_data[options.web_root] = widgets;
    _markdown[options.web_root] = markdown;
    _config[options.web_root] = config;
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

function loadTemplates(dir) {
    let templates = {};
    let paths = getFilePathsRecursive(dir);
    for (const file_path of paths) {
        let file_name = Path.basename(file_path);
        file_name = file_name.substr(0, file_name.lastIndexOf('.'));
        let ext = Path.extname(file_path);
        let data = fs.readFileSync(file_path, {encoding: 'utf-8'});
        if (ext === '.pug') {
            templates[file_name] = pug.compile(data, {
                filename: file_path
            });
        } else {
            console.warn(`Ignoring file, not a .pug widget or template: ${file_path}`);
        }
    }
    Object.assign(_templates, templates);
}

function sortFromConfig(widgets, config) {
    return config.reduce((accumulator, current) => {
        accumulator[current] = widgets[current];
        return accumulator;
    }, {});
}

exports.init = init;
exports.handleRequest = handleRequest;
exports.loadTemplates = loadTemplates;
exports.templates = _templates;