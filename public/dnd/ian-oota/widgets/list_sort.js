
(function(){
const container = document.getElementById("widget_content");
const children = Array.from(container.children);

const sorted = children.sort((a, b) => new Date(b.getAttribute("data-session-date")).getTime() - new Date(a.getAttribute("data-session-date")).getTime())
for (let i = 0; i < sorted.length; i++) {
    sorted[i].style.order = i;
}
})();
