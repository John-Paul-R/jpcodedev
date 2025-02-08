#!/bin/bash

fuser -k 9229/tcp 8082/tcp 8083/tcp

# Function to create tmux session and run commands
create_tmux_session() {
    # Start a new detached tmux session
    env SHELL=/bin/bash tmux new-session -d -s jpcodedev_debug_tmux /bin/bash

    # Split the window horizontally
    tmux split-window -h

    # Pass all environment variables to tmux
    for var in $(compgen -e); do
        tmux setenv -t jpcodedev_debug_tmux $var "${!var}"
    done

    # Run www command in the left pane
    tmux send-keys -t jpcodedev_debug_tmux:0.0 "/bin/bash -c '. ./debug.sourceme.sh; run_www'" C-m

    # Run static command in the right pane
    tmux send-keys -t jpcodedev_debug_tmux:0.1 "/bin/bash -c '. ./debug.sourceme.sh; run_static'" C-m

    # Attach to the tmux session
    tmux attach-session -t jpcodedev_debug_tmux
}

# Create and attach to tmux session
create_tmux_session

# The script will end here, but the tmux session will continue running