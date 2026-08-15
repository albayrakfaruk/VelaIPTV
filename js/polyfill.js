(function () {
    if (!Object.assign) {
        Object.assign = function (target) {
            if (target == null) throw new TypeError("assign");
            var to = Object(target);
            for (var i = 1; i < arguments.length; i++) {
                var src = arguments[i];
                if (src == null) continue;
                for (var key in src) {
                    if (Object.prototype.hasOwnProperty.call(src, key)) to[key] = src[key];
                }
            }
            return to;
        };
    }

    if (typeof Promise !== "undefined") return;

    function P(fn) {
        var self = this;
        self._s = 0;
        self._v = null;
        self._ok = [];
        self._no = [];
        function resolve(v) {
            if (self._s) return;
            if (v && typeof v.then === "function") {
                v.then(resolve, reject);
                return;
            }
            self._s = 1;
            self._v = v;
            self._ok.forEach(function (f) { f(v); });
        }
        function reject(e) {
            if (self._s) return;
            self._s = 2;
            self._v = e;
            self._no.forEach(function (f) { f(e); });
        }
        try { fn(resolve, reject); } catch (err) { reject(err); }
    }
    P.prototype.then = function (ok, no) {
        var self = this;
        return new P(function (resolve, reject) {
            function handleOk(v) {
                try { resolve(ok ? ok(v) : v); } catch (e) { reject(e); }
            }
            function handleNo(e) {
                try {
                    if (no) resolve(no(e));
                    else reject(e);
                } catch (err) { reject(err); }
            }
            if (self._s === 1) handleOk(self._v);
            else if (self._s === 2) handleNo(self._v);
            else {
                self._ok.push(handleOk);
                self._no.push(handleNo);
            }
        });
    };
    P.prototype.catch = function (no) { return this.then(null, no); };
    P.resolve = function (v) { return new P(function (r) { r(v); }); };
    P.reject = function (e) { return new P(function (r, j) { j(e); }); };
    P.all = function (arr) {
        return new P(function (resolve, reject) {
            if (!arr.length) { resolve([]); return; }
            var out = [];
            var left = arr.length;
            arr.forEach(function (p, i) {
                P.resolve(p).then(function (v) {
                    out[i] = v;
                    left -= 1;
                    if (!left) resolve(out);
                }, reject);
            });
        });
    };
    window.Promise = P;
})();
