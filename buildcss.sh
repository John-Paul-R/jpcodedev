mkdir -p public_static/css

runSass() {
    sass css/$1.scss public_static/css/$1.css
}

runSass "dnd_index"
runSass "widget_standalone"
runSass "projects-list"
runSass "github_md"
runSass "dnd_art_browse"
runSass "core_style"

# Rsync any already-compiled CSS files
rsync -av --include='*.css' --exclude='*' css/ public_static/css/