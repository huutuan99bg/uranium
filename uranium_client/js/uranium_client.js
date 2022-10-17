var socket = null;
var uranium_target = null;
var prevent_popup = false;
var remote_tabs = []; // {tab_id: 123..., uranium_target = null}
var uranium_tags = []
chrome.management.getAll(extensions => {
    /* Get config from extension config */
    let extension_config = extensions.filter(function (el) {
        return el.shortName.match(/uranium_config/);
    });
    config = JSON.parse(extension_config[0].description)
    browser_id = config.client_id
    server_port = config.server_port
    socket = io('http://127.0.0.1:' + server_port);
    socket.on('connect', () => {
        socket.emit('register', { client: browser_id });
    });

    socket.on("disconnect", async () => {
        console.log(`disconnected, ${socket.id}`);
        await closeBrowser();
    });

    socket.on("connect_response", (arg) => {
        console.log('Connected to uranium server');
    });
    // stylesheet, script, image, font, object, xmlhttprequest, ping, csp_report, media
    socket.on("quit", async data => {
        await closeBrowser();
    })
    socket.on("command", uraniumCommandCallback);
});

const remoteUraniumTarget = (tab_id) => {
    try {
        return remote_tabs.filter(function (el) { return el.tab_id == tab_id })[0].uranium_target
    } catch (err) { return null }
}
const remoteUpdateUraniumTarget = (tab_id, target) => {
    try {
        remote_tab = remote_tabs.filter(function (el) { return el.tab_id == tab_id })[0]
        remote_tabs[remote_tabs.indexOf(remote_tab)].uranium_target = target
        return true;
    } catch (err) { return null }
}
const remoteRemoveTab = (tab_id) => {
    try {
        remote_tab = remote_tabs.filter(function (el) { return el.tab_id == tab_id })[0]
        delete remote_tabs[remote_tabs.indexOf(remote_tab)]
        return true;
    } catch (err) { return null }
}
const isRemoteTab = (tab_id) => {
    try {
        return remote_tabs.filter(function (el) { return el.tab_id == tab_id }).length > 0;
    } catch (err) {
        return false;
    }

}


const uraniumCommandCallback = async data => {
    let status = true;
    let response_data = null
    try {
        let method = data.command.method
        let params = data.command.params
        target_tab_id = selected_tab_id
        if (params.tab_id) {
            target_tab_id = params.tab_id
        }
        switch (data.command.method) {
            case 'get':
                if (isValidUrl(params.url)) {
                    chrome.tabs.update(target_tab_id, { url: params.url })
                    if (target_tab_id == selected_tab_id) {
                        uranium_target = null;
                    } else {
                        remoteUpdateUraniumTarget(target_tab_id, null)
                    }

                    response_data = await waitForLoaded(target_tab_id)
                    if (remote_tabs.length == 0) {
                        chrome.tabs.update(selected_tab_id, { selected: true });
                    }

                } else {
                    response_data = null
                    status = false
                }
                break;
            case 'refresh':
                if (target_tab_id == selected_tab_id) {
                    uranium_target = null;
                } else {
                    remoteUpdateUraniumTarget(target_tab_id, null)
                }
                chrome.tabs.reload(target_tab_id);
                response_data = await waitForLoaded(target_tab_id)
                break;
            /* Tab handle */
            case 'current_window_handle':
            case 'title':
            case 'active':
            case 'url':
                response_data = await commandTabHandle(method, params, target_tab_id)
                break;
            case 'switch_to_window':
            case 'switch_to_frame':
            case 'switch_to_default_content':
                response_data = commandSwithToHandle(method, params, target_tab_id)
                break;
            case 'close_curent':
                response_data = await closeCurrent()
                break;
            /* Multiple tabs handles */
            case 'prevent_popup':
                prevent_popup = params.mode;
                response_data = true;
                break;
            case 'close_another':
                await closeAnotherTabs()
                response_data = true;
                break;
            case 'window_handles':
                response_data = await commandTabsHandle(method, params)
                break;
            case 'add_bookmark':
                response_data = await commandBookmarkHandle(method, params)
                break;
            case 'create_tab':
                if (remote_tabs.length == 0 && params.new_tab !== true) {
                    remote_tabs.push({ tab_id: selected_tab_id, uranium_target: null })
                    response_data = selected_tab_id;
                } else {
                    response_data = await commandCreateTabHandle(params)
                }
                break;
            case 'remote_tab':
                if (!isRemoteTab(params.tab_id)) {
                    remote_tabs.push({ tab_id: params.tab_id, uranium_target: null })
                }
                response_data = true
                break;
            case 'close_tab':
                if (isRemoteTab(params.tab_id)) {
                    remote_tabs.push({ tab_id: params.tab_id, uranium_target: null })
                }
                response_data = true
                break;
            /* Window update */
            case 'set_window_state':
            case 'maximize_window':
            case 'minimize_window':
                response_data = await commandWindowHandle(method, params);
                break;
            /* Content Script */
            case 'click':
            case 'send_keys':
            case 'select_option':
            case 'get_element_by_xpath':
            case 'get_element_by_selector':
            case 'get_element_by_id':
            case 'get_elements_by_xpaths':
            case 'get_elements_by_selector':
            case 'get_elements_by_id':
            case 'page_source':
            case 'get_local_storage':
            case 'set_local_storage':
                response_data = await commandContentScript(method, params, target_tab_id);
                if (remote_tabs.length == 0) {
                    chrome.tabs.update(selected_tab_id, { selected: true });
                }
                break;
            case 'upload_file':
                response_data = await commandUploadFile(method, params, target_tab_id);
                break;
            /* Browser data */

            case 'get_cookies':
            case 'set_cookie':
            case 'set_cookies':
            case 'remove_browser_data':
                response_data = await commandBrowserDataHandle(method, params);
                break;
            case 'execute_script':
                response_data = await commandExecuteScript(params.script, target_tab_id);
                break;
            case 'add_tag':
                if (hasUraniumTag(target_tab_id) != null) {
                    uranium_tags[uranium_tags.indexOf(hasUraniumTag(target_tab_id))].tags.push({
                        tag_name: params.tag_name,
                        tag_content: params.tag_content,
                    })
                } else {
                    uranium_tags.push({
                        tab_id: target_tab_id,
                        tags: [{
                            tag_name: params.tag_name,
                            tag_content: params.tag_content,
                        }]
                    })
                }

                response_data = true;
                break;
        }
    } catch (e) {
        console.error(e);
        status = false;
        response_data = null;
    }

    let response = { command_id: data.command_id, status: status, data: response_data }
    socket.emit('command_res', response)
}

const commandExecuteScript = async (script, target_tab_id) => {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.executeScript(target_tab_id, {
                code: script,
            }, (result) => {
                resolve(result)
            })
        } catch (err) {
            console.error(err);
            reject(false);
        }

    });
}


const commandBrowserDataHandle = async (method, params, target_tab_id) => {
    switch (method) {
        case 'get_cookies':
            if (params.domain == null) {
                target_tab = await getCurrentTab(target_tab_id)
                return await getPageCookies(new URL(target_tab.url).hostname)
            } else {
                return await getPageCookies(params.domain)
            }
        case 'set_cookie':
            return await setPageCookie(params.cookie)
        case 'set_cookies':
            return await setPageCookies(params.cookies)
        case 'remove_browser_data':
            await clearBrowserData(params.since)
            return true
    }
}

const commandCreateTabHandle = async (params) => {
    return new Promise((resolve, reject) => {
        try {
            delete params.new_tab;
            if (params.url == null) {
                delete params.url;
            }
            chrome.tabs.create(params, (tab) => {
                resolve(tab.id)
            })
        } catch (err) {
            console.error(err);
            reject(err)
        }
    })

}
const commandUploadFile = async (method, params, target_tab_id) => {
    try {
        let target = uranium_target
        if (target_tab_id != selected_tab_id) {
            target = remoteUraniumTarget(target_tab_id)
        }
        let file_path = params.path;
        let file_base64 = await fileUrlToBase64('http://127.0.0.1:' + server_port + '/uranium-load-file?path=' + file_path);
        params.file_base64 = file_base64;
        return await clientRequest(target_tab_id, method, params, target)
    } catch (err) {
        console.error(err);
        return null;
    }

}
const commandContentScript = async (method, params, target_tab_id) => {
    let target = uranium_target
    if (target_tab_id != selected_tab_id) {
        target = remoteUraniumTarget(target_tab_id)
    }
    let elements = null;
    if (params && params.wait == true) {
        elements = await waitMethodSuccess(async () => {
            try { return await clientRequest(target_tab_id, method, params, target) } catch (e) { return null }
        }, params.timeout * 1000)
    } else {
        return await clientRequest(target_tab_id, method, params, target)
    }
    return elements
}

const commandTabsHandle = async (method, params) => {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.query(params.query, tabs => {
                switch (method) {
                    case 'window_handles':
                        resolve(tabs)
                        break;
                }
            });
        } catch (err) {
            console.error(err);
            reject(false);
        }
    });
};

const commandBookmarkHandle = async (method, params) => {
    return new Promise((resolve, reject) => {
        try {
            title = params.title != null ? params.title : url;
            chrome.bookmarks.create({ parentId: '1', url: params.url, title: title }, (result) => {
                resolve(result)
            })
        } catch (err) {
            console.error(err);
            reject(false);
        }
    });
};

const commandSwithToHandle = (method, params, target_tab_id) => {
    switch (method) {
        case 'switch_to_window':
            selected_tab_id = params.window.id;
            chrome.tabs.update(selected_tab_id, { selected: true });
            uranium_target = null;
            break;
        case 'switch_to_frame':
            if (target_tab_id == selected_tab_id) {
                uranium_target = params.frame
                if (isRemoteTab(target_tab_id)) {
                    remoteUpdateUraniumTarget(target_tab_id, params.frame)
                }
            } else {
                remoteUpdateUraniumTarget(target_tab_id, params.frame)
            }
            break;
        case 'switch_to_default_content':
            uranium_target = null;
            if (target_tab_id == selected_tab_id) {
                uranium_target = null
                if (isRemoteTab(target_tab_id)) {
                    remoteUpdateUraniumTarget(target_tab_id, null)
                }
            } else {
                remoteUpdateUraniumTarget(target_tab_id, null)
            }
            break;
    }
    return true;
}

const commandWindowHandle = async (method, params) => {
    return new Promise((resolve, reject) => {
        try {
            switch (method) {
                case 'set_window_state':
                    chrome.windows.getCurrent({},
                        (w) => {
                            let options = {
                                state: "normal",
                                width: params.width,
                                height: params.height
                            }
                            if (params.left != null && typeof params.left == 'number') {
                                options.left = params.left;
                            }
                            if (params.top != null && typeof params.top == 'number') {
                                options.top = params.top;
                            }
                            chrome.windows.update(w.id, options, () => { resolve(true) });
                        }
                    )
                    break;
                case 'maximize_window':
                    chrome.windows.getCurrent({},
                        (w) => {
                            chrome.windows.update(w.id, { state: "maximized" }, () => { resolve(true) });
                        }
                    )
                    break;
                case 'minimize_window':
                    chrome.windows.getCurrent({},
                        (w) => {
                            chrome.windows.update(w.id, { state: "minimized" }, () => { resolve(true) });
                        }
                    )
                    break;
            }
        } catch (e) {
            reject(false)
        }

    })
}
const commandTabHandle = async (method, params, target_tab_id) => {
    target = uranium_target;
    if (target_tab_id != selected_tab_id) {
        target = remoteUraniumTarget(target_tab_id)
    }
    if (target == null) {
        return new Promise((resolve, reject) => {
            try {
                if (method == 'active') chrome.tabs.update(target_tab_id, { selected: true });

                chrome.tabs.get(target_tab_id, tab => {
                    switch (method) {
                        case 'current_window_handle':
                            resolve(tab)
                            break;
                        case 'url':
                            resolve(tab.url)
                            break;
                        case 'title':
                            resolve(tab.title)
                            break;
                        case 'active':
                            resolve(tab.active)
                            break;
                    }
                });
            } catch (err) {
                console.error(err);
                reject(false);
            }
        });
    } else {
        result = await clientRequest(target_tab_id, method, params, target)
        return result
    }
};


const hasUraniumTag = (tab_id) => {
    try {
        if (uranium_tags.filter(function (el) { return el.tab_id == tab_id }).length > 0) {
            return uranium_tags.filter(function (el) { return el.tab_id == tab_id })[0]
        } else {
            return null;
        }

    } catch (err) {
        return null;
    }
}

const updateTabsTargetFrame = async () => {
    result = await clientRequest(selected_tab_id, 'get_element_by_xpath', { xpath: uranium_target.fullpath }, null)
    if (result == null) {
        // uranium_target = null;  
    }
}

chrome.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    try {
        if (id == selected_tab_id && changeInfo.status == 'loading' && uranium_target != null) {
            updateTabsTargetFrame();
        }
        if (isRemoteTab(id) && changeInfo.status == 'loading') {
            remoteUpdateUraniumTarget(id, null)
        }
    } catch (err) { }
    try {
        if (hasUraniumTag(id) != null && changeInfo.status == 'complete') {
            let tags = hasUraniumTag(id);
            if (tags.tags.length > 0) {
                for (tag of tags.tags) {
                    chrome.tabs.executeScript(id, {
                        code: 'document.querySelector("html").setAttribute("' + tag.tag_name + '","' + tag.tag_content + '")',
                    }, (result) => { })
                }
            }
        }
    } catch (err) { console.error(err) }
    return true
});
chrome.tabs.onCreated.addListener(async tab => {
    try {
        if (tab.pendingUrl) return;
        if (tab.openerTabId == undefined) return;
        if (prevent_popup == true) {
            // let whitelist = []
            // for (tab of remote_tabs) {
            //     whitelist.push(tab.id)
            // }
            // await closeAnotherTabs(whitelist);
            await chrome.tabs.remove(tab.id, () => { });

        }
    } catch (e) { console.error(e) }
})

