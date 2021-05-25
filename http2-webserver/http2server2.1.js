
//  Imports
const http2 = require('http2');
const fs = require('fs');
const Path = require('path');
const log4js = require('log4js');
const pug = require('pug');
const widgets = require('./timeline-notes.js');
const fm = require('./files-manager.js');

//  Load ArgV
const optionDefinitions = [
  { name: 'key', alias: 'k', type: String },
  { name: 'cert', alias: 'c', type: String },
  { name: 'debug', alias: 'd', type: Boolean },
  { name: 'pubpath', type: String, multiple: false, defaultOption: true, defaultValue: "../public" },
  { name: 'port', alias: 'p', type: Number },
  { name: 'server-push', type: Boolean },
  { name: 'early-hints', type: Boolean },
  { name: 'allowHTTP1', type: Boolean, defaultValue: false },
  { name: 'log', type: String },
  { name: 'use-br-if-available', type: String, defaultValue: false },
  { name: 'maxAge', type: String },
  { name: 'static', type: Boolean, defaultValue: false},
  { name: 'host', type: String, multiple: false, defaultValue: "www.jpcode.dev" },
]
const commandLineArgs = require('command-line-args');
const runOpts = commandLineArgs(optionDefinitions)

const websiteRoot = runOpts.host;
const FILENAME = Path.basename(__filename)
const exec_path = runOpts.pubpath;
const exec_dirname = Path.basename(exec_path);
const execModeString = runOpts.debug ? 'DEBUG' : 'PRODUCTION';

// Init logger
const logger = log4js.getLogger();
log4js.configure({
  appenders: {
    logfile: {
      type: 'file',
      filename: Path.join('log', `${websiteRoot}-${execModeString}.log`),//${Date.now()}
      maxLogSize: 10485760,
      backups: 10,
      compress: true,
    },
    console: { type: 'console' },
  },
  categories: {
    default: { appenders: ['logfile', 'console'], level: 'INFO' },
  }
});
logger.info(`Starting ${FILENAME} in ${execModeString} mode.`);

// Set Logging Format based on runOpts
var logStream;
if (runOpts.log === "simple") {
  logStream = function (headers, socket) {
      logger.info(headers[HTTP2_HEADER_METHOD], headers[HTTP2_HEADER_PATH])
  };
} else if (runOpts.log === "verbose") {
  logStream = (headers, socket) => {
      logger.info(
        `${socket.remoteFamily}, ${socket.remoteAddress}, ${socket.remotePort}, ${headers[HTTP2_HEADER_METHOD]} '${headers[HTTP2_HEADER_PATH]}', ${headers[http2.constants.HTTP2_HEADER_REFERER]}, '${headers[http2.constants.HTTP2_HEADER_USER_AGENT]}'`
      );
  };
  // + headers[http2.constants.HTTP2_HEADER]
  // +` - pushList[reqPath]: ${pushList[reqPath]}`
} else {
  logStream = () => { };
}


// Load Pug Templates
widgets.loadTemplates("../pug");
var pugOptions = {
  basedir: "../pug",
  globals: [
    {
      linkify: (pathend) => `https://${websiteRoot}/${pathend}`
    },
  ],
}
// Initialize dnd/ian-oota Notes Widgets
widgets.init({
  widget_directory: Path.join(runOpts.pubpath, "dnd/ian-oota/widgets"),
  preload_widgets: true,
  lazy_lead_allowed: true,
  web_root: "dnd/ian-oota"
});
// Initialize dnd/jay-waterdeep Notes Widgets
widgets.init({
  widget_directory: Path.join(runOpts.pubpath, "dnd/jay-waterdeep/widgets"),
  preload_widgets: true,
  lazy_lead_allowed: true,
  web_root: "dnd/jay-waterdeep"
});

// Init file manager
fm.init(runOpts, widgets, pugOptions, logger);
fm.load(exec_path);


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

const port = runOpts.port || 8080;
const serverOpts = {
  allowHTTP1: runOpts.allowHTTP1
}

