const getDomPath = el => {
    if (!el) return;
    var stack = [];
    var isShadow = false;
    while (el.parentNode != null) {
        var sibCount = 0, sibIndex = 0;
        // get sibling indexes
        for (var i = 0; i < el.parentNode.childNodes.length; i++) {
            var sib = el.parentNode.childNodes[i];
            if (sib.nodeName == el.nodeName) {
                if (sib === el) {
                    sibIndex = sibCount;
                }
                sibCount++;
            }
        }
        var nodeName = el.nodeName.toLowerCase();
        if (isShadow) {
            nodeName += "::shadow";
            isShadow = false;
        }
        if (sibCount > 1) {
            stack.unshift(nodeName + ':nth-of-type(' + (sibIndex + 1) + ')');
        } else {
            stack.unshift(nodeName);
        }
        el = el.parentNode;
        if (el.nodeType === 11) { // for shadow dom, we
            isShadow = true;
            el = el.host;
        }
    }
    stack.splice(0, 1); // removes the html element
    return stack.join(' > ');
}
const getAllAttributes = el => el
    .getAttributeNames()
    .reduce((obj, name) => ({
        ...obj,
        [name]: el.getAttribute(name)
    }), {})

/* 
Add xpath method to element
*/
document.xpath = xpath => {
    const snapshot = document.evaluate(
        xpath, document, null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
    );
    return [...Array(snapshot.snapshotLength)].map((_, i) => snapshot.snapshotItem(i));
};

Element.prototype.xpath = function (xpath) {
    const snapshot = document.evaluate(
        xpath, this, null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
    );
    return [...Array(snapshot.snapshotLength)].map((_, i) => snapshot.snapshotItem(i));
}


const waitMethodSuccessHandler = (method, callback, timeout, frequency) => {
    var startTime = Date.now();
    (async function loopSearch() {
        result = await method()
        if (result != null) {
            callback(result)
        }
        else {
            setTimeout(function () {
                if (timeout && Date.now() - startTime >= timeout) { callback(result); }
                loopSearch();
            }, frequency);
        }
    })();
}

const waitMethodSuccess = async (method, timeout, frequency = 100) => {
    return new Promise((resolve, reject) => {
        try {
            waitMethodSuccessHandler(method, (result) => {
                resolve(result)
            }, timeout, frequency)
        } catch (e) {
            console.log(e)
            reject(false);
        }
    });
}

Element.prototype.uraniumSendKeys = function sendKeys(text, replace = false) {
    try {
        this.focus();
        if (replace == true) this.select();
        document.execCommand('insertText', false, text);
        this.dispatchEvent(new Event('change', { bubbles: true })); // usually not needed
        return this;
    } catch (e) {
        return null;
    }
}

Element.prototype.uraniumSelect = function sendKeys(value,) {
    try {
        let option = this.querySelector('option[value="'+value+'"]');
        option.selected = true;
        option.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
        return null;
    }
}

Element.prototype.uraniumClick = function () {
    events = ['mouseover', 'mousedown', 'click', 'mouseup']
    for (i = 0; i < events.length; i++) {
        e = document.createEvent("MouseEvents");
        e.initEvent.apply(e, [events[i], true, true]);
        this.dispatchEvent(e);
    }
};

const csidGenerator = () => {
    return 'cs_' + (Math.random().toString(36) + Math.random().toString(36)).replace(/0./g, '');
}

const frameResponse = csid => {
    return new Promise((resolve, reject) => {
        try {
            window.addEventListener("message", response => {
                if (response.data !== undefined && response.data.csid && response.data.type == 'uranium_frame_response' && response.data.csid == csid) {
                    resolve(response.data)
                }
            })
        } catch (e) {
            console.log(e)
            reject(false);
        }
    });
}

const frameRequest = async (frame, data) => {
    try {
        csid = csidGenerator()
        let frame_request_data = {
            data: data,
            type: "uranium_frame_request",
            csid: csid
        }
        frame.contentWindow.postMessage(frame_request_data, '*')
        return await frameResponse(csid);
    } catch (err) {
        console.log(err);
        return false
    }
}
