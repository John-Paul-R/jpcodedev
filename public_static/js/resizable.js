(function () {

  window.addEventListener('DOMContentLoaded', initResize);
  const STORAGE_KEY = 'preferred_reader_width';
  const CSS_VAR_WIDTH = '--resizable-width';

  const originallyStoredSize = window.localStorage.getItem(STORAGE_KEY);
  if (originallyStoredSize !== null) {
    window.document.documentElement.style.setProperty(CSS_VAR_WIDTH, originallyStoredSize + 'px');
  }

  // Borrowed ideas from https://codepen.io/jkasun/pen/QrLjXP by Janith

  function initResize() {
    {
      const elems = document.getElementsByClassName("resizable");
      for (let i = 0; i < elems.length; i++) {
        const el = elems[i];

        const right = document.createElement("div");
        right.className = "resizer-right";
        el.appendChild(right);
        right.addEventListener("mousedown", initDrag, false);
        right.resizeParent = el;
        right.addEventListener('dblclick', () => {
          el.style.width = null;
          storeWidth(null);
        });
      }

    }

    let dragStartX, startWidth;
    let draggingElementParent = null;

    function initDrag(e) {
      draggingElementParent = this.resizeParent;

      dragStartX = e.clientX;
      startY = e.clientY;
      startWidth = parseInt(
        document.defaultView.getComputedStyle(draggingElementParent).width,
        10
      );
      startHeight = parseInt(
        document.defaultView.getComputedStyle(draggingElementParent).height,
        10
      );
      document.documentElement.addEventListener("mousemove", doDrag, false);
      document.documentElement.addEventListener("mouseup", stopDrag, false);
    }

    function doDrag(e) {
      let newWidth = startWidth + (e.clientX - dragStartX) * 2;
      draggingElementParent.style.setProperty(CSS_VAR_WIDTH, `${newWidth}px`);
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
