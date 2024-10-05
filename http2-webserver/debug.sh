#!/bin/bash

. .ports

run_www() {
    nodemon -L --inspect \
        -w ../public -w ./ -w ../pug \
        -x "deno run --allow-all" \
        http2server2.1.ts \
        -p $www --debug --pubpath ../public --log simple --maxAge 0 --host "www.jpcode.dev" \
        -k ./certs/localhost-privkey.pem \
        -c ./certs/localhost-cert.pem
}

run_static() {
    #--inspect 
    nodemon -L -w ../public_static -w ./ -w ../pug \
    -x "deno run --allow-all" \
    http2server2.1.ts \
    -p $static --debug --pubpath ../public_static --maxAge 0 --log simple --host "static.jpcode.dev" \
    -k ./certs/localhost-privkey.pem \
    -c ./certs/localhost-cert.pem
}

run_www &

run_static &

wait
wait
