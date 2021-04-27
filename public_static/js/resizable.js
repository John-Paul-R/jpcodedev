
var scriptTags = document.getElementsByTagName('script');
var scriptTag = scriptTags[scriptTags.length - 1];

var parentElem = scriptTag.parentElement;
window.onload = function() {
    initResize();
  };

// Borrowed ideas from https://codepen.io/jkasun/pen/QrLjXP by Janith

function initResize() {
    var startX, startWidth;
    var elems = document.getElementsByClassName("resizable");
    var element = null;
  
    for (var i = 0; i < elems.length; i++) {

        var el = elems[i];
        
        var right = document.createElement("div");
        right.className = "resizer-right";
        el.appendChild(right);
        right.addEventListener("mousedown", initDrag, false);
        right.resizeParent = el;
    }
    

    function initDrag(e) {
        element = this.resizeParent;
    
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(
          document.defaultView.getComputedStyle(element).width,
          10
        );
        startHeight = parseInt(
          document.defaultView.getComputedStyle(element).height,
          10
        );
        document.documentElement.addEventListener("mousemove", doDrag, false);
        document.documentElement.addEventListener("mouseup", stopDrag, false);
    }

    function doDrag(e) {
        element.style.width = `clamp(50ch, ${startWidth + (e.clientX - startX)*2}px, 100vw)`;
    }
    
    function stopDrag() {
        document.documentElement.removeEventListener("mousemove", doDrag, false);
        document.documentElement.removeEventListener("mouseup", stopDrag, false);
    }
}
