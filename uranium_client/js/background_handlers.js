/* Tabs hanldes */

var selected_tab_id = null;
chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    if (selected_tab_id == null) {
        selected_tab_id = tabs[0].id;
    }
});

/* Tabs hanldes */

const queryTabs = async (query) => {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.query(query, async function (tabs) {
                resolve(tabs)
            });
        } catch (e) { reject(false); }
    });
}

const getTab = async (tabId) => {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.get(tabId, tab => {
                resolve(tab)
            });
        } catch (e) { reject(false); }
    });
}

const getCurrentTab = async (target_tab_id) => { return await getTab(target_tab_id); }

const closeAnotherTabs = async (whitelist = []) => {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.query({}, async tabs => {
                for (i = 0; i < tabs.length; i++) {
                    if (tabs[i].id != selected_tab_id && !whitelist.includes(tabs[i].id)) {
                        await chrome.tabs.remove(tabs[i].id, () => { });
                    }
                }
                resolve(true)
            });
        } catch (e) { reject(false); }
    });
}

const closeCurrent = async (target_tab_id) => {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.remove(target_tab_id, () => {
                if (target_tab_id == selected_tab_id) {
                    chrome.tabs.query({}, function (tabs) {
                        selected_tab_id = tabs[0].id;
                        resolve(selected_tab_id)
                    });
                } else {
                    resolve(true)
                }
            });
        } catch (e) { reject(false); }
    });
}

const closeBrowser = async () => {
    chrome.tabs.query({}, async function (tabs) {
        for (var i = 0; i < tabs.length; i++) {
            await chrome.tabs.remove(tabs[i].id);
        }
    });
    chrome.windows.getAll({}, (windows) => {
        for (window of windows) {
            window.close()
        }
    })
}

const waitForLoaded = tabId => {
    const [promise, resolve, reject] = promiseHandler()
    try {
        chrome.tabs.onUpdated.addListener((id, changeInfo, tab) => {
            if (id == tabId && changeInfo.status == 'complete') {
                resolve(changeInfo)
            }
            return true
        });

    } catch (err) { console.log(err); reject(false); }

    return promise
}

const isValidUrl = urlString => {
    try {
        return Boolean(new URL(urlString));
    } catch (e) {
        return false;
    }
}
/* Browser data hanldes */
const getLocalStorage = async (key) => {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get([key], result => {
            try {
                if (result[key] === undefined) {
                    resolve(undefined);
                } else {
                    resolve(result[key]);
                }
            } catch (err) {
                console.error(err);
                reject();
            }
        });
    });
};
const removeLocalStorage = async (key) => {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.remove([key], () => {
            var error = chrome.runtime.lastError;
            if (error) {
                reject()
            } else {
                resolve(true)
            }
        });
    });
};
const getPageCookies = async (domain) => {
    return new Promise((resolve, reject) => {
        chrome.cookies.getAll({ domain: domain }, cookies => {
            try {
                if (cookies === undefined) {
                    resolve(undefined);
                } else {
                    resolve(cookies);
                }
            } catch (err) {
                v
                console.error(err);
                reject();
            }
        });
    });
};

const clearPageCookies = async (domain) => {
    let cookies = await getPageCookies(domain);
    for (var i = 0; i < cookies.length; i++) {
        chrome.cookies.remove({ url: domain + cookies[i].path, name: cookies[i].name }, () => { });
    }
}

const setPageCookie = async (cookie) => {
    try {
        chrome.cookies.set(cookie, function () { },)
        return true
    } catch (e) { return false }

}
const setPageCookies = async (cookies) => {
    try {
        for (i = 0; i < cookies.length; i++) {
            chrome.cookies.set(cookies[i], function () { },)
        }
        return true
    } catch (e) { return false }

}

const promiseHandler = () => {
    let resolve, reject
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; })
    return [promise, resolve, reject]
}

const clearBrowserData = async (since = 'hour') => {
    /* Since option: hour|day|week|month|all */
    let sinceCalc = 0
    switch (since) {
        case 'hour':
            sinceCalc = Date.now() - 1000 * 60 * 60
            break;
        case 'day':
            sinceCalc = Date.now() - 1000 * 60 * 60 * 24
            break;
        case 'week':
            sinceCalc = Date.now() - 1000 * 60 * 60 * 24 * 7
            break;
        case 'month':
            sinceCalc = Date.now() - 1000 * 60 * 60 * 24 * 30
            break;
        case 'all':
            sinceCalc = 0
            break;
    }

    chrome.browsingData.remove({
        "since": sinceCalc
    }, {
        "appcache": true,
        "cache": true,
        "cacheStorage": true,
        "cookies": true,
        "downloads": true,
        "fileSystems": true,
        "formData": true,
        "history": true,
        "indexedDB": true,
        "localStorage": true,
        "serviceWorkers": true,
        "webSQL": true
    }, () => { });
}

/* Communicate with content script */
const csidGenerator = () => {
    return 'uranium_' + (Math.random().toString(36) + Math.random().toString(36)).replace(/0./g, '');
}
const clientResponse = uraniumid => {
    const [promise, resolve, reject] = promiseHandler()
    try {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type !== undefined && request.uraniumid && request.type == 'uranium_response' && request.uraniumid == uraniumid) {
                resolve(request.data)
            }
            return true
        });
    } catch (err) { console.error(err); reject(false); }
    return promise
}

const clientRequest = async (target_tab_id, method, params = {}, target = null) => {
    try {
        let uraniumid = csidGenerator();
        let data = { type: "uranium_request", uraniumid, method, params, target }
        chrome.tabs.sendMessage(target_tab_id, data)
        return await clientResponse(uraniumid);
    } catch (err) {
        console.error(err);
        return null
    }
}


const waitMethodSuccessHandler = (method, callback, timeout, frequency) => {
    var startTime = Date.now();
    (async function loopSearch() {
        result = await method();
        if (result != null) {
            callback(result)
        }
        else {
            setTimeout(function () {
                console.log(timeout && Date.now() - startTime)
                if (timeout && Date.now() - startTime >= timeout - frequency) {
                    callback(result);
                } else {
                    loopSearch();
                }
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

const fileUrlToBase64 = async url => {
    const response = await fetch(url);
    let  filename = 'something.jpg';
    try{ filename = r.headers.get('Content-disposition').split(';')[1].split('=')[1];}catch(e){}
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        try {
            const reader = new FileReader();
            reader.onload = function () { 
                resolve({file:this.result, filename:filename}) 
            };
            reader.readAsDataURL(blob);
        } catch (e) {
            reject(e);
        }
    });
};