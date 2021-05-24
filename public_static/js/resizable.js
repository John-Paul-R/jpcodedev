(function() {
var scriptTags = document.getElementsByTagName('script');
var scriptTag = scriptTags[scriptTags.length - 1];

var parentElem = scriptTag.parentElement;
window.onload = function() {
    initResize();
  };
const STORAGE_KEY = 'preferred_reader_width';

// Borrowed ideas from https://codepen.io/jkasun/pen/QrLjXP by Janith

function initResize() {
    var startX, startWidth;
    var elems = document.getElementsByClassName("resizable");
    var element = null;
    var storedWidth = window.localStorage.getItem(STORAGE_KEY)

    for (var i = 0; i < elems.length; i++) {

        var el = elems[i];
        if (storedWidth)
            el.style.width = `clamp(50ch, ${storedWidth}px, 100%)`;

        var right = document.createElement("div");
        right.className = "resizer-right";
        el.appendChild(right);
        right.addEventListener("mousedown", initDrag, false);
        right.resizeParent = el;
        right.addEventListener('dblclick', function (e) {
          el.style.width = null;
          storeWidth(null);
        });
        
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
        let newWidth = startWidth + (e.clientX - startX)*2;
        element.style.width = `clamp(50ch, ${newWidth}px, 100vw)`;
        storeWidth(newWidth);
    }
    
    function stopDrag() {
        document.documentElement.removeEventListener("mousemove", doDrag, false);
        document.documentElement.removeEventListener("mouseup", stopDrag, false);
    }

    const debounce = (func, wait) => {
      let timeout;
    
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
    
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };
    
    const storeWidth = debounce((width) => {
      window.localStorage.setItem(STORAGE_KEY, width);
    }, 500);
      
}

})();
