cd public_static/css

runSass() {
    sass $1.scss $1.css
}

runSass "dnd_index"
runSass "widget_standalone"
runSass "projects-list"
runSass "github_md"
runSass "dnd_art_browse"
runSass "core_style"

