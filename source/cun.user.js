// ==UserScript==
// @name         村花
// @namespace    https://cunhua.click/
// @version      0.9
// @description  cunhua
// @author       You
// @require      https://cunhua.click/template/bygsjw_sj/image/jquery.min.js
// @connect      cunhua.click
// @connect      www.cunhua.click
// @match        https://cunhua.click/*
// @match        https://www.cunhua.click/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=cunhua.click
// @grant       GM_xmlhttpRequest
// @grant       GM.xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    function GMFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            const { method = 'GET', headers = {}, data = null } = options;
            const requestOptions = {
                method: method.toUpperCase(),
                headers: headers,
                url: url,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 400) {
                        resolve(response.responseText);
                    } else {
                        reject(response.statusText);
                    }
                },
                onerror: (error) => {
                    reject(error);
                },
            };
            if (method.toUpperCase() === 'POST') {
                requestOptions.data = data;
            }
            GM_xmlhttpRequest(requestOptions);
        });
    }

    async function fetch_real_url(url) {
        const resp = await fetch(url);
        const html = await resp.text();
        let [, jsStr] = /<script.*?>([\s\S]*?)<\/script>/gm.exec(html);
        const temp = `
        MuURL='';
        MuObj={
            href:'',replace:function(abc){MuURL=abc},
            assign:function(abc){MuURL=abc},
        };` ;
        jsStr = temp + jsStr.replaceAll('location', 'MuObj');
        //console.log(jsStr);
        let func = new Function(jsStr);
        func();
        MuURL = MuURL ? MuURL : (MuObj.href || MuObj);
        let [, _dsign] = /_dsign=(.*)/gm.exec(MuURL);
        const sign = url.includes('?') ? '&' : '?';
        const _url = `${url}${sign}_dsign=${_dsign}`;
        return _url;
    }

    async function get_images(url) {
        //console.log(url);
        const real_url = await fetch_real_url(url);
        const mobileOpt = { headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1 Edg/113.0.0.0" } };
        const pcOpt = {};
        const opt = url.includes('mobile=') ? mobileOpt : pcOpt;
        const resp = await GMFetch(real_url, opt);
        const html = resp;//.text();
        let regex = /<img[^>]+id="aimg_\d+"[^>]*>/g;
        let matches = html.match(regex);
        //console.log(html);
        if (matches) {
            return matches.map((v) => {
                const src = $(v).attr('src');
                const zoomfile = $(v).attr('zoomfile');
                return zoomfile ? zoomfile : src;
            });
        } else {
            return [];
        }
        // const urls = $(html).find('.message a>img')
        //     .map(function () {
        //         return $(this).attr('src');
        //     }).get();
        // return urls;
    }

    function preLoadImg(id, url) {
        console.log("preLoadImg", id, url);
        var img = new Image();
        img.src = url;
        img.onload = function () {
            document.getElementById(id).src = url;
        };
        img.onerror = function () {
            document.getElementById(id).src = "https://jsonp.gitee.io/404.png";
        }
    }

    $('.threadlist li>a:first-child,#favorite_ul li>a[target="_blank"],#threadlist li.pbw h3>a,table[summary="主题付费"] tr td>a[target="_blank"]').each(async function (index, vo) {
        let container = $(this).parent().append(`<div class="img-list" style="width: 100vw; height:200px;padding-top:10px;overflow-x: auto; overflow-y: hidden; white-space: nowrap;"></div>`);
        const defaultImg = "https://jsonp.gitee.io/load.gif";
        let i = 0;
        while (i++ < 2) {
            container.find(".img-list").append(`<img src="${defaultImg}" id="id_${index}_img_${i - 1}" style="height: 200px; display: inline-block;padding:0 5px"/>`);
        }
        let url = $(this).attr('href');
        url = 'https://' + location.host + '/' + url;
        container.find(".img-list").attr("data-href", url).attr('data-index', index);
        lazyLoad();
    });

    function debounce(fn, delay) {
        let timer;
        return function () {
            const context = this;
            const args = arguments;
            clearTimeout(timer);
            timer = setTimeout(() => {
                fn.apply(context, args);
            }, delay);
        };
    }

    function lazyLoad() {
        const lazyDivs = $(".img-list[data-href]");
        lazyDivs.each(async (i, div) => {
            const divTop = div.getBoundingClientRect().top;
            const divBottom = div.getBoundingClientRect().bottom;
            const winTop = window.innerHeight;
            if (divTop < winTop && divBottom > 0) {
                const href = $(div).data('href');
                const index = $(div).data('index');
                $(div).removeAttr("data-href");
                const links = await get_images(href);
                let count = links.length;
                $(div).parent().find('p').append(`<b>[${count}P]</b>`);
                while (count++ < 2) {
                    links.push("https://jsonp.gitee.io/404.png");
                }
                links.slice(0, 2).forEach((link, _index) => {
                    const dom_id = `id_${index}_img_${_index}`;
                    preLoadImg(dom_id, link);
                });
            }
        });
    }
    const lazyLoadDebounced = debounce(lazyLoad, 60);
    window.addEventListener('scroll', lazyLoadDebounced);
})();