
(function () {
    const multiPaletteContainer = document.getElementById("multi-palette-js-container");

    multiPaletteContainer.style.position = 'relative';

    const makePaletteOverlayDiv = (color) => {
        const overlayElement = document.createElement('div');
        overlayElement.style.setProperty("--color", color);
        overlayElement.style.opacity = '0';
        overlayElement.style.backgroundColor = 'transparent';
        overlayElement.style.border = `1px solid ${color}`;
        overlayElement.style.position = 'absolute';
        overlayElement.style.top = `${94 / 512 * 100}%`;
        overlayElement.style.left = `${108 / 512 * 100}%`;
        overlayElement.style.width = `${110 / 512 * 97}%`;
        overlayElement.style.height = `${277 / 512 * 97}%`;
        overlayElement.classList.add('palette_overlay_div')
        return overlayElement;
    }

    const rotationCenterXPercent = 50 + '%';
    const rotationCenterYPercent = 93.5 + '%';
    const rotationCenterCssStr = rotationCenterXPercent + ' ' + rotationCenterYPercent


    const rotateAboutPoint = (element, point2dCssStr, rotationDeg) => {
        element.style.transformOrigin = point2dCssStr;
        element.style.transform = `rotate(${rotationDeg}deg)`;
    }

    var originalPalette;
    var isHoverPaletteActive = false;

    const temporarilyForceTransitionOnAll = () => {
        document.body.classList.add('hover_mpal_transition_all_elems');
        setTimeout(() => {
            document.body.classList.remove('hover_mpal_transition_all_elems')
        }, 1000);
    };

    const setPalette = (paletteIndex) => {
        temporarilyForceTransitionOnAll();
        if (!isHoverPaletteActive) {
            console.log(mpal, mpal.currentPaletteIndex)
            originalPalette = mpal.currentPaletteIndex;
        }
        mpal.setPalette(paletteIndex);
        isHoverPaletteActive = true;
    }

    const revertPalette = () => {
        temporarilyForceTransitionOnAll();
        mpal.setPalette(originalPalette);
        isHoverPaletteActive = false;
    }

    const greenDiv = makePaletteOverlayDiv('green');
    greenDiv.addEventListener('pointerover', () => {
        setPalette(7);
    });
    greenDiv.addEventListener('pointerleave', revertPalette);
    multiPaletteContainer.appendChild(greenDiv);

    const blueDiv = makePaletteOverlayDiv('blue');
    rotateAboutPoint(blueDiv, rotationCenterCssStr, 45);
    blueDiv.addEventListener('pointerover', () => {
        setPalette(1);
    });
    blueDiv.addEventListener('pointerleave', revertPalette);
    multiPaletteContainer.appendChild(blueDiv);

    const redDiv = makePaletteOverlayDiv('red');
    rotateAboutPoint(redDiv, rotationCenterCssStr, 90);
    redDiv.addEventListener('pointerover', () => {
        setPalette(2);
    });
    redDiv.addEventListener('pointerleave', revertPalette);
    multiPaletteContainer.appendChild(redDiv);

    {
        function createStyleSheet(id, media) {
            var el = document.createElement('style');
            // WebKit hack
            el.appendChild(document.createTextNode(''));
            // el.type  = 'text/css';
            el.rel = 'stylesheet';
            el.media = media || 'screen';
            el.id = id;
            document.head.appendChild(el);
            return el.sheet;
        }

        function initStyleSheet() {
            const sheet = createStyleSheet('hover-multi-palette-div-css');
            sheet.insertRule(`.palette_overlay_div:hover {
                opacity: 30% !important;
                background-color: var(--color) !important;
            }`);
            sheet.insertRule(`.hover_mpal_transition_all_elems * {
                transition: all 0.5s !important;
            }`);
        }

        initStyleSheet();
    }
})();