

//Create the Pixi Application
/**
 * @type {PIXI.Application}
 */
var app;
/**
 * @type {PIXI.Container}
 */
var stage;
/**
 * @type {PIXI.Loader}
 */
var loader;
console.log("Creating PIXI app.");
var CONTAINER_ELEMENT = document.getElementById("pixibg");

app = new PIXI.Application({
    autoStart: true,
    antialias: true,
    sharedLoader: true,
    sharedTicker: true,
    resolution: devicePixelRatio,
    autoDensity: true,
    resizeTo: CONTAINER_ELEMENT,
});

stage = app.stage;
// app.loader.onComplete.once(() => {
//     console.timeLog("load");
//     CONTAINER_ELEMENT = document.getElementById("pixibg")
//     CONTAINER_ELEMENT.appendChild(app.view);
// });
CONTAINER_ELEMENT.appendChild(app.view);

// loader
    // .add("img/Atlas47kb.webp")
    // .load(setup);


var pointRows = [];
const spacing = 35;
const defaultLineStyle = {
    width: 3,
    color: 0x222222,
    alpha: 1,
    native: false
};
function initPoints(spacing) {
    // Create Base Point
    function createBasePoint(radius, lineWidth) {
        const lineStyle = {
            width: lineWidth,
            color: 0x222222,
            alpha: 1,
            native: false
        }
        let nodeGraph = new PIXI.Graphics();
        nodeGraph.lineStyle(lineStyle)
            .beginFill('0xFFFFFF', 1)
            .drawCircle(0, 0, radius)
            .moveTo(0, 0)
            .lineTo(-radius, 0)
    
        const texSizeNormal = radius * 2 + lineStyle.width;
        const res = 2;
        let normalTex = PIXI.RenderTexture.create({ width: texSizeNormal, height: texSizeNormal, resolution: res});
        normalTex.defaultAnchor = new PIXI.Point(0.5, 0.5);
        nodeGraph.position.set(texSizeNormal/2, texSizeNormal/2);

        app.renderer.render(nodeGraph, normalTex);

        return normalTex;
    }
    const bPoint = createBasePoint(10, 1);
    const pointsContainer = new PIXI.Container();
    let width = CONTAINER_ELEMENT.clientWidth;
    let height = CONTAINER_ELEMENT.clientHeight;
    const hspace = spacing/2
    let hPoints = Math.floor(width/spacing);
    let vPoints = Math.floor(height/spacing);
    const numPoints = hPoints*vPoints;
    for (let i = 0; i < hPoints; i++) {
        let row = [];
        let xpos = hspace+spacing*i;
        for (let j = 0; j < vPoints; j++) {
            let sprite = new PIXI.Sprite(bPoint);
            row.push(sprite);
            pointsContainer.addChild(sprite)
            sprite.position.set(xpos, hspace+spacing*j);
            sprite.tint = PIXI.utils.rgb2hex(HSVtoRGB((i*vPoints+j)/numPoints, 1, 1));
        }
        pointRows.push(row);
    }
    return pointsContainer;
}
var pointsContainer = initPoints(spacing);
stage.addChild(pointsContainer);
// pointsContainer.anchor.set(0.5, 0.5);
// let temp = getCenter();
// pointsContainer.position.set(temp.x-pointsContainer.width/2, temp.y-pointsContainer.height/2);

window.addEventListener('resize', ()=>{
    stage.removeChild(pointsContainer)
    pointRows = [];
    pointsContainer = initPoints(spacing);
    stage.addChild(pointsContainer);
});
var frameCount = 0;
function pointBrightnessByMouseProximity() {
    const interactMgr = app.renderer.plugins.interaction;
    const mouseData = interactMgr.mouse;
    const numPoints = pointRows.length * pointRows[0].length;
    for (let i = 0; i < pointRows.length; i++) {
        for (let j = 0; j < pointRows[0].length; j++) {
            let sprite = pointRows[i][j];
            let pos = mouseData.global;
            let dx = pos.x - sprite.x;
            let dy = pos.y - sprite.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            let normalized_dist_thing = Math.min(1, (1/(dist/(20))));
            sprite.tint = PIXI.utils.rgb2hex(HSVtoRGB(
                (i*pointRows.length+j)/numPoints+frameCount/1000, 
                Math.max(0.1, normalized_dist_thing), 
                Math.max(0.15, normalized_dist_thing)
            ));
            if (flashLightMode)
                sprite.alpha = normalized_dist_thing*2;
            else
                sprite.alpha = 1;  
            sprite.scale.set(Math.max(0.5, Math.min(2, 10/Math.sqrt(dist))));
            sprite.rotation = Math.atan2(dy, dx);
        }
    }
    
    frameCount += 1;
}

/* accepts parameters
 * h  Object = {h:x, s:y, v:z}
 * OR 
 * h, s, v
*/
function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return [
        r,
        g,
        b
    ];
}
function hsv2hex(h, s, v) {
    return PIXI.utils.hex2string(PIXI.utils.rgb2hex(HSVtoRGB(h, s, v)));
}


function circleWave() {
    const numPoints = pointRows.length * pointRows[0].length;
    for (let i = 0; i < pointRows.length; i++) {
        for (let j = 0; j < pointRows[0].length; j++) {
            let sprite = pointRows[i][j];

            
            sprite.scale.set(Math.sin(frameCount/100+i));
            // sprite.rotation = Math.atan2(dy, dx);
        }
    }
    
}

// var timeSinceLastClick = -1;
// function clickCircleWave() {
//     const interactMgr = app.renderer.plugins.interaction;
//     const mouseData = interactMgr.mouse;
//     const numPoints = pointRows.length * pointRows[0].length;
//     for (let i = 0; i < pointRows.length; i++) {
//         for (let j = 0; j < pointRows[0].length; j++) {
//             let sprite = pointRows[i][j];
//             let pos = mouseData.global;
//             let dx = pos.x - sprite.x;
//             let dy = pos.y - sprite.y;
//             let dist = Math.sqrt(dx*dx + dy*dy);
            
//             sprite.scale.set(Math.sin((timeSinceLastClick+dist)/100)*(100/dist));
//             // sprite.rotation = Math.atan2(dy, dx);
//         }
//     }
    
//     if (timeSinceLastClick != -1) {
//         timeSinceLastClick += 1;
//     } else if (timeSinceLastClick > 500) {
//         timeSinceLastClick = -1;
//     }
// }

app.ticker.add(pointBrightnessByMouseProximity);
// app.ticker.add(circleWave)
// app.ticker.add(clickCircleWave);

document.addEventListener('click', ()=>{
    timeSinceLastClick = 0;
});

var centerCircle
function buildCenterCircle() {
    let centerCircle = new PIXI.Graphics();
    let radius = 256;
    centerCircle.lineStyle({
        width: 4,
        color: 0x222222,
        alpha: 1,
        native: false
    }).beginFill('0x000000', 1)
    .drawCircle(0, 0, radius)

    let ticksCircle = new PIXI.Graphics();
    centerCircle.ticksCircle = ticksCircle;
    let totalItems = 75;
    let pi = Math.PI;
    let tau = 2*pi;
    let step = tau/totalItems;
    ticksCircle.step = tau/totalItems;
    let angle = 0;
    let startDist = radius-8;
    let endDist = radius+8;

    ticksCircle.lineStyle({
        width: 4,
        color: 0x767676,
        alpha: 1,
        native: false
    })
    for (let i = 0; i < totalItems; i++) {
        let vx = Math.cos(angle), vy = Math.sin(angle);
        ticksCircle.moveTo(startDist*vx, startDist*vy);
        ticksCircle.lineTo(endDist*vx, endDist*vy);
        angle += step;
    }
    (function(){
        let colorCircle = new PIXI.Graphics();
        centerCircle.colorCircle = colorCircle;
        let totalSteps = 100;
        let step = tau/totalSteps;
        let dist = radius;
        let angle = 0;
        let nextX = dist;
        let nextY = 0;
        for (let i = 0; i < totalSteps; i++) {
            colorCircle.moveTo(nextX, nextY);
            // colorCircle.lineTextureStyle({
            //     width: 4,
            //     texture: gradient(
            //         hsv2hex(i/totalSteps, 1, 1), 
            //         hsv2hex((i+1)/totalSteps, 1, 1), 
            //         300),
            //     alpha: 1,
            //     native: false,        
            // })
            colorCircle.lineStyle({
                width: 4,
                color: PIXI.utils.rgb2hex(HSVtoRGB(i/totalSteps, 1, 1)),
                alpha: 1,
                native: false
            })
            angle += step;
            nextX = dist*Math.cos(angle);
            nextY = dist*Math.sin(angle);
            colorCircle.lineTo(nextX, nextY);
        }
        
        colorCircle.alpha = 1;
        centerCircle.interactive = true;
        // centerCircle.pointerover = () => colorCircle.alpha = 1;
        // centerCircle.pointerout = () => colorCircle.alpha = 0;
        // document.getElementById('center_content_container').addEventListener('pointerover', () => {
        //     colorCircle.alpha = 1;
        // })
    })()
    centerCircle.addChild(centerCircle.colorCircle);
    centerCircle.addChild(ticksCircle);
    return centerCircle;
}
centerCircle = buildCenterCircle();
app.stage.addChildAt(centerCircle, 1);
centerCircle.position.set(
    (app.screen.width)/2, 
    (app.screen.height)/2
);

app.ticker.add(() => {
    centerCircle.ticksCircle.rotation += centerCircle.ticksCircle.step/200;
    centerCircle.colorCircle.rotation -= centerCircle.ticksCircle.step/200;
})


function gradient(from, to, size=100) {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const grd = ctx.createLinearGradient(0,0,size,size);
    grd.addColorStop(0, from);
    grd.addColorStop(1, to);
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,size,size);
    return new PIXI.Texture.from(c);
}
function radialGradient(from, to) {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const grd = ctx.createRadialGradient(128,128,256,100,100);
    grd.addColorStop(0, from);
    grd.addColorStop(1, to);
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,100,100);
    return new PIXI.Texture.from(c);
}

// Create Buttons
(function(){
    function createButton(textContent, color, uniqueAction) {
        let button = new PIXI.Graphics();
        let bWidth = 128, bHeight = 48;
        button.lineStyle({
            width: 3,
            color: color
        }).beginFill(0x111111, 1)
        .drawRoundedRect(-bWidth/2, -bHeight/2, bWidth, bHeight, 16);
        
        let text = new PIXI.Text(textContent, {
            fontFamily: "sans-serif",
            fill: '0xeeeeee',
            fontSize: 24,
        });
        text.anchor.set(0.5,0.5);
        button.addChild(text);

        button.interactive = true;
        button.cursor = 'pointer';
        button.pointerover = () => {
            button.tint = 0x888888;
        }
        button.pointerout = () => {
            button.tint = 0xffffff;
        }

        return button;
    }

    let container = new PIXI.Container();
    let button1 = createButton("Resumé", 0x3535ff);
    button1.click = () => window.open("https://static.jpcode.dev/files/john-paul-r-resume-2020-4.pdf","_self");
    let button2 = createButton("Contact", 0x35ff35);
    button2.click = () => window.open("https://www.jpcode.dev/contact","_self");

    container.addChild(button1);
    container.addChild(button2);
    app.stage.addChild(container);

    let center = getCenter();
    container.position.set(center.x, center.y+76);
    let xoffset = 64+16;
    button1.position.set(-xoffset, 0);
    button2.position.set(xoffset, 0);

})();

// Create divider line
function createDivider() {
    let line = new PIXI.Graphics();
    let halfWidth = 128;
    line.lineStyle({
        width: 2,
        color: 0x353535,
        alpha: 1,
        native: false
    }).moveTo(-halfWidth, 0)
    .lineTo(halfWidth, 0)
    app.stage.addChild(line);
    line.position = getCenter();
    
}
createDivider();


// Draw technology icon containers with Arcs
(function(){
    let arcContainer = new PIXI.Graphics();
    let cx = 0, cy = 0, radius = 512, startAngle = Math.PI*(5/6), endAngle = Math.PI*(7/6);
    let width = 128;
    arcContainer.lineStyle({
        width: 4,
        color: 0xeeeeee
    })
    .beginFill(0x000000, 1)
    .moveTo(radius*Math.cos(startAngle)+width, radius*Math.sin(startAngle))
    .arc(cx, cy, radius, startAngle, endAngle)
    .arc(width, cy, radius,endAngle, startAngle, true)
    
    let arcLeft = arcContainer.clone(), arcRight = arcContainer.clone();
    
    let center = getCenter();
    function finalize(sprite) {
        app.stage.addChild(sprite);
        sprite.position = center;
        sprite.alpha = 0.88;
    }
    finalize(arcLeft);
    finalize(arcRight);
    arcRight.scale.x = -1;
})();


function getCenter() {
    return new PIXI.Point((app.screen.width)/2, (app.screen.height)/2);
}

let flashLightMode = false;
const flashLightModeToggle = document.body.appendChild(document.createElement('button'));
flashLightModeToggle.addEventListener('click', () => {
    flashLightMode = !flashLightMode;
});
flashLightModeToggle.style.position = "absolute";
flashLightModeToggle.style.top = "1rem";
flashLightModeToggle.style.right = "1rem";
flashLightModeToggle.style.padding = "0.25em";
flashLightModeToggle.textContent = "Toggle Flashlight Mode";
