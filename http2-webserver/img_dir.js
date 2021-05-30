
const Path = require('path');
const fs = require('fs');
const { request } = require('https');

const getImageFiles = source => {
    const file_end_len = "-thumb.webp".length;
    const statsFile = JSON.parse(fs.readFileSync(Path.join(source, "_stats.json")));
    let out = fs.readdirSync(source, { withFileTypes: true })
      .filter(dirent => dirent.isFile() && dirent.name.endsWith("-wm-thumb.webp"))
      .map(dirent => {
        const baseName = dirent.name.slice(0, dirent.name.length-file_end_len-3);
        return {
        "name": baseName,
        "fileName": dirent.name.slice(0, dirent.name.length-file_end_len),
        "dateModified": statsFile[baseName],
      }});
      // .map((name) => name["dateModified"] = statsFile[name.slice(0, name.length-3)]);
      
    // console.log(statsFile)
    // console.log(statsFile["Blank World Experiment 1"]);
    // console.log(out);
    // console.log(out[0].dateModified)
    out = out.sort((a, b) => b.dateModified - a.dateModified);
    console.log(out)
    return out;
  
  }
var imgDirPug;
var consts;
function init(pug, constants) {
    imgDirPug = pug;
    consts = constants;
    // websiteRoot = consts.websiteRoot;
    // exec_path = consts.exec_path;
}
function handleRequest(stream, headers, path, query) {
    // console.log(imgFiles);
    const isStatic = (consts.websiteRoot.startsWith("static."));
    console.log(consts.websiteRoot, isStatic);
    if (!isStatic) {
        console.log("pinging static server...");
        const req = request({
        hostname: "static.jpcode.dev",
        path: "/3d/all",
        port: 443,
        protocol: "https:",
        method: "GET"
        }, (res) => {
            res.setEncoding('utf8');
            stream.respond({
                'content-type': 'text/html; charset=utf-8',
                ':status': 200,
            });
            console.log(`STATUS: ${res.statusCode}`);
            res.on('data', (chunk) => {
                stream.write(chunk);
                // console.log(chunk);
            });
            res.on('end', () => {
                stream.end();
            });
        });

        // req.w/rite();
        req.end();


    } else {
        const imgFiles = getImageFiles(Path.join(consts.exec_path, '/img/3d'));
        let images = [];
        for (const imgFile of imgFiles) {
        const base = Path.join('img/3d', imgFile.fileName);
        const date = new Date(imgFile.dateModified);
        date.setUTCSeconds(imgFile.dateModified);
        console.log(imgFile.name, imgFile.dateModified, date)
        images.push({
            preview: new URL(`${base}-thumb.webp`, consts.URL_ROOT).toString(),
            link: new URL(`${base}.webp`, consts.URL_ROOT).toString(),
            dateString: date.toLocaleString(),
            title: imgFile.name,
        })
        }
        
        stream.write(imgDirPug({cards: images}));
        stream.end();
    } 
    
}
exports.init = init;
exports.handleRequest = handleRequest;
// exports = {
//     init: init,
//     handleRequest: handleRequest,
// }