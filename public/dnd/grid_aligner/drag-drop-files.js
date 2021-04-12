
(function(){
    let dropArea = document.getElementById('drop_area');

    buildDropArea(dropArea);
    
    function buildDropArea(dropArea) {
        dropArea.classList.add('drop_area');

        const form = document.createElement('form');
        form.classList.add('drop_area_form');

        const infoText = document.createElement('p');
        infoText.textContent = "Upload a battlemap image file with the file dialog or by dragging and dropping images onto the dashed region.";

        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('id', 'file_input');
        // input.onchange = handleFiles(input.files);

        dropArea.appendChild(form);
        form.appendChild(infoText);
        form.appendChild(input);
    
        // Event Handlers
        // Prevent Defaults
        ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false)
        })
          
        function preventDefaults (e) {
            e.preventDefault()
            e.stopPropagation()
        }
        
        // Visual feedback
        ;['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, highlight, false)
        })
          
        ;['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, unhighlight, false)
        })
          
        function highlight(e) {
            dropArea.classList.add('highlight')
        }
          
        function unhighlight(e) {
            dropArea.classList.remove('highlight')
        }

        // Handle file drop
        dropArea.addEventListener('drop', handleDrop, false)

        function handleDrop(e) {
            let dt = e.dataTransfer
            let files = dt.files

            input.files = files;
            fireOnChange(input);
            // handleFiles(files);
        }
        function fireOnChange(element) {
            if ("createEvent" in document) {
                var evt = document.createEvent("HTMLEvents");
                evt.initEvent("change", false, true);
                element.dispatchEvent(evt);
            }
            else
                element.fireEvent("onchange");
        }

    }

})()