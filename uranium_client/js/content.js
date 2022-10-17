// Commands
let isMainWindow = false;
try {
    isMainWindow = (parent.location.href == self.location.href)
} catch (e) { isMainWindow = false; }

if (isMainWindow) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request && request.type === "uranium_request") {
            if (request.target == null) {
                clientHandlers(request, false)
            } else {
                frameHandlers(request);
            }
            sendResponse(true)
        }
        return true;
    });
} else {

    window.addEventListener('message', function (request) {
        if (request.data && request.data.type === "uranium_frame_request") {
            clientHandlers(request.data, true)
        }
    });
}

const frameHandlers = async (request) => {
    let uranium_target = request.target;
    let frame = document.querySelector(uranium_target.fullpath);
    switch (request.method) {
        case 'url':
            response_data = frame.getAttribute('src')
            break;
        default:
            frame_response = await frameRequest(frame, request)
            response_data = frame_response.data
            break;
    }

    let response = { type: 'uranium_response', uraniumid: request.uraniumid, data: response_data }
    chrome.runtime.sendMessage(chrome.runtime.id, response, () => { return true });
}



const clientHandlers = async (request, inside_frame) => {
    
    let response_data = null;
    request_data = {}
    if (inside_frame == true) {
        request_data = request.data;
        request_data.csid = request.csid;
    } else {
        request_data = request;
    }
    try {
        switch (request_data.method) {
            case 'get_local_storage':
                response_data = { ...localStorage };
                break;
            case 'set_local_storage':
                localStorage.setItem(request_data.params.key, request_data.params.value);
                response_data = true;
                break;
            case 'page_source':
                response_data = document.querySelector('*').outerHTML
                break;
            case 'click':
                document.querySelector(request_data.params.element.fullpath).uraniumClick()
                response_data = true;
                break;
            case 'send_keys':
                document.querySelector(request_data.params.element.fullpath).uraniumSendKeys(request_data.params.text, request_data.params.replace)
                response_data = true;
                break;
            case 'select_option':
                document.querySelector(request_data.params.element.fullpath).uraniumSelect(request_data.params.value)
                response_data = true;
                break;
            case 'upload_file':
                let file = base64ToFile(request_data.params.file_base64.file, request_data.params.file_base64.filename)
                document.querySelector(request_data.params.element.fullpath).uraniumUpload(file)
                response_data = true;
                break;
            case 'title':
                response_data = document.querySelector('title').innerText
                break;
        }

        if (response_data == null) {
            /* Dom */
            let element = null;
            let elements = null;
            let elements_obj = null
            switch (request_data.method) {
                case "get_element_by_xpath":
                    element = document.xpath(request_data.params.xpath)
                    element = element.length > 0 ? element[0] : null;
                    break;
                case "get_element_by_id":
                    element = document.getElementById(request_data.params.id)
                    break;
                case "get_element_by_selector":
                    element = document.querySelector(request_data.params.selector)
                    break;
                case "get_elements_by_selector":
                    elements = document.querySelectorAll(request_data.params.selector)
                    elements = elements.length > 0 ? elements : null;
                    break;
                case "get_elements_by_xpath":
                    elements = document.xpath(request_data.params.xpath)
                    elements = elements.length > 0 ? elements : null;
                    break;

                case "get_element_by_xpaths":
                    elements_obj = []
                    for (var i = 0; i < request_data.params.xpaths; i++) {
                        try {
                            els = document.xpath(request_data.params.xpaths[i])
                            if (els.length > 0) {
                                elements_obj.push({
                                    xpath: request_data.params.xpaths[i],
                                    element: els[0],
                                })
                            }
                        } catch (e) { }
                    }
                    if (elements_obj.length == 0) elements_obj = null;
                    break;
            }

            if (element != null) {
                response_data = {}
                response_data.fullpath = getDomPath(element)
                response_data.attributes = getAllAttributes(element)
                response_data.html = element.innerHTML
                response_data.text = element.innerText
                response_data.value = element.value || null
                response_data.is_enabled = element.disabled == undefined ? null : !element.disabled
            } else if (elements != null) {
                response_data = []
                for (i = 0; i < elements.length; i++) {
                    el = {
                        fullpath: getDomPath(elements[i]),
                        attributes: getAllAttributes(elements[i]),
                        html: elements[i].innerHTML,
                        text: elements[i].innerText,
                        value: elements[i].value || null,
                        is_enabled: elements[i].disabled == undefined ? null : !elements[i].disabled
                    }
                    response_data.push(el)
                }
            } else if (elements_obj != null) {
                response_data = []
                for (i = 0; i < elements.length; i++) {
                    el = {
                        fullpath: getDomPath(elements[i]),
                        attributes: getAllAttributes(elements[i]),
                        html: elements[i].innerHTML,
                        text: elements[i].innerText,
                        value: elements[i].value || null,
                        is_enabled: elements[i].disabled == undefined ? null : !elements[i].disabled
                    }
                    response_data.push(el)
                }
            }
        }
    } catch (err) {
        console.error(err)
        response_data = null;
    }

    if (!inside_frame) {
        let response = { type: 'uranium_response', uraniumid: request_data.uraniumid, data: response_data }
        chrome.runtime.sendMessage(chrome.runtime.id, response, () => { return true });
    } else {
        let response = { type: 'uranium_frame_response', csid: request_data.csid, data: response_data }
        window.parent.postMessage(response, '*');
    }

}


