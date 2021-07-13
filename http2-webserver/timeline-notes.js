const { pathToFileURL } = require('url');
const http2 = require('http2');
const fs = require('fs-extra');
const Path = require('path');
const pug = require('pug');
const showdown = require('showdown');
const { config } = require('process');
const converter = new showdown.Converter({
    tables: true,
    strikethrough: true,
});
const dndPlugin = require('./dnd-plugin.js')

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
                const dirConfig = dndDirConfig(webroot);
                return respond(
                    stream,
                     'text/html',
                     _templates['list']({
                        "widgets": _widgets_data[webroot].entries(),
                        "title": dirConfig.title,
                        "webroot": webroot,
                        ogPreview: dirConfig.ogPreview,
                    }),
                ); 
            } else if (pathFrags[3] === "list-json") {
                return respond(
                    stream,
                    'application/json',
                    JSON.stringify(Object.keys(_widgets_data)),
                );
            } else {
                try {
                    let frag = pathFrags.slice(3);
                    let widgetContents = _markdown[webroot][frag];
                    let widgetTitle = _widgets_data[webroot].get(frag[0]).title;
                    
                    const dirConfig = dndDirConfig(webroot);
                    
                    console.log(widgetTitle)
                    // TODO Properly handle responding to widgets in subdirs. (atm its reliant solely on basename, subdir has no effect)
                    if (widgetContents) {
                        return respond(
                            stream,
                            'text/html',
                            _templates['dnd_summary_note']({
                                "widgetContents": widgetContents,
                                "title": widgetTitle,
                                "dirTitle": dirConfig.title,
                                "webroot": webroot,
                            })
                        );
                    } else {
                        return -2;
                    }
                } catch (err) {
                    console.warn(err);
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

function dndDirConfig(webroot) {
    const dirConfig = _dir_config[webroot];
    let dirTitle = `${Path.basename(webroot)} notes`;
    let ogPreview = null;
    if (dirConfig && dirConfig.dnd && dirConfig.dnd.campaign_title) {
        dirTitle = `Campaign Notes: ${Path.basename(dirConfig.dnd.campaign_title)}`;
        ogPreview = dirConfig.dnd.ogPreview;
    }
    return {
        "title": dirTitle,
        "ogPreview": ogPreview,
    };
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
    dir.close();
    for (const subdir of subdir_dirents) {
        widget_dirents.concat(getFilePathsRecursive(subdir, dirent_arr));
    }
    return widget_dirents;
}
var _widgets_data = {};
var _templates = {};
var _markdown = {};
var _config = {};
var _dir_config = {};
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
    plugins: []
}) {
    fs.ensureDirSync(options.widget_directory);
    let widget_paths = getFilePathsRecursive(options.widget_directory);

    let templates = {};
    let widgets = {};
    let markdown = {};
    let config = {};

    let dirConfig = {};
    let dirConfigPath = Path.join(Path.normalize(options.widget_directory, "../"), "config.json");

    if (fs.existsSync(dirConfigPath)) {
        dirConfig = JSON.parse(fs.readFileSync(dirConfigPath));
    }

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
                if (file_name == "config") {
                    continue;
                }
                widgets[file_name] = JSON.parse(data);
            } else if (ext === '.md') {
                dndPlugin.insertSpellTooltips(
                    converter.makeHtml(data).replace(/<a\s*?href/gm, '<a noreferrer target="_blank" href')
                ).then(htmlStr => markdown[file_name] = htmlStr);
                } else {
                console.warn("Ignoring file, not a .pug widget or a content .json: "+file_path);
            }
            // console.log("Loaded Widget: "+file_name);
        }
    }


    webroots.push(options.web_root);
    Object.assign(_templates, templates);
    _widgets_data[options.web_root] = widgets;
    _markdown[options.web_root] = markdown;
    _config[options.web_root] = config;
    _dir_config[options.web_root] = dirConfig;
    if (dirConfig && dirConfig.dnd && dirConfig.dnd.type == "notes") {
        let n_widgets = new Map();
        for (const [key, value] of Object.entries(widgets).sort((a, b) => new Date(b[1]["session-date"]).getTime() - new Date(a[1]["session-date"]).getTime())) {
            n_widgets.set(key, value)
        }
        _widgets_data[options.web_root] = n_widgets;
    }
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
exports.getPugTemplate = (templateName) => _templates[templateName];