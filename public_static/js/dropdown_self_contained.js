
const wrappers = document.getElementsByClassName("dropdown_sc-wrapper");

for (const wrapper of wrappers) {
    const content = wrapper.getElementsByClassName("dropdown_sc-content")[0];
    const button = document.getElementById(`${wrapper.id}-btn`);

    content.addEventListener("mousedown", (e) => {
        // can't allow this event to reach `body` or the popup will close from
        // clicks within it.
        e.stopPropagation();
    })
    let isToggledDueToMouseDown;
    let isClickFromClose = false;
    const clickHandler = (e) => {
        isClickFromClose = false;
        const bodyListener = () => {
            wrapper.classList.remove('open');
            document.body.removeEventListener('mousedown', bodyListener);
            isToggledDueToMouseDown = undefined;
            isClickFromClose = true;
        };

        if (!wrapper.classList.contains('open')) {
            e.stopPropagation();
            // Going from closed to open
            document.body.addEventListener("mousedown", bodyListener);
        }
        wrapper.classList.toggle('open');
    };

    button.addEventListener("mousedown", (e) => {
        isToggledDueToMouseDown = true;
        clickHandler(e);
    })
    button.addEventListener("click", (e) => {
        if (isToggledDueToMouseDown) {
            // if "body"'s event fires, we'll close the menu we just
            // opened, so prevent that
            e.stopPropagation();
        } else if (!isClickFromClose) {
            clickHandler(e);
        }
    });
}