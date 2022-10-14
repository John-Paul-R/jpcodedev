#!/bin/bash
. ./.ports
nodemon -L --inspect -w ../public_static -w ./ -w ../pug ./ts_output/http2server2.1.js -p $static --debug --pubpath ../public_static --maxAge 0 --log simple --host "static.jpcode.dev"
#node --inspect http2server2.0.js -p 8084 --debug --pubpath ../public_static --log simple -k ./credentials/server.key -c ./credentials/server.crt --maxAge 0
