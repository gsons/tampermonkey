// ==UserScript==
// @name         cpoloar
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match       https://chat.openai.com/?service=*
// @connect      localhost
// @connect      api.github.com
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.io
// @grant       GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    function GM_fetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            const { method = 'GET', headers = {}, body = '' } = options;
            const requestOptions = {
                method: method.toUpperCase(),
                headers: headers,
                url: url,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 400) {
                        const obj = {
                            json: function () { return JSON.parse(response.responseText); },
                            text: function () { return response.responseText; }
                        };
                        resolve(obj);
                    } else {
                        reject(response);
                    }
                },
                onerror: (error) => {
                    reject(error);
                },
            };
            if (method.toUpperCase() === 'POST'||method.toUpperCase() === 'PUT') {
                requestOptions.data = body;
            }
            GM_xmlhttpRequest(requestOptions);
        });
    }

    async function getToken() {
        const response = await GM_fetch('http://localhost:9200/api/v1/user/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: '976955017@163.com',
                password: '976955017@163.com'
            })
        });

        const data = await response.json();
        const { code, data: { token } } = data;
        if (code === 20000) {
            return token;
        } else {
            throw new Error(`登录失败: ${JSON.stringify(data)}`);
        }
    }

    async function getlist(token) {
        const response = await GM_fetch('http://localhost:9200/api/v1/tunnels', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        const { code } = data;
        if (code === 20000) {
            let res=data.data.items.map((v)=>{return {name:v.name,domain:v.public_url.replace('https://','')}});
            let map={};
            res.forEach((vv)=>{
                map[vv.name]=vv.domain;
            });
            return map['chatgpt-ws'];
        } else {
            throw new Error(`获取列表失败: ${JSON.stringify(data)}`);
        }
    }

    async function main() {
       // await update_file("cpolar.php","update cpolar.php");
        //return;
        let token = await getToken();
        let list= await getlist(token);
        update_file('domain.json',JSON.stringify({"domain":list}));
        console.warn(new Date().toISOString(),'first token '+token,list);
         let templist=list;
        setInterval(async ()=>{
            try {
                templist = await getlist(token);
            } catch (error) {
                console.warn(new Date().toISOString(),'获取域名失败重新登录。。。');
                token = await getToken();
                console.warn(new Date().toISOString(),'new token '+token);
            }
            if(templist!=list){
                console.warn(new Date().toISOString(),'更新域名',templist);
                update_file('domain.json',JSON.stringify({"domain":templist}));
            }
            list=templist;
            console.log(new Date().toISOString(),list);
        },60000);
    }

    async function update_file(file_path, new_file_content) {
        const owner = "gsons";
        const repo = "gsons.github.io";
        const access_token = "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";

        // Define the current URL of the file we want to update
        const current_file_url = `https://api.github.com/repos/${owner}/${repo}/contents/${file_path}`;

        try {
          // Fetch the current file information
          const response = await GM_fetch(current_file_url, {
            headers: {
              'User-Agent': 'MyJSApp/1.0',
                "referer":"api.github.com",
              'Authorization': `token ${access_token}`
            }
          });

          // Extract the current file data from the response
          const current_file_data = await response.json();

          console.log(new Date().toISOString(),current_file_data);
          //return;

          // Check if the request was successful and get the current file's SHA value
          if (current_file_data.sha) {
            const current_file_sha = current_file_data.sha;

            // Define the URL for updating the file
            const update_file_url = `https://api.github.com/repos/${owner}/${repo}/contents/${file_path}`;

            // Define the new file content and encode it in base64
            const new_file_content_base64 = btoa(new_file_content);

            // Define the request body
            const request_body = JSON.stringify({
              message: `Update ${file_path}`,
              content: new_file_content_base64,
              sha: current_file_sha
            });

            // Set the Fetch options for the update request
            const update_response = await GM_fetch(update_file_url, {
              method: 'PUT',
              headers: {
                'User-Agent': 'MyJSApp/1.0',
                 "referer":"api.github.com",
                'Authorization': `token ${access_token}`,
                //'Content-Type': 'application/json',
                'Content-Length': request_body.length
              },
              body: request_body
            });

            const update_response_data = await update_response.json();

            // Check if the request was successful
            if (update_response_data.commit) {
              console.log("File updated successfully!");
            } else {
              console.log("File update failed!");
              console.log(update_response_data);
            }
          } else {
            console.log("Unable to get current file information!");
          }
        } catch (error) {
          console.log(error);
        }
      }


    main()
        .then()
        .catch((e) => {
            console.error(new Date().toISOString(),'主函数报错：',e);
        });

})();