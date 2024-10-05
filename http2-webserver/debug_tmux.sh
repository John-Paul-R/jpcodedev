#!/bin/bash

fuser -k 9229/tcp 8082/tcp 8083/tcp

# Source the .ports file
set -a
source .ports
set +a

# Function to create tmux session and run commands
create_tmux_session() {
    # Start a new detached tmux session
    tmux new-session -d -s myapp

    # Split the window horizontally
    tmux split-window -h

    # Pass all environment variables to tmux
    for var in $(compgen -e); do
        tmux setenv -t myapp $var "${!var}"
    done

    # Run www command in the left pane
    tmux send-keys -t myapp:0.0 "run_www" C-m

    # Run static command in the right pane
    tmux send-keys -t myapp:0.1 "run_static" C-m

    # Attach to the tmux session
    tmux attach-session -t myapp
}

run_www() {
    deno run --inspect --allow-all --watch='../pug' --no-clear-screen \
         ./src/http2server2.1.ts \
        -p $www --debug --pubpath ../public --log simple --maxAge 0 --urlAuthority "localhost:$www" \
        -k ./certs/localhost-privkey.pem \
        -c ./certs/localhost-cert.pem
}

run_static() {
    deno run --allow-all --watch='../pug' --no-clear-screen \
         ./src/http2server2.1.ts \
        -p $static --debug --pubpath ../public_static --maxAge 0 --log simple --urlAuthority "localhost:$static" \
        -k ./certs/localhost-privkey.pem \
        -c ./certs/localhost-cert.pem
}

# Export functions so they're available in tmux
export -f run_www
export -f run_static

# Create and attach to tmux session
create_tmux_session

# The script will end here, but the tmux session will continue running