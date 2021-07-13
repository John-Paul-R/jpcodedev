
const spells = document.getElementsByClassName("spell");

for (const spell of spells) {
    const id = spell.getAttribute("data-desc-id");
    const descElem = document.getElementById(id);
    // const descSize = sizeFromRect(descElem.getBoundingClientRect());
    const moveListenter = (e) => {
        const textRect = e.target.getBoundingClientRect();
        const descRect = descElem.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();
        const directionNum = chooseDir((textRect.left+textRect.right)/2, descRect.width, bodyRect.width)
        const newLeft = (directionNum > 0 ? e.clientX+"px" : (e.clientX - descRect.width)+'px');
        descElem.style.left = newLeft;
    };
    spell.addEventListener("pointerover", (e) => {
        descElem.classList.add('open');
        const textRect = e.target.getBoundingClientRect();
        const descRect = descElem.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();

        const directionNum = chooseDir((textRect.top+textRect.bottom)/2, descRect.height, bodyRect.height);
        
        const newTop = (directionNum > 0 ? textRect.bottom+"px" : (textRect.top - descRect.height)+'px');
        
        descElem.style.top = newTop;
        
        descElem.style.left = (e.clientX) + 'px';
        e.target.addEventListener('pointermove', moveListenter);

    })

    spell.addEventListener("pointerout", (e) => {
        descElem.classList.remove('open');
        e.target.removeEventListener('pointermove', moveListenter);
    })
}

// choose direction that has least amount cut off.
/**
 * 
 * @param {number} pos midpoint of source elem 
 * @param {number} size size of desc box
 * @param {number} upperBound viewport size in this dimension
 * @returns {number} -1 for towards top, 1 for towards bottom.
 */
function chooseDir(pos, size, upperBound) {
    // Amount of desc out-of-screen (approx)
    const overlapBot = (pos + size) - upperBound;
    const overlapTop = size - pos;
    
    // Smaller overlap should be chosen
    return (overlapBot > overlapTop) ? -1 : 1;

}

// expand in certain direction if absolutely necessary.

function sizeFromRect(rect) {
    return {
        height: rect.height,
        width: rect.width
    };
}