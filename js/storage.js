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
            remove("catPrefs");
        },
        catPrefs: function () { return get("catPrefs", {}); },
        setCatPrefs: function (v) { set("catPrefs", v || {}); },
        catalog: function () { return get("catalog", null); },
        setCatalog: function (v) { set("catalog", v); },
        favorites: function () { return get("favorites", []); },
        setFavorites: function (v) { set("favorites", v); },
        history: function () { return get("history", []); },
        setHistory: function (v) { set("history", v); },
        settings: function () {
            var saved = get("settings", {}) || {};
            var s = Object.assign(defaults(), saved);
            if (!saved.cacheMigrated168) {
                if (saved.cacheHours == null || saved.cacheHours === 72) {
                    s.cacheHours = CONFIG.DEFAULT_CACHE_HOURS;
                }
                s.cacheMigrated168 = true;
                set("settings", s);
            }
            return s;
        },
        setSettings: function (v) { set("settings", Object.assign(defaults(), v)); }
    };
})();
