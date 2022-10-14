// Commands
let isMainWindow = false;
try {
    isMainWindow = (parent.location.href == self.location.href)
} catch (e) { isMainWindow = false; }

if (!isMainWindow) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request && request.type === "uranium_frame_request") {
            clientHandlers(request)
            sendResponse(true)
        }
        return true;
    });
}

const clientHandlers = async (request) => {
    let response_data = null;
    try {
        // console.log(request.method);
        switch (request.method) {
            case 'get_local_storage':
                response_data = { ...localStorage };
                break;
            case 'set_local_storage':
                localStorage.setItem(request.params.key, request.params.value);
                response_data = true;
                break;
            case 'page_source':
                response_data = document.querySelector('*').outerHTML
                break;
            case 'click':
                document.querySelector(request.params.element.fullpath).uraniumClick()
                response_data = true;
                break;
            case 'send_keys':
                document.querySelector(request.params.element.fullpath).uraniumSendKeys(request.params.text, request.params.replace)
                response_data = true;
                break;
        }

        if (response_data == null) {
            /* Dom */
            let element = null;
            let elements = null;
            switch (request.method) {
                case "get_element_by_xpath":
                    element = document.xpath(request.params.xpath)
                    element = element.length > 0 ? element[0] : null;
                    break;
                case "get_element_by_id":
                    element = document.getElementById(request.params.id)
                    break;
                case "get_element_by_selector":
                    element = document.querySelector(request.params.selector)
                    break;
                case "get_elements_by_selector":
                    elements = document.querySelectorAll(request.params.selector)
                    elements = elements.length > 0 ? elements : null;
                    break;
                case "get_elements_by_xpath":
                    elements = document.xpath(request.params.xpath)
                    elements = elements.length > 0 ? elements : null;
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
            }
        }
    } catch (err) {
        console.log(err)
        response_data = null;
    }
    let response = { type: 'uranium_frame_response', uraniumid: request.uraniumid, data: response_data }
    chrome.runtime.sendMessage(chrome.runtime.id, response, () => { return true });
}