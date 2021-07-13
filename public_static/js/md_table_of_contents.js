
(function() {
    const md_containers = document.getElementsByClassName('markdown');

    for (const elem of md_containers) {
        const sect_heads = elem.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
    
        const toc_wrapper = document.createElement('div');
        toc_wrapper.classList.add('md_table_of_contents-wrapper');
        const table_of_contents = document.createElement('ol');
        table_of_contents.classList.add("md_table_of_contents");
        toc_wrapper.appendChild(table_of_contents);
    
        for (const head_el of sect_heads) {
            const sect_link = document.createElement('a');
            sect_link.href = "#"+head_el.id;
            sect_link.textContent = head_el.textContent;
            sect_link.addEventListener('click', (e) =>  {
                head_el.style.backgroundColor = mpal.currentPalette.base[1];
                setTimeout(() =>  {
                    head_el.style.backgroundColor = "";
                }, 1000);
            });
            table_of_contents.appendChild(sect_link);
        }
        elem.parentElement.insertBefore(toc_wrapper, elem.parentElement.firstChild);
    }
})();
