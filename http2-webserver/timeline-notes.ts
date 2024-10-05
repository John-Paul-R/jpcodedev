/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as pug from "@x/pug";
import fs from "fs-extra";
import http2 from "node:http2";
import Path from "node:path";

import showdown from "npm:showdown";
import showdownHighlight from "npm:showdown-highlight";

import log4js from "log4js";
import type { Buffer } from "node:buffer";
import * as dndPlugin from "./dnd-plugin.ts";
import { URL_ROOT } from "./http2server2.1.ts";
import { trimTrailingSlash } from "./utils.ts";
import { readJson } from "@x/jsonfile";

const logger = log4js.getLogger("timeline-notes");

type WidgetsDirectoryConfig = {
    dnd?: DndDirectoryOptions;
    thoughts?: ThoughtsDirectoryOptions;
};

/**
 * Configuration options for a directory `timeline-notes` content/source
 * directory.
 *
 * Many of these properties will affect how the content is parsed and eventually
 * rendered, as well as what properties are available to the content .json
 * files.
 */
type SharedDirectoryOptions = {
    type: "notes" | "other";
    ogPreview?: OpenGraphProperties;
};

type ColumnKey = string | number;

type ColumnConfig = {
    /**
     * The display name to use for the column when rendering the table
     */
    displayName: string;
    /**
     * The key that content .json files will use to populate this value
     */
    key: ColumnKey;
    /**
     * The type of cell to render (a sort of preset, supported by the pug template).
     * - 'title': notably, has a link to the note
     */
    cell_type?: 'title' | undefined;
};

type DndDirectoryOptions = SharedDirectoryOptions & {
    campaign_title: string;
    dungeon_master: string;
};

type ThoughtsDirectoryOptions = SharedDirectoryOptions & {
    topic: string;
    author: string;
    columns: ColumnConfig[];
    sortColumnKey: ColumnKey;
};

type OpenGraphProperties = {
    title?: string;
    image?: string;
    url?: string;
};

type ContentFIleMetadata = {
    [key: string]: string;
};

type ContentFileMemCache = {
    content: string | Buffer;
} & ContentFIleMetadata;

const converter = new showdown.Converter({
    tables: true,
    strikethrough: true,
    disableForced4SpacesIndentedSublists: true,
    extensions: [
        showdownHighlight({
            pre: true,
        }),
    ],
});

const _widgets_data: { [key: string]: Map<string, ContentFileMemCache> } = {};
const _templates: { [key: string]: pug.compileTemplate } = {};
const _markdown: { [key: string]: { [key: string]: string | Buffer } } = {};
const _config: { [key: string]: { [key: string]: any } } = {};
const _dir_config: { [key: string]: WidgetsDirectoryConfig } = {};
/**
 * a list of registered "root" path fragments
 *
 * e.g. in `https://example.com/fun/games/and/stuff`, `fun` would be considered
 * the 'webroot'
 */
const webroots: string[] = [];
const webrootToWidgetDirectory: Record<string, string> = {};
const webrootToPugVariables: Record<string, any> = {};

/**
 *
 * @param {object} options
 * @param {String}  options.widget_directory The directory to look inside for widget files
 * @param {boolean} options.preload_widgets Whether widgets should be loaded into memory at startup
 * @param {boolean} options.lazy_load_allowed Whether the service is allowed to check for widgets on disk during runtime (after startup) (if not found in memory)
 * @param {string}  options.web_root
 * @param {string[]} options.plugins
 * @param {Record<string, any>} options.pugVariables
 */