// Whether or not to use HTTPS on webserver
let useSecure = false;
if (runOpts.key && runOpts.cert) {
  serverOpts.key = fs.readFileSync(runOpts.key);
  serverOpts.cert = fs.readFileSync(runOpts.cert);
  useSecure = true;
  logger.info("Key and Cert Loaded. Running server with encryption enabled.");
} else if (runOpts.key || runOpts.cert) {
  logger.warn(`CommandLineArguments Error: A ${runOpts.key ? "key" : "cert"} was specified, but a ${runOpts.key ? "cert" : "key"} was not. In order to enable SSL/TLS, both must be specified. Starting server without SSL/TLS.`);
} else {
  logger.info("Key and Cert Unspecified. Running server without encryption.");
}

//  Create server
const server = useSecure ? http2.createSecureServer(serverOpts) : http2.createServer(serverOpts);

// server.on("request", ()=>{
//   console.info("Request Received");
// })
//  Handle Errors
server.on('error', (err) => logger.error(err));

//  Handle streams (requests are streams)
server.on('stream', (stream, headers) => {
  logStream(headers, stream.session.socket);
  try {
    const successCode = respond(stream, headers);
  } catch (err) {
    logger.error(err);
  }
});

const getDirectoriesOrHtml = source =>
  fs.readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() || dirent.name.endsWith(".html"))
    .map(dirent => dirent.name)

const pugFile = Path.join(__dirname, "templates", "list.pug");
const dirIndexPug = pug.compile(
  fs.readFileSync(pugFile), { filename: pugFile }
)
// Request Handler / Response Generator
function respond(stream, headers) {
  // stream is a Duplex
  const method = headers[HTTP2_HEADER_METHOD];
  const path = headers[HTTP2_HEADER_PATH];
  const socket = stream.session.socket;
  const encodings = headers[HTTP2_HEADER_ACCEPT_ENCODING];

  const requestedFile = fm.getFile(path);
  if (requestedFile)
    requestedFile.headers[HTTP2_HEADER_CONTENT_LENGTH] = Buffer.byteLength(requestedFile.data, 'utf8');
  //Try widget
  if (!requestedFile) {
    const successCode = widgets.handleRequest(stream, headers);
    if (successCode === 0)
      return 0;
  }
  if (!requestedFile) {
    try {
      let fpath = Path.join(exec_path, path)
      let fd = fs.openSync(fpath);
      if (fs.fstatSync(fd).isFile()) {
        stream.respondWithFD(fd);
        stream.on('close', () => fs.closeSync(fd));
        return 0;
      } else if (fs.fstatSync(fd).isDirectory()) {
        fs.closeSync(fd);
        // DO directory index things
        const opts = {
          dir: Path.basename(path),
          widgets: getDirectoriesOrHtml(fpath)
            .map(name =>  {return { name: name, link: "https://"+Path.join(websiteRoot, path, name) };})
        }
        stream.respond({
          'content-type': 'text/html; charset=utf-8',
          ':status': 200,
        })
        stream.write(dirIndexPug(opts));
        stream.end();
        return 0;

      }
    } catch (error) {
      // logger.warn(error);
    }
  }

  // Send successful response
  try {
    resHeaders = requestedFile.headers;
    resHeaders[':status'] = 200;

    stream.respond(resHeaders);
    stream.end(requestedFile.data);
    return 0;
  } catch (err) {
    // logger.error(err);
  }
  // Handle 404
  logger.warn(`404 Not Found: ${path}`)
  handle404(stream, headers);
  return -1;
}
function handle404(stream) {
  
  if (runOpts.static) {
    stream.respond({
      ':status': 404
    });
    stream.end();
  } else {
    stream.respond({
      'content-type': 'text/html; charset=utf-8',
      ':status': 404
    });
    stream.end(fm.getFile("/404.html").data);
  }
  
  // stream.end('<h1>HTTP Error 404 - Requested file not found.</h1>');
  return -1;

}

// Start Server
server.listen(port);
logger.info(`'${FILENAME}' is listening on port ${port}`);
