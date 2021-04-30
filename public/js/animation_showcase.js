
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
const ctx = canvas.getContext('2d');
canvas.id = 'canvas';
canvas_container.prepend(canvas);
const stage = app.stage;
draw(mpal.currentPalette);
function draw(palette) {
    app.renderer.backgroundColor = hexFix(palette.base[0]);
    console.log(stage);
    app.render();
}

var sheet = createStyleSheet("animation-showcase");
hookElements();

var canvasRect;
initCanvas();
function initialPattern() {
    linesPattern(canvas, mpal.currentPalette, Math.PI/4, 10, 10);
    linesPattern(canvas, mpal.currentPalette, -Math.PI/4, 10, 10);

}
function initCanvas() {
    canvas.width = canvas_container.clientWidth;
    canvas.height = canvas_container.clientHeight;
    canvasRect = canvas.getBoundingClientRect();
    initialPattern();
}
function hookElements() {
    // Palette Button
    let elems = document.getElementsByClassName('swap_palette');
    for (let i = 0; i < elems.length; i++) {
        elems[i].addEventListener('click', () => {
            draw(mpal.currentPalette);
            ctx.fillStyle = mpal.currentPalette.base[0];
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            linesPattern(canvas, mpal.currentPalette, Math.PI/4, 10);
            linesPattern(canvas, mpal.currentPalette, -Math.PI/4, 10);

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

/**
 * 
 * @param {*} pos 
 * @param {CanvasRenderingContext2D} ctx 
 */
function circle(pos, ctx) {
    const r = 5;
    if (pos)
        ctx.fillRect(pos.x-r, pos.y-r, 2*r, 2*r);
}
var paintBg;
// Returns function that handles mouse event
var animateCursorTrail;
function cursorTrailFunc(shapeFunc, maxlen=16, mindist=10) {
    let mousePosHistory = [];
    let lastPos = {x: 0, y: 0};

    animateCursorTrail = (frameStuff) => {
        ctx.fillStyle = mpal.currentPalette.accent1[0];
        
        // e.y = e.y-32;
        for (let i = 0; i < mousePosHistory.length; i++) {
            ctx.globalAlpha = (i+1)/maxlen;
            shapeFunc(mousePosHistory[i], ctx);
        }
        ctx.globalAlpha = 1;
    };
    /**
     * @param {MouseEvent} e 
     */
    const outFunc = (e) =>  {
        let pos = pageCoordToRect(e.x, e.y);
        let dist = Math.sqrt((pos.x-lastPos.x)**2 + (pos.y-lastPos.y)**2);
        // console.log(dist);
        if (dist >= mindist || mousePosHistory.length < maxlen) {
            mousePosHistory.push(pos);
            lastPos = pos;
            if (mousePosHistory.length > maxlen)
                mousePosHistory = mousePosHistory.slice(1);
        }

    };

    return outFunc;
}

/**
 * 
 * @param {object} pos 
 * @param {DOMRect} rect 
 * @returns 
 */
function pageCoordToRect(x, y, rect=canvasRect) {
    return {
        x: x - rect.x,
        y: y - rect.y,
    };
}

window.addEventListener('resize', (e) => {
    initCanvas();
});

/**
 * @type {Array<ClickCircle>}
 */
var clickCircles = [];
var circleGrowRate = 1;
var circleMaxLifetime = 60;
class ClickCircle {
    constructor(position, color) {
        this.pos = position;
        this.color = color;
        this.lifetime = 0;
    }

    /**
     * 
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        this.lifetime++;
        let rad = this.lifetime*circleGrowRate;
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = Math.sqrt((circleMaxLifetime-this.lifetime)/circleMaxLifetime);
        ctx.beginPath()
        ctx.ellipse(this.pos.x, this.pos.y, rad, rad, 0, 0, 2*Math.PI);
        ctx.stroke();
        ctx.closePath()
        ctx.globalAlpha = 1;
    }
}

/**
 * 
 * @param {MouseEvent} e 
 */
function clickCircle(e) {
    clickCircles.push(new ClickCircle(pageCoordToRect(e.x, e.y), mpal.currentPalette.element1[0]));
}
document.addEventListener('click', clickCircle)

function animateClickCircles(frameStuff) {
    for (let i = 0; i < clickCircles.length; i++) {
        let circle = clickCircles[i];
        circle.draw(ctx);
        if (circle.lifetime >= circleMaxLifetime)
            clickCircles.splice(i, 1);
    }
}


    

function animate(frameStuff) {
    clearBg();
    paintBg();

    animateClickCircles(frameStuff);
    animateCursorTrail(frameStuff);

    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

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
    let count = 0;
    const stopHeight = h*2*Math.max(w/h, 1);
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
    const base = colors.base;
    let count = 0;
    const stopHeight = h*2*Math.max(w/h, 1);
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

function clearBg(color=mpal.currentPalette.base[0]) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
const outFuncs = {
    bg: clearBg,
    drawLines: (angle, thickness) => linesPattern(canvas, mpal.currentPalette, angle, thickness),
    drawLines2: (angle, thickness, fillBetween=false) => linesPattern2(canvas, mpal.currentPalette, angle, thickness, fillBetween),
    cursorTrail: (maxlen, mindist) => {
        document.body.addEventListener("mousemove", cursorTrailFunc(circle, maxlen, mindist));
    },
}
// TODO Specify line spacing, instead of number of lines, so that the generated pattern is consistent across aspet ratios & screen sizes.
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
    panel.appendChild(buildButton("Fill Bg", () => {
        paintBg = () => outFuncs.bg(mpal.currentPalette.base[0]);
        paintBg();
    }));

    // drawLines
    panel.appendChild(buildButton("lines1", () => {
        paintBg = () => outFuncs.drawLines(Math.PI/4, 20);
        paintBg();
    }));

    // drawLines2
    panel.appendChild(buildButton("lines2", () => {
        paintBg = () => outFuncs.drawLines2(Math.PI/4, 20, true);
        paintBg();
    }));


    // drawLines2
    panel.appendChild(buildButton("diamonds", () => {
        paintBg = () => {
            outFuncs.drawLines2(Math.PI/4, 30, false);
            outFuncs.drawLines2(-Math.PI/4, 30, false);
        }
        paintBg();
    }));

    // drawLines2
    panel.appendChild(buildButton("dots", () => {
        paintBg = () => {
            outFuncs.drawLines2(Math.PI/4, 20, false);
            outFuncs.drawLines2(-Math.PI/4, 20, false);
        }
        paintBg();
    }));

    // initial
    panel.appendChild(buildButton("default", () => {
        paintBg = initialPattern;
        paintBg();
    }));
}
paintBg = initialPattern;
outFuncs.cursorTrail(16, 10);
return outFuncs;
})();
