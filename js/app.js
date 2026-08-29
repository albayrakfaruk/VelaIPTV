var App = (function () {
    var t = I18N.t;
    var root;
    var screen = "splash";
    var setupType = "xtream";
    var form = { server: "", username: "", password: "", playlist: "", epg: "" };
    var formFocus = 0;
    var errorMsg = "";
    var statusMsg = "";
    var catalog = Provider.emptyCatalog();
    var provider = null;
    var tab = "live";
    var catIndex = 0;
    var itemIndex = 0;
    var focusCol = "cats";
    var menuOpen = false;
    var menuIndex = 0;
    var query = "";
    var searchOpen = false;
    var searchFocus = "keys";
    var searchKeyIndex = 0;
    var searchQuery = "";
    var toastTimer = null;
    var hintText = "";
    var hintTimer = null;
    var lastBack = 0;
    var playerItem = null;
    var playerList = [];
    var osdVisible = true;
    var osdTimer = null;
    var sheet = "";
    var sheetIndex = 0;
    var playTime = 0;
    var playDur = 0;
    var seriesDetail = null;
    var seasonIndex = 0;
    var epIndex = 0;
    var settingsIndex = 0;
    var lastContentTab = "live";
    var catEditKind = "live";
    var catEditIndex = 0;
    var catEditFocus = "list";
    var payFocus = 0;
    var setupChoice = 0;
    var itemsCache = null;
    var itemsCacheKey = "";
    var itemWin = { start: -1, end: -1 };
    var catWinStart = 0;
    var detailItem = null;
    var detailInfo = null;
    var detailFocus = "play";
    var trailerOpen = false;
    var pendingSeriesPlay = false;
    var chBuf = "";
    var chTimer = null;
    var subLabel = "";
    var osdGroup = "";
    var osdEpg = "";
    var playerBuffering = false;
    var replayAt = null;
    var painting = false;
    var seekTarget = -1;
    var seekOrigin = 0;
    var seekTimer = null;
    var pendingSeek = -1;
    var osdFocus = "bar";
    var returnScreen = "home";
    var loadingMore = false;
    var busyHideTimer = null;

    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
    }

    function hasClass(el, c) {
        return el && (" " + el.className + " ").indexOf(" " + c + " ") >= 0;
    }

    function addClass(el, c) {
        if (el && !hasClass(el, c)) el.className += (el.className ? " " : "") + c;
    }

    function remClass(el, c) {
        if (!el) return;
        el.className = (" " + el.className + " ").replace(" " + c + " ", " ").replace(/^\s+|\s+$/g, "");
    }

    function $(id) { return document.getElementById(id); }

    function mark(compact) {
        return '<div class="mark">' +
            '<img class="mark-v" src="icon.png?v=3" alt=""/>' +
            '<div><div class="mark-name">VELA</div>' +
            (compact ? "" : '<div class="mark-sub">IPTV PLAYER</div>') +
            "</div></div>";
    }

    function loginBrandHtml() {
        return '<div class="login-brand">' +
            '<img class="login-v" src="icon.png?v=3" alt="VELA"/>' +
            '<div class="login-name">VELA</div>' +
            '<div class="login-sub">IPTV PLAYER</div>' +
            "</div>";
    }

    function loginModesHtml(focusModes) {
        return '<div class="login-modes">' +
            '<div class="login-mode' + (setupType === "xtream" ? " active" : "") +
                (focusModes && setupChoice === 0 ? " focused" : "") +
                '" data-mode="xtream">' + esc(t("xtream")) + "</div>" +
            '<div class="login-mode' + (setupType === "m3u" ? " active" : "") +
                (focusModes && setupChoice === 1 ? " focused" : "") +
                '" data-mode="m3u">' + esc(t("m3u")) + "</div></div>";
    }

    function loginShell(inner) {
        return '<div class="login">' + loginBrandHtml() +
            '<div class="login-side"><div class="login-card">' + inner +
            "</div></div></div>";
    }

    function forceGatePreview() {
        try {
            return Http.isPreview() && /(?:^|[?&])(?:gate=1|screen=setup)(?:&|$)/.test(location.search);
        } catch (e) {
            return false;
        }
    }

    function forceCatEditPreview() {
        try {
            return Http.isPreview() && /(?:^|[?&])catedit=1(?:&|$)/.test(location.search);
        } catch (e) {
            return false;
        }
    }

    function show(id, on) {
        var el = $(id);
        if (!el) return;
        if (on) remClass(el, "hidden");
        else addClass(el, "hidden");
    }

    function toast(msg) {
        var node = $("toast");
        if (!node) return;
        node.textContent = msg;
        remClass(node, "hidden");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            addClass(node, "hidden");
            toastTimer = null;
        }, 1800);
    }

    function applyHint() {
        var el = $("phint");
        if (!el) return;
        el.textContent = hintText;
        if (hintText) remClass(el, "hidden");
        else addClass(el, "hidden");
    }

    function flashHint(msg) {
        if (screen !== "player") {
            toast(msg);
            return;
        }
        hintText = msg || "";
        if (hintTimer) clearTimeout(hintTimer);
        hintTimer = setTimeout(function () {
            hintText = "";
            hintTimer = null;
            applyHint();
        }, 1800);
        applyHint();
    }

    function clearHint() {
        if (hintTimer) {
            clearTimeout(hintTimer);
            hintTimer = null;
        }
        hintText = "";
    }

    function setBusy(msg) {
        var node = $("busy");
        if (!node) return;
        if (busyHideTimer) {
            clearTimeout(busyHideTimer);
            busyHideTimer = null;
        }
        if (msg) {
            node.textContent = msg;
            remClass(node, "hidden");
        } else addClass(node, "hidden");
    }

    function sections() {
        return [
            { id: "live", label: t("tv"), ico: "tv" },
            { id: "movies", label: t("movies"), ico: "film" },
            { id: "series", label: t("series"), ico: "series" },
            { id: "settings", label: t("settings"), ico: "gear" }
        ];
    }

    function sectionIndex(id) {
        var list = sections();
        for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
        return 0;
    }

    function isGrid() {
        return tab === "movies" || tab === "series";
    }

    function currentIndexMap() {
        if (tab === "live") return catalog.liveByCat;
        if (tab === "movies") return catalog.vodByCat;
        if (tab === "series") return catalog.seriesByCat;
        return null;
    }

    function rawCatsFor(kind) {
        if (kind === "live") return catalog.liveCats || [];
        if (kind === "movies") return catalog.vodCats || [];
        if (kind === "series") return catalog.seriesCats || [];
        return [];
    }

    function catKindPrefs(kind) {
        var all = Store.catPrefs() || {};
        var p = all[kind] || {};
        return {
            order: p.order ? p.order.slice() : [],
            hidden: p.hidden ? p.hidden.slice() : []
        };
    }

    function saveCatKindPrefs(kind, prefs) {
        var all = Store.catPrefs() || {};
        all[kind] = {
            order: prefs.order || [],
            hidden: prefs.hidden || []
        };
        Store.setCatPrefs(all);
    }

    function arrangedCats(kind, includeHidden) {
        var raw = rawCatsFor(kind);
        var prefs = catKindPrefs(kind);
        var byId = {};
        var i;
        for (i = 0; i < raw.length; i++) {
            if (raw[i]) byId[String(raw[i].id)] = raw[i];
        }
        var seen = {};
        var out = [];
        var order = prefs.order;
        for (i = 0; i < order.length; i++) {
            var id = String(order[i]);
            if (byId[id] && !seen[id]) {
                out.push(byId[id]);
                seen[id] = true;
            }
        }
        for (i = 0; i < raw.length; i++) {
            var rid = String(raw[i].id);
            if (!seen[rid]) out.push(raw[i]);
        }
        if (includeHidden) return out;
        var hidden = {};
        for (i = 0; i < prefs.hidden.length; i++) hidden[String(prefs.hidden[i])] = true;
        var vis = [];
        for (i = 0; i < out.length; i++) {
            if (!hidden[String(out[i].id)]) vis.push(out[i]);
        }
        return vis;
    }

    function isCatHidden(kind, id) {
        return catKindPrefs(kind).hidden.indexOf(String(id)) >= 0;
    }

    function currentCats() {
        var cats;
        if (tab === "live" || tab === "movies" || tab === "series") cats = arrangedCats(tab, false);
        else return [];
        if (favItemsOfTab(false).length) {
            return [{ id: "fav", name: t("favorites") }].concat(cats);
        }
        return cats;
    }

    function itemsOfTab() {
        if (tab === "live") return catalog.live || [];
        if (tab === "movies") return catalog.vod || [];
        if (tab === "series") return catalog.series || [];
        return [];
    }

    function favItemsOfTab(applyQuery) {
        var pool = itemsOfTab();
        var favs = Store.favorites();
        if (!favs.length || !pool.length) return [];
        var byKey = {};
        for (var i = 0; i < pool.length; i++) {
            var k = Provider.itemKey(pool[i]);
            if (!byKey[k]) byKey[k] = pool[i];
        }
        var out = [];
        var q = applyQuery && query ? query.toLowerCase() : "";
        for (var f = 0; f < favs.length; f++) {
            var it = byKey[favs[f]];
            if (!it) continue;
            if (q && (it.name || "").toLowerCase().indexOf(q) === -1) continue;
            out.push(it);
        }
        return out;
    }

    function invalidateItems() {
        itemsCache = null;
        itemsCacheKey = "";
        itemWin.start = -1;
    }

    function currentItems() {
        var cat = currentCats()[catIndex] || { id: "all" };
        var key = tab + "|" + cat.id + "|" + query;
        if (itemsCache && itemsCacheKey === key) return itemsCache;
        itemsCacheKey = key;
        if (cat.id === "fav") {
            itemsCache = favItemsOfTab(true);
            return itemsCache;
        }
        itemsCache = Provider.filterItems(currentIndexMap(), cat.id, query);
        return itemsCache;
    }

    function logoTag(src, name, cls) {
        var letter = esc((name || "?").charAt(0).toUpperCase());
        if (src) {
            return '<img src="' + esc(src) + '" alt="' + letter + '" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'"/>' +
                '<div class="ph" style="display:none">' + letter + "</div>";
        }
        return '<div class="' + (cls || "ph") + '">' + letter + "</div>";
    }

    function mount() {
        root.innerHTML =
            '<div id="gate" class="screen bg-dim"></div>' +
            '<div id="home" class="screen shell hidden">' +
                '<div class="scrim" id="scrim"></div>' +
                '<div class="menu-edge"></div>' +
                '<aside class="sidemenu" id="menu">' +
                    mark(true) +
                    '<div id="menu-list"></div>' +
                    '<div class="menu-foot" id="menu-foot"></div>' +
                "</aside>" +
                '<section class="main">' +
                    '<div class="catbar"><div class="sec-label" id="sec-label">TV</div>' +
                    '<div class="cat-tabs" id="cat-tabs"></div>' +
                    '<div class="cat-search" id="cat-search"></div>' +
                    '<div class="cat-meta" id="cat-meta"></div></div>' +
                    '<div class="stage" id="stage"></div>' +
                "</section>" +
            "</div>" +
            '<div id="catedit" class="screen catedit-screen hidden"></div>' +
            '<div id="detail-screen" class="screen detail hidden"></div>' +
            '<div id="trailer-layer" class="trailer-layer hidden"></div>' +
            '<div id="player-ui" class="screen hidden"></div>' +
            '<div id="toast" class="toast hidden"></div>' +
            '<div id="ch-osd" class="ch-osd hidden"></div>' +
            '<div id="busy" class="busy hidden"></div>';
    }

    function paintGate() {
        var gate = $("gate");
        if (!gate) return;
        show("gate", true);
        show("home", false);
        show("catedit", false);
        show("detail-screen", false);
        show("player-ui", false);
        if (screen === "splash") {
            gate.className = "screen bg-dim login-screen";
            gate.innerHTML = '<div class="login">' + loginBrandHtml() +
                '<div class="login-side"><div class="login-card login-wait">' +
                '<div class="p-spin"></div>' +
                '<div class="splash-status">' + esc(statusMsg || t("loading")) + "</div></div></div></div>";
            return;
        }
        if (screen === "paywall") {
            var btns = [t("subscribe"), t("restore"), t("later")];
            var acts = ["subscribe", "restore", "later"];
            var html = '<div class="login-kicker">' + esc(t("loginKicker")) + "</div>" +
                "<h1>" + esc(t("subscribeTitle")) + "</h1><p>" + esc(t("subscribeBody")) +
                '</p><div class="form-actions">';
            for (var i = 0; i < btns.length; i++) {
                html += '<button class="btn ' + (i === 0 ? "primary " : "") + "focusable" +
                    (i === payFocus ? " focused" : "") + '" data-act="' + acts[i] + '">' +
                    esc(btns[i]) + "</button>";
            }
            html += "</div>";
            gate.className = "screen bg-dim login-screen";
            gate.innerHTML = loginShell(html);
            return;
        }
        var fields = setupType === "xtream"
            ? [
                { key: "server", label: t("server"), value: form.server, hint: t("serverPh") },
                { key: "username", label: t("username"), value: form.username, hint: t("usernamePh") },
                { key: "password", label: t("password"), value: form.password, pass: true, hint: t("passwordPh") }
            ]
            : [
                { key: "playlist", label: t("playlist"), value: form.playlist, hint: t("playlistPh") }
            ];
        var focusModes = screen === "setup";
        if (!focusModes && formFocus > fields.length) formFocus = fields.length;
        var html = "<h1>" + esc(t("loginHead")) + "</h1>" + loginModesHtml(focusModes);
        for (var f = 0; f < fields.length; f++) {
            html += '<div class="field"><label>' + esc(fields[f].label) + "</label>" +
                '<input class="focusable' + (!focusModes && formFocus === f ? " focused" : "") +
                '" data-k="' + fields[f].key + '" value="' + esc(fields[f].value) + '"' +
                (fields[f].hint ? ' placeholder="' + esc(fields[f].hint) + '"' : "") +
                (fields[f].pass ? ' type="password"' : ' type="text"') + "/></div>";
        }
        html += '<div class="error">' + esc(errorMsg) + "</div><div class=\"form-actions\">" +
            '<button class="btn primary focusable' +
            (!focusModes && formFocus === fields.length ? " focused" : "") +
            '" data-act="connect">' + esc(statusMsg || t("connect")) + "</button></div>";
        gate.className = "screen bg-dim login-screen";
        gate.innerHTML = loginShell(html);
        var focused = gate.querySelector(".focused");
        if (focused && focused.tagName === "INPUT") {
            focused.focus();
            var v = focused.value;
            focused.value = "";
            focused.value = v;
        }
    }

    function paintMenu() {
        var list = sections();
        var html = "";
        var foot = "";
        for (var i = 0; i < list.length; i++) {
            var s = list[i];
            var main = s.id !== "settings";
            var cls = "menu-item" + (tab === s.id ? " active" : "") +
                (focusCol === "menu" && menuIndex === i ? " focused" : "");
            var block = '<div class="' + cls + '" data-sec="' + s.id + '">' +
                '<div class="ico"><i class="nav-ico nav-' + s.ico + '"></i></div>' +
                '<div class="lab">' + esc(s.label) + "</div></div>";
            if (main) html += block;
            else foot += block;
        }
        $("menu-list").innerHTML = html;
        $("menu-foot").innerHTML = foot;
        var shell = $("home");
        if (menuOpen) addClass(shell, "menu-open");
        else remClass(shell, "menu-open");
    }

    function paintCats() {
        var bar = $("cat-tabs");
        var meta = $("cat-meta");
        var label = $("sec-label");
        var searchBtn = $("cat-search");
        if (label) {
            var list = sections();
            var name = t("tv");
            for (var s = 0; s < list.length; s++) if (list[s].id === tab) name = list[s].label;
            label.textContent = name;
        }
        if (tab === "settings") {
            bar.innerHTML = "";
            if (searchBtn) addClass(searchBtn, "hidden");
            meta.textContent = "";
            return;
        }
        if (searchBtn) {
            remClass(searchBtn, "hidden");
            searchBtn.innerHTML = icoSvg("search");
            if (focusCol === "search" || searchOpen) addClass(searchBtn, "focused");
            else remClass(searchBtn, "focused");
            if (searchOpen) addClass(searchBtn, "open");
            else remClass(searchBtn, "open");
        }
        var cats = currentCats();
        var vis = CONFIG.CAT_TABS || 8;
        catWinStart = Math.max(0, Math.min(catIndex, Math.max(0, cats.length - vis)));
        if (catIndex - catWinStart >= vis) catWinStart = catIndex - vis + 1;
        var idxMap = currentIndexMap();
        var html = "";
        var end = Math.min(cats.length, catWinStart + vis);
        for (var i = catWinStart; i < end; i++) {
            var cid = String(cats[i].id);
            var n = cid === "fav"
                ? favItemsOfTab(false).length
                : ((idxMap && idxMap[cid]) ? idxMap[cid].length : 0);
            html += '<div class="cat-tab' + (i === catIndex ? " active" : "") +
                (focusCol === "cats" && i === catIndex ? " focused" : "") +
                '" data-i="' + i + '"><span class="cat-name">' + esc(cats[i].name) +
                '</span><span class="cnt">(' + n + ")</span></div>";
        }
        bar.innerHTML = html;
        meta.textContent = "";
    }

    var SEARCH_KEYS = [
        "1","2","3","4","5","6","7","8","9","0",
        "q","w","e","r","t","y","u","ı","o","p",
        "a","s","d","f","g","h","j","k","l","ğ",
        "z","x","c","v","b","n","m","ü","ş","i",
        "ö","ç","space","back","clear"
    ];

    function searchItems() {
        var q = (searchQuery || "").trim().toLowerCase();
        if (!q) return [];
        var pool = itemsOfTab();
        var out = [];
        var seen = {};
        for (var i = 0; i < pool.length; i++) {
            var it = pool[i];
            var key = Provider.itemKey(it);
            if (seen[key]) continue;
            var name = (it.name || "").toLowerCase();
            if (name.indexOf(q) === -1 && String(it.year || "") !== q) continue;
            seen[key] = 1;
            out.push(it);
        }
        return out;
    }

    function openSearch() {
        if (tab === "settings") return;
        searchOpen = true;
        searchFocus = "keys";
        searchKeyIndex = 10;
        searchQuery = "";
        itemIndex = 0;
        focusCol = "search";
        menuOpen = false;
        paintHome(true);
    }

    function closeSearch() {
        searchOpen = false;
        searchFocus = "keys";
        searchQuery = "";
        itemIndex = 0;
        focusCol = "search";
        paintHome(true);
    }

    function applySearchChar(ch) {
        if (ch === "back") {
            searchQuery = searchQuery.slice(0, -1);
        } else if (ch === "clear") {
            searchQuery = "";
        } else if (ch === "space") {
            if (searchQuery && searchQuery.slice(-1) !== " ") searchQuery += " ";
        } else {
            searchQuery += ch;
        }
        itemIndex = 0;
        paintStage(true);
        paintCats();
    }

    function searchKeyLabel(ch) {
        if (ch === "space") return t("searchSpace");
        if (ch === "back") return t("searchDel");
        if (ch === "clear") return t("searchClear");
        return ch;
    }

    function paintSearchOsk() {
        var html = "";
        var i = 0;
        while (i < SEARCH_KEYS.length) {
            var rowEnd = i < 40 ? i + 10 : SEARCH_KEYS.length;
            html += '<div class="search-row">';
            for (; i < rowEnd; i++) {
                var ch = SEARCH_KEYS[i];
                html += '<div class="search-key' + (ch === "space" ? " wide" : "") +
                    (searchFocus === "keys" && i === searchKeyIndex ? " is-on" : "") +
                    '" data-k="' + i + '">' + esc(searchKeyLabel(ch)) + "</div>";
            }
            html += "</div>";
        }
        return html;
    }

    function paintSearchHits(items) {
        if (!searchQuery.trim()) {
            return '<div class="empty">' + esc(t("searchType")) + "</div>";
        }
        if (!items.length) {
            return '<div class="empty">' + esc(t("searchEmpty")) + "</div>";
        }
        var start;
        var end;
        var html;
        var focused = searchFocus === "results";
        if (isGrid()) {
            var page = CONFIG.GRID_COLS * (searchFocus === "results" ? CONFIG.GRID_ROWS : 1);
            start = Math.floor(itemIndex / page) * page;
            end = Math.min(items.length, start + page);
            html = '<div class="grid">';
            for (var g = start; g < end; g++) {
                var v = items[g];
                html += '<div class="poster' + (focused && g === itemIndex ? " focused" : "") +
                    '" data-i="' + g + '"><div class="art">' +
                    favMark(v) +
                    logoTag(v.logo, v.name) +
                    '<div class="cap">' + esc(v.name) + "</div></div></div>";
            }
            html += "</div>";
        } else {
            var vis = searchFocus === "results" ? CONFIG.LIVE_PAGE : Math.min(5, CONFIG.LIVE_PAGE);
            start = Math.max(0, itemIndex - Math.floor((vis - 1) / 2));
            end = Math.min(items.length, start + vis);
            if (end - start < vis) start = Math.max(0, end - vis);
            html = '<div class="list">';
            for (var i = start; i < end; i++) {
                var it = items[i];
                html += '<div class="row' + (focused && i === itemIndex ? " focused" : "") +
                    '" data-i="' + i + '">' +
                    logoTag(it.logo, it.name) +
                    '<div class="meta"><div class="name">' + esc(it.name) + "</div></div>" +
                    favMark(it) +
                    "</div>";
            }
            html += "</div>";
        }
        return html;
    }

    function paintSearch() {
        var items = searchItems();
        if (itemIndex >= items.length) itemIndex = Math.max(0, items.length - 1);
        var q = searchQuery;
        var html = '<div class="search-box">' +
            '<div class="search-head' + (searchFocus === "query" ? " is-on" : "") + '">' +
            icoSvg("search") +
            '<div class="search-q' + (q ? "" : " is-ph") + '">' + esc(q || t("searchHint")) + "</div>" +
            '<div class="search-n">' + (q ? items.length : "") + "</div></div>" +
            '<div class="search-hits">' + paintSearchHits(items) + "</div>";
        if (searchFocus !== "results") html += '<div class="search-osk">' + paintSearchOsk() + "</div>";
        html += "</div>";
        return html;
    }

    function moveSearchKey(k) {
        var max = SEARCH_KEYS.length - 1;
        var i = searchKeyIndex;
        if (k === "left") {
            if (i > 0) searchKeyIndex = i - 1;
        } else if (k === "right") {
            if (i < max) searchKeyIndex = i + 1;
        } else if (k === "up") {
            if (i < 10) searchFocus = "query";
            else if (i < 40) searchKeyIndex = i - 10;
            else searchKeyIndex = 30 + Math.min(9, (i - 40) * 2);
        } else if (k === "down") {
            if (i < 30) searchKeyIndex = i + 10;
            else if (i < 40) searchKeyIndex = 40 + Math.min(4, Math.floor((i - 30) / 2));
            else {
                searchFocus = "results";
                itemIndex = 0;
            }
        }
        paintStage(true);
    }

    function handleSearchKey(k) {
        if (k === "yellow") return;
        if (k === "back") {
            if (searchQuery) {
                applySearchChar("back");
                return;
            }
            closeSearch();
            return;
        }
        if (k === "red") {
            var hit = searchItems()[itemIndex];
            if (searchFocus === "results" && hit) toggleFav(hit);
            return;
        }
        if (searchFocus === "query") {
            if (k === "down" || k === "enter") {
                searchFocus = "keys";
                paintStage(true);
            }
            return;
        }
        if (searchFocus === "keys") {
            if (k === "enter") {
                applySearchChar(SEARCH_KEYS[searchKeyIndex]);
                return;
            }
            moveSearchKey(k);
            return;
        }
        var items = searchItems();
        var cols = CONFIG.GRID_COLS;
        var max = Math.max(0, items.length - 1);
        if (k === "up") {
            if (isGrid()) {
                if (itemIndex < cols) {
                    searchFocus = "keys";
                    paintStage(true);
                    return;
                }
                itemIndex -= cols;
            } else {
                if (itemIndex <= 0) {
                    searchFocus = "keys";
                    paintStage(true);
                    return;
                }
                itemIndex -= 1;
            }
            paintStage(false);
            return;
        }
        if (k === "down") {
            if (isGrid()) itemIndex = Math.min(max, itemIndex + cols);
            else itemIndex = Math.min(max, itemIndex + 1);
            paintStage(false);
            return;
        }
        if (k === "left") {
            if (isGrid() && itemIndex % cols !== 0) itemIndex -= 1;
            paintStage(false);
            return;
        }
        if (k === "right") {
            if (isGrid()) itemIndex = Math.min(max, itemIndex + 1);
            paintStage(false);
            return;
        }
        if (k === "enter" && items[itemIndex]) {
            var pick = items[itemIndex];
            var list = items;
            searchOpen = false;
            searchQuery = "";
            returnScreen = "home";
            startPlay(pick, list);
        }
    }

    function paintStage(force) {
        var stage = $("stage");
        if (tab === "settings") {
            stage.innerHTML = renderSettingsInner();
            itemWin.start = -1;
            return;
        }
        if (searchOpen) {
            stage.innerHTML = paintSearch();
            itemWin.start = -1;
            return;
        }
        var items = currentItems();
        if (!items.length) {
            var empty = (currentCats()[catIndex] || {}).id === "fav"
                ? t("emptyFav")
                : (tab === "live" ? t("emptyLive") : t("emptyVod"));
            stage.innerHTML = '<div class="empty">' + esc(empty).replace("\n", "<br/>") + "</div>";
            itemWin.start = -1;
            return;
        }
        var start;
        var end;
        var html;
        if (isGrid()) {
            var page = CONFIG.GRID_COLS * CONFIG.GRID_ROWS;
            start = Math.floor(itemIndex / page) * page;
            end = Math.min(items.length, start + page);
            if (!force && start === itemWin.start && end === itemWin.end) {
                syncItemFocus();
                return;
            }
            html = '<div class="grid">';
            for (var g = start; g < end; g++) {
                var v = items[g];
                html += '<div class="poster' + (focusCol === "items" && g === itemIndex ? " focused" : "") +
                    '" data-i="' + g + '"><div class="art">' +
                    (v.year && v.kind !== "vod" ? '<div class="badge">' + esc(v.year) + "</div>" : "") +
                    favMark(v) +
                    logoTag(v.logo, v.name) +
                    '<div class="cap">' + esc(v.name) + "</div></div></div>";
            }
            html += "</div>";
        } else {
            var vis = CONFIG.LIVE_PAGE;
            start = Math.max(0, itemIndex - Math.floor((vis - 1) / 2));
            end = Math.min(items.length, start + vis);
            if (end - start < vis) start = Math.max(0, end - vis);
            if (!force && start === itemWin.start && end === itemWin.end) {
                syncItemFocus();
                return;
            }
            html = '<div class="list">';
            for (var i = start; i < end; i++) {
                var it = items[i];
                html += '<div class="row' + (focusCol === "items" && i === itemIndex ? " focused" : "") +
                    '" data-i="' + i + '">' +
                    logoTag(it.logo, it.name) +
                    '<div class="meta"><div class="name">' + esc(it.name) + "</div></div>" +
                    favMark(it) +
                    '<div class="go">›</div>' +
                    "</div>";
            }
            html += "</div>";
        }
        itemWin.start = start;
        itemWin.end = end;
        stage.innerHTML = html;
    }

    function syncItemFocus() {
        var stage = $("stage");
        if (!stage) return;
        var nodes = stage.querySelectorAll("[data-i]");
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var idx = Number(n.getAttribute("data-i"));
            if (focusCol === "items" && idx === itemIndex) addClass(n, "focused");
            else remClass(n, "focused");
        }
    }

    function cacheRefreshOpts() {
        return [-1, 24, 72, 168, 0];
    }

    function normalizeCacheHours(h) {
        var opts = cacheRefreshOpts();
        return opts.indexOf(h) >= 0 ? h : 72;
    }

    function cacheRefreshLabel(h) {
        h = normalizeCacheHours(h);
        if (h === -1) return t("refreshAlways");
        if (h === 0) return t("refreshNever");
        if (h === 24) return t("hours24");
        if (h === 72) return t("days3");
        if (h === 168) return t("days7");
        return t("days3");
    }

    function cacheExpired() {
        var h = normalizeCacheHours(Store.settings().cacheHours);
        if (h === 0) return false;
        if (h === -1) return true;
        var at = catalog.fetchedAt || 0;
        if (!at) return true;
        return (Date.now() - at) >= h * 3600 * 1000;
    }

    function settingsRows() {
        var s = Store.settings();
        var refreshLabel = cacheRefreshLabel(s.cacheHours);
        return [
            { id: "refresh", name: t("refresh"), value: "" },
            { id: "interval", name: t("refreshEvery"), value: refreshLabel },
            { id: "cats", name: t("editCats"), value: "" },
            { id: "remove", name: t("removeProvider"), value: provider ? provider.label : "" },
            { id: "about", name: t("about"), value: CONFIG.APP_VERSION }
        ];
    }

    function renderSettingsInner() {
        var rows = settingsRows();
        var html = '<div class="settings-list">';
        if (settingsIndex >= rows.length) settingsIndex = rows.length - 1;
        if (settingsIndex < 0) settingsIndex = 0;
        for (var i = 0; i < rows.length; i++) {
            html += '<div class="row' + (i === settingsIndex ? " focused" : "") + '" data-set="' + rows[i].id + '"><div class="name">' +
                esc(rows[i].name) + "</div><div>" + esc(rows[i].value) + "</div></div>";
        }
        html += "</div>";
        return html;
    }

    function paintHome(forceItems) {
        show("gate", false);
        show("catedit", false);
        show("detail-screen", false);
        show("player-ui", false);
        show("home", true);
        paintMenu();
        paintCats();
        paintStage(!!forceItems);
    }

    function isFavItem(item) {
        if (!item) return false;
        return Store.favorites().indexOf(Provider.itemKey(item)) >= 0;
    }

    function favMark(item) {
        if (!isFavItem(item)) return "";
        return '<div class="fav-mark">' + icoSvg("heart") + "</div>";
    }

    function minutesFromDuration(s, secs) {
        var n = parseInt(secs, 10);
        if (isFinite(n) && n > 0) return Math.round(n / 60);
        if (s == null || s === "") return 0;
        if (typeof s === "number") {
            if (s > 1000) return Math.round(s / 60);
            return Math.round(s);
        }
        var str = String(s).trim().toLowerCase().replace(",", ".");
        if (!str || str === "0" || str === "00:00" || str === "00:00:00" || str === "n/a" ||
            str === "none" || str === "null") return 0;
        var colon = str.split(":");
        if (colon.length >= 2 && /^\d+$/.test(colon[0]) && /^\d+$/.test(colon[1])) {
            var h = parseInt(colon[0], 10);
            var m = parseInt(colon[1], 10);
            var sec = colon[2] ? parseInt(colon[2], 10) : 0;
            return h * 60 + m + (sec >= 30 ? 1 : 0);
        }
        var hm = str.match(/(\d+)\s*(?:saat|sa|h|hr|hrs|hours?)\s*(\d+)?/);
        if (hm) return parseInt(hm[1], 10) * 60 + (hm[2] ? parseInt(hm[2], 10) : 0);
        var mins = str.match(/(\d+(?:\.\d+)?)\s*(?:dakika|dk|min|mins|minutes?)/);
        if (mins) return Math.round(parseFloat(mins[1]));
        if (/^\d+$/.test(str)) {
            n = parseInt(str, 10);
            if (n > 300 && n < 20000) return Math.round(n / 60);
            if (n > 0 && n < 500) return n;
        }
        return 0;
    }

    function fmtDuration(s, secs) {
        var mins = minutesFromDuration(s, secs);
        if (!mins) return "";
        var h = Math.floor(mins / 60);
        var m = mins % 60;
        if (h && m) return h + " sa " + m + " dk";
        if (h) return h + " sa";
        return m + " dk";
    }

    function itemCatText(item) {
        if (!item) return "";
        var cats = catalog.liveCats;
        if (item.kind === "vod") cats = catalog.vodCats;
        else if (item.kind === "series" || item.kind === "episode") cats = catalog.seriesCats;
        cats = cats || [];
        var ids = item.groups && item.groups.length ? item.groups : [item.group];
        var names = [];
        for (var i = 0; i < ids.length; i++) {
            for (var c = 0; c < cats.length; c++) {
                if (String(cats[c].id) === String(ids[i])) {
                    names.push(cats[c].name || "");
                    break;
                }
            }
        }
        return names.join(" ");
    }

    function qualityLabel(item, info) {
        info = info || {};
        var w = Number(info.videoWidth) || 0;
        var h = Number(info.videoHeight) || 0;
        if (w >= 3800 || h >= 2100) return "4K";
        if (w >= 1800 || h >= 1000) return "FHD";
        if (w >= 1200 || h >= 700) return "HD";
        if (w >= 500 || h >= 360) return "SD";
        var text = [
            info.name || "",
            item && item.name || "",
            itemCatText(item)
        ].join(" ");
        if (/4k|uhd|2160/i.test(text)) return "4K";
        if (/1080|full.?hd|\bfhd\b|bluray|blu.?ray/i.test(text)) return "FHD";
        if (/\bhd\b|720p|\b720\b/i.test(text)) return "HD";
        if (/\bsd\b|480p|\b480\b/i.test(text)) return "SD";
        return "";
    }

    function fmtRating(raw, raw5) {
        var n = 0;
        var s = String(raw == null ? "" : raw).trim().replace(",", ".");
        if (/n\/a|none|null/i.test(s)) s = "";
        var m = s.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
        if (m) n = parseFloat(m[1]);
        else if (s) n = parseFloat(s);
        if (!isFinite(n) || n <= 0) {
            var n5 = parseFloat(String(raw5 == null ? "" : raw5).replace(",", "."));
            if (isFinite(n5) && n5 > 0) n = n5 <= 5 ? n5 * 2 : n5;
        }
        if (!isFinite(n) || n <= 0) return null;
        if (n > 10 && n <= 100) n = n / 10;
        if (n > 10) return null;
        return n.toFixed(1);
    }

    function splitNames(s) {
        var parts = String(s || "").split(/,|;|\//);
        var seen = {};
        var out = [];
        for (var i = 0; i < parts.length; i++) {
            var n = parts[i].replace(/^\s+|\s+$/g, "");
            if (!n) continue;
            var k = n.toLowerCase();
            if (seen[k]) continue;
            seen[k] = 1;
            out.push(n);
        }
        return out;
    }

    function fmtPeople(s, max) {
        var names = splitNames(s);
        if (!names.length) return "";
        if (names.length <= max) return names.join(", ");
        return names.slice(0, max).join(", ") + "…";
    }

    function plotText() {
        return String((detailInfo && detailInfo.plot) || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    }

    function currentTrailer() {
        var info = detailInfo || {};
        var item = detailItem || {};
        return info.trailer || Provider.youtubeId(item.trailer || "") || "";
    }

    function topDetailActs() {
        var row = ["play", "fav"];
        if (currentTrailer()) row.push("trailer");
        return row;
    }

    function hideTrailer() {
        trailerOpen = false;
        var el = $("trailer-layer");
        if (!el) return;
        el.innerHTML = "";
        addClass(el, "hidden");
    }

    function showTrailer() {
        var id = currentTrailer();
        if (!id) {
            toast(t("noStream"));
            return;
        }
        trailerOpen = true;
        var el = $("trailer-layer");
        if (!el) return;
        el.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
            '?autoplay=1&rel=0&modestbranding=1&playsinline=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>' +
            '<div class="trailer-hint">' + esc(t("closeTrailer")) + "</div>";
        remClass(el, "hidden");
    }

    function pad2(n) {
        n = String(n == null ? "" : n);
        return n.length < 2 ? ("0" + n) : n;
    }

    function detailActBtn(id, ico, lab, extra) {
        return '<div class="dd-act ' + extra + (detailFocus === id ? " focused" : "") +
            '" data-act="' + id + '"><div class="dd-act-btn">' + icoSvg(ico) +
            '</div><div class="dd-act-lab">' + esc(lab) + "</div></div>";
    }

    function paintDetail() {
        var item = detailItem || {};
        var info = detailInfo || {};
        var cover = info.cover || item.logo || "";
        var back = info.backdrop || cover;
        var title = String(info.name || item.name || "").replace(/\s*\(\d{4}\)\s*$/, "");
        var plot = plotText();
        var genre = info.genre || item.genre || "";
        var score = fmtRating(info.rating || item.rating, info.rating5);
        var year = info.year || item.year || "";
        var dur = fmtDuration(info.duration, info.durationSecs);
        var age = info.age || "";
        var cast = fmtPeople(info.cast || "", 5);
        var director = fmtPeople(info.director || "", 3);
        var country = info.country || "";
        var oName = info.oName || "";
        var fav = isFavItem(item);
        var quality = qualityLabel(item, info);
        var trailer = currentTrailer();
        var genres = splitNames(genre);
        var series = item.kind === "series";

        var html = '<div class="dd' + (series ? " is-series" : "") + '">';
        if (back) html += '<div class="dd-back" style="background-image:url(\'' + esc(back) + "')\"></div>";
        html += '<div class="dd-veil"></div><div class="dd-hero"><div class="dd-plate">';
        html += '<div class="dd-kicker">' + esc(series ? t("series") : t("film")) + "</div>";
        html += "<h1>" + esc(title) + "</h1>";
        if (oName && oName !== title && title.indexOf(oName) < 0) {
            html += '<div class="dd-orig">' + esc(oName) + "</div>";
        }
        var meta = [];
        if (score) meta.push('<span class="dd-score">★ ' + esc(score) + "</span>");
        if (year) meta.push("<span>" + esc(year) + "</span>");
        if (dur) meta.push("<span>" + esc(dur) + "</span>");
        if (quality) meta.push('<span class="dd-q">' + esc(quality) + "</span>");
        if (age) meta.push('<span class="dd-age">' + esc(age) + "</span>");
        for (var gi = 0; gi < genres.length && gi < 3; gi++) {
            meta.push("<span>" + esc(genres[gi]) + "</span>");
        }
        if (meta.length) html += '<div class="dd-meta">' + meta.join('<span class="dd-dot">·</span>') + "</div>";
        if (plot) html += '<div class="dd-plot">' + esc(plot) + "</div>";
        if (director || cast || (country && !series)) {
            html += '<div class="dd-credits">';
            if (director) html += "<div><em>" + esc(t("director")) + "</em> " + esc(director) + "</div>";
            if (cast) html += "<div><em>" + esc(t("cast")) + "</em> " + esc(cast) + "</div>";
            if (country && !series) html += "<div><em>" + esc(t("country")) + "</em> " + esc(country) + "</div>";
            html += "</div>";
        }
        html += '<div class="dd-acts">' +
            detailActBtn("play", "play", t("play"), "dd-play nf-play") +
            detailActBtn("fav", "heart", "", "nf-list" + (fav ? " is-fav" : ""));
        if (trailer) html += detailActBtn("trailer", "trailer", t("trailer"), "nf-trailer");
        html += "</div></div></div>";

        if (series) {
            var seasons = (seriesDetail && seriesDetail.seasons) || [];
            html += '<div class="dd-rail">';
            html += '<div class="dd-seasons">';
            if (!seasons.length) {
                html += '<div class="dd-wait">' + esc(seriesDetail ? t("noEps") : t("loadingEps")) + "</div>";
            }
            var sVis = 7;
            var sStart = Math.max(0, seasonIndex - 2);
            var sEnd = Math.min(seasons.length, sStart + sVis);
            if (sEnd - sStart < sVis) sStart = Math.max(0, sEnd - sVis);
            for (var s = sStart; s < sEnd; s++) {
                var sn = seasons[s];
                html += '<div class="dd-stab' + (s === seasonIndex ? " active" : "") +
                    (detailFocus === "seasons" && s === seasonIndex ? " focused" : "") +
                    '" data-s="' + s + '">' + esc(sn.name) +
                    (sn.count ? '<span class="cnt">(' + sn.count + ")</span>" : "") + "</div>";
            }
            html += "</div><div class=\"dd-eps\">";
            var eps = (seasons[seasonIndex] && seasons[seasonIndex].episodes) || [];
            var vis = 4;
            var start = Math.max(0, epIndex - 1);
            var end = Math.min(eps.length, start + vis);
            if (end - start < vis) start = Math.max(0, end - vis);
            var sampleDur = fmtDuration(info.duration, info.durationSecs);
            if (!sampleDur) {
                for (var d = 0; d < eps.length; d++) {
                    sampleDur = fmtDuration(eps[d].duration, eps[d].durationSecs);
                    if (sampleDur) break;
                }
            }
            for (var e = start; e < end; e++) {
                var ep = eps[e];
                var epDur = fmtDuration(ep.duration, ep.durationSecs) || sampleDur;
                var nlab = pad2(ep.num || (e + 1));
                html += '<div class="dd-ep' + (detailFocus === "episodes" && e === epIndex ? " focused" : "") +
                    '" data-i="' + e + '">' +
                    '<div class="dd-ep-still">' +
                    (ep.logo ? '<img src="' + esc(ep.logo) + '" alt=""/>' : "") +
                    '<span class="dd-ep-no">' + esc(nlab) + "</span></div>" +
                    '<div class="dd-ep-name">' + esc(ep.name) + "</div>" +
                    '<div class="dd-ep-dur">' + esc(epDur) + "</div>" +
                    "</div>";
            }
            html += "</div></div>";
        }
        html += "</div>";
        var el = $("detail-screen");
        el.innerHTML = html;
        show("gate", false);
        show("home", false);
        show("catedit", false);
        show("player-ui", false);
        show("detail-screen", true);
    }

    function clockNow() {
        var d = new Date();
        function p(n) { return (n < 10 ? "0" : "") + n; }
        return p(d.getHours()) + ":" + p(d.getMinutes());
    }

    function episodeBadge(item) {
        if (!item || item.kind !== "episode") return "";
        var s = item.season ? ("S" + item.season) : "";
        var e = item.num ? ("E" + item.num) : "";
        return (s + " " + e).replace(/^\s+|\s+$/g, "");
    }

    function playerHeading(item) {
        if (!item) return { title: "", sub: "", list: false };
        if (item.kind === "episode") {
            var series = item.seriesName ||
                (seriesDetail && seriesDetail.info && (seriesDetail.info.name || seriesDetail.info.title)) ||
                (detailItem && detailItem.kind === "series" ? detailItem.name : "") || "";
            var sub = "";
            if (item.season) sub += t("seasons") + " " + item.season;
            if (item.num) sub += (sub ? " · " : "") + t("episode") + " " + item.num;
            var epName = item.name && String(item.name) !== ("E" + item.num) ? item.name : "";
            if (epName && series) sub += (sub ? " · " : "") + epName;
            return { title: series || item.name || "", sub: sub, list: true };
        }
        if (item.kind === "live") {
            return { title: item.name || "", sub: "", list: true };
        }
        return { title: item.name || "", sub: "", list: false };
    }

    function resumePoint(item) {
        if (!item || item.kind === "live") return 0;
        var hist = Store.history();
        var key = Provider.itemKey(item);
        for (var i = 0; i < hist.length; i++) {
            if (hist[i].key === key && hist[i].t > 15000 && hist[i].d && hist[i].t < hist[i].d * 0.9) {
                return hist[i].t;
            }
        }
        return 0;
    }

    function nextEpisode(item) {
        if (!item || item.kind !== "episode" || !playerList || !playerList.length) return null;
        for (var i = 0; i < playerList.length - 1; i++) {
            if (playerList[i].id === item.id) return playerList[i + 1];
        }
        return null;
    }

    function remainingLabel(cur, dur) {
        if (!dur || dur <= cur) return "";
        return fmtTime(dur - cur) + " " + t("remaining");
    }

    function fmtTime(ms) {
        ms = Math.max(0, Math.floor((ms || 0) / 1000));
        var h = Math.floor(ms / 3600);
        var m = Math.floor((ms % 3600) / 60);
        var s = ms % 60;
        function p(n) { return (n < 10 ? "0" : "") + n; }
        return (h ? h + ":" : "") + p(m) + ":" + p(s);
    }

    function fmtDurClock(ms) {
        return ms > 0 ? fmtTime(ms) : "--:--";
    }

    function metaDurationMs(item, info) {
        item = item || {};
        info = info || {};
        var mins = minutesFromDuration(
            info.duration || item.duration || "",
            info.durationSecs || item.durationSecs || ""
        );
        return mins > 0 ? mins * 60000 : 0;
    }

    function skipLabel(delta) {
        var sign = delta >= 0 ? "+" : "-";
        var sec = Math.round(Math.abs(delta) / 1000);
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return sign + " " + m + " " + t("skipMin") + " " + s + " " + t("skipSec");
    }

    function clockTime() {
        return seekTarget >= 0 ? seekOrigin : playTime;
    }

    function barTime() {
        return seekTarget >= 0 ? seekTarget : playTime;
    }

    function applySeekBadge() {
        var el = $("pseek");
        if (!el) return;
        if (seekTarget < 0) {
            addClass(el, "hidden");
            return;
        }
        el.textContent = skipLabel(seekTarget - seekOrigin);
        remClass(el, "hidden");
    }

    function applyProgressUi() {
        var item = playerItem || { name: "" };
        var live = item.kind === "live";
        var t = barTime();
        var pct = !live && playDur ? Math.min(100, (t / playDur) * 100) : 0;
        var bar = $("pbar");
        if (bar && !live) bar.style.width = pct + "%";
        var knob = $("pknob");
        if (knob) knob.style.left = pct + "%";
        var tm = $("ptime");
        if (tm) tm.textContent = fmtTime(clockTime());
        var durEl = $("pdur");
        if (durEl) durEl.textContent = fmtDurClock(playDur);
        var prog = bar && bar.parentNode;
        if (prog) {
            if (seekTarget >= 0) addClass(prog, "scrubbing");
            else remClass(prog, "scrubbing");
        }
        applySeekBadge();
    }

    function nudgeSeek(dir) {
        if (!playerItem || playerItem.kind === "live") {
            bumpOsd();
            return;
        }
        var step = 10000;
        if (seekTarget < 0) seekOrigin = playTime;
        var cur = seekTarget >= 0 ? seekTarget : playTime;
        var max = playDur > 400 ? playDur - 400 : cur + step * 20;
        seekTarget = Math.max(0, Math.min(max, cur + dir * step));
        if (seekTimer) clearTimeout(seekTimer);
        seekTimer = setTimeout(function () { commitSeek(); }, 700);
        bumpOsd();
    }

    function commitSeek(opts) {
        if (seekTimer) {
            clearTimeout(seekTimer);
            seekTimer = null;
        }
        var t = seekTarget;
        seekTarget = -1;
        applySeekBadge();
        if (t < 0 || !playerItem || playerItem.kind === "live") {
            applyProgressUi();
            return;
        }
        Player.seekTo(t);
        pendingSeek = t;
        playTime = t;
        applyProgressUi();
        if (!opts || opts.osd !== false) bumpOsd();
    }

    function clearSeek() {
        if (seekTimer) {
            clearTimeout(seekTimer);
            seekTimer = null;
        }
        seekTarget = -1;
        seekOrigin = 0;
        pendingSeek = -1;
        applySeekBadge();
    }

    function seekFromBar(e) {
        if (!playerItem || playerItem.kind === "live" || !playDur) return false;
        var bar = $("pbar");
        var prog = bar && bar.parentNode;
        if (!prog) return false;
        var el = e.target;
        var onBar = false;
        while (el && el !== document.body) {
            if (el === prog || el.id === "pbar" || el.id === "pknob") {
                onBar = true;
                break;
            }
            el = el.parentNode;
        }
        if (!onBar) return false;
        var rect = prog.getBoundingClientRect();
        if (!rect.width) return false;
        var pct = (e.clientX - rect.left) / rect.width;
        pct = Math.max(0, Math.min(1, pct));
        seekTarget = pct * playDur;
        commitSeek();
        return true;
    }

    function syncPlayerProgress() {
        if (screen !== "player") return;
        if (seekTarget < 0) applyProgressUi();
        var busy = $("pbusy");
        if (busy) {
            if (playerBuffering) remClass(busy, "hidden");
            else addClass(busy, "hidden");
        }
        var pauseEl = $("ppause");
        if (pauseEl) {
            if (seekTarget >= 0) addClass(pauseEl, "hidden");
            else if (Player.isPaused()) remClass(pauseEl, "hidden");
            else addClass(pauseEl, "hidden");
        }
        var playBtn = $("pplay");
        if (playBtn) {
            if (Player.isPaused()) addClass(playBtn, "is-paused");
            else remClass(playBtn, "is-paused");
        }
    }

    function applyPlayerChrome() {
        var show = osdVisible || chromeLocked();
        var osd = $("osd");
        var top = $("ptop");
        if (osd) {
            if (show) remClass(osd, "hidden");
            else addClass(osd, "hidden");
        }
        if (top) {
            if (show) remClass(top, "hidden");
            else addClass(top, "hidden");
        }
    }

    function paintPlayer(full) {
        if (painting) return;
        painting = true;
        try {
            paintPlayerInner(full);
        } finally {
            painting = false;
        }
    }

    function paintPlayerInner(full) {
        if (chromeLocked()) osdVisible = true;
        var item = playerItem || { name: "" };
        var live = item.kind === "live";
        var tBar = barTime();
        var pct = !live && playDur ? Math.min(100, (tBar / playDur) * 100) : 0;
        var ui = $("player-ui");
        var busy = $("pbusy");
        if (busy) {
            if (playerBuffering) remClass(busy, "hidden");
            else addClass(busy, "hidden");
        }
        if (!full && ui && !hasClass(ui, "hidden")) {
            var bar = $("pbar");
            if (bar) bar.style.width = pct + "%";
            var knob = $("pknob");
            if (knob) knob.style.left = pct + "%";
            var tm = $("ptime");
            if (tm) tm.textContent = fmtTime(clockTime());
            var durEl = $("pdur");
            if (durEl) durEl.textContent = fmtDurClock(playDur);
            var prog = bar && bar.parentNode;
            if (prog) {
                if (seekTarget >= 0) addClass(prog, "scrubbing");
                else remClass(prog, "scrubbing");
            }
            applySeekBadge();
            var pauseEl = $("ppause");
            if (pauseEl) {
                if (seekTarget >= 0) addClass(pauseEl, "hidden");
                else if (Player.isPaused()) remClass(pauseEl, "hidden");
                else addClass(pauseEl, "hidden");
            }
            var playBtn = $("pplay");
            if (playBtn) {
                if (Player.isPaused()) addClass(playBtn, "is-paused");
                else remClass(playBtn, "is-paused");
            }
            var st = Player.trackState ? Player.trackState() : null;
            var ratioEl = $("pratio");
            if (ratioEl) ratioEl.textContent = st ? st.aspectLabel : t("aspect_" + Player.aspectMode());
            var speedEl = $("pspeed");
            if (speedEl && st) speedEl.textContent = st.speedLabel;
            var subEl = $("psub");
            if (subEl && st) subEl.textContent = st.sub.label;
            var audEl = $("paudio");
            if (audEl && st) audEl.textContent = st.audio.label;
            applyPlayerChrome();
            applyHint();
            applyOsdFocus();
            var zapBtn = $("pzapbtn");
            if (zapBtn) {
                if (sheet === "list") addClass(zapBtn, "on");
                else remClass(zapBtn, "on");
            }
            var favBtn = $("pfavbtn");
            if (favBtn) {
                if (isFavItem(item)) addClass(favBtn, "on");
                else remClass(favBtn, "on");
            }
            var titleEl = $("ptitle");
            var subEl2 = $("psubline");
            var head = playerHeading(item);
            if (titleEl) titleEl.textContent = head.title;
            if (subEl2) {
                subEl2.textContent = head.sub;
                if (head.sub) remClass(subEl2, "hidden");
                else addClass(subEl2, "hidden");
            }
            return;
        }
        var head = playerHeading(item);
        var html = "";
        html += '<div id="pbusy" class="p-busy' + (playerBuffering ? "" : " hidden") + '"><div class="p-spin"></div></div>';
        html += '<div id="ppause" class="p-pause' + (Player.isPaused() && seekTarget < 0 ? "" : " hidden") + '">' + esc(t("paused")) + "</div>";
        html += '<div id="pseek" class="p-seek' + (seekTarget >= 0 ? "" : " hidden") + '">' +
            (seekTarget >= 0 ? esc(skipLabel(seekTarget - seekOrigin)) : "") + "</div>";
        html += '<div id="ptop" class="player-top' + (osdVisible ? "" : " hidden") + '">';
        html += '<div class="ptop-text">';
        html += '<div id="ptitle" class="osd-title">' + esc(head.title) + "</div>";
        html += '<div id="psubline" class="osd-subline' + (head.sub ? "" : " hidden") + '">' + esc(head.sub) + "</div>";
        html += "</div><div class=\"ptop-acts\">";
        html += '<div id="pfavbtn" class="p-btn' + (isFavItem(item) ? " on" : "") + (osdFocus === "fav" ? " is-on" : "") + '" data-act="fav">' + icoSvg("heart") + "</div>";
        if (head.list) {
            html += '<div id="pzapbtn" class="p-btn' + (sheet === "list" ? " on" : "") + (osdFocus === "zap" ? " is-on" : "") + '" data-act="zap">' + icoSvg("list") + "</div>";
        }
        html += "</div></div>";
        html += '<div id="osd" class="osd' + (osdVisible ? "" : " hidden") + '">';
        html += '<div class="osd-bot">';
        html += '<div class="pbar-block">';
        html += '<div id="phint" class="p-hint' + (hintText ? "" : " hidden") + '">' + esc(hintText) + "</div>";
        if (live) {
            html += '<div class="p-ctrls"><div class="p-btn" data-act="reload">' + icoSvg("refresh") + "</div></div></div>";
        } else {
            var st = Player.trackState();
            html += '<div class="pbar-row">' +
                '<span id="ptime" class="p-time">' + fmtTime(clockTime()) + "</span>" +
                '<div class="progress' + (seekTarget >= 0 ? " scrubbing" : "") + (osdFocus === "bar" ? " is-on" : "") + '"><span id="pbar" style="width:' + pct + '%"></span>' +
                '<i id="pknob" class="p-knob" style="left:' + pct + '%"></i></div>' +
                '<span id="pdur" class="p-time">' + fmtDurClock(playDur) + "</span></div></div>";
            html += '<div class="p-ctrls">' +
                '<div class="p-tool-row">' +
                playerChip("aspect", st.aspectLabel, "pratio", "aspect") +
                playerChip("speed", st.speedLabel, "pspeed", "speed") +
                "</div>" +
                '<div class="p-mid">' +
                '<div class="p-btn p-play' + (Player.isPaused() ? " is-paused" : "") + (osdFocus === "play" ? " is-on" : "") + '" id="pplay" data-act="toggle">' +
                icoSvg("play") + icoSvg("pause") + "</div>" +
                "</div>" +
                '<div class="p-tool-row">' +
                playerChip("sub", st.sub.label, "psub", "cc") +
                playerChip("audio", st.audio.label, "paudio", "vol") +
                "</div></div>";
        }
        html += "</div></div>";
        html += '<div id="psheet" class="sheet"></div>';
        if (!ui) return;
        ui.innerHTML = html;
        show("gate", false);
        show("home", false);
        show("catedit", false);
        show("detail-screen", false);
        show("player-ui", true);
        if (sheet) paintSheet();
    }

    function icoSvg(name) {
        var d = {
            play: '<path d="M8.2 5.4v13.2L19.4 12z"/>',
            pause: '<rect x="7" y="5.2" width="3.4" height="13.6" rx="1.2"/><rect x="13.6" y="5.2" width="3.4" height="13.6" rx="1.2"/>',
            refresh: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18.2 12a6.2 6.2 0 1 1-1.6-4.2"/><path d="M18.6 4.8v4.2h-4.2"/>',
            aspect: '<rect x="3.2" y="6" width="17.6" height="12" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M8 10h2.6V7.6M16 14h-2.6v2.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
            speed: '<path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M5 16.2A8.1 8.1 0 0 1 12 4.8a8.1 8.1 0 0 1 7 11.4"/><path fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" d="M12 14.2L16.4 8.6"/><circle cx="12" cy="14.2" r="1.55"/>',
            cc: '<rect x="2.6" y="6.2" width="18.8" height="11.6" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.4 10.2c-.7.3-1.2 1-1.2 1.8s.5 1.5 1.2 1.8M15.6 10.2c-.7.3-1.2 1-1.2 1.8s.5 1.5 1.2 1.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
            vol: '<path d="M4.2 9.2h3.1L11.6 6v12l-4.3-3.2H4.2z"/><path d="M14.8 9.1a3.6 3.6 0 010 5.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17.4 7a6.2 6.2 0 010 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
            heart: '<path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linejoin="round" d="M12 19.4S4.8 14.6 4.8 9.8A4.15 4.15 0 0 1 12 7.1a4.15 4.15 0 0 1 7.2 2.7c0 4.8-7.2 9.6-7.2 9.6z"/>',
            list: '<path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" d="M8.2 7h11.2M8.2 12h11.2M8.2 17h11.2"/><circle cx="4.8" cy="7" r="1.25"/><circle cx="4.8" cy="12" r="1.25"/><circle cx="4.8" cy="17" r="1.25"/>',
            trailer: '<rect x="3.2" y="6" width="17.6" height="12" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9.2v5.6L15.4 12z"/>',
            search: '<circle cx="10.8" cy="10.8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.9"/><path fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" d="M15.6 15.6L21 21"/>'
        };
        return '<svg class="p-ico ico-' + name + '" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' + (d[name] || "") + "</svg>";
    }

    function playerChip(act, val, id, ico) {
        return '<div class="p-act' + (osdFocus === act ? " is-on" : "") + '" data-act="' + act + '">' +
            '<div class="p-act-btn">' + icoSvg(ico) + "</div>" +
            '<div id="' + id + '" class="p-act-val">' + esc(val) + "</div></div>";
    }

    function paintSheet() {
        var el = $("psheet");
        if (!el) return;
        if (!sheet) {
            remClass(el, "open");
            return;
        }
        var html = "";
        var rows = sheetRows();
        if (sheetIndex > rows.length - 1) sheetIndex = Math.max(0, rows.length - 1);
        if (sheetIndex < 0) sheetIndex = 0;
        html += '<div class="sheet-lab">' + esc(sheetTitle()) + "</div>";
        html += '<div class="sheet-list">';
        var vis = 13;
        var start = Math.max(0, sheetIndex - 4);
        var end = Math.min(rows.length, start + vis);
        if (end - start < vis) start = Math.max(0, end - vis);
        for (var i = start; i < end; i++) {
            html += '<div class="row' + (i === sheetIndex ? " focused" : "") +
                (rows[i].on ? " on" : "") + '" data-act="sheet" data-i="' + i + '">' +
                (rows[i].prefix ? '<div class="num">' + esc(rows[i].prefix) + "</div>" : "") +
                (rows[i].logo ? logoTag(rows[i].logo, rows[i].label) : "") +
                '<div class="name">' + esc(rows[i].label) + "</div></div>";
        }
        html += "</div>";
        el.innerHTML = html;
        addClass(el, "open");
    }

    function sheetTitle() {
        if (sheet === "sub") return t("subtitles");
        if (sheet === "audio") return t("audio");
        if (playerItem && playerItem.kind === "episode") {
            return playerItem.season ? (t("seasons") + " " + playerItem.season) : t("episodes");
        }
        return osdGroup || t("zap");
    }

    function sheetRows() {
        if (sheet === "sub") return Player.subtitleOptions();
        if (sheet === "audio") return Player.audioOptions();
        var live = playerItem && playerItem.kind === "live";
        var rows = [];
        for (var i = 0; i < playerList.length; i++) {
            var it = playerList[i];
            rows.push({
                index: i,
                label: zapRowName(it),
                prefix: live ? "" : String(it.num || (i + 1)),
                logo: live ? it.logo : "",
                on: i === itemIndex
            });
        }
        return rows;
    }

    function openSheet(kind) {
        if (kind === "list" && playerItem && playerItem.kind !== "live" && playerItem.kind !== "episode") return;
        if (kind !== "list" && playerItem && playerItem.kind === "live") return;
        if (sheet === kind) {
            closeSheet();
            return;
        }
        sheet = kind;
        if (kind === "list") sheetIndex = itemIndex;
        else {
            sheetIndex = 0;
            var opts = sheetRows();
            for (var i = 0; i < opts.length; i++) {
                if (opts[i].on) sheetIndex = i;
            }
        }
        osdVisible = true;
        if (osdTimer) clearTimeout(osdTimer);
        paintPlayer(true);
    }

    function closeSheet() {
        sheet = "";
        var el = $("psheet");
        if (el) remClass(el, "open");
        bumpOsd();
    }

    function chooseSheetRow() {
        if (sheet === "list") {
            var it = playerList[sheetIndex];
            closeSheet();
            if (it) playNow(it, playerList);
            return;
        }
        if (sheet === "sub") {
            var subs = Player.subtitleOptions();
            var sub = subs[sheetIndex];
            if (sub) Player.selectSubtitle(sub.index);
            closeSheet();
            if (sub) flashHint(sub.label);
            return;
        }
        if (sheet === "audio") {
            var auds = Player.audioOptions();
            var aud = auds[sheetIndex];
            if (aud) Player.selectAudio(aud.index);
            closeSheet();
            if (aud) flashHint(aud.label);
        }
    }

    function zapRowName(it) {
        if (!it) return "";
        if (it.kind === "episode") {
            if (it.name && String(it.name) !== ("E" + it.num)) return it.name;
            return it.num ? (t("episode") + " " + it.num) : it.name;
        }
        return it.name || "";
    }

    function toggleZap() {
        openSheet("list");
    }

    function cycleSpeed() {
        if (!playerItem || playerItem.kind === "live") return;
        var st = Player.cycleSpeed();
        flashHint(st.label);
        bumpOsd();
        paintPlayer(false);
    }

    function cycleSub() {
        openSheet("sub");
    }

    function cycleAudio() {
        openSheet("audio");
    }

    function cycleAspect() {
        if (!playerItem || playerItem.kind === "live") return;
        var mode = Player.cycleAspect();
        flashHint(t("aspect_" + mode));
        bumpOsd();
        paintPlayer(false);
    }

    function reloadStream() {
        if (!playerItem) return;
        replayAt = playerItem.kind === "live" ? 0 : playTime;
        playNow(playerItem, playerList);
    }

    function zapChannel(delta) {
        if (!playerList || !playerList.length) return;
        itemIndex = (itemIndex + delta + playerList.length) % playerList.length;
        playNow(playerList[itemIndex], playerList);
    }

    function goHome(force, stayOnItems) {
        hideTrailer();
        screen = "home";
        if (tab === "settings") focusCol = "settings";
        else if (menuOpen) focusCol = "menu";
        else if (stayOnItems) focusCol = "items";
        else if (tab === "live" || tab === "movies" || tab === "series") focusCol = "cats";
        else focusCol = "items";
        paintHome(force);
    }

    function setTab(id) {
        tab = id;
        catIndex = 0;
        itemIndex = 0;
        query = "";
        searchOpen = false;
        searchQuery = "";
        invalidateItems();
        var s = Store.settings();
        s.lastTab = tab;
        Store.setSettings(s);
        if (tab === "live" || tab === "movies" || tab === "series") lastContentTab = tab;
        if (tab === "settings") {
            settingsIndex = 0;
            focusCol = "settings";
        } else if (tab === "live" || tab === "movies" || tab === "series") focusCol = "cats";
        else focusCol = "items";
        menuIndex = sectionIndex(tab);
    }

    function openMenu() {
        menuOpen = true;
        menuIndex = sectionIndex(tab);
        focusCol = "menu";
        paintMenu();
    }

    function closeMenu(nextFocus) {
        menuOpen = false;
        focusCol = nextFocus || (tab === "settings" ? "settings" : "cats");
        paintHome(false);
    }

    function chooseSection() {
        var list = sections();
        var sec = list[menuIndex];
        if (!sec) return;
        setTab(sec.id);
        menuOpen = false;
        paintHome(true);
    }

    function loadCachedCatalog() {
        provider = Store.provider();
        var cached = Store.catalog();
        if (cached) catalog = Provider.hydrate(cached, provider);
        tab = "live";
        menuIndex = sectionIndex(tab);
        if (!provider) return;
        var payload = provider.type === "m3u"
            ? { type: "m3u", playlist: provider.playlist, epg: provider.epg }
            : { type: "xtream", server: provider.base || provider.server, username: provider.username, password: provider.password };
        if (!cached || !cached.liveReady) connectProvider(payload);
        else if (cacheExpired()) refreshCatalog(true);
    }

    function persistCatalog() {
        try {
            Store.setCatalog(Provider.compactForStore(catalog, provider));
        } catch (e) {
            var slim = Provider.compactForStore(catalog, provider);
            slim.vod = [];
            slim.series = [];
            try { Store.setCatalog(slim); } catch (e2) {}
        }
    }

    function onCatalogProgress(cat, stage) {
        catalog = cat;
        if (stage.indexOf("loading") !== 0) persistCatalog();

        if (stage === "loading-live") {
            loadingMore = true;
            statusMsg = t("loadingTv");
            if (screen === "splash" || screen === "form") paintGate();
            else setBusy(t("loadingTv"));
            return;
        }
        if (stage === "loading-vod") {
            setBusy(t("loadingMovies"));
            return;
        }
        if (stage === "loading-series") {
            setBusy(t("loadingSeries"));
            return;
        }
        if (stage === "live") {
            if (screen === "splash" || screen === "form") {
                statusMsg = "";
                tab = "live";
                catIndex = 0;
                itemIndex = 0;
                focusCol = "cats";
                menuOpen = false;
                goHome(true);
            } else if (screen === "home" && tab === "live") {
                invalidateItems();
                paintHome(true);
            }
            return;
        }
        if (stage === "vod") {
            if (screen === "home" && tab === "movies") {
                invalidateItems();
                paintHome(true);
            } else if (screen === "home") paintCats();
            return;
        }
        if (stage === "series") {
            loadingMore = false;
            setBusy(t("loadedAll"));
            busyHideTimer = setTimeout(function () { setBusy(""); }, 1600);
            if (screen === "home" && tab === "series") {
                invalidateItems();
                paintHome(true);
            } else if (screen === "home") paintCats();
        }
    }

    function connectProvider(payload) {
        statusMsg = t("loadingTv");
        if (screen === "form" || screen === "splash") paintGate();
        Provider.connect(payload, { onProgress: onCatalogProgress }).then(function (res) {
            provider = res.provider;
            catalog = res.catalog;
            Store.setProvider(provider);
            persistCatalog();
            loadingMore = false;
            statusMsg = "";
            if (screen !== "home" && screen !== "player" && screen !== "detail") {
                tab = "live";
                catIndex = 0;
                itemIndex = 0;
                goHome(true);
            } else if (screen === "home") {
                invalidateItems();
                paintHome(true);
            }
        }).catch(function () {
            loadingMore = false;
            setBusy("");
            statusMsg = "";
            errorMsg = payload.type === "xtream" ? t("badLogin") : t("badPlaylist");
            screen = "form";
            setupType = payload.type || "xtream";
            paintGate();
        });
    }

    function refreshCatalog(silent) {
        if (!provider) return;
        if (!silent) toast(t("connecting"));
        Provider.refresh(provider, { onProgress: onCatalogProgress }).then(function (c) {
            catalog = c;
            persistCatalog();
            loadingMore = false;
            if (!silent) toast(t("refreshed"));
            invalidateItems();
            if (screen === "home") paintHome(true);
        }).catch(function () {
            loadingMore = false;
            setBusy("");
            toast(t("badPlaylist"));
        });
    }

    function startPlay(item, list) {
        if (!item) return;
        if (item.kind === "series") {
            openDetail(item);
            return;
        }
        if (item.kind === "vod") {
            openDetail(item);
            return;
        }
        playNow(item, list);
    }

    function catNameFor(item) {
        if (!item) return "";
        var cats = catalog.liveCats;
        if (item.kind === "vod") cats = catalog.vodCats;
        else if (item.kind === "series" || item.kind === "episode") cats = catalog.seriesCats;
        cats = cats || [];
        for (var i = 0; i < cats.length; i++) {
            if (String(cats[i].id) === String(item.group)) return cats[i].name;
        }
        return item.kind || "";
    }

    function playNow(item, list) {
        hideTrailer();
        if (!item || !item.url) {
            toast(t("noStream"));
            return;
        }
        clearSeek();
        playerItem = item;
        osdGroup = catNameFor(item);
        playerList = list || currentItems();
        var idx = -1;
        for (var i = 0; i < playerList.length; i++) {
            if (playerList[i] === item || (playerList[i].id === item.id && playerList[i].kind === item.kind)) {
                idx = i;
                break;
            }
        }
        itemIndex = idx < 0 ? 0 : idx;
        screen = "player";
        osdVisible = true;
        osdFocus = defaultPlayerFocus();
        sheet = "";
        playTime = 0;
        playDur = metaDurationMs(item, detailInfo && detailItem && detailItem.id === item.id ? detailInfo : null);
        subLabel = "";
        osdEpg = "";
        playerBuffering = true;
        var startOverride = replayAt;
        replayAt = null;
        paintPlayer(true);
        bumpOsd();
        if (item.kind === "live" && provider) {
            Provider.shortEpg(provider, item.id).then(function (title) {
                osdEpg = title || "";
                if (screen === "player") paintPlayer(true);
            }).catch(function () {});
        }
        if (item.kind === "vod" && playDur < 1000 && provider) {
            Provider.vodInfo(provider, item.id).then(function (info) {
                if (!info || screen !== "player" || !playerItem || playerItem.id !== item.id) return;
                var ms = metaDurationMs(item, info);
                if (ms > playDur) {
                    playDur = ms;
                    applyProgressUi();
                }
            }).catch(function () {});
        }
        Player.open(item, {
            startAt: startOverride != null ? startOverride : resumePoint(item),
            onTime: function (cur, dur) {
                if (dur > 8000) playDur = dur;
                if (seekTarget >= 0) {
                    if (screen === "player") syncPlayerProgress();
                    return;
                }
                if (pendingSeek >= 0 && Math.abs(cur - pendingSeek) > 2500) {
                    if (screen === "player") syncPlayerProgress();
                    return;
                }
                pendingSeek = -1;
                playTime = cur;
                saveProgress(item, cur, playDur);
                if (screen === "player") syncPlayerProgress();
            },
            onBuffer: function (on) {
                playerBuffering = !!on;
                if (screen === "player") syncPlayerProgress();
            },
            onEnd: function () {
                var nxt = nextEpisode(item);
                if (nxt) {
                    flashHint(t("nextEp"));
                    playNow(nxt, playerList);
                    return;
                }
                stopPlay();
            },
            onSub: function () {
                if (screen === "player" && osdVisible) paintPlayer(false);
            },
            onTracks: function () {
                if (screen !== "player") return;
                var st = Player.trackState();
                var subEl = $("psub");
                if (subEl) subEl.textContent = st.sub.label;
                var audEl = $("paudio");
                if (audEl) audEl.textContent = st.audio.label;
                if ((sheet === "sub" || sheet === "audio") && !painting) paintSheet();
            },
            onError: function () {
                if (item.kind === "live" && item.urlTs && item.url !== item.urlTs) {
                    item.url = item.urlTs;
                    Player.open(item, {
                        onTime: function (cur, dur) { playTime = cur; playDur = dur; if (osdVisible) paintPlayer(false); },
                        onBuffer: function (on) { playerBuffering = !!on; if (screen === "player") paintPlayer(false); },
                        onEnd: stopPlay,
                        onError: function () { toast(t("noStream")); stopPlay(); }
                    });
                } else {
                    toast((item.url || "").indexOf(".mkv") !== -1 ? t("mkvHint") : t("noStream"));
                    stopPlay();
                }
            }
        });
        rememberHistory(item);
    }

    function openDetail(item) {
        if (!item) return;
        detailItem = item;
        detailInfo = null;
        seriesDetail = null;
        seasonIndex = 0;
        epIndex = 0;
        detailFocus = "play";
        pendingSeriesPlay = false;
        hideTrailer();
        screen = "detail";
        paintDetail();
        if (item.kind === "series") {
            Provider.seriesInfo(provider, item.id).then(function (detail) {
                seriesDetail = detail || { seasons: [] };
                if (seriesDetail.info) detailInfo = seriesDetail.info;
                var first = seriesDetail.seasons[0] && seriesDetail.seasons[0].episodes && seriesDetail.seasons[0].episodes[0];
                if (pendingSeriesPlay && first) {
                    pendingSeriesPlay = false;
                    returnScreen = "detail";
                    playNow(first, seriesDetail.seasons[0].episodes);
                    return;
                }
                if (screen === "detail") paintDetail();
            }).catch(function () {
                seriesDetail = { seasons: [] };
                if (screen === "detail") paintDetail();
                toast(t("noEps"));
            });
        } else if (item.kind === "vod") {
            Provider.vodInfo(provider, item.id).then(function (info) {
                detailInfo = info;
                if (screen === "detail") paintDetail();
            }).catch(function () {});
        }
    }

    function saveProgress(item, cur, dur) {
        if (!dur || item.kind === "live") return;
        var hist = Store.history();
        var key = Provider.itemKey(item);
        var next = [];
        for (var i = 0; i < hist.length; i++) if (hist[i].key !== key) next.push(hist[i]);
        next.unshift({ key: key, t: cur, d: dur, at: Date.now() });
        Store.setHistory(next.slice(0, 40));
    }

    function rememberHistory(item) {
        var hist = Store.history();
        var key = Provider.itemKey(item);
        var next = [];
        for (var i = 0; i < hist.length; i++) if (hist[i].key !== key) next.push(hist[i]);
        next.unshift({ key: key, name: item.name, at: Date.now() });
        Store.setHistory(next.slice(0, 40));
    }

    function stopPlay() {
        clearSeek();
        clearHint();
        Player.stop();
        screen = returnScreen === "detail" && detailItem ? "detail" : "home";
        if (screen === "detail") paintDetail();
        else goHome(false, true);
    }

    function chromeLocked() {
        return !!(playerItem && playerItem.kind !== "live" && Player.isPaused());
    }

    function bumpOsd() {
        var reveal = !osdVisible;
        osdVisible = true;
        if (reveal && playerItem && playerItem.kind !== "live") osdFocus = "bar";
        if (osdTimer) clearTimeout(osdTimer);
        if (sheet || chromeLocked()) {
            if (screen === "player") paintPlayer(false);
            return;
        }
        osdTimer = setTimeout(function () {
            if (chromeLocked() || sheet) return;
            if (seekTarget >= 0) commitSeek({ osd: false });
            osdVisible = false;
            osdFocus = defaultPlayerFocus();
            sheet = "";
            if (screen === "player") paintPlayer(false);
        }, 4000);
        if (screen === "player") paintPlayer(false);
    }

    function toggleFav(item) {
        if (!item) return;
        var stayId = (currentCats()[catIndex] || {}).id;
        var key = Provider.itemKey(item);
        var favs = Store.favorites();
        var i = favs.indexOf(key);
        if (i >= 0) {
            favs.splice(i, 1);
            if (screen === "player") flashHint(t("removedFav"));
            else toast(t("removedFav"));
        } else {
            favs.unshift(key);
        }
        Store.setFavorites(favs.slice(0, 500));
        invalidateItems();
        var cats = currentCats();
        catIndex = 0;
        if (stayId) {
            for (var c = 0; c < cats.length; c++) {
                if (String(cats[c].id) === String(stayId)) { catIndex = c; break; }
            }
        }
        if (catIndex > cats.length - 1) catIndex = Math.max(0, cats.length - 1);
        itemIndex = Math.min(itemIndex, Math.max(0, currentItems().length - 1));
        if (screen === "detail") paintDetail();
        if (screen === "player") paintPlayer(false);
        if (screen === "home" && tab !== "settings") paintHome(true);
    }

    function formFieldCount() {
        return setupType === "xtream" ? 3 : 1;
    }

    function readInputs() {
        var inputs = root.querySelectorAll("input");
        for (var i = 0; i < inputs.length; i++) {
            form[inputs[i].getAttribute("data-k")] = inputs[i].value;
        }
    }

    function submitForm() {
        readInputs();
        errorMsg = "";
        if (setupType === "xtream") {
            if (!(form.server || "").trim() || !(form.username || "").trim() || !form.password) {
                errorMsg = t("badLogin");
                screen = "form";
                paintGate();
                return;
            }
            connectProvider({ type: "xtream", server: form.server, username: form.username, password: form.password });
            return;
        }
        if (!(form.playlist || "").trim()) {
            errorMsg = t("badPlaylist");
            screen = "form";
            paintGate();
            return;
        }
        connectProvider({ type: "m3u", playlist: form.playlist });
    }

    function jumpToNum(n) {
        if (!n) return;
        var list = screen === "player" ? playerList : currentItems();
        var best = -1;
        var dist = 1e9;
        for (var i = 0; i < list.length; i++) {
            var num = Number(list[i].num || 0);
            if (num === n) { best = i; break; }
            var d = Math.abs(num - n);
            if (num && d < dist) { dist = d; best = i; }
        }
        if (best < 0) return;
        itemIndex = best;
        if (screen === "player") {
            startPlay(list[itemIndex], list);
        } else {
            paintStage(true);
        }
    }

    function onDigit(d) {
        if (searchOpen) {
            applySearchChar(String(d));
            return;
        }
        if (!(tab === "live" || screen === "player")) return;
        chBuf += String(d);
        var osd = $("ch-osd");
        if (osd) {
            osd.textContent = chBuf;
            remClass(osd, "hidden");
        }
        if (chTimer) clearTimeout(chTimer);
        chTimer = setTimeout(function () {
            jumpToNum(parseInt(chBuf, 10));
            chBuf = "";
            if (osd) addClass(osd, "hidden");
        }, 1100);
    }

    function clampItem() {
        var max = Math.max(0, currentItems().length - 1);
        if (itemIndex > max) itemIndex = max;
        if (itemIndex < 0) itemIndex = 0;
    }

    function handleHomeKey(k) {
        if (searchOpen) {
            handleSearchKey(k);
            return;
        }
        if (k === "yellow") {
            openSearch();
            return;
        }
        if (k === "green") {
            refreshCatalog(false);
            return;
        }
        if (k === "blue") {
            setTab("settings");
            menuOpen = false;
            paintHome(true);
            return;
        }
        if (k === "red") {
            toggleFav(currentItems()[itemIndex]);
            return;
        }
        if (k === "info") {
            var it = currentItems()[itemIndex];
            if (it && (it.kind === "vod" || it.kind === "series")) openDetail(it);
            return;
        }

        if (focusCol === "menu" || menuOpen && focusCol === "menu") {
            var list = sections();
            if (k === "up") menuIndex = Math.max(0, menuIndex - 1);
            else if (k === "down") menuIndex = Math.min(list.length - 1, menuIndex + 1);
            else if (k === "right" || k === "enter") {
                chooseSection();
                return;
            }
            paintMenu();
            return;
        }

        if (tab === "settings") {
            handleSettingsKey(k);
            return;
        }

        var cats = currentCats();
        var items = currentItems();
        var cols = CONFIG.GRID_COLS;
        var max = Math.max(0, items.length - 1);

        if (k === "back") {
            if (query) {
                query = "";
                itemIndex = 0;
                invalidateItems();
                paintHome(true);
                return;
            }
            if (focusCol === "search") {
                focusCol = "cats";
                paintCats();
                return;
            }
            if (menuOpen) {
                closeMenu("items");
                return;
            }
            var now = Date.now();
            if (now - lastBack < 2000) exitApp();
            else {
                lastBack = now;
                toast(t("exitHint"));
            }
            return;
        }

        if (focusCol === "cats") {
            if (k === "left") {
                if (catIndex <= 0) { openMenu(); return; }
                catIndex -= 1;
                itemIndex = 0;
                invalidateItems();
                paintHome(true);
                return;
            }
            if (k === "right") {
                if (catIndex >= cats.length - 1) {
                    focusCol = "search";
                    paintCats();
                    syncItemFocus();
                    return;
                }
                catIndex += 1;
                itemIndex = 0;
                invalidateItems();
                paintHome(true);
                return;
            }
            if (k === "down" || k === "enter") {
                focusCol = "items";
                paintHome(false);
                return;
            }
            return;
        }

        if (focusCol === "search") {
            if (k === "left") {
                focusCol = "cats";
                if (cats.length) catIndex = cats.length - 1;
                itemIndex = 0;
                invalidateItems();
                paintHome(true);
                return;
            }
            if (k === "down") {
                focusCol = "items";
                paintHome(false);
                return;
            }
            if (k === "enter") {
                openSearch();
                return;
            }
            return;
        }

        if (k === "up") {
            if (isGrid()) {
                if (itemIndex < cols) {
                    focusCol = "cats";
                    paintCats();
                    syncItemFocus();
                    return;
                }
                itemIndex -= cols;
            } else {
                if (itemIndex <= 0) {
                    focusCol = "cats";
                    paintCats();
                    syncItemFocus();
                    return;
                }
                itemIndex -= 1;
            }
            clampItem();
            paintStage(false);
            return;
        }
        if (k === "down") {
            if (isGrid()) itemIndex = Math.min(max, itemIndex + cols);
            else itemIndex = Math.min(max, itemIndex + 1);
            paintStage(false);
            return;
        }
        if (k === "left") {
            if (isGrid() && itemIndex % cols !== 0) {
                itemIndex -= 1;
                paintStage(false);
                return;
            }
            focusCol = "cats";
            paintCats();
            syncItemFocus();
            return;
        }
        if (k === "right") {
            if (isGrid()) {
                itemIndex = Math.min(max, itemIndex + 1);
                paintStage(false);
            }
            return;
        }
        if (k === "enter") {
            returnScreen = "home";
            startPlay(items[itemIndex], items);
        }
    }

    function catEditKinds() {
        return [
            { id: "live", label: t("tv") },
            { id: "movies", label: t("movies") },
            { id: "series", label: t("series") }
        ];
    }

    function catEditKindIndex() {
        var kinds = catEditKinds();
        for (var i = 0; i < kinds.length; i++) if (kinds[i].id === catEditKind) return i;
        return 0;
    }

    function openCatEdit() {
        screen = "catedit";
        catEditKind = lastContentTab === "movies" || lastContentTab === "series" ? lastContentTab : "live";
        catEditIndex = 0;
        catEditFocus = "list";
        if (!arrangedCats(catEditKind, true).length) catEditFocus = "kind";
        paintCatEdit();
    }

    function closeCatEdit() {
        screen = "home";
        tab = "settings";
        focusCol = "settings";
        menuOpen = false;
        invalidateItems();
        paintHome(true);
    }

    function toggleCatHidden() {
        var list = arrangedCats(catEditKind, true);
        var cat = list[catEditIndex];
        if (!cat) return;
        var prefs = catKindPrefs(catEditKind);
        var sid = String(cat.id);
        var hid = prefs.hidden;
        var at = hid.indexOf(sid);
        if (at >= 0) hid.splice(at, 1);
        else {
            var visible = arrangedCats(catEditKind, false);
            if (visible.length <= 1) {
                toast(t("keepOneCat"));
                return;
            }
            hid.push(sid);
        }
        prefs.hidden = hid;
        prefs.order = list.map(function (c) { return String(c.id); });
        saveCatKindPrefs(catEditKind, prefs);
        paintCatEdit();
    }

    function moveCatEdit(dir) {
        var list = arrangedCats(catEditKind, true);
        var j = catEditIndex + dir;
        if (j < 0 || j >= list.length) return;
        var tmp = list[catEditIndex];
        list[catEditIndex] = list[j];
        list[j] = tmp;
        var prefs = catKindPrefs(catEditKind);
        prefs.order = list.map(function (c) { return String(c.id); });
        saveCatKindPrefs(catEditKind, prefs);
        catEditIndex = j;
        paintCatEdit();
    }

    function paintCatEdit() {
        var el = $("catedit");
        if (!el) return;
        var kinds = catEditKinds();
        var list = arrangedCats(catEditKind, true);
        if (catEditIndex >= list.length) catEditIndex = Math.max(0, list.length - 1);
        var html = "<h1 class=\"ce-title\">" + esc(t("editCats")) + "</h1>" +
            '<div class="ce-sub">' + esc(t("catEditHint")) + "</div>" +
            '<div class="ce-kinds">';
        for (var k = 0; k < kinds.length; k++) {
            html += '<div class="ce-kind' + (kinds[k].id === catEditKind ? " active" : "") +
                (catEditFocus === "kind" && k === catEditKindIndex() ? " focused" : "") +
                '" data-kind="' + kinds[k].id + '">' + esc(kinds[k].label) + "</div>";
        }
        html += '</div><div class="ce-list">';
        if (!list.length) {
            html += '<div class="empty">' + esc(t("catEditEmpty")) + "</div>";
        } else {
            var vis = 8;
            var start = Math.max(0, catEditIndex - Math.floor((vis - 1) / 2));
            var end = Math.min(list.length, start + vis);
            if (end - start < vis) start = Math.max(0, end - vis);
            for (var i = start; i < end; i++) {
                var hidden = isCatHidden(catEditKind, list[i].id);
                html += '<div class="ce-row' + (catEditFocus === "list" && i === catEditIndex ? " focused" : "") +
                    (hidden ? " is-hidden" : "") + '" data-ci="' + i + '">' +
                    '<div class="ce-num">' + (i + 1) + "</div>" +
                    '<div class="ce-name">' + esc(list[i].name) + "</div>" +
                    '<div class="ce-vis ' + (hidden ? "off" : "on") + '">' +
                    esc(hidden ? t("catHidden") : t("catVisible")) + "</div></div>";
            }
        }
        html += "</div>";
        el.innerHTML = html;
        show("gate", false);
        show("home", false);
        show("detail-screen", false);
        show("player-ui", false);
        show("catedit", true);
    }

    function handleCatEditKey(k) {
        var kinds = catEditKinds();
        var list = arrangedCats(catEditKind, true);
        if (k === "back") {
            closeCatEdit();
            return;
        }
        if (catEditFocus === "kind") {
            var ki = catEditKindIndex();
            if (k === "left") ki = Math.max(0, ki - 1);
            if (k === "right") ki = Math.min(kinds.length - 1, ki + 1);
            if (k === "left" || k === "right") {
                catEditKind = kinds[ki].id;
                catEditIndex = 0;
            }
            if (k === "down" || k === "enter") {
                if (list.length) catEditFocus = "list";
            }
            paintCatEdit();
            return;
        }
        if (k === "up") {
            if (catEditIndex <= 0) {
                catEditFocus = "kind";
                paintCatEdit();
                return;
            }
            catEditIndex -= 1;
            paintCatEdit();
            return;
        }
        if (k === "down") {
            catEditIndex = Math.min(Math.max(0, list.length - 1), catEditIndex + 1);
            paintCatEdit();
            return;
        }
        if (k === "left" || k === "chup") {
            moveCatEdit(-1);
            return;
        }
        if (k === "right" || k === "chdown") {
            moveCatEdit(1);
            return;
        }
        if (k === "enter" || k === "red") toggleCatHidden();
    }

    function activateSettingsRow() {
        var rows = settingsRows();
        var row = rows[settingsIndex];
        if (!row) return false;
        if (row.id === "refresh") {
            if (provider) refreshCatalog(false);
            return true;
        }
        if (row.id === "interval") {
            var s = Store.settings();
            var opts = cacheRefreshOpts();
            var i = opts.indexOf(normalizeCacheHours(s.cacheHours));
            if (i < 0) i = opts.indexOf(72);
            s.cacheHours = opts[(i + 1) % opts.length];
            Store.setSettings(s);
            return true;
        }
        if (row.id === "cats") {
            openCatEdit();
            return true;
        }
        if (row.id === "remove") {
            Store.clearProvider();
            provider = null;
            catalog = Provider.emptyCatalog();
            screen = "setup";
            paintGate();
            return true;
        }
        return false;
    }

    function handleSettingsKey(k) {
        var rows = settingsRows();
        if (k === "up") settingsIndex = Math.max(0, settingsIndex - 1);
        if (k === "down") settingsIndex = Math.min(rows.length - 1, settingsIndex + 1);
        if (k === "left") { openMenu(); return; }
        if (k === "enter") {
            if (activateSettingsRow()) {
                if (screen !== "home") return;
            }
        }
        if (k === "back") {
            setTab("live");
            paintHome(true);
            return;
        }
        paintStage(true);
    }

    function handleDetailKey(k) {
        var seasons = (seriesDetail && seriesDetail.seasons) || [];
        var eps = (seasons[seasonIndex] && seasons[seasonIndex].episodes) || [];
        var acts = topDetailActs();
        var ai = acts.indexOf(detailFocus);
        if (trailerOpen) {
            if (k === "back") hideTrailer();
            return;
        }
        if (k === "back") {
            seriesDetail = null;
            detailItem = null;
            goHome(false);
            return;
        }
        if (k === "red") { toggleFav(detailItem); return; }
        if (detailItem && detailItem.kind === "series") {
            if (k === "left") {
                if (ai > 0) detailFocus = acts[ai - 1];
                else if (detailFocus === "seasons" && seasonIndex > 0) {
                    seasonIndex -= 1;
                    epIndex = 0;
                } else if (detailFocus === "episodes" && epIndex > 0) epIndex -= 1;
            }
            if (k === "right") {
                if (ai >= 0 && ai < acts.length - 1) detailFocus = acts[ai + 1];
                else if (detailFocus === "seasons" && seasonIndex < seasons.length - 1) {
                    seasonIndex += 1;
                    epIndex = 0;
                } else if (detailFocus === "episodes") {
                    epIndex = Math.min(Math.max(0, eps.length - 1), epIndex + 1);
                }
            }
            if (k === "up") {
                if (detailFocus === "episodes") detailFocus = "seasons";
                else if (detailFocus === "seasons") detailFocus = "play";
            }
            if (k === "down") {
                if (ai >= 0) detailFocus = seasons.length ? "seasons" : "episodes";
                else if (detailFocus === "seasons") detailFocus = "episodes";
            }
            if (k === "enter") {
                if (detailFocus === "fav") toggleFav(detailItem);
                else if (detailFocus === "trailer") {
                    showTrailer();
                    return;
                } else if (detailFocus === "play" || detailFocus === "episodes") {
                    if (eps[epIndex] || eps[0]) {
                        returnScreen = "detail";
                        playNow(eps[epIndex] || eps[0], eps);
                    } else {
                        pendingSeriesPlay = true;
                        toast(t("loadingEps"));
                    }
                    return;
                } else if (detailFocus === "seasons") detailFocus = "episodes";
            }
            paintDetail();
            return;
        }
        if (k === "left") {
            if (ai > 0) detailFocus = acts[ai - 1];
        }
        if (k === "right") {
            if (ai >= 0 && ai < acts.length - 1) detailFocus = acts[ai + 1];
        }
        if (k === "enter") {
            if (detailFocus === "fav") toggleFav(detailItem);
            else if (detailFocus === "trailer") {
                showTrailer();
                return;
            } else {
                returnScreen = "detail";
                playNow(detailItem, currentItems());
                return;
            }
        }
        paintDetail();
    }

    function playerTopIds() {
        var ids = ["fav"];
        var item = playerItem || {};
        if (item.kind === "live" || item.kind === "episode") ids.push("zap");
        return ids;
    }

    function playerCtrlIds() {
        if (playerItem && playerItem.kind === "live") return ["reload"];
        var ids = ["aspect", "speed", "play"];
        ids.push("sub", "audio");
        return ids;
    }

    function defaultPlayerFocus() {
        if (playerItem && playerItem.kind === "live") return "reload";
        return "bar";
    }

    function focusActId() {
        if (osdFocus === "play") return "toggle";
        return osdFocus;
    }

    function applyOsdFocus() {
        var bar = $("pbar");
        var prog = bar && bar.parentNode;
        if (prog) {
            if (osdFocus === "bar") addClass(prog, "is-on");
            else remClass(prog, "is-on");
        }
        var want = focusActId();
        var roots = [$("osd"), $("ptop")];
        for (var r = 0; r < roots.length; r++) {
            if (!roots[r]) continue;
            var nodes = roots[r].getElementsByTagName("*");
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                var act = n.getAttribute("data-act");
                if (!act) continue;
                if (act === want) addClass(n, "is-on");
                else remClass(n, "is-on");
            }
        }
    }

    function movePlayerFocus(dir) {
        var top = playerTopIds();
        var ti = top.indexOf(osdFocus);
        if (ti >= 0) {
            ti = Math.max(0, Math.min(top.length - 1, ti + dir));
            osdFocus = top[ti];
            bumpOsd();
            return;
        }
        var ids = playerCtrlIds();
        var i = ids.indexOf(osdFocus);
        if (i < 0) i = ids.indexOf("play");
        if (i < 0) i = 0;
        i = Math.max(0, Math.min(ids.length - 1, i + dir));
        osdFocus = ids[i];
        bumpOsd();
    }

    function activatePlayerFocus() {
        if (osdFocus === "fav") {
            toggleFav(playerItem);
            bumpOsd();
            return;
        }
        if (osdFocus === "zap") {
            toggleZap();
            return;
        }
        if (osdFocus === "aspect") { cycleAspect(); return; }
        if (osdFocus === "speed") { cycleSpeed(); return; }
        if (osdFocus === "sub") { cycleSub(); return; }
        if (osdFocus === "audio") { cycleAudio(); return; }
        if (osdFocus === "reload") { reloadStream(); return; }
        if (playerItem && playerItem.kind === "live") {
            toggleZap();
            return;
        }
        Player.toggle();
        bumpOsd();
        paintPlayer(false);
    }

    function handlePlayerKey(k) {
        var live = playerItem && playerItem.kind === "live";
        if (k === "back") {
            if (sheet) {
                closeSheet();
                return;
            }
            if (seekTarget >= 0) commitSeek({ osd: false });
            if (!live && osdVisible && osdFocus !== "bar") {
                osdFocus = "bar";
                bumpOsd();
                return;
            }
            if (chromeLocked()) {
                stopPlay();
                return;
            }
            if (osdVisible) {
                osdVisible = false;
                osdFocus = defaultPlayerFocus();
                paintPlayer(false);
            } else stopPlay();
            return;
        }
        if (k === "caption") {
            if (!live) cycleSub();
            return;
        }
        if (k === "green") {
            if (live) reloadStream();
            return;
        }
        if (k === "blue") {
            cycleAspect();
            return;
        }
        if (k === "yellow") {
            if (!live) cycleAudio();
            return;
        }
        if (k === "enter" || k === "info") {
            if (sheet) {
                chooseSheetRow();
                return;
            }
            if (seekTarget >= 0) commitSeek();
            if (!osdVisible) {
                osdFocus = defaultPlayerFocus();
                bumpOsd();
                return;
            }
            activatePlayerFocus();
            return;
        }
        if (k === "playpause") {
            if (seekTarget >= 0) commitSeek();
            if (!live) Player.toggle();
            bumpOsd();
            return;
        }
        if (k === "pause") {
            if (!live) Player.pause();
            bumpOsd();
            return;
        }
        if (k === "stop") { stopPlay(); return; }
        if (k === "left") {
            if (sheet) closeSheet();
            else if (!osdVisible) {
                osdFocus = defaultPlayerFocus();
                bumpOsd();
            } else if (osdFocus === "bar") nudgeSeek(-1);
            else movePlayerFocus(-1);
            return;
        }
        if (k === "rw") {
            osdFocus = "bar";
            nudgeSeek(-1);
            return;
        }
        if (k === "ff") {
            osdFocus = "bar";
            nudgeSeek(1);
            return;
        }
        if (k === "right") {
            if (sheet) bumpOsd();
            else if (!osdVisible) {
                osdFocus = defaultPlayerFocus();
                bumpOsd();
            } else if (osdFocus === "bar") nudgeSeek(1);
            else movePlayerFocus(1);
            return;
        }
        if (k === "red") { toggleFav(playerItem); return; }
        if (k === "chup") { zapChannel(-1); return; }
        if (k === "chdown") { zapChannel(1); return; }
        if (k === "up") {
            if (sheet) {
                sheetIndex = Math.max(0, sheetIndex - 1);
                paintSheet();
            } else if (!osdVisible) {
                osdFocus = live ? "fav" : "bar";
                bumpOsd();
            } else if (osdFocus === "fav" || osdFocus === "zap") {
                bumpOsd();
            } else if (osdFocus === "bar" || live) {
                osdFocus = "fav";
                bumpOsd();
            } else {
                osdFocus = "bar";
                bumpOsd();
            }
            return;
        }
        if (k === "down") {
            if (sheet) {
                var rows = sheetRows();
                sheetIndex = Math.min(rows.length - 1, sheetIndex + 1);
                paintSheet();
            } else if (!osdVisible) {
                osdFocus = defaultPlayerFocus();
                bumpOsd();
            } else if (osdFocus === "fav" || osdFocus === "zap") {
                osdFocus = live ? "reload" : "bar";
                bumpOsd();
            } else if (osdFocus === "bar") {
                if (seekTarget >= 0) commitSeek();
                osdFocus = "play";
                bumpOsd();
            } else bumpOsd();
            return;
        }
    }

    function onKey(e) {
        if (searchOpen && screen === "home" && !e.ctrlKey && !e.metaKey && !e.altKey) {
            var ch = e.key || "";
            if (ch === " " || (ch.length === 1 && /[0-9a-zA-ZğüşöçıİĞÜŞÖÇ]/.test(ch))) {
                e.preventDefault();
                e.stopPropagation();
                applySearchChar(ch === " " ? "space" : ch.toLowerCase());
                return;
            }
        }
        var k = Keys.kind(e);
        if (!k) return;
        if (document.activeElement && document.activeElement.tagName === "INPUT" &&
            (k === "left" || k === "right" || k.indexOf("num") === 0)) {
            if (k !== "enter" && k !== "back" && k !== "up" && k !== "down") return;
        }
        e.preventDefault();
        e.stopPropagation();

        if (k === "exit") {
            exitApp();
            return;
        }
        if (k.indexOf("num") === 0) {
            onDigit(k.slice(3));
            return;
        }

        if (screen === "paywall") {
            if (k === "left") payFocus = Math.max(0, payFocus - 1);
            if (k === "right") payFocus = Math.min(2, payFocus + 1);
            if (k === "enter") {
                if (payFocus === 0) Billing.buy().then(afterBilling);
                else if (payFocus === 1) Billing.check().then(afterBilling);
                else afterSetupGate();
            }
            if (k === "back") exitApp();
            paintGate();
            return;
        }

        if (screen === "setup") {
            if (k === "left") {
                setupChoice = 0;
                setupType = "xtream";
            }
            if (k === "right") {
                setupChoice = 1;
                setupType = "m3u";
            }
            if (k === "enter" || k === "down") {
                setupType = setupChoice === 0 ? "xtream" : "m3u";
                formFocus = 0;
                screen = "form";
            }
            if (k === "back") exitApp();
            paintGate();
            return;
        }

        if (screen === "form") {
            var n = formFieldCount() + 1;
            if (k === "up") {
                if (formFocus === 0) {
                    screen = "setup";
                    setupChoice = setupType === "m3u" ? 1 : 0;
                } else formFocus = Math.max(0, formFocus - 1);
            }
            if (k === "down") formFocus = Math.min(n - 1, formFocus + 1);
            if (k === "enter") {
                if (formFocus === formFieldCount()) submitForm();
                else {
                    var inp = root.querySelector(".focused");
                    if (inp && inp.focus) inp.focus();
                }
            }
            if (k === "back") {
                if (document.activeElement && document.activeElement.tagName === "INPUT") {
                    document.activeElement.blur();
                } else {
                    screen = "setup";
                    errorMsg = "";
                    setupChoice = setupType === "m3u" ? 1 : 0;
                }
            }
            paintGate();
            return;
        }

        if (screen === "splash") return;

        if (screen === "detail") {
            handleDetailKey(k);
            return;
        }
        if (screen === "player") {
            handlePlayerKey(k);
            return;
        }
        if (screen === "catedit") {
            handleCatEditKey(k);
            return;
        }
        if (screen === "home") handleHomeKey(k);
    }

    function afterBilling(res) {
        if (res && res.ok) afterSetupGate();
        else toast(t("subscribeTitle"));
    }

    function fillDefaultForm() {
        var d = Provider.defaultForm();
        form.server = d.server;
        form.username = d.username;
        form.password = d.password;
    }

    function afterSetupGate() {
        fillDefaultForm();
        if (forceCatEditPreview()) {
            catalog.liveCats = [
                { id: "1", name: "Türkiye" },
                { id: "2", name: "Spor" },
                { id: "3", name: "Haber" },
                { id: "4", name: "Belgesel" },
                { id: "5", name: "Çocuk" }
            ];
            catalog.vodCats = [
                { id: "10", name: "Aksiyon" },
                { id: "11", name: "Komedi" },
                { id: "12", name: "Dram" }
            ];
            catalog.seriesCats = [
                { id: "20", name: "Yerli Dizi" },
                { id: "21", name: "Yabancı Dizi" }
            ];
            catalog.liveReady = true;
            lastContentTab = "live";
            openCatEdit();
            return;
        }
        if (forceGatePreview()) {
            screen = "setup";
            statusMsg = "";
            errorMsg = "";
            paintGate();
            return;
        }
        var d = Provider.defaultForm();
        if (d && d.server && d.username && d.password) {
            screen = "splash";
            statusMsg = t("loadingTv");
            paintGate();
            connectProvider(d);
            return;
        }
        if (Store.provider()) {
            screen = "splash";
            statusMsg = t("loadingTv");
            paintGate();
            loadCachedCatalog();
            if (catalog.liveReady) goHome(true);
            return;
        }
        screen = "setup";
        statusMsg = "";
        errorMsg = "";
        paintGate();
    }

    function exitApp() {
        Player.stop();
        try { tizen.application.getCurrentApplication().exit(); } catch (e) {}
    }

    function fitPreview() {
        if (!Http.isPreview()) return;
        function apply() {
            var s = (window.innerWidth || 1920) / 1920;
            var html = document.documentElement;
            var body = document.body;
            html.style.width = "";
            html.style.height = "";
            html.style.transform = "";
            html.style.webkitTransform = "";
            html.style.overflow = "hidden";
            html.style.background = "#000";
            html.style.zoom = String(s);
            body.style.position = "";
            body.style.left = "";
            body.style.top = "";
            body.style.transform = "";
            body.style.webkitTransform = "";
            body.style.transformOrigin = "";
            body.style.webkitTransformOrigin = "";
            body.style.width = "1920px";
            body.style.height = "1080px";
            body.style.overflow = "hidden";
            body.style.background = "#000";
        }
        window.addEventListener("resize", apply);
        apply();
    }

    function handleGateClick(e) {
        var n = e.target;
        while (n && n !== document.body) {
            var mode = n.getAttribute && n.getAttribute("data-mode");
            if (mode) {
                setupType = mode;
                setupChoice = mode === "m3u" ? 1 : 0;
                formFocus = 0;
                errorMsg = "";
                screen = "form";
                paintGate();
                return;
            }
            var act = n.getAttribute && n.getAttribute("data-act");
            if (act === "connect") {
                screen = "form";
                submitForm();
                return;
            }
            if (act === "subscribe") {
                Billing.buy().then(afterBilling);
                return;
            }
            if (act === "restore") {
                Billing.check().then(afterBilling);
                return;
            }
            if (act === "later") {
                afterSetupGate();
                return;
            }
            if (n.tagName === "INPUT") {
                screen = "form";
                var inputs = root.querySelectorAll("input[data-k]");
                for (var i = 0; i < inputs.length; i++) {
                    if (inputs[i] === n) formFocus = i;
                }
                var prev = root.querySelectorAll(".focused");
                for (var p = 0; p < prev.length; p++) remClass(prev[p], "focused");
                addClass(n, "focused");
                n.focus();
                return;
            }
            n = n.parentNode;
        }
    }

    function boot() {
        root = $("app") || document.getElementById("app");
        mount();
        fitPreview();
        Player.init();
        Keys.register();
        document.addEventListener("keydown", onKey, true);
        document.addEventListener("input", function (e) {
            var key = e.target && e.target.getAttribute && e.target.getAttribute("data-k");
            if (key && form) form[key] = e.target.value;
        }, true);
        document.addEventListener("click", function (e) {
            if (!Http.isPreview()) return;
            if (screen === "player") {
                if (seekFromBar(e)) return;
                var p = e.target;
                while (p && p !== document.body) {
                    var act = p.getAttribute && p.getAttribute("data-act");
                    if (act === "reload") { reloadStream(); return; }
                    if (act === "aspect") { cycleAspect(); return; }
                    if (act === "speed") { cycleSpeed(); return; }
                    if (act === "sub") { cycleSub(); return; }
                    if (act === "audio") { cycleAudio(); return; }
                    if (act === "sheet") {
                        var si = p.getAttribute("data-i");
                        if (si != null) sheetIndex = Number(si);
                        chooseSheetRow();
                        return;
                    }
                    if (act === "zap") { toggleZap(); return; }
                    if (act === "fav") { toggleFav(playerItem); return; }
                    if (act === "toggle") { handlePlayerKey("enter"); return; }
                    p = p.parentNode;
                }
                var hit = e.target;
                while (hit && hit !== document.body) {
                    if (hit.id === "psheet" && sheet) return;
                    hit = hit.parentNode;
                }
                if (sheet) {
                    closeSheet();
                    return;
                }
                bumpOsd();
                return;
            }
            if (screen === "setup" || screen === "form" || screen === "paywall") {
                handleGateClick(e);
                return;
            }
            if (screen === "catedit") {
                var ce = e.target;
                while (ce && ce !== document.body) {
                    var kind = ce.getAttribute && ce.getAttribute("data-kind");
                    if (kind) {
                        catEditKind = kind;
                        catEditIndex = 0;
                        catEditFocus = "kind";
                        paintCatEdit();
                        return;
                    }
                    var ci = ce.getAttribute && ce.getAttribute("data-ci");
                    if (ci != null) {
                        catEditIndex = Number(ci);
                        catEditFocus = "list";
                        toggleCatHidden();
                        return;
                    }
                    ce = ce.parentNode;
                }
                return;
            }
            var n = e.target;
            if (screen === "detail") {
                while (n && n !== document.body) {
                    var cls = String(n.className || "");
                    var act = n.getAttribute && n.getAttribute("data-act");
                    if (act === "play" || act === "fav" || act === "trailer") {
                        detailFocus = act;
                        handleDetailKey("enter");
                        return;
                    }
                    var ds = n.getAttribute && n.getAttribute("data-s");
                    if (ds != null && cls.indexOf("dd-stab") >= 0) {
                        seasonIndex = Number(ds);
                        epIndex = 0;
                        detailFocus = "seasons";
                        paintDetail();
                        return;
                    }
                    var di = n.getAttribute && n.getAttribute("data-i");
                    if (di != null && cls.indexOf("dd-ep") >= 0) {
                        epIndex = Number(di);
                        detailFocus = "episodes";
                        handleDetailKey("enter");
                        return;
                    }
                    n = n.parentNode;
                }
                return;
            }
            if (screen !== "home") return;
            n = e.target;
            while (n && n !== document.body) {
                var setId = n.getAttribute && n.getAttribute("data-set");
                if (setId && tab === "settings") {
                    var srows = settingsRows();
                    for (var sr = 0; sr < srows.length; sr++) {
                        if (srows[sr].id === setId) settingsIndex = sr;
                    }
                    activateSettingsRow();
                    return;
                }
                var cls2 = String(n.className || "");
                if (cls2.indexOf("cat-search") >= 0) {
                    openSearch();
                    return;
                }
                var dk = n.getAttribute && n.getAttribute("data-k");
                if (dk != null && cls2.indexOf("search-key") >= 0) {
                    searchKeyIndex = Number(dk);
                    searchFocus = "keys";
                    applySearchChar(SEARCH_KEYS[searchKeyIndex]);
                    return;
                }
                var di2 = n.getAttribute && n.getAttribute("data-i");
                if (di2 != null && n.className && (n.className.indexOf("row") >= 0 || n.className.indexOf("poster") >= 0)) {
                    itemIndex = Number(di2);
                    var pool = searchOpen ? searchItems() : currentItems();
                    searchOpen = false;
                    searchQuery = "";
                    startPlay(pool[itemIndex], pool);
                    return;
                }
                if (n.className && n.className.indexOf("menu-item") >= 0) {
                    var sec = n.getAttribute("data-sec");
                    if (sec) {
                        menuIndex = sectionIndex(sec);
                        chooseSection();
                    }
                    return;
                }
                if (n.className && n.className.indexOf("cat-tab") >= 0 && di2 != null) {
                    if (searchOpen) closeSearch();
                    catIndex = Number(di2);
                    itemIndex = 0;
                    invalidateItems();
                    focusCol = "items";
                    paintHome(true);
                    return;
                }
                n = n.parentNode;
            }
        }, true);
        fillDefaultForm();
        statusMsg = t("checking");
        paintGate();
        Billing.check().then(function (res) {
            if (res && res.ok) afterSetupGate();
            else {
                screen = "paywall";
                paintGate();
            }
        });
    }

    return { boot: boot };
})();

window.addEventListener("load", function () {
    App.boot();
});
