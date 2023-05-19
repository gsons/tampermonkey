// ==UserScript==
// @name         内网穿透域名更新器
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  try to take over the world!
// @author       gsonhub
// @match        https://gsons.github.io/*
// @match        https://chat.openai.com/?service=*
// @connect      gitee.com
// @connect      localhost
// @connect      192.168.88.3
// @connect      192.168.88.159
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


    class Http {
        static fetch(url, options = {}) {
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
                            reject('Http error:' + response.responseText);
                        }
                    },
                    onerror: (error) => {
                        reject('Htpp error:' + JSON.stringify(error));
                    },
                };
                if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') {
                    requestOptions.data = body;
                }
                GM_xmlhttpRequest(requestOptions);
            });
        }
    }

    class Log {

        static appName = '';

        static config(option) {
            const { app_name } = option;
            Log.appName = app_name;
        }

        static info(...info) {
            console.log(Log.appName, new Date().toLocaleString(), ...info);
        }
        static error(...info) {
            console.error(Log.appName, new Date().toLocaleString(), ...info);
        }
        static warn(...info) {
            console.warn(Log.appName, new Date().toLocaleString(), ...info);
        }
    }


    class BaseError extends Error {
        constructor(title, msg, error) {
            super();
            this.name = 'BaseError';
            this.title = title;
            this.error = title;
            if (error) throw error;
        }
        toString() {
            return `${this.title}: ${this.message}`;
        }
    }

    class Notice {
        static show(title, text = '...') {
            GM_notification({
                text: text,
                title: title
            });
        }
    }

    class Cpolar {
        token = '';

        constructor(option) {
            const { host, email, password } = option;
            this.host = host;
            this.email = email;
            this.password = password;
        }

        async initToken() {
            this.token = await this.getToken();
        }

        async setToken() {
            this.token = await this.getToken();
        }

        async getToken() {
            const url = `http://${this.host}:9200/api/v1/user/login`;
            const option = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: this.email,
                    password: this.password
                })
            };

            try {
                const response = await Http.fetch(url, option);
                const data = response.json();
                const { code, data: { token } } = data;
                if (code === 20000) {
                    return token;
                } else {
                    throw new Error(response.text());
                }
            } catch (error) {
                throw new Error('获取token失败,' + error);
            }
        }

        async getTunnels() {
            const url = `http://${this.host}:9200/api/v1/tunnels`;
            const option = {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            };

            try {
                const response = await Http.fetch(url, option);
                const data = await response.json();
                const { code } = data;
                if (code === 20000) {
                    let res = data.data.items.map((v) => {
                        const _obj = { domain: v.public_url.replace('https://', '') };
                        return { ...v, ..._obj }
                    });
                    return res.filter((vo) => { return vo.name != 'remoteDesktop' });
                } else {
                    throw new Error(response.text());
                }
            } catch (error) {
                throw new Error('获取域名列表失败,' + error);
            }
        }

        async startCpolar(vv) {
            const url = `http://${this.host}:9200/api/v1/tunnels/${vv.id}/start`;
            const option = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            };

            try {
                const response = await Http.fetch(url, option);
                const data = await response.json();
                const { code } = data;
                if (code === 20000) {
                    return true;
                } else {
                    throw new Error(response.text());
                }
            } catch (error) {
                throw new Error(`启动服务器${vv.domain}失败,` + error);
            }
        }

        getWsDomain(domain_list) {
            let map = {};
            domain_list.forEach(async (vv) => {
                map[vv.name] = vv.domain;
            });
            const domain = map['chatgpt-ws'];
            return domain;
        }

        async checkTunnelStatus(domain_list, callback) {
            domain_list.forEach(async vo => {
                if (vo.status != 'active') {
                    let is_run;
                    try {
                        await this.startCpolar(vo);
                        is_run = true;
                    } catch (error) {
                        is_run = false;
                    }
                    callback({ ...vo, is_run });
                }
            });
        }
    }

    class Github {
        static option = {};
        static config(option) {
            Github.option = option;
        }

        static async getSha(file_path) {
            const { owner, repo, token } = Github.option;
            let opt = {
                headers: {
                    'User-Agent': 'MyJSApp/1.0',
                    "referer": "api.github.com",
                    'Authorization': `token ${token}`
                }
            };
            const url = `https://api.github.com/repos/${owner}/${repo}/contents/${file_path}`
            try {
                let res = await Http.fetch(url, opt);
                const { sha } = res.json();
                if (sha) {
                    return sha;
                } else {
                    throw new Error(res.text());
                }
            } catch (error) {
                throw new Error('获取github sha失败,' + error);
            }
        }

        static async updateFileApi(sha, file_path, content) {
            const { owner, repo, token } = Github.option;
            const update_file_url = `https://api.github.com/repos/${owner}/${repo}/contents/${file_path}`;
            const request_body = JSON.stringify({
                message: `Update ${file_path}`,
                content: btoa(content),
                sha: sha
            });
            const option = {
                method: 'PUT',
                headers: {
                    'User-Agent': 'MyJSApp/1.0',
                    "referer": "api.github.com",
                    'Authorization': `token ${token}`,
                    'Content-Length': request_body.length
                },
                body: request_body
            };
            try {
                const update_response = await Http.fetch(update_file_url, option);
                const update_response_data = await update_response.json();
                if (update_response_data.commit) {
                    return update_response.text();
                } else {
                    throw new Error(update_response.text())
                }
            } catch (error) {
                throw new Error('更新GITHUB失败,' + error);
            }
        }

        static async updateFile(file_path, content) {
            const sha = await Github.getSha(file_path);
            return await Github.updateFileApi(sha, file_path, content);
        }
    }

    class Gitee {
        static option = {};
        static config(option) {
            Gitee.option = option;
        }
        static async getSha(file_path) {
            const { owner, repo, token } = Gitee.option;
            const url = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${file_path}`;

            try {
                let res = await Http.fetch(url);
                const { sha } = res.json();
                if (sha) {
                    return sha;
                } else {
                    throw new Error(res.text());
                }
            } catch (error) {
                throw new Error('获取gitee sha失败' + error);
            }
        }

        static async updateFileApi(sha, file_path, content) {
            const { owner, repo, token } = Gitee.option;
            let data = new FormData();
            data.append('access_token', token);
            data.append('sha', sha);
            data.append('content', btoa(content));
            data.append('message', "update " + file_path);
            const url = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${file_path}`;
            try {
                const update_response = await Http.fetch(url, { method: "PUT", body: data });
                let { commit } = update_response.json();
                if (commit) {
                    return update_response.text();
                } else {
                    throw new Error(update_response.text());
                }
            } catch (error) {
                throw new Error('更新gitee 失败,' + error);
            }
        }

        static async updateFile(file_path, content) {
            const sha = await Gitee.getSha(file_path);
            return await Gitee.updateFileApi(sha, file_path, content);
        }
    }

    class App {

        static async config() {
            Log.config({ app_name: 'Cpolar' });
            Gitee.config({ owner: 'jsonp', repo: 'jsonp', token: '' });
            Github.config({ owner: 'gsons', repo: 'gsons.github.io', token: '' });
        }
        static async checkTunnel(cpolar, domain_list) {
            await cpolar.checkTunnelStatus(domain_list, (vo) => {
                if (vo.is_run) {
                    Log.info('Cpolar服务器' + vo.name, vo.domain + '启动成功');
                    Notice.show('Cpolar服务器' + vo.name, vo.domain + '启动成功');
                } else {
                    Log.error('Cpolar服务器' + vo.name, vo.domain + '启动失败');
                    Notice.show('Cpolar服务器' + vo.name, vo.domain + '启动失败');
                }
            });
        }

        static async cpolar(option, callback) {
            const cpolar = new Cpolar(option);
            await cpolar.initToken();
            let domain_list = await cpolar.getTunnels();
            Log.info('domain_list', domain_list);
            let old_domain = cpolar.getWsDomain(domain_list);
            callback(old_domain);
            setInterval(async () => {
                try {
                    domain_list = await cpolar.getTunnels();
                    Log.info('检验 domain_list', domain_list);
                    App.checkTunnel(cpolar, domain_list);
                } catch (error) {
                    await cpolar.setToken();
                    domain_list = await cpolar.getTunnels();
                }
                let new_domain = cpolar.getWsDomain(domain_list);
                if (new_domain != old_domain) {
                    await callback(new_domain);
                }
                old_domain = new_domain;
            }, 60000);
        }

        static async updateWsFile(domain_list) {
            const content = `get_domain_list(${domain_list});`;
            let res1 = await Gitee.updateFile('get_domain_list.js', content);
            Log.info('更新gitee域名成功', content, res1);
            let res2 = await Github.updateFile('get_domain_list.js', content);
            Log.info('更新Github域名成功', content, res2);
        }

        static async run() {
            App.config();

            const domain0 = 't6rz7no.nat.ipyingshe.com';
            const option1 = { host: '192.168.88.159', email: '2084821727@qq.com', password: '2084821727@qq.com' };
            const option2 = { host: '192.168.88.3', email: '976955017@163.com', password: '976955017@163.com' };
            let domain1, domain2;
            App.cpolar(option1, async (domain) => {
                domain1 = domain;
                if (domain1 && domain2) {
                    const json =[domain2, domain1, domain0];
                    Log.info('更新域名1', json);
                    App.updateWsFile(JSON.stringify(json)).then().catch(err => { Log.error(err) });
                }
            });
            App.cpolar(option2, async (domain) => {
                domain2 = domain;
                if (domain1 && domain2) {
                    const json =[domain2, domain1, domain0];
                    Log.info('更新域名2', json);
                    App.updateWsFile(JSON.stringify(json)).then().catch(err => { Log.error(err) });
                }
            });
        }
    }

    App.run().then().catch((err) => {
        Log.error('主线程错误', err);
    })
})();