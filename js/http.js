var Http = (function () {
    function request(url, timeoutMs) {
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

    return { request: request, json: json };
})();
