
(function(){
    const footer = document.getElementById("footer");
    const divShadow = document.createElement('div');
    divShadow.classList.add('shadow');

    const copyrightText = document.createElement('p');
    copyrightText.classList.add('small', 'text', 'aligncenter');
    copyrightText.innerHTML = `&#169; 2020-${new Date().getFullYear()} <a href="https://github.com/John-Paul-R"> John Paul R.</a>`;

    footer.appendChild(divShadow);
    divShadow.appendChild(copyrightText);
    footer.firstChild.remove();
})();
