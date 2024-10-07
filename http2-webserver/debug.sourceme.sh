source .ports

run_www() {
    deno run --inspect --allow-all --watch='../pug' --no-clear-screen \
         ./src/http2server2.1.ts \
        -p $www --debug --pubpath ../public --log simple --maxAge 0 \
        --urlAuthority "localhost:$www" \
        -k ./certs/localhost-privkey.pem \
        -c ./certs/localhost-cert.pem
}

run_static() {
    deno run --allow-all --watch='../pug' --no-clear-screen \
         ./src/http2server2.1.ts \
        -p $static --debug --pubpath ../public_static --maxAge 0 --log simple \
        --urlAuthority "localhost:$static" \
        --static \
        -k ./certs/localhost-privkey.pem \
        -c ./certs/localhost-cert.pem
}

# Export functions so they're available in tmux
export -f run_www
export -f run_static
