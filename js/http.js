var Http = (function () {
    function isPreview() {
        try {
            var h = window.location.hostname;
            return h === "127.0.0.1" || h === "localhost";
        } catch (e) {
            return false;
        }
    }

    function wrap(url) {
        if (!url || !isPreview()) return url;
        if (url.charAt(0) === "/" || url.indexOf(window.location.origin) === 0) return url;
        return "/proxy?u=" + encodeURIComponent(url);
    }

    function request(url, timeoutMs) {
        url = wrap(url);
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.timeout = timeoutMs || 25000;
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status >= 200 && xhr.status < 400) resolve(xhr.responseText);
                else reject(new Error("HTTP " + xhr.status));
            };
            xhr.ontimeout = function () { reject(new Error("timeout")); };
            xhr.onerror = function () { reject(new Error("network")); };
            xhr.send();
        });
    }

    function json(url, timeoutMs) {
        return request(url, timeoutMs).then(function (text) {
            return JSON.parse(text);
        });
    }

    return { request: request, json: json, wrap: wrap, isPreview: isPreview };
})();
