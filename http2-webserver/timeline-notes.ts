import http2, { IncomingHttpHeaders, ServerHttp2Stream } from "http2";
import fs from "fs-extra";
import Path from "path";
import pug from "pug";
import { Converter as MdConverter } from "showdown";

import * as dndPlugin from "./dnd-plugin";
import { trimTrailingSlash } from "./utils.js";
import { Dirent } from "fs";

type WidgetsDirectoryConfig = {
    dnd?: DndDirectoryOptions;
};

type DndDirectoryOptions = {
    campaign_title: string;
    dungeon_master: string;
    type: "notes" | "other";
    ogPreview?: OpenGraphProperties;
};

type OpenGraphProperties = {
    title?: string;
    image?: string;
    url?: string;
};

type DndNoteMetadata = {
    title: string;
    "content-file": string;
    "session-date": string;
};

type DndNoteMemCache = {
    content: string | Buffer;
} & DndNoteMetadata;

const converter = new MdConverter({
    tables: true,
    strikethrough: true,
});

const { HTTP2_HEADER_PATH } = http2.constants;
const baseUrl = "https://www.jpcode.dev/";

const _widgets_data: { [key: string]: Map<string, DndNoteMemCache> } = {};
const _templates: { [key: string]: pug.compileTemplate } = {};
const _markdown: { [key: string]: { [key: string]: string | Buffer } } = {};
const _config: { [key: string]: { [key: string]: {} } } = {};
const _dir_config: { [key: string]: WidgetsDirectoryConfig } = {};
const webroots: string[] = [];

/**
 *
 * @param {object} options
 * @param {String}  options.widget_directory The directory to look inside for widget files
 * @param {boolean} options.preload_widgets Whether widgets should be loaded into memory at startup
 * @param {boolean} options.lazy_load_allowed Whether the service is allowed to check for widgets on disk during runtime (after startup) (if not found in memory)
 * @param {string}  options.web_root
 * @param {string[]} options.plugins
 */
function init(
    options = {
        widget_directory: Path.join(__dirname, "widgets"),
        preload_widgets: true,
        lazy_load_allowed: true,
        web_root: "widgets",
        plugins: [] as string[],
    }
) {
    fs.ensureDirSync(options.widget_directory);
    const widget_paths = getFilePathsRecursive(options.widget_directory);

    const templates: { [key: string]: pug.compileTemplate } = {};
    const widgets: { [key: string]: DndNoteMemCache } = {};
    const markdown: { [key: string]: string | Buffer } = {};
    const config: { [key: string]: {} } = {};

    let dirConfig: WidgetsDirectoryConfig = {};
    const dirConfigPath = Path.join(
        Path.normalize(options.widget_directory),
        "config.json"
    );

    if (fs.existsSync(dirConfigPath)) {
        dirConfig = JSON.parse(fs.readFileSync(dirConfigPath).toString());
    }

    if (options.preload_widgets) {
        for (const file_path of widget_paths) {
            let file_name = Path.basename(file_path);
            file_name = file_name.substr(0, file_name.lastIndexOf("."));
            const ext = Path.extname(file_path);
            const data = fs.readFileSync(file_path, { encoding: "utf-8" });
            if (file_name[0] === "_" && ext === ".json") {
                config[file_name] = JSON.parse(data);
            } else if (ext === ".pug") {
                templates[file_name] = pug.compile(data, {
                    filename: file_path,
                });
            } else if (ext === ".json") {
                if (file_name == "config") {
                    continue;
                }
                widgets[file_name] = JSON.parse(data);
            } else if (ext === ".md") {
                dndPlugin
                    .insertSpellTooltips(
                        converter
                            .makeHtml(data)
                            .replace(
                                /<a\s*?href/gm,
                                '<a noreferrer target="_blank" href'
                            )
                    )
                    .then((htmlStr: string) => (markdown[file_name] = htmlStr));
            } else {
                console.warn(
                    "Ignoring file, not a .pug widget or a content .json: " +
                        file_path
                );
            }
            // console.log("Loaded Widget: "+file_name);
        }
    }

    webroots.push(options.web_root);
    Object.assign(_templates, templates);
    _markdown[options.web_root] = markdown;
    _config[options.web_root] = config;
    _dir_config[options.web_root] = dirConfig;
    if (dirConfig && dirConfig.dnd && dirConfig.dnd.type == "notes") {
        const n_widgets = new Map<string, DndNoteMemCache>();
        for (const [key, value] of Object.entries(widgets).sort(
            (a, b) =>
                new Date(b[1]["session-date"]).getTime() -
                new Date(a[1]["session-date"]).getTime()
        )) {
            n_widgets.set(key, value);
        }
        _widgets_data[options.web_root] = n_widgets;
    } else {
        _widgets_data[options.web_root] = new Map<string, DndNoteMemCache>(
            Object.entries(widgets)
        );
    }
    for (const widget of Object.values(widgets)) {
        if (widget["content-file"]) {
            widget["content"] =
                markdown[Path.basename(widget["content-file"], ".md")];
        }
    }
}

