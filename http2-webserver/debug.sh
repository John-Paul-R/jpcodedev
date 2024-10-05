#!/bin/bash

. .ports

set -m
cleanup() {
    echo "Cleaning up..."
    echo "$(jobs -p)"
    kill $(jobs -p)
    exit
}
# Set up trap to call cleanup function on script exit
trap cleanup EXIT

run_www() {
    # --inspect-brk
    deno run --inspect --allow-all \
         ./src/http2server2.1.ts \
        -p $www --debug --pubpath ../public --log simple --maxAge 0 --urlAuthority "localhost:$www" \
        -k ./certs/localhost-privkey.pem \
        -c ./certs/localhost-cert.pem
}

run_static() {
    deno run --allow-all \
         ./src/http2server2.1.ts \
        -p $static --debug --pubpath ../public_static --maxAge 0 --log simple --urlAuthority "localhost:$static" \
        -k ./certs/localhost-privkey.pem \
        -c ./certs/localhost-cert.pem
}

# Run processes in background and capture their PIDs
run_www & pid1=$!
run_static & pid2=$!

echo "PIDS $pid1 $pid2"

# Wait for either process to finish
wait -fn $pid1 $pid2 || true

echo "DONE WAITING"

# If we get here, one of the processes has finished, so we exit
# This will trigger the cleanup function due to the trap
exit
