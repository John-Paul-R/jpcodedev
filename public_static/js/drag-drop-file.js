
(function(){
    let dropArea = document.getElementById('drop-area')

    buildDropArea(dropArea);
    
    dropArea.addEventListener('dragenter', handlerFunction, false)
    dropArea.addEventListener('dragleave', handlerFunction, false)
    dropArea.addEventListener('dragover', handlerFunction, false)
    dropArea.addEventListener('drop', handlerFunction, false)


    function buildDropArea(dropArea) {
        dropArea.classList.add('drop_area');

        const form = document.createElement('form');
        form.classList.add('drop_area_form');

        const infoText = document.createElement('p');
        infoText.textContent = "Upload multiple files with the file dialog or by dragging and dropping images onto the dashed region.";

        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('name', 'file_elem');
        input.onchange = handleFiles(input.files);

        const label = document.createElement('label');
        label.classList.add('button');
        label.setAttribute('for', 'file_elem');
        label.textContent = "Choose File"

        dropArea.appendChild(form);
        form.appendChild(infoText);
        form.appendChild(input);
        form.appendChild(label);
    
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
            
            handleFiles(files)
        }

    }




})()