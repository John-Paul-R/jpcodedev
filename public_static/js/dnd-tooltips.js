const spells = document.getElementsByClassName("spell");

class DescElem {
    constructor(parentElement) {
        this.root = document.createElement('div');
        this.root.id = "spell-desc-tooltip";
        this.root.classList.add('spell_desc');

        this.name = this.root.appendChild(document.createElement('b'));
        this.name.classList.add('name');

        this.spell_meta = this.root.appendChild(document.createElement('span'));
        this.spell_meta.classList.add('spell_meta');

        this.cast_time = this.root.appendChild(document.createElement('span'));
        this.cast_time.classList.add('cast_time');

        this.desc = this.root.appendChild(document.createElement('p'));
        this.desc.classList.add('desc');
        parentElement.appendChild(this.root);
    }

    /**
     * {
            name: data.name,
            level: data.level,
            school: data.school.name,
            casting_time: data.casting_time,
            desc: data.desc,
        };
     */
    fillData(spellId) {
        const data = spell_desc_data[spellId];
        this.name.innerText = data['name'];
        this.spell_meta.innerText = `Level ${data['level']} ${data['school']}`;
        this.cast_time.innerText = data['casting_time'];
        this.desc.innerText = data['desc'];
    }

}

const descObj = new DescElem(document.querySelector(".widget_content.markdown"));
const descElem = descObj.root;
for (const spell of spells) {
    const id = spell.getAttribute("data-desc-id");
    // const descElem = document.getElementById(id);
    // const descSize = sizeFromRect(descElem.getBoundingClientRect());
    const moveListener = (e) => {
        const textRect = e.target.getBoundingClientRect();
        const descRect = descElem.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();
        const leftFn = positionFromPointer((textRect.left + textRect.right) / 2, descRect.width, bodyRect.width);
        descElem.style.left = leftFn(e.clientX)
    };
    spell.addEventListener("pointerover", (e) => {
        descElem.classList.add('open');
        descObj.fillData(id);

        const textRect = e.target.getBoundingClientRect();
        const descRect = descElem.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();

        const directionNum = chooseDir((textRect.top + textRect.bottom) / 2, descRect.height, bodyRect.height);

        if (directionNum > 0) {
            descElem.style.top = textRect.bottom + 'px';
            descElem.style.bottom = null;
        } else {
            descElem.style.top = null;
            descElem.style.bottom = (bodyRect.height - textRect.top) + 'px';
        }

        descElem.style.maxHeight = (directionNum > 0 ? bodyRect.bottom - textRect.bottom - 25 : textRect.top) + 'px';

        const leftFn = positionFromPointer((textRect.left + textRect.right) / 2, descRect.width, bodyRect.width);
        descElem.style.left = leftFn(e.clientX)

        e.target.addEventListener('pointermove', moveListener);
    })

    const createPopupHandler = (trigger, popup) => {
        let isPopupBound = false;
        const handler = (e) => {
            const otherElement = e.target === trigger ? popup : trigger;
            const isInOtherElement = isInBounds(e, otherElement);
            if (!isInOtherElement) {
                // Cleanup all listeners and close
                popup.classList.remove('open');
                trigger.removeEventListener('pointermove', moveListener);
                popup.removeEventListener('pointerout', handler);
                descElem.style.top = 'unset';
                descElem.style.maxHeight = 'unset';
                isPopupBound = false;
            } else if (isInBounds(e, popup) && !isPopupBound) {
                popup.addEventListener('pointerleave', handler)
                isPopupBound = true;
            }
        };

        return handler;
    };

    spell.addEventListener("pointerout", createPopupHandler(spell, descElem))
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
/**
 * 
 * @param {number} pos midpoint of source elem 
 * @param {number} size size of desc box
 * @param {number} upperBound viewport size in this dimension
 * @returns {number} -1 for towards top, 1 for towards bottom.
 */
function positionFromPointer(pos, size, upperBound) {
    const dir = chooseDir(pos, size, upperBound)
    const toAdd = (dir < 0) ? -size : 0
    const offset = 25;
    // const newLeft = (directionNum > 0 ? e.clientX + "px" : (e.clientX - descRect.width) + 'px');
    return (pos) => dir * (pos + toAdd + (-dir * offset)) + 'px'
}

// expand in certain direction if absolutely necessary.

function sizeFromRect(rect) {
    return {
        height: rect.height,
        width: rect.width
    };
}
function isInBounds(event, element) {
    const rect = element.getBoundingClientRect();
    return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
    );
}