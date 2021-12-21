
const containerDiv = document.getElementById("advanced_particles-container");

let baseColor = mpal.currentPalette.text[0] ?? '#ffffff';
mpal.onPaletteChange((palette) => {
    baseColor = palette.text[0];
});

function d2h(d) {
    var s = (+d).toString(16);
    if (s.length < 2) {
        s = '0' + s;
    }
    return s;
}

const roundToNearest = (x, n) => Math.round(x / n) * n
const floatToGrayColor = (num) =>
    baseColor + d2h(roundToNearest(num * 255, 1))

const floatToAccentColor = (num) =>
    mpal.currentPalette.accent1[0] + d2h(roundToNearest(num * 255, 5))

//'#' + d2h(roundToNearest(num * 255, 1)).repeat(3)// + roundToNearest(num * 255, 1)


advancedparticles.init();
containerDiv.style.height = '100%';
containerDiv.style.width = '100%';
var containerRect = containerDiv.getBoundingClientRect();
const distToCursor = (x, y) =>
    Math.sqrt((cursorPosition.x - containerRect.x - x) ** 2 + (cursorPosition.y - containerRect.y - y) ** 2);

console.log(containerRect.width, containerRect.height);
let cursorPosition = { x: 0, y: 0 };
document.addEventListener('mousemove', (e) => {
    cursorPosition = { x: e.clientX, y: e.clientY };
});
// particles per sq pixel
const particleDensity = 0.001;
const colorNums = [];
const maxLineRange = 60;
const settings = {
    particleCount: containerRect.width * containerRect.height * particleDensity,
    sizeSupplier: (state) => {
        const dist = distToCursor(state.x, state.y);
        return Math.max(Math.min(750 / dist, 7), 1);
    },
    velocity: (state) => {
        const dist = distToCursor(state.x, state.y);
        if (dist > 500) {
            return 0;
        }
        return Math.max(Math.min(250 / dist, 8), 0.5);
    },
    bounds: { x1: 0, y1: 0, x2: containerRect.width, y2: containerRect.height },
    colorSupplier: (state) => {
        const dist = distToCursor(state.x, state.y);
        return floatToAccentColor(Math.max(0, -(1 / (350)) * dist + 1));
    },
    maxLineRange,
    circleMode: "fill",
    lineColorSupplier: (state1, state2) => {

        const dist = Math.sqrt((state2.x - state1.x) ** 2 + (state2.y - state1.y) ** 2);
        //return Math.sqrt((state2.x-state1.x)**2 + (state2.y-state1.y)**2) > 34 ? "#ffffff" : "#353535"
        return floatToGrayColor(-(1 / maxLineRange) * dist + 1);
    }

};
const startState = advancedparticles.generateInitialState(settings);
const ctx = document.getElementById("advanced_particles-container").firstElementChild.getContext('2d');
ctx.canvas.width = containerRect.width;
ctx.canvas.height = containerRect.height;

const debugDisplay = document.getElementById('debug_info');

const renderCallback = (info, settings) => {
    // let outText = "";
    // for (const [key, value] of Object.entries(info)) {
    // outText += `<div>${key}:</div><div>${value.toFixed(3)}</div>`
    // }
    // debugDisplay.innerHTML = outText;
    // -- variable things
    containerRect = containerDiv.getBoundingClientRect();

    return {
        ...settings,
    };
}

advancedparticles.nextFrame({ ctx, settings, state: startState, renderCallback });