async function init(
    options = {
        widget_directory: Path.join(__dirname, "widgets"),
        preload_widgets: true,
        lazy_load_allowed: true,
        web_root: "widgets",
        plugins: [] as string[],
        pugVariables: {} 
    }
) {
    fs.ensureDirSync(options.widget_directory);
    const widget_paths = await getFilePathsRecursive(options.widget_directory);
    webrootToWidgetDirectory[options.web_root] = options.widget_directory;
    webrootToPugVariables[options.web_root] = options.pugVariables;

    const templates: { [key: string]: pug.compileTemplate } = {};
    const widgets: { [key: string]: ContentFileMemCache } = {};
    const markdown: { [key: string]: string | Buffer } = {};
    const config: { [key: string]: any } = {};

    let dirConfig: WidgetsDirectoryConfig = {};
    const dirConfigPath = Path.join(
        Path.normalize(options.widget_directory),
        "config.json"
    );

    if (fs.existsSync(dirConfigPath)) {
        dirConfig = await readJson(dirConfigPath) as any;
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
                    .then((htmlStr: string) => (markdown[file_name] = htmlStr))
                    .catch((err) => logger.warn("failed to fill tooltup", err));
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
        const n_widgets = new Map<string, ContentFileMemCache>();
        for (const [key, value] of Object.entries(widgets).sort(
            (a, b) =>
                new Date(b[1]["session-date"]).getTime() -
                new Date(a[1]["session-date"]).getTime()
        )) {
            n_widgets.set(key, value);
        }
        _widgets_data[options.web_root] = n_widgets;
    } else {
        _widgets_data[options.web_root] = new Map<string, ContentFileMemCache>(
            Object.entries(widgets)
        );
    }
    if (dirConfig && dirConfig.thoughts && dirConfig.thoughts.type == "notes") {
        const n_widgets = new Map<string, ContentFileMemCache>();
        const colKeys = dirConfig.thoughts.columns.map((col) => col.key);
        for (const key of colKeys) {
            const sortedWidgetEntries = Object.entries(widgets).sort(
                (a, b) =>
                    new Date(b[1][key]).getTime() -
                    new Date(a[1][key]).getTime()
            );
            for (const [key, value] of sortedWidgetEntries) {
                n_widgets.set(key, value);
            }
        }

        _widgets_data[options.web_root] = n_widgets;
    } else {
        _widgets_data[options.web_root] = new Map<string, ContentFileMemCache>(
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
    contentType: string,
    content: any,
    statusCode = 200
): Response {
    const content_type = contentType ?? "text/raw";
    return new Response(
        content,
        {
            status: statusCode,
            headers: {
            "content-type": `${content_type}; charset=utf-8`,
        }
    });
}

function respondRedirect(to: string): Response {
    return new Response(null, {
        status: 301,
        headers: { 'Location' : to }
    })
}

function handleRequest(
    request: Request,
    supportedBasePaths: string[]
): Response | undefined | null {
    const url = new URL(request.url);
    const reqPath = url.pathname;
    console.log(`reqPath: ${reqPath}`);
    const reqPathOnly = trimTrailingSlash(url.pathname);
    const pathFrags = reqPathOnly.split("/");

    // timeline notes will ignore ALL paths that do not start with one of the
    // specified fragments.
    if (!supportedBasePaths.includes(pathFrags[1])) {
        return undefined;
    }

    const rpath = reqPath.replace(/^\/+/, "");
    for (const webroot of webroots) {
        if (rpath.startsWith(webroot)) {
            console.log(webroot);
            const srcUrlPath =
                "/" +
                Path.join(
                    ...webrootToWidgetDirectory[webroot].split("/").slice(2)
                );
            const pugVars = webrootToPugVariables[webroot];
            if (
                !reqPath.startsWith(srcUrlPath) &&
                pathFrags[pathFrags.length - 1].endsWith(".md")
            ) {
                return respondRedirect(
                    "https://" +
                        Path.join(
                            URL_ROOT.substring("https://".length),
                            srcUrlPath,
                            "content",
                            pathFrags[pathFrags.length - 1]
                        )
                );
            }

            if (pathFrags.length < 4 || pathFrags[3] === "list") {
                const rawDirConfig = _dir_config[webroot];
                const dirConfig = parseDirConfig(webroot);
                if (rawDirConfig.dnd) {
                    // TODO Properly handle responding to widgets in subdirs. (atm its reliant solely on basename, subdir has no effect)
                    return respond(
                        "text/html",
                        _templates["list"]({
                            ...pugVars,
                            widgets: _widgets_data[webroot].entries(),
                            title: dirConfig.title,
                            webroot: webroot,
                            ogPreview: dirConfig.ogPreview,
                        })
                    );
                } else if (rawDirConfig.thoughts) {
                    // TODO Properly handle responding to widgets in subdirs. (atm its reliant solely on basename, subdir has no effect)
                    const thoughtsDirConfig = rawDirConfig.thoughts;
                    // The fields available to each row in the table
                    const widgetMetadata = [
                        // for each widget
                        ..._widgets_data[webroot].entries(),
                    ].map(([widgetKey, widgetMeta]) => [
                        widgetKey,
                        {
                            ...widgetMeta,
                            columns: thoughtsDirConfig.columns.map(col => ({ 
                                value: widgetMeta[col.key],
                                cell_type: col.cell_type
                            })) ?? [],
                        },
                    ]);

                    return respond(
                        "text/html",
                        _templates["list_dynamic"]({
                            ...pugVars,
                            widgets: widgetMetadata,
                            columnHeaders: thoughtsDirConfig.columns.map(
                                (col) => col.displayName
                            ),
                            title: dirConfig.title,
                            webroot: webroot,
                        })
                    );
                }
            } else if (pathFrags[3] === "list-json") {
                return respond(
                    "application/json",
                    JSON.stringify(Object.keys(_widgets_data))
                );
            } else {
                try {
                    const frag = pathFrags.slice(3);
                    const widgetContents = _markdown[webroot][frag[0]];

                    const widgetMetadata = _widgets_data[webroot].get(frag[0]);
                    if (!widgetContents || !widgetMetadata) {
                        return null;
                    }
                    const widgetTitle = widgetMetadata.title;

                    const rawDirConfig = _dir_config[webroot];

                    const dirConfig = parseDirConfig(webroot);
                    console.log(widgetTitle);

                    if (rawDirConfig.dnd) {
                        // TODO Properly handle responding to widgets in subdirs. (atm its reliant solely on basename, subdir has no effect)
                        if (widgetContents) {
                            return respond(
                                "text/html",
                                _templates["dnd_summary_note"]({
                                    ...pugVars,
                                    widgetContents: widgetContents,
                                    title: widgetTitle,
                                    dirTitle: dirConfig.title,
                                    webroot: webroot,
                                })
                            );
                        }
                    } else if (rawDirConfig.thoughts) {
                        return respond(
                            "text/html",
                            _templates["thoughts_software_content"]({
                                ...pugVars,
                                widgetContents: widgetContents,
                                title: widgetTitle,
                                contentFile: widgetMetadata["content-file"],
                                dirTitle: dirConfig.title,
                                webroot: webroot,
                            })
                        );
                    }
                } catch (err) {
                    console.warn(err);
                    return null;
                }
            }
        }
    }
    if (pathFrags[1] === "dnd" && pathFrags.length > 2) {
        if (pathFrags[2] === "debug-widgets") {
            return respond(
                "application/json",
                JSON.stringify(
                    {
                        templates: Object.keys(_templates).sort(),
                        widgets: Object.keys(_widgets_data).sort(),
                        markdown: Object.keys(_markdown).sort(),
                        dir_configs: Object.entries(_dir_config).sort(),
                    },
                    null,
                    4
                )
            );
        } else {
            return undefined;
        }
    } else {
        return undefined;
    }
}

type DirRenderConfig = {
    title: string;
    ogPreview: OpenGraphProperties | null | undefined;
};

function parseDirConfig(webroot: string): DirRenderConfig {
    const dirConfig = _dir_config[webroot];
    if (!dirConfig) {
        throw new Error(
            `${__filename}: dirConfig was not defined for webroot '${webroot}'`
        );
    }
    if (dirConfig.dnd) {
        return {
            title: `Campaign Notes: ${dirConfig.dnd.campaign_title}`,
            ogPreview: dirConfig.dnd.ogPreview,
        };
    }
    if (dirConfig.thoughts) {
        return {
            title: `thoughts/${dirConfig.thoughts.topic}`,
            ogPreview: dirConfig.thoughts.ogPreview,
        };
    }
    throw new Error(
        `${__filename}: dirConfig did not have one of [thoughts, dnd] defined for webroot '${webroot}'`
    );
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
    } else if (pathFrags[1] && _markdown[web_root][pathFrags[1]]) {
        // Template and Markdown
        out = pug_template({ content: _markdown[web_root][pathFrags[1]] });
    } else if (pathFrags[0] && _markdown[web_root][pathFrags[0]]) {
        // Markdown only
        out = _markdown[web_root][pathFrags[0]];
    }

    return out;
}


async function getFilePathsRecursive(directory_path: string): Promise<string[]> {
    const result_dirents: string[] = [];
    await getFilePathsRecursiveImpl(directory_path, result_dirents);
    return result_dirents;
}
async function getFilePathsRecursiveImpl(
    directory_path: string,
    result_dirents: string[]
): Promise<void> {
    const subdir_dirents = [];
    const dirents = await fs.readdir(directory_path, { withFileTypes: true });

    for (const dirent of dirents) {
        if (dirent === null) break;
        const dirent_path = Path.join(directory_path, dirent.name);
        if (dirent.isFile()) {
            result_dirents.push(dirent_path);
        } else if (dirent.isDirectory()) {
            subdir_dirents.push(dirent_path);
        }
    }
        
    await Promise.all(subdir_dirents.map(async subdir => {
        await getFilePathsRecursiveImpl(subdir, result_dirents)
    }));
}

async function loadTemplates(dir: string) {
    const templates: { [key: string]: pug.compileTemplate } = {};
    const paths = await getFilePathsRecursive(dir);
    for (const file_path of paths) {
        let file_name = Path.basename(file_path);
        file_name = file_name.substr(0, file_name.lastIndexOf("."));
        const ext = Path.extname(file_path);
        const data = await fs.readFile(file_path, { encoding: "utf-8" });
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
    getPugTemplate, handleRequest, init, loadTemplates,
    _templates as templates
};