function respond(
    stream: ServerHttp2Stream,
    contentType: string,
    content: any,
    statusCode = 200
) {
    const content_type = contentType ?? "text/raw";
    stream.respond({
        "content-type": `${content_type}; charset=utf-8`,
        ":status": statusCode,
    });
    stream.write(content);
    stream.end();
    return statusCode === 200 ? 0 : -1;
}

function handleRequest(
    stream: ServerHttp2Stream,
    headers: IncomingHttpHeaders
) {
    const reqPath = headers[HTTP2_HEADER_PATH] as string;
    console.log(`reqPath: ${reqPath}`);
    const reqPathOnly = trimTrailingSlash(new URL(reqPath, baseUrl).pathname);
    const pathFrags = reqPathOnly.split("/");

    if (pathFrags[1] !== "dnd") return -1;

    const rpath = reqPath.replace(/^\/+/, "");
    for (const webroot of webroots) {
        if (rpath.startsWith(webroot)) {
            console.log(webroot);
            if (pathFrags.length < 4 || pathFrags[3] === "list") {
                const dirConfig = dndDirConfig(webroot);
                return respond(
                    stream,
                    "text/html",
                    _templates["list"]({
                        widgets: _widgets_data[webroot].entries(),
                        title: dirConfig.title,
                        webroot: webroot,
                        ogPreview: dirConfig.ogPreview,
                    })
                );
            } else if (pathFrags[3] === "list-json") {
                return respond(
                    stream,
                    "application/json",
                    JSON.stringify(Object.keys(_widgets_data))
                );
            } else {
                try {
                    const frag = pathFrags.slice(3);
                    const widgetContents = _markdown[webroot][frag[0]];
                    const widgetTitle = _widgets_data[webroot].get(
                        frag[0]
                    )?.title;

                    const dirConfig = dndDirConfig(webroot);

                    console.log(widgetTitle);
                    // TODO Properly handle responding to widgets in subdirs. (atm its reliant solely on basename, subdir has no effect)
                    if (widgetContents) {
                        return respond(
                            stream,
                            "text/html",
                            _templates["dnd_summary_note"]({
                                widgetContents: widgetContents,
                                title: widgetTitle,
                                dirTitle: dirConfig.title,
                                webroot: webroot,
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
                "application/json",
                JSON.stringify(
                    {
                        templates: Object.keys(_templates).sort(),
                        widgets: Object.keys(_widgets_data).sort(),
                        markdown: Object.keys(_markdown).sort(),
                    },
                    null,
                    4
                )
            );
        } else {
            return -1;
        }
    } else {
        return -1;
    }
    return 0;
}

function dndDirConfig(webroot: string) {
    const dirConfig = _dir_config[webroot];
    let dirTitle = `${Path.basename(webroot)} notes`;
    let ogPreview = null;
    if (dirConfig && dirConfig.dnd && dirConfig.dnd.campaign_title) {
        dirTitle = `Campaign Notes: ${Path.basename(
            dirConfig.dnd.campaign_title
        )}`;
        ogPreview = dirConfig.dnd.ogPreview;
    }
    return {
        title: dirTitle,
        ogPreview: ogPreview,
    };
}

function getWidget(reqPath: string, pathFrags: string) {
    let out = null;
    Path.dirname;
    const web_root =
        reqPath.startsWith("/") && reqPath.length > 1
            ? Path.dirname(reqPath).slice(1)
            : reqPath;
    console.log("Web Root: " + web_root);
    const pug_template = _templates[pathFrags[0]];
    console.log(pathFrags);
    const widget = _widgets_data[web_root]?.get(pathFrags[1]);

    if (pug_template && widget) {
        // Template and JSON
        out = pug_template(widget);
    } else if (
        pug_template &&
        pathFrags[1] &&
        _markdown[web_root][pathFrags[1]]
    ) {
        // Template and Markdown
        out = pug_template({ content: _markdown[web_root][pathFrags[1]] });
    } else if (pathFrags[0] && _markdown[web_root][pathFrags[0]]) {
        // Markdown only
        out = _markdown[web_root][pathFrags[0]];
    }

    return out;
}

function getFilePathsRecursive(
    directory_path: string,
    dirent_arr: string[] & Dirent[] = []
) {
    const dir = fs.opendirSync(directory_path);
    const widget_dirents = dirent_arr;
    const subdir_dirents = [];
    let lastDirent = null;
    do {
        const dirent = dir.readSync();
        if (dirent === null) break;
        const dirent_path = Path.join(directory_path, dirent.name);
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

function loadTemplates(dir: string) {
    const templates: { [key: string]: pug.compileTemplate } = {};
    const paths = getFilePathsRecursive(dir);
    for (const file_path of paths) {
        let file_name = Path.basename(file_path);
        file_name = file_name.substr(0, file_name.lastIndexOf("."));
        const ext = Path.extname(file_path);
        const data = fs.readFileSync(file_path, { encoding: "utf-8" });
        if (ext === ".pug") {
            templates[file_name] = pug.compile(data, {
                filename: file_path,
            });
        } else {
            console.warn(
                `Ignoring file, not a .pug widget or template: ${file_path}`
            );
        }
    }
    Object.assign(_templates, templates);
}

const getPugTemplate = (templateName: string) => _templates[templateName];

export {
    init,
    handleRequest,
    loadTemplates,
    _templates as templates,
    getPugTemplate,
};
