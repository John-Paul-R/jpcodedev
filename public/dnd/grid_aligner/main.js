
/*
Given:
  Img Height & Width
  Num Cells
Determine:
  Cell Width
*/

function buildPrompt() {
    const container = document.createElement('div');
    container.classList.add('auto_cells_prompt');
    const question = document.createElement('p');
    const makeInput = (name) => {
        const inContainer = document.createElement('div');
        const input = document.createElement('input');
        const label = document.createElement('label');

        label.textContent = `Cells on '${name}' axis:`

        inContainer.appendChild(label);
        inContainer.appendChild(input);
    }
    const inX = makeInput('x');
    const inY = makeInput('y');
    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Submit';
    submitBtn.addEventListener('click', (e) => {

    });

    container.appendChild(question);
    container.appendChild(inX);
    container.appendChild(inY);
    container.appendChild(submitBtn);
    document.appendChild(container);
    return container;
}
function promptForCellCount() {
    
}

function getCellWidth(h, w, cellsX, cellsY) {
    let cellHeight = h/cellsY;
    let cellWidth = w/cellsX;
    return cellHeight;
}

function calcBrightness(c) {
    return (c[0] + c[1] + c[2]) /3 /255;
}

const baseOffset = 255;
function getCellWidthFromImage(startWidth, endWidth, numRepeats) {
    var img = document.getElementById('my-image');
    var canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
    var ctx = canvas.getContext('2d');
    img.parentElement.appendChild(canvas);
    function getColorDiff(colorArr1, colorArr2) {
        let diff = 0;
        for (let i = 0; i < 3; i++) {
            diff += colorArr2[i] - colorArr1[i];
        }
        return diff / 3
    }
    function testWidth(width, numRepeats) {
        let prevPixelData;
        let differenceRating = 0;
        ctx.fillStyle = '#ffff00';
        for (let i = 0; i < numRepeats; i++) {
            let pixelData = ctx.getImageData(width*(i+1), baseOffset, 2, 2).data;
            if (i > 0) {
                differenceRating += getColorDiff(prevPixelData, pixelData);
            }
            prevPixelData = pixelData;
        }
        for (let i = 0; i < numRepeats; i++) {
            let pixelData = ctx.getImageData(baseOffset, width*(i+1), 2, 2).data;
            if (i > 0) {
                differenceRating += getColorDiff(prevPixelData, pixelData);
            }
            prevPixelData = pixelData;
        }
        return Math.abs(differenceRating);
    }
    let bestDiffRating = Infinity;
    let bestWidth;

    for (let i = startWidth; i < endWidth; i++) {
        let diffRating = testWidth(i, numRepeats);
        console.log({diffRating, i});
        if (diffRating < bestDiffRating) {
            bestDiffRating = diffRating;
            bestWidth = i;
        }
    }
    for (let i = 0; i < numRepeats; i++) {
        ctx.fillRect(baseOffset, 25*(i+1), 2, 2);

        ctx.fillRect(baseOffset, 25*(i+1), 2, 2);
    }
    return { bestDiffRating, bestWidth };
}

class BrightnessSpike {
    constructor(position, brightnessOffset, brightness) {
        this.position = position;
        this.brightnessOffset = brightnessOffset;
        this.brightness = brightness;
    }
}
var canvas = document.createElement('canvas');
function getCellWidthFromImage2(img, startWidth, lengthRatio, spikeStorecount, numLines) {
    let lenX = lengthRatio * img.width;
    let lenY = lengthRatio * img.height;
    // var img = document.getElementById('my-image');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
    var ctx = canvas.getContext('2d');
    document.body.appendChild(canvas);

    const sortSpikes = (a, b) => Math.abs(b.brightnessOffset) - Math.abs(a.brightnessOffset);
    function getLineBrightnessSpikesX(linePos, length, storeCount) {
        let spikes = [];
        let prevData = ctx.getImageData(linePos, startWidth, 1, 1).data;
        let prevBrightness = calcBrightness(prevData);
        for (let i = 1; i < length; i++) {
            let posOnLine = startWidth+i;
            let pixelData = ctx.getImageData(linePos, posOnLine, 1, 1).data;
            let brightness = calcBrightness(pixelData);
            let brightnessDelta = brightness - prevBrightness;
            spikes.push(new BrightnessSpike(posOnLine, brightnessDelta, brightness));
            prevData = pixelData;
            prevBrightness = brightness;
        }

        return spikes.sort(sortSpikes).slice(0, storeCount);
    }
    function getLineBrightnessSpikesY(linePos, length, storeCount) {
        let spikes = [];
        let prevData = ctx.getImageData(startWidth, linePos, 1, 1).data;
        let prevBrightness = calcBrightness(prevData);
        for (let i = 1; i < length; i++) {
            let posOnLine = startWidth+i;
            let pixelData = ctx.getImageData(posOnLine, linePos, 1, 1).data;
            let brightness = calcBrightness(pixelData);
            let brightnessDelta = brightness - prevBrightness;
            spikes.push(new BrightnessSpike(posOnLine, brightnessDelta, brightness));
            prevData = pixelData;
            prevBrightness = brightness;
        }

        return spikes.sort(sortSpikes).slice(0, storeCount);
    }
    let distTally = {};
    function findModeDistance(spikesIn, distTally) {
        let prevPos = 0
        let spikes = spikesIn.sort((a, b) =>  a.position - b.position);
        for (let i = 0; i < spikes.length; i++) {
            let cDist = spikes[i].position - prevPos;
            if (distTally[cDist])
                distTally[cDist] += 1;
            else
                distTally[cDist] = 1;
            prevPos = spikes[i].position;
        }
        return 0;
    }
    let spikesList = [];
    for (let i = 0; i < numLines; i++) {
        let linePosX = startWidth+((img.width-startWidth)/numLines)*i;
        let spikesX = getLineBrightnessSpikesX(linePosX, lenX, spikeStorecount);
        spikesList.push(spikesX);
        let linePosY = startWidth+((img.height-startWidth)/numLines)*i;
        let spikesY = getLineBrightnessSpikesY(linePosY, lenY, spikeStorecount);
        spikesList.push(spikesY);
        for (let i = 0; i < spikeStorecount; i++) {
            ctx.fillStyle = "#ff00ff";

            ctx.fillRect(linePosX, spikesX[i].position, 2, 2);
            ctx.fillRect(spikesY[i].position, linePosY, 2, 2);
        }
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(linePosX, startWidth+lenX, 2, 2);
        ctx.fillRect(startWidth+lenY, linePosY, 2, 2);
        findModeDistance(spikesX, distTally);
        findModeDistance(spikesY, distTally);
    }
    // NOTE: there will be a brightess DECREASE, followed by a brightness INCREASE most of the time if this is working correctly.
    // you can use this to find the width of the line used, potentially.

    // Possible implementation:
    // Record position of small-distance brightness changes (1-2 (<10) px in length)
    // Then calculate distance between these small-distance changes and find mode.

    // Math:
    // Adjust calculated px value to nearest val. that divides evenly into dimension length.

    console.log(distTally);
    let squareWidth = parseInt(mode(distTally, 10));
    let lineWidth = parseInt(mode(distTally, 0));
    let bimodal = isBimodal(distTally, squareWidth);
    let cellWidth;
    console.log(bimodal);
    if (bimodal.bimodal) {
        cellWidth = bimodal.mode;
        cellWidth = approxCellWidth(cellWidth, img.width);
    } else {
        cellWidth = approxCellWidth(squareWidth+lineWidth, img.width);
    }
    console.log(`Mode: ${squareWidth}`);
    console.log(`Cell Width: ${squareWidth+lineWidth}`);

    function approxCellWidth(cellWidth, dimensionLength) {
        let approxCellCount = Math.round(dimensionLength/cellWidth);
        return (dimensionLength/approxCellCount);
    }
    console.log(`approx cell count X: ${cellWidth}`);
    drawLines(img, ctx, cellWidth);
    return {
        height: img.height,
        width: img.width,
        squareWidth: squareWidth,
        lineWidth: lineWidth,
        cellWidth: cellWidth,
    };
}
function mode(obj, min, ignoreKey=null) {
    let maxKey = null;
    let maxVal = 0;
    for(const key of Object.keys(obj)) {
        const val = obj[key];
        if (val > maxVal && key > min && key != ignoreKey) {
            maxKey = key;
            maxVal = val;
        }
    }
    return maxKey;
}
/**
 * 
 * @param {*} img 
 * @param {HTMLCanvasElement} canvas 
 * @param {*} cellWidth 
 */
function drawLines(img, ctx, cellWidth) {

    const linesX = img.width/cellWidth;
    const linesY = img.height/cellWidth;
    ctx.strokeStyle = "#ff00ff";
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    for (let i = 1; i < linesX+1; i++) {
        ctx.beginPath();
        ctx.moveTo(cellWidth*i, 0);
        ctx.lineTo(cellWidth*i, img.height);
        ctx.stroke();
        ctx.closePath();
    }

    for (let i = 1; i < linesY+1; i++) {
        ctx.beginPath();
        ctx.moveTo(0, cellWidth*i);
        ctx.lineTo(img.width, cellWidth*i);
        ctx.stroke();
        ctx.closePath();
    }

}


// console.log(getCellWidthFromImage(10, 150, 20));
var img = new Image();

const onload = () => { 
    var result = getCellWidthFromImage2(img, 10, 1, 40, 45);
    document.getElementById("height").textContent = result.height;
    document.getElementById("width").textContent = result.width;
    document.getElementById("cell_width").textContent = result.cellWidth;
 }
 img.onload = onload;
img.src = "./jy43tx2esds61.jpg";


const inputElement = document.getElementById("file_input");
inputElement.addEventListener("change", handleFiles, false);
function handleFiles() {
  const fileList = this.files; /* now you can work with the file list */

  const imgFile = fileList[0];
    img.src = URL.createObjectURL(this.files[0]);
    console.log(img.src);

}

function isBimodal(distTally, modeKey) {
    let secondMode = mode(distTally, 10, modeKey);
    if (distTally[secondMode]/distTally[modeKey] > 0.5) {
        // Find true cellWidth
        return { bimodal: true, mode: Math.max(secondMode, modeKey) };
    }
    return { bimodal: false, mode: modeKey };
}

//roll20 elem to hook into: .dd-item.library-item.draggableresult