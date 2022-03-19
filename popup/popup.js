document.addEventListener("DOMContentLoaded", function(e){
    browser.storage.local.get({
        update_list: []
    }, function(res) {
        if(res.update_list.length > 0) {
            let update_list = res.update_list;
            let update_list_elem = document.createElement("div");
            update_list_elem.id = "update-list";
            for(let update_info of update_list) {
                let update_info_elem = document.createElement("div");
                update_info_elem.className = "update-info";
                update_info_elem.innerHTML = `<div class="update-icon" style="background-image: url(${update_info.icon})"></div><div class="update-info-text"><div class="update-name">${update_info.name}</div><div class="update-version">${update_info.old_version} -> ${update_info.new_version}</div></div>`;
                update_info_elem.addEventListener("click", function(e){
                    extension_update(update_info.id);
                });
                update_list_elem.appendChild(update_info_elem);
            }
            document.body.appendChild(update_list_elem);
        }else{
            let update_list_elem = document.createElement("div");
            update_list_elem.id = "update-list";
            update_list_elem.innerHTML = "No updates available";
            document.body.appendChild(update_list_elem);
        }
    })
});