
// import * as PIXI from 'pixi.js';

window.anim = (function() {

const canvas_container = document.getElementById("canvas_container");
const app = new PIXI.Application({
    width: canvas_container.clientWidth,
    height: canvas_container.clientHeight,
    autoStart: false,
    resizeTo: canvas_container,
});
// const canvas = app.view;
const canvas = document.createElement('canvas');
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

canvas.width = canvas_container.clientWidth;
canvas.height = canvas_container.clientHeight;
linesPattern(canvas, currentPalette, Math.PI/4, 10, 10);
linesPattern(canvas, currentPalette, -Math.PI/4, 10, 10);

function hookElements() {
    // Palette Button
    let elems = document.getElementsByClassName('swap_palette');
    for (let i = 0; i < elems.length; i++) {
        elems[i].addEventListener('click', () => {
            draw(currentPalette);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = currentPalette.base[0];
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            linesPattern(canvas, currentPalette, Math.PI/4, 10);
            linesPattern(canvas, currentPalette, -Math.PI/4, 10);

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

/**
 * 
 * @param {HTMLCanvasElement} canvas 
 * @param {*} colors 
 * @param {*} angle 
 * @param {*} thickness1 
 * @param {*} thickness2 
 */
function linesPattern(canvas, colors, angle, thickness1) {
    const w = canvas.width;
    const h = canvas.height;
    const sp = Math.max(w, h)/10;
    const base = colors.base;
    const ctx = canvas.getContext('2d');
    let count = 0;
    const stopHeight = h*2*(w/h);
    const ratio = Math.tan(angle);
    let startX = 0;
    if (ratio < 0) {
        startX = w;
    }
    for (let i = 0; i < stopHeight; i += thickness1*2) {
        drawLine(i);
        count++;
    }


    function drawLine(i) {
        ctx.beginPath()
        ctx.lineWidth = thickness1;
        if (count % 2 === 1)
            ctx.strokeStyle = base[0];
        else
            ctx.strokeStyle = base[2];
        ctx.moveTo(startX, i);

        ctx.lineTo(startX+ratio*i, 0);
        ctx.closePath();
        ctx.stroke();

    }
}
/**
 * 
 * @param {HTMLCanvasElement} canvas 
 * @param {*} colors 
 * @param {*} angle 
 * @param {*} thickness 
 * @param {*} thickness2 
 */
 function linesPattern2(canvas, colors, angle, thickness, fillBetween=false) {
    const w = canvas.width;
    const h = canvas.height;
    const sp = Math.max(w, h)/10;
    const base = colors.base;
    const ctx = canvas.getContext('2d');
    let count = 0;
    const stopHeight = h*2*(w/h);
    const ratio = Math.tan(angle);
    let startX = -thickness;
    if (ratio < 0) {
        startX = w+thickness;
    }
    for (let i = 0; i < stopHeight; i += thickness*(w/h)) {
        if (count % 2 === 1) {
            if (fillBetween)
                drawLine(i, base[0])
        }
            
        else{
            drawLine(i, base[2]);
        }
            
        count++;
    }

    function drawLine(i, color) {
        ctx.beginPath()
        ctx.lineWidth = thickness;

        ctx.strokeStyle = color;
        ctx.moveTo(startX, i);

        ctx.lineTo(startX+ratio*i, -thickness);
        ctx.closePath();
        ctx.stroke();

    }
}

const outFuncs = {
    bg: (color=currentPalette.base[0]) => {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    drawLines: (angle, thickness) => linesPattern(canvas, currentPalette, angle, thickness),
    drawLines2: (angle, thickness, fillBetween=false) => linesPattern2(canvas, currentPalette, angle, thickness, fillBetween),
}

buildControlPanel();
function buildControlPanel() {
    const panel = document.getElementById("anim_control_panel_items");

    function buildButton(text, action) {
        const btn = document.createElement('button');
        btn.classList.add('button', 'glow');
        btn.textContent = text;
        
        btn.addEventListener('click', action);

        return btn;
    }

    // Clear Bg
    panel.appendChild(buildButton("Fill Bg", () => outFuncs.bg()));

    // drawLines
    panel.appendChild(buildButton("lines1", () => outFuncs.drawLines(Math.PI/4, 20)));

    // drawLines2
    panel.appendChild(buildButton("lines2", () => outFuncs.drawLines2(Math.PI/4, 20, true)));
}

return outFuncs;
})();
