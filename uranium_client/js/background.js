// Load config
/* var filter = { urls: ["<all_urls>"], };
var requestConditions = [];

const loadConfig = async () => {    
    const config_path = chrome.runtime.getURL('config.json');
    let config_data = await fetch(config_path);
    config_data = await config_data.text();
    requestConditions = JSON.parse(config_data)
    return true
}
loadConfig()
var requestHandler = function(info) {
    if (!requestConditions) { return; }
    try {
        for (var i = 0; i < requestConditions.types.length; i++) {
            if (requestConditions.types[i] == info.type) {
                return { cancel: true };
            }
        }
    } catch (e) {}
    try {
        for (var i = 0; i < requestConditions.urls.length; i++) {
            var regex = new RegExp(requestConditions.urls[i]);
            var res = info.url.match(regex);
            if ((res != null && res[0] != null)) {
                return { cancel: true };
            }
        }
    } catch (e) {}
};
// Blocking with config
chrome.webRequest.onBeforeRequest.addListener(requestHandler, filter, ["blocking"]); */







