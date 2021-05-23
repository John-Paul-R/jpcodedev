
const wrappers = document.getElementsByClassName("dropdown_sc-wrapper");

for (const wrapper of wrappers) {
    const content = wrapper.getElementsByClassName("dropdown_sc-content");
    const buttons = wrapper.getElementsByClassName("dropdown_sc-button");
    for (const button of buttons) {
        button.addEventListener("click", (e)=>{
            const content_elem = content[0]; 
            const bodyListener = (e)=>{
                wrapper.classList.remove('open');
                document.body.removeEventListener('click', bodyListener);
            };
            
            if (!wrapper.classList.contains('open')) {
                // Going from closed to open
                document.body.addEventListener("click", bodyListener);
                e.stopPropagation();
            }
            wrapper.classList.toggle('open');
        });
    }
}