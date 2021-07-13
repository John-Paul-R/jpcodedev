
const spells = document.getElementsByClassName("spell");

for (const spell of spells) {
    spell.addEventListener("pointerover", (e) => {
        const id = e.target.getAttribute("data-desc-id");
        const descElem = document.getElementById(id)
        descElem.classList.add('open');
        const pos = e.target.getBoundingClientRect();

        descElem.style.top = pos.bottom + 'px';
        descElem.style.left = pos.right + 'px';
    })

    spell.addEventListener("pointerout", (e) => {
        const id = e.target.getAttribute("data-desc-id");
        document.getElementById(id).classList.remove('open');

    })
}