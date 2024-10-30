// ==UserScript==
// @name         caoliu
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @require      https://cdn.bootcss.com/jquery/1.8.3/jquery.min.js
// @match        https://cc.9385x.xyz/thread0806.php?fid=*
// @icon         https://www.google.com/s2/favicons?domain=www.pornhub.com
// @connect      cc.9385x.xyz
// @grant        none
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

    async function get_images(url) {
        //console.log(url);
        const real_url = url;// await fetch_real_url(url);
        const mobileOpt = { headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1 Edg/113.0.0.0" } };
        const pcOpt = {};
        const opt = url.includes('mobile=') ? mobileOpt : mobileOpt;
        const resp = await fetch(real_url, opt);
        const html = await resp.text();
        let regex = /<img.*?ess-data=["'](.*?)["']/g;
        let matches = html.match(regex);
        if (matches) {
            return matches.map((htmlString) => {
                const regex = /<img.*?src=["'](.*?)["']/;
                const [, src] = regex.exec(htmlString) ?? [];
                const regex2 = /<img.*?ess-data=["'](.*?)["']/g;
                const [, zoomfile] = regex2.exec(htmlString) ?? [];
                return zoomfile ? zoomfile : src;
            }).reverse()//.sort(() => Math.random() - 0.5);//filter((v=>{return /\/\d+\/\d+\/\d+/.test(v)}));//.reverse();//filter((v)=>{!/\/\d+\/\d+\/\d+\//.test(v)});//
        } else {
            return [];
        }
    }

    $('table h3 a').each(async function (index, vo) {
        let container = $(this).parent().parent().parent().after(`<tr><td colspan="6"><div class="img-list" style="width: 100%; height:250px;padding-top:10px;overflow-x: auto; overflow-y: hidden; white-space: nowrap;"></div></td><tr>`);
        const defaultImg = "https://cosmic-dieffenbachia-e06779.netlify.app/img/load.gif";
        let i = 0;
        while (i++ < 3) {
            container.next().find(".img-list").append(`<img src="${defaultImg}" id="id_${index}_img_${i - 1}" style="height: 250px; display: inline-block;padding:0 5px"/>`);
        }
        //console.log(container.html());
        let url = $(this).attr('href');
        url = 'https://' + location.host + '/' + url;
        container.next().find(".img-list").attr("data-href", url).attr('data-index', index);
        lazyLoad();
    });

    function preLoadImg(id, url) {
        console.log("preLoadImg", id, url);
        var img = new Image();
        img.src = url;
        img.onload = function () {
            document.getElementById(id).src = url;
        };
        img.onerror = function () {
            document.getElementById(id).src = "https://cosmic-dieffenbachia-e06779.netlify.app/img/404.png";
        }
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
                console.log([href,links]);
                let count = links.length;
                $(div).parent().find('p').append(`<b>[${count}P]</b>`);
                while (count++ < 3) {
                   const img_id = `id_${index}_img_${count-1}`;
                   $('#'+img_id).remove();
                   //links.push("https://cosmic-dieffenbachia-e06779.netlify.app/img/404.png");
                }
                links.slice(0, 3).forEach((link, _index) => {
                    const dom_id = `id_${index}_img_${_index}`;
                    preLoadImg(dom_id, link);
                });
            }
        });
    }



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

    const lazyLoadDebounced = debounce(lazyLoad, 60);
    window.addEventListener('scroll', lazyLoadDebounced);

    async function test() {
        const links = await get_images('https://cc.9385x.xyz/htm_data/2410/25/6564453.html');
        console.log('test', links);
    }
    // test().then().catch();
})();