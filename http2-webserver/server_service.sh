#!/bin/bash

. .ports

deno run \
    --allow-read=".,../public,../public,../pug,src/foreign-api-cache" \
    --allow-write="../public,../public,log,src/foreign-api-cache" \
    --allow-env \
    --allow-sys='homedir' \
    --allow-import='deno.land:443,jsr.io:443,esm.sh:443,raw.githubusercontent.com:443,user.githubusercontent.com:443,arweave.net:443,lra6z45nakk5lnu3yjchp7tftsdnwwikwr65ocha5eojfnlgu4sa.arweave.net:443' \
    --allow-net \
    ./src/http2server2.1.ts \
    -p $www --pubpath ../public --log simple \
    --maxAge 0 \
    --urlAuthority='www.jpcode.dev'
