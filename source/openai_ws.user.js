// ==UserScript==
// @name          OPENAI-WS
// @namespace    OPENAI-WS
// @version        0.1
// @description  OPENAI-WS
// @author       gsonhub
// @match             https://chat.openai.com/?service=*
// @icon              data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @connect           127.0.0.1
// @connect           127.0.0.1:55151
// @connect           chat.openai.com
// @grant             GM_setValue
// @grant             GM_getValue
// @grant             GM_notification
// @grant             GM_registerMenuCommand
// @grant             GM_unregisterMenuCommand
// @grant             GM.xmlHttpRequest

// ==/UserScript==

(function () {
    'use strict';

    async function getAccessToken() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(),1500); // 设置超时时间为2秒
        try {
            const resp = await fetch('https://chat.openai.com/api/auth/session', { signal: controller.signal });
            clearTimeout(timeout);

            if (resp.status === 403) {
                throw new Error('CLOUDFLARE');
            }

            const data = await resp.json();
            if (!data.accessToken) {
                throw new Error('UNAUTHORIZED');
            }

            return data.accessToken;
        } catch (error) {
            clearTimeout(timeout);

            GM_notification({
                text: error,
                title: "ChatGPT 读取token服务异常!"
            });

            throw new Error('读取token服务异常,' + error);
        }
    }


    function uuidv4() {
        var d = new Date().getTime()
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0
            d = Math.floor(d / 16)
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })
        return uuid
    }

    async function generateAnswer(question, callback) {
        let accessToken = await getAccessToken();
        let pdata = {
            action: 'next',
            messages: [{
                role: 'user', id: question.id || uuidv4(),
                content: { content_type: 'text', parts: [question.content] }
            }],
            model: 'text-davinci-002-render',
            parent_message_id: question.pid || uuidv4(),
            max_tokens: 4000
        };
        if (question.cid) {
            pdata = { ...pdata, ...{ parent_message_id: question.pid, conversation_id: question.cid } };
        }
        console.log(pdata);

        let is_time_out = true;
        let req = GM.xmlHttpRequest({
            method: 'POST', url: 'https://chat.openai.com/backend-api/conversation',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
            responseType: 'stream',
            data: JSON.stringify(pdata),
            onloadstart: function (stream) {
                is_time_out = false;
                var reader = stream.response.getReader()
                reader.read().then(function processText({ done, value }) {
                    if (done) {
                        return;
                    }

                    let responseItem = String.fromCharCode(...Array.from(value));

                    //console.log('responseItem',"start***"+responseItem+"***end");
                    // if (responseItem.includes('Internal Server Error')) {
                    //     throw new Error('Internal Server Error');
                    // }

                    if (responseItem.includes('event: ping')) {
                        callback({ 'status': 'ping', 'data': '' })
                        return reader.read().then(processText);
                    }
                    var items = responseItem.split('\n\n');
                    items.pop();
                    //responseItem=items.pop();

                    const last1 = items.pop();
                    const last2 = items.pop();
                    let pid = '', cid = '';

                    if (!last1) {
                        callback({ 'status': 'error', 'data': responseItem });
                        return;
                    }

                    if (!last1.includes('data: [DONE]')) {
                        let temp = JSON.parse(last1.slice(6));
                        let answer = temp.message.content.parts[0];
                        pid = temp.message.id;
                        cid = temp.conversation_id;
                        callback({ 'status': 'loading', 'data': answer, pid: pid, cid: cid });
                    } else {
                        if (last2) {
                            let temp = JSON.parse(last2.slice(6));
                            let answer = temp.message.content.parts[0];
                            pid = temp.message.id;
                            cid = temp.conversation_id;
                            callback({ 'status': 'loading', 'data': answer, pid: pid, cid: cid });
                        }
                        setTimeout(() => { callback({ 'status': 'done', 'data': '' }) }, 100)
                        return;
                    }

                    return reader.read().then(processText)
                })
            },
            ontimeout: function (e) {
                const msg = "generateAnswer error ontimeout:" + e;
                callback({ 'status': 'error', 'data': msg });
                //throw new Error(msg);
            },
            onerror: function (error) {
                const msg = "generateAnswer error: " + error;
                callback({ 'status': 'error', 'data': msg });
                //throw new Error(msg);
            }
        });

        setTimeout(() => {
            if (is_time_out) {
                req.abort();
                const msg = "generateAnswer error ontimeout";
                GM_notification({
                    text: msg,
                    title: "ChatGPT服务异常!"
                });
                callback({ 'status': 'error', 'data': msg });
            }
        }, 3500);
    }

    class ChatWebSocket {
        constructor() {
            var ws = new WebSocket("ws://127.0.0.1:7272/");
            this.sendMsg = function (to_client_id, content) {
                let msg = {
                    "type": "say",
                    "to_client_id": to_client_id,
                    "to_client_name": "user",
                    "content": content
                };
                ws.send(JSON.stringify(msg));
            };
            this.connect = () => {
                ws.onopen = () => {
                    var login_data = { "type": "login", "client_name": "admin", "room_id": "1", "is_admin": true };
                    ws.send(JSON.stringify(login_data));
                };
                ws.onmessage = (e) => {
                    var data = JSON.parse(e.data);
                    switch (data['type']) {
                        case 'ping':
                            ws.send('{"type":"pong"}');
                            break;
                        case 'login':
                            console.log(data['client_id'] + "登录成功");
                            break;
                        case 'say':
                            if (data['from_client_name'] == 'user') {
                                generateAnswer(data['content'], ans => {
                                    //console.log(ans);
                                    this.sendMsg(data['from_client_id'], JSON.stringify(ans));
                                }).then().catch(err => {
                                    console.error(err);
                                    this.sendMsg(data['from_client_id'], JSON.stringify({
                                        'status': 'error',
                                        'data': '' + err
                                    }));
                                });
                            }
                            break;
                        case 'logout':
                            console.log(data['from_client_id'] + "退出");
                    }
                };
                ws.onclose = function () {
                    console.log("连接关闭");
                    setTimeout(() => { this.connect(); }, 2000);
                };
                ws.onerror = function (e) {
                    console.error('连接出错', e);
                    setTimeout(() => { this.connect(); }, 2000);
                };
            };
            return this;
        }
    }

    async function main() {
        GM_notification({
            text: "正在启动。。。",
            title: "ChatGPT"
        });
        var ws = new ChatWebSocket();
        ws.connect();
    }

    main().then().catch((err) => { console.error('主线程错误：', err) });
})();