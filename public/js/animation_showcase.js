
(function() {

    const canvas = document.createElement('canvas');
    canvas.id = 'canvas';
    const canvas_container = document.getElementById("canvas_container");
    canvas_container.prepend(canvas);
    canvas.width = canvas_container.clientWidth;
    canvas.height = canvas_container.clientHeight;
    const ctx = canvas.getContext('2d');

    
    draw(currentPalette);
    function draw(palette) {
        ctx.fillStyle = palette.base[0];
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }


    hookPaletteButton();
    function hookPaletteButton() {
        let elems = document.getElementsByClassName('swap_palette');
        for (let i = 0; i < elems.length; i++) {
            elems[i].addEventListener('click', () => {
                draw(currentPalette)
            });
        }
    }
})();
