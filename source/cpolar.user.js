// ==UserScript==
// @name         cpoloar_server
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  try to take over the world!
// @author       gsonhub
// @match        -https://jsonp.gitee.io/*
// @match        https://chat.openai.com/?service=*
// @connect      gitee.com
// @connect      localhost
// @connect      api.github.com
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.io
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand

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
            if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') {
                requestOptions.data = body;
            }
            GM_xmlhttpRequest(requestOptions);
        });
    }

    async function get_token() {
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

    async function get_tunnels(token) {
        const response = await GM_fetch('http://localhost:9200/api/v1/tunnels', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        const { code } = data;
        if (code === 20000) {
            let res = data.data.items.map((v) => {
                const _obj = { domain: v.public_url.replace('https://', '') };
                return { ...v, ..._obj }
            });
            return res.filter((vo)=>{return vo.name!='remoteDesktop'});
        } else {
            throw new Error(`获取列表失败: ${JSON.stringify(data)}`);
        }
    }

    async function start_cpolar(token, vv) {
        const url = `http://localhost:9200/api/v1/tunnels/${vv.id}/start`;
        const response = await GM_fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        const { code } = data;
        if (code === 20000) {
            return true;
        } else {
            throw new Error(`启动服务器失败: ${JSON.stringify(data)}`);
        }
    }

    function window_notice(title, text = '...') {
        GM_notification({
            text: text,
            title: "Cpolar plugin" + title
        });
    }

    function debug_info(...info) {
        console.log('Cpolar plugin: ', new Date().toLocaleString(), ...info);
    }
    function debug_error(...info) {
        console.error('Cpolar plugin: ', new Date().toLocaleString(), ...info);
    }
    function debug_warn(...info) {
        console.warn('Cpolar plugin: ', new Date().toLocaleString(), ...info);
    }

    async function check_tunnel_status(token, domain_list) {
        debug_info('检验cpplar', domain_list);
        domain_list.forEach(async vo => {
            if (vo.status != 'active') {
                try {
                    await start_cpolar(token, vo);
                    window_notice('Cpolar服务器', vo.domain + ' 启动成功');
                } catch (error) {
                    debug_error(error);
                    window_notice('Cpolar服务器', vo.domain + ' 启动失败');
                }
            } else {
                //debug_info(vo.name, vo.domain, vo.status);
            }
        });
    }

    async function update_github(file, new_file_content) {
        const owner = "gsons";
        const repo = "gsons.github.io";
        const access_token = "";
        let opt = {
            headers: {
                'User-Agent': 'MyJSApp/1.0',
                "referer": "api.github.com",
                'Authorization': `token ${access_token}`
            }
        };
        const res = await GM_fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file}`, opt);
        const { sha } = res.json();
        if (!sha) {
            debug_error("更新GITHUB失败 sha值为空无法更新:" + res.text());
            return false;
        }
        const update_file_url = `https://api.github.com/repos/${owner}/${repo}/contents/${file}`;
        const request_body = JSON.stringify({
            message: `Update ${file}`,
            content: btoa(new_file_content),
            sha: sha
        });
        const option = {
            method: 'PUT',
            headers: {
                'User-Agent': 'MyJSApp/1.0',
                "referer": "api.github.com",
                'Authorization': `token ${access_token}`,
                'Content-Length': request_body.length
            },
            body: request_body
        };
        //debug_info('github option', option);
        const update_response = await GM_fetch(update_file_url, option);
        const update_response_data = await update_response.json();
        if (update_response_data.commit) {
            debug_info("更新GITHUB成功", file);
            return true;
        } else {
            debug_error("更新GITHUB失败", file, update_response.text());
            return false;
        }
    }

    async function update_gitee(file, content) {
        const res = await GM_fetch(`https://gitee.com/api/v5/repos/jsonp/jsonp/contents/${file}`);
        const { sha } = res.json();
        if (!sha) {
            debug_error("更新GITEE失败 Gitee sha值为空无法更新:" + res.text());
            return false;
        }
        let data = new FormData();
        data.append('access_token', "2b5be221688193bc31733c8f321b993c");
        data.append('sha', sha);
        data.append('content', btoa(content));
        data.append('message', "update " + file);
        const update_response = await GM_fetch(`https://gitee.com/api/v5/repos/jsonp/jsonp/contents/${file}`, { method: "PUT", body: data });
        let { commit } = update_response.json();
        if (commit) {
            debug_info("更新GITEE成功", file);
            return true;
        } else {
            debug_error("更新GITEE失败", file, update_response.text());
            return false;
        }
    }

    async function update_ws_domain(domain_list) {
        const domain = get_ws_domain(domain_list);
        const content = `get_domain('${domain}');`;
        await update_gitee('get_domain.js', content);
        await update_github('get_domain.js', content);
        debug_warn('更新域名成功！');
        return domain;
    }

    function get_ws_domain(domain_list) {
        let map = {};
        domain_list.forEach(async (vv) => {
            map[vv.name] = vv.domain;
        });
        const domain = map['chatgpt-ws'];
        return domain;
    }

    async function main() {
        debug_warn('Cpolar更新服务....');
        let token = await get_token();
        let domain_list = await get_tunnels(token);
        await check_tunnel_status(token, domain_list);
        debug_info('first token ' + token, 'domain_list', domain_list);
        let old_domain = await update_ws_domain(domain_list).catch((err => { debug_error('更新域名错误', err); }));
        setInterval(async () => {
            try {
                domain_list = await get_tunnels(token);
            } catch (error) {
                debug_error('获取域名失败正在重新登录。。。', error);
                token = await get_token();
                domain_list = await get_tunnels(token);
            }
            await check_tunnel_status(token, domain_list);
            const new_domain = get_ws_domain(domain_list);
            if (new_domain != old_domain) {
                await update_ws_domain();
            }
            debug_info("获取到域名为", new_domain);
            old_domain = new_domain;
        }, 60000);
    }

    main().then().catch(err => {
        debug_error('主线程错误', err);
    })

})();