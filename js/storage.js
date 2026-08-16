var Store = (function () {
    var PREFIX = "vela.";

    function get(key, fallback) {
        try {
            var raw = localStorage.getItem(PREFIX + key);
            if (raw == null) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    }

    function set(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch (e) {}
    }

    function remove(key) {
        try {
            localStorage.removeItem(PREFIX + key);
        } catch (e) {}
    }

    function defaults() {
        return {
            cacheHours: CONFIG.DEFAULT_CACHE_HOURS,
            subtitleSize: "medium",
            aspectMode: "fit",
            playSpeed: 1,
            lastTab: "live"
        };
    }

    return {
        provider: function () { return get("provider", null); },
        setProvider: function (v) { set("provider", v); },
        clearProvider: function () {
            remove("provider");
            remove("catalog");
        },
        catalog: function () { return get("catalog", null); },
        setCatalog: function (v) { set("catalog", v); },
        favorites: function () { return get("favorites", []); },
        setFavorites: function (v) { set("favorites", v); },
        history: function () { return get("history", []); },
        setHistory: function (v) { set("history", v); },
        settings: function () { return Object.assign(defaults(), get("settings", {})); },
        setSettings: function (v) { set("settings", Object.assign(defaults(), v)); }
    };
})();
