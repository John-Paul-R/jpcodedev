#!/bin/bash
. ./.ports
nodemon -L --inspect -w ../public -w ./ -w ../pug ./ts_output/http2server2.1.js -p $www --debug --pubpath ../public --log simple --maxAge 0 --host "www.jpcode.dev"
