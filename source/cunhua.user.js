// ==UserScript==
// @name         cunhua
// @namespace    https://cunhua.click/
// @version      0.2
// @description  cunhua
// @author       You
// @match        https://cunhua.click/*
// @match        https://www.cunhua.click/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=cunhua.click
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

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
        const _url = url + '&_dsign=' + _dsign;
        return _url;
    }

    async function get_images(url) {
        //console.log(url);
        const real_url = await fetch_real_url(url);
        const resp = await fetch(real_url);
        const html = await resp.text();
        var regex = /<img[^>]+id="aimg_\d+"[^>]*>/g;
        var matches = html.match(regex);
        return matches.map((v) => { return $(v).attr('src'); });
        // const urls = $(html).find('.message a>img')
        //     .map(function () {
        //         return $(this).attr('src');
        //     }).get();
        // return urls;
    }

    $('.threadlist a.z').each(async function (index, vo) {
        var url = $(this).attr('href');
        const links = await get_images('https://' + location.host + '/' + url);
        console.log(url, index, links);
        let count=links.length;
        $(this).find('p').append(`<b>[${count}P]</b>`);
        links.slice(0, 4).forEach((link) => {
            $(this).append('<img style="max-width:140px;max-height:240px;padding:5px;" src="' + link + '">');
        });
    });
})();