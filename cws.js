const supported_permissions = [
    "activeTab",
    "alarms",
    "bookmarks",
    "browserSettings",
    "browsingData",
    "captivePortal",
    "clipboardRead",
    "clipboardWrite",
    "contentSettings",
    "contextMenus",
    "contextualIdentities",
    "cookies",
    "debugger",
    "dns",
    "downloads",
    "downloads.open",
    "find",
    "geolocation",
    "history",
    "identity",
    "idle",
    "management",
    "menus",
    "menus.overrideContext",
    "nativeMessaging",
    "notifications",
    "pageCapture",
    "pkcs11",
    "privacy",
    "proxy",
    "search",
    "sessions",
    "storage",
    "tabHide",
    "tabs",
    "theme",
    "topSites",
    "unlimitedStorage",
    "webNavigation",
    "webRequest",
    "webRequestBlocking",
]

const c_ver = "98.0.4758.105";

function isBackgroundPage() {
    return location.href.startsWith("moz-extension://") && location.href.endsWith("/background.html");
}

function isPopupPage() {
    return location.href.startsWith("moz-extension://") && location.href.endsWith("/popup.html");
}

async function readManifest(zipfile) {
    //https://twitter.com/check_ca/status/1498992800666468352
    zip.configure({
        workerScripts: {
            "inflate": [browser.runtime.getURL("lib/z-worker.js")],
            "deflate": [browser.runtime.getURL("lib/z-worker.js")]
        }
    });
    
    let _zip = await new zip.ZipReader(new zip.BlobReader(zipfile));
    let entries = await _zip.getEntries();
    let manifest = await entries.find(e => e.filename === "manifest.json");
    let manifest_json = await manifest.getData(new zip.TextWriter());
    let manifest_obj = JSON.parse(manifest_json);
    _zip.close();
    return manifest_obj;
}

async function recompress(zipfile, extension_id) {
    //https://twitter.com/check_ca/status/1498992800666468352
    zip.configure({
        workerScripts: {
            "inflate": [browser.runtime.getURL("lib/z-worker.js")],
            "deflate": [browser.runtime.getURL("lib/z-worker.js")]
        }
    });
    
    let _zip = await new zip.ZipReader(new zip.BlobReader(zipfile));
    let entries = await _zip.getEntries();
    let manifest = await entries.find(e => e.filename === "manifest.json");
    let manifest_json = await manifest.getData(new zip.TextWriter());
    let manifest_obj = JSON.parse(manifest_json);
    manifest_obj.applications = {
        gecko: {
            id: extension_id + "@cwsextension",
            strict_min_version: "91.0",
        }
    }
    manifest_json = JSON.stringify(manifest_obj);
    _zip.close();

    let new_zip = await new zip.ZipWriter(new zip.BlobWriter(), {
        level: 0
    });
    await new_zip.add("manifest.json", new zip.TextReader(manifest_json));
    for (let entry of entries) {
        if(!entry.directory && entry.filename !== "manifest.json") {
            console.log(entry.filename);
            let data = await entry.getData(new zip.BlobWriter());
            await new_zip.add(entry.filename, new zip.BlobReader(data));
        }
    }
    let blob = await new_zip.close();
    return blob;
}

async function download(url) {
    let res = await fetch(url);
    if(!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
    }
    let blob = await res.blob();
    return blob;
}

async function install(cws_url) {
    if(cws_url.indexOf("chrome.google.com") !== -1) {
        var extension_id = /.*detail\/.*\/([a-z]{32})/.exec(cws_url)[1];
    }else{
        var extension_id = cws_url;
    }
    var url = "https://clients2.google.com/service/update2/crx?response=redirect&os=win&arch=x86-64&os_arch=x86-64&nacl_arch=x86-64&prod=chromiumcrx&prodchannel=unknown&prodversion=9999.0.9999.0&acceptformat=crx2,crx3&x=id%3D" + extension_id + "%26uc";

    try {
        var zipfile = await download(url);
    }catch(e) {
        console.error("Extension download failed.");
        alert("Extension download failed.");
        throw e;
    }
    
    try{
        var manifest = await readManifest(zipfile);
    }catch(e) {
        console.error("Fatal error: Extension read failed.");
        alert("Fatal error: Extension read failed.");
        console.error(e);
        throw e;
    }

    if(manifest.manifest_version !== 2) {
        console.error("This extension is not supported.");
        alert("This extension is not supported.");
        throw new Error("This extension is not supported.");
    }

    if(manifest.permissions) {
        for (let permission of manifest.permissions) {
            if(supported_permissions.indexOf(permission) !== -1) {
                continue;
            }else if(permission === "<all_urls>") {
                continue;
            }else if(/^[a-z*]+:\/\/([^/]*)\/|^about:/.exec(permission)) {
                continue;
            }else{
                console.error("This extension is not supported.");
                alert("This extension is not supported.");
                console.log(permission);
                throw new Error("This extension is not supported.");
            }
        }
    }

    if(manifest.optional_permissions) {
        for (let permission of manifest.optional_permissions) {
            if(supported_permissions.indexOf(permission) !== -1) {
                continue;
            }else if(permission === "<all_urls>") {
                continue;
            }else if(/^[a-z*]+:\/\/([^/]*)\/|^about:/.exec(permission)) {
                continue;
            }else{
                console.error("This extension is not supported.");
                alert("This extension is not supported.");
                console.log(permission);
                throw new Error("This extension is not supported.");
            }
        }
    }

    console.log("done");

    try {
        var recompress_zipfile = await recompress(zipfile, extension_id);
    }catch(e) {
        console.error("Fatal error: Compression failed.");
        alert("Fatal error: Compression failed.");
        console.error(e);
        throw e;
    }

    let blob = new Blob([recompress_zipfile], {type: "application/x-xpinstall"});
    let b_url = URL.createObjectURL(blob);
    if(isBackgroundPage() || isPopupPage()) {
        browser.tabs.create({url: b_url});
    }else{
        location.href = b_url;
    }
    setTimeout(() => URL.revokeObjectURL(b_url), 1000 * 60);
}

if(!isBackgroundPage() && !isPopupPage()) {
    let old_elem = null;
    setInterval(function(){
        if(document.querySelector(".webstore-test-button-label")){
            var elem = document.querySelector(".webstore-test-button-label").parentElement.parentElement.parentElement;
            if(elem && elem !== old_elem) {
                old_elem = elem;
                elem.addEventListener("click", function(e){
                    install(location.href);
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                }, true);
            }
        }
    }, 50);
}

async function getEWSAddons(){
    const addons = await browser.management.getAll();
    const cws_addons = addons.filter(addon => addon.type === "extension" && addon.id.endsWith("@cwsextension")); 
    return cws_addons;
}

async function check_updates() {
    let cws_addons = await getEWSAddons();
    let update_list = [];
    for (let addon of cws_addons) {
        let url = "https://clients2.google.com/service/update2/crx?response=redirect&os=win&arch=x86-64&os_arch=x86-64&nacl_arch=x86-64&prod=chromiumcrx&prodchannel=unknown&prodversion=9999.0.9999.0&acceptformat=crx2,crx3&x=id%3D" + addon.id.replace(/@cwsextension$/, "") + "%26uc";
        try {
            let zipfile = await download(url);
            let manifest = await readManifest(zipfile);
            if(manifest.version !== addon.version) {
                const update_info = {
                    id: addon.id,
                    name: addon.name,
                    icon: addon.icons[0].url,
                    new_version: manifest.version,
                    old_version: addon.version
                }
                update_list.push(update_info);
            }
        }catch(e) {
            console.error(e);
        }
    }
    
    browser.storage.local.set({
        update_list: update_list
    });
}
if(isBackgroundPage()) {
    check_updates();
    setInterval(check_updates, 1000 * 60 * 60 * 3);
}

async function extension_update(id) {
    try{
        await install(id.replace(/@cwsextension$/, ""));
    }catch(e) {
        throw e;
    }
    browser.storage.local.get({
        update_list: []
    }, function(res){
        let update_list = res.update_list;
        let index = update_list.findIndex(function(item){
            return item.id === id;
        });
        if(index !== -1) {
            update_list.splice(index, 1);
        }
        browser.storage.local.set({
            update_list: update_list
        });
    });
}
