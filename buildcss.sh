cd public_static/css

runSass() {
    sass $1.scss $1.css
}

runSass "dnd_index"
runSass "widget_standalone"
runSass "projects-list"
runSass "github_md"
