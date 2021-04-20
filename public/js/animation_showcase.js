
// import * as PIXI from 'pixi.js';
const canvas_container = document.getElementById("canvas_container");
const app = new PIXI.Application({
    width: canvas_container.clientWidth,
    height: canvas_container.clientHeight,
    autoStart: false,
    resizeTo: canvas_container,
});
const canvas = app.view;
canvas.id = 'canvas';
canvas_container.prepend(canvas);
const stage = app.stage;
draw(currentPalette);
function draw(palette) {
    app.renderer.backgroundColor = hexFix(palette.base[0]);
    console.log(stage);
    app.render();
}

var sheet = createStyleSheet("animation-showcase");
hookElements();
function hookElements() {
    // Palette Button
    let elems = document.getElementsByClassName('swap_palette');
    for (let i = 0; i < elems.length; i++) {
        elems[i].addEventListener('click', () => {
            draw(currentPalette);
        });
    }

    // Animate Start Button
    let animate_btn = document.getElementById('animate_btn');
    const animate_btn_gfx = new PIXI.Graphics();
    stage.addChild(animate_btn_gfx);
    

    animate_btn.addEventListener("click", () => {
        animate_btn_gfx
            .lineStyle(8, '0xff8888', 1, 0.5, false)
            .beginFill('0x555555',0)
            .drawCircle(0, 0, 100);

        animate_btn_gfx.position.set(
            animate_btn.offsetLeft+animate_btn.clientWidth/2,
            animate_btn.offsetTop+animate_btn.clientHeight/2
        );
        app.renderer.render(stage);
        clickAnim(animate_btn, animate_btn_gfx);
    });
    animate_btn.addEventListener("pointerover", () => {

    });
    animate_btn.addEventListener("pointerout", () => {

    });
    app.render(stage);
    addCSS(`.project_item, .project_item *{
        transition: all 1s;
    }`);
}

function hexFix(hashtagHex) {
    return '0x'+hashtagHex.slice(1);
}

// Button hover animations
function hoverAnim(elem, graphics) {

}

function clickAnim(elem, graphics) {

    const projElems = document.getElementsByClassName('project_item');

    // projElems[0].style.position = "absolute";   
    const width = projElems[0].clientWidth;
    // projElems[0].style.transform = `translateX(-512px) translateY(${width/2}px) rotate(90deg)`;
    // projElems[1].style.transform = `translateY(-${projElems[1].offsetTop -projElems[1].parentElement.offsetTop}px)`;
    // projElems[2].style.transform = `translateY(${canvas_container.clientHeight - projElems[3].offsetTop}px)`;
    // projElems[3].style.transform = `translateX(512px) rotate(-90deg)`;
    for (let i = 0; i < projElems.length; i++) {
        randTranslate(projElems[i], true);
        // projElems[i].style.transition = "all 5s";
        // projElems[i].style.transform = "rotate3d(0, 1, 0, 180deg)";
    }
    /**
     * 
     * @param {HTMLElement} elem 
     * @param {boolean} recurse 
     */
    function undoTranslate(elem, recurse=false) {

        elem.style.transform = null;

        if (recurse && elem.children) {
            for (const childElem of elem.children) {
                undoTranslate(childElem, recurse);
            }
        }
    }
    function randTranslate(elem, recurse=false) {

        elem.style.transform = `translate3d(${(Math.random()-0.5)*600}px, ${(Math.random()-0.5)*600}px, ${(Math.random()-0.5)*600}px) rotate3d(${Math.random()}, ${Math.random()}, ${Math.random()}, ${(Math.random()-0.5)*360}deg)`

        if (recurse && elem.children) {
            for (const childElem of elem.children) {
                randTranslate(childElem, recurse);
            }
        }
    }
    setTimeout(() => {
        for (let i = 0; i < projElems.length; i++) {
            undoTranslate(projElems[i], true);
        }
    }, 5000);
}

function createStyleSheet(id, media) {
    var el   = document.createElement('style');
    // WebKit hack
    el.appendChild(document.createTextNode(''));
    // el.type  = 'text/css';
    el.rel   = 'stylesheet';
    el.media = media || 'screen';
    el.id    = id;
    document.head.appendChild(el);
    return el.sheet;
}

/**
 * 
 * @param {string} rulesText 
 */
function addCSS(rulesText) {
    const rules = rulesText.split('}');
    for (const rule of rules) {
        if (rule.trim() !== '')
            sheet.insertRule(rule);
    }
}
