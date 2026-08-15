var App = (function () {
    var t = I18N.t;
    var root;
    var screen = "splash";
    var setupType = "xtream";
    var form = { server: "", username: "", password: "", playlist: "", epg: "" };
    var formFocus = 0;
    var errorMsg = "";
    var statusMsg = "";
    var catalog = { live: [], liveCats: [], vod: [], vodCats: [], series: [], seriesCats: [] };
    var provider = null;
    var tab = "live";
    var catIndex = 0;
    var itemIndex = 0;
    var focusCol = "tabs";
    var query = "";
    var toastTimer = null;
    var toastText = "";
    var lastBack = 0;
    var playerItem = null;
    var playerList = [];
    var osdVisible = true;
    var osdTimer = null;
    var zapOpen = false;
    var playTime = 0;
    var playDur = 0;
    var seriesDetail = null;
    var seasonIndex = 0;
    var epIndex = 0;
    var searchMode = false;
    var settingsIndex = 0;
    var payFocus = 0;
    var setupChoice = 0;
    var confirmMode = null;

    function el(html) {
        root.innerHTML = html;
    }

    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
    }

    function mark(compact) {
        return '<div class="mark">' +
            '<div class="mark-v">V</div>' +
            '<div><div class="mark-name">VELA</div>' +
            (compact ? "" : '<div class="mark-sub">IPTV PLAYER</div>') +
            "</div></div>";
    }

    function toast(msg) {
        toastText = msg;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toastText = "";
            toastTimer = null;
            paintChrome();
        }, 1800);
        paintChrome();
    }

    function paintChrome() {
        var node = document.getElementById("toast");
        if (!node && toastText) {
            var d = document.createElement("div");
            d.id = "toast";
            d.className = "toast";
            d.textContent = toastText;
            root.appendChild(d);
        } else if (node && toastText) {
            node.textContent = toastText;
        } else if (node && !toastText) {
            node.parentNode.removeChild(node);
        }
    }

    function currentCats() {
        if (tab === "live") return catalog.liveCats || [];
        if (tab === "movies") return catalog.vodCats || [];
        if (tab === "series") return catalog.seriesCats || [];
        return [{ id: "all", name: t("all") }];
    }

    function currentItems() {
        var cat = currentCats()[catIndex] || { id: "all" };
        if (tab === "live") return Provider.filterItems(catalog.live, cat.id, query);
        if (tab === "movies") return Provider.filterItems(catalog.vod, cat.id, query);
        if (tab === "series") return Provider.filterItems(catalog.series, cat.id, query);
        var favs = Store.favorites();
        var map = {};
        favs.forEach(function (k) { map[k] = 1; });
        var all = (catalog.live || []).concat(catalog.vod || []).concat(catalog.series || []);
        return all.filter(function (it) { return map[Provider.itemKey(it)]; });
    }

    function logoTag(src, name) {
        if (src) return '<img src="' + esc(src) + '" alt=""/>';
        return '<div class="ph">' + esc((name || "?").charAt(0).toUpperCase()) + "</div>";
    }

    function renderSplash() {
        el('<div class="screen bg-dim splash">' + mark(false) +
            '<div class="tagline">' + esc(t("tagline")) + "</div>" +
            '<div class="splash-status">' + esc(statusMsg || t("loading")) + "</div></div>");
    }

    function renderPaywall() {
        var btns = [t("subscribe"), t("restore"), t("later")];
        var html = '<div class="screen bg-dim panel-wrap"><div class="panel">' + mark(true) +
            "<h1>" + esc(t("subscribeTitle")) + "</h1><p>" + esc(t("subscribeBody")) + "</p><div class=\"form-actions\">";
        btns.forEach(function (label, i) {
            html += '<button class="btn ' + (i === 0 ? "primary " : "") + "focusable" +
                (i === payFocus ? " focused" : "") + '">' + esc(label) + "</button>";
        });
        html += "</div></div></div>";
        el(html);
    }

    function renderSetupChoice() {
        el('<div class="screen bg-dim panel-wrap"><div class="panel">' + mark(true) +
            "<h1>" + esc(t("setupTitle")) + "</h1><p>" + esc(t("setupBody")) + '</p><div class="choice-row">' +
            '<div class="choice focusable' + (setupChoice === 0 ? " focused" : "") + '"><b>' + esc(t("xtream")) +
            "</b><span>" + esc(t("xtreamHint")) + "</span></div>" +
            '<div class="choice focusable' + (setupChoice === 1 ? " focused" : "") + '"><b>' + esc(t("m3u")) +
            "</b><span>" + esc(t("m3uHint")) + "</span></div></div></div></div>");
    }

    function renderSetupForm() {
        var fields = setupType === "xtream"
            ? [
                { key: "server", label: t("server"), value: form.server },
                { key: "username", label: t("username"), value: form.username },
                { key: "password", label: t("password"), value: form.password, pass: true }
            ]
            : [
                { key: "playlist", label: t("playlist"), value: form.playlist },
                { key: "epg", label: t("epg"), value: form.epg }
            ];
        var html = '<div class="screen bg-dim panel-wrap"><div class="panel">' + mark(true) +
            "<h1>" + esc(setupType === "xtream" ? t("xtream") : t("m3u")) + "</h1>";
        fields.forEach(function (f, i) {
            html += '<div class="field"><label>' + esc(f.label) + "</label>" +
                '<input class="focusable' + (formFocus === i ? " focused" : "") + '" data-k="' + f.key +
                '" value="' + esc(f.value) + '"' + (f.pass ? ' type="password"' : ' type="text"') + "/></div>";
        });
        html += '<div class="error">' + esc(errorMsg) + "</div><div class=\"form-actions\">" +
            '<button class="btn ghost focusable' + (formFocus === fields.length ? " focused" : "") + '">' + esc(t("back")) + "</button>" +
            '<button class="btn primary focusable' + (formFocus === fields.length + 1 ? " focused" : "") + '">' +
            esc(statusMsg || t("connect")) + "</button></div></div></div>";
        el(html);
        var focused = root.querySelector(".focused");
        if (focused && focused.tagName === "INPUT") {
            focused.focus();
            var v = focused.value;
            focused.value = "";
            focused.value = v;
        }
    }

    function renderHome() {
        var tabs = ["live", "movies", "series", "favorites", "settings"];
        var labels = [t("live"), t("movies"), t("series"), t("favorites"), t("settings")];
        var html = '<div class="screen shell"><div class="topbar">' + mark(true) + '<div class="tabs">';
        tabs.forEach(function (id, i) {
            html += '<button class="tab' + (tab === id ? " active" : "") +
                (focusCol === "tabs" && i === tabs.indexOf(tab) ? " focused" : "") +
                '" data-tab="' + id + '">' + esc(labels[i]) + "</button>";
        });
        html += "</div><div>" + esc(provider && provider.label ? provider.label : "") + "</div></div>";

        if (tab === "settings") {
            html += renderSettingsInner() + "</div>";
            el(html);
            return;
        }

        var cats = currentCats();
        var items = currentItems();
        html += '<div class="body"><div class="cats">';
        var catStart = Math.max(0, catIndex - 6);
        var catEnd = Math.min(cats.length, catStart + 12);
        for (var c = catStart; c < catEnd; c++) {
            html += '<div class="cat' + (c === catIndex ? " active" : "") +
                (focusCol === "cats" && c === catIndex ? " focused" : "") + '">' +
                esc(cats[c].name) + "</div>";
        }
        html += '</div><div class="content"><div class="toolbar"><span>' +
            esc(cats[catIndex] ? cats[catIndex].name : "") + " · " + items.length +
            (query ? " · “" + esc(query) + "”" : "") + "</span><span>" +
            (searchMode ? esc(t("searchHint")) : '<span class="kbd">Y</span> ' + esc(t("search"))) +
            "</span></div>";

        if (!items.length) {
            html += '<div class="empty">' + esc(tab === "favorites" ? t("emptyFav") : (tab === "live" ? t("emptyLive") : t("emptyVod"))).replace("\n", "<br/>") + "</div>";
        } else if (tab === "live" || tab === "favorites") {
            html += '<div class="list">';
            var start = Math.max(0, itemIndex - 4);
            var end = Math.min(items.length, start + 9);
            for (var i = start; i < end; i++) {
                var it = items[i];
                html += '<div class="row' + (focusCol === "items" && i === itemIndex ? " focused" : "") + '">' +
                    logoTag(it.logo, it.name) + '<div class="meta"><div class="name">' + esc(it.name) +
                    "</div><div class=\"epg\">" + esc(it.kind === "live" ? t("live") : it.kind) +
                    "</div></div></div>";
            }
            html += "</div>";
        } else {
            html += '<div class="grid">';
            var page = CONFIG.GRID_COLS * CONFIG.GRID_ROWS;
            var gStart = Math.floor(itemIndex / page) * page;
            var gEnd = Math.min(items.length, gStart + page);
            for (var g = gStart; g < gEnd; g++) {
                var v = items[g];
                html += '<div class="poster' + (focusCol === "items" && g === itemIndex ? " focused" : "") + '">' +
                    (v.logo ? '<img src="' + esc(v.logo) + '" alt=""/>' : '<div class="ph">' + esc((v.name || "?").charAt(0)) + "</div>") +
                    '<div class="cap">' + esc(v.name) + "</div></div>";
            }
            html += "</div>";
        }
        html += "</div></div></div>";
        el(html);
    }

    function renderSettingsInner() {
        var s = Store.settings();
        var refreshLabel = s.cacheHours === 0 ? t("manual") : (s.cacheHours + " " + t("hours"));
        var rows = [
            { id: "refresh", name: t("refresh"), value: "" },
            { id: "interval", name: t("refreshEvery"), value: refreshLabel },
            { id: "subs", name: t("subSize"), value: t(s.subtitleSize || "medium") },
            { id: "remove", name: t("removeProvider"), value: provider ? provider.label : "" },
            { id: "about", name: t("about"), value: CONFIG.APP_VERSION }
        ];
        var html = '<div class="body"><div class="content"><p style="color:#8b8d98;padding:8px 16px 20px">' +
            esc(t("legal")) + '</p><div class="settings-list">';
        rows.forEach(function (r, i) {
            html += '<div class="row' + (i === settingsIndex ? " focused" : "") + '"><div>' +
                esc(r.name) + "</div><div>" + esc(r.value) + "</div></div>";
        });
        html += "</div></div></div>";
        return html;
    }

    function renderSeries() {
        if (!seriesDetail) return;
        var seasons = seriesDetail.seasons || [];
        var season = seasons[seasonIndex] || { episodes: [] };
        var html = '<div class="screen shell"><div class="topbar">' + mark(true) +
            "<div style=\"font-size:32px\">" + esc(playerItem ? playerItem.name : "") + "</div></div><div class=\"body\">";
        html += '<div class="cats">';
        seasons.forEach(function (sn, i) {
            html += '<div class="cat' + (i === seasonIndex ? " active" : "") +
                (focusCol === "cats" && i === seasonIndex ? " focused" : "") + '">' +
                esc(sn.name) + "</div>";
        });
        html += '</div><div class="content"><div class="list">';
        (season.episodes || []).forEach(function (ep, i) {
            html += '<div class="row' + (focusCol === "items" && i === epIndex ? " focused" : "") + '"><div class="meta"><div class="name">' +
                esc(ep.name) + "</div></div></div>";
        });
        html += "</div></div></div></div>";
        el(html);
    }

    function fmtTime(ms) {
        ms = Math.max(0, Math.floor((ms || 0) / 1000));
        var h = Math.floor(ms / 3600);
        var m = Math.floor((ms % 3600) / 60);
        var s = ms % 60;
        function p(n) { return (n < 10 ? "0" : "") + n; }
        return (h ? h + ":" : "") + p(m) + ":" + p(s);
    }

    function renderPlayer() {
        var item = playerItem || { name: "" };
        var pct = playDur ? Math.min(100, (playTime / playDur) * 100) : 0;
        var html = '<div class="screen" style="background:transparent">';
        if (osdVisible) {
            html += '<div class="osd"><div class="osd-top"><div class="title">' + esc(item.name) +
                "</div><div class=\"sub\">" + esc(item.group || item.kind || "") + "</div></div><div>" +
                (item.kind !== "live" ? '<div class="progress"><span style="width:' + pct + '%"></span></div><div class="hints">' +
                    fmtTime(playTime) + " / " + fmtTime(playDur) + "</div>" : "") +
                '<div class="hints"><span>' + esc(t("hintOk")) + "</span><span>" + esc(t("hintBack")) +
                "</span><span>" + esc(t("hintFav")) + "</span><span>" + esc(t("hintCh")) + "</span></div></div></div>";
        }
        if (zapOpen) {
            html += '<div class="zap">';
            var start = Math.max(0, itemIndex - 4);
            var end = Math.min(playerList.length, start + 9);
            for (var i = start; i < end; i++) {
                html += '<div class="row' + (i === itemIndex ? " focused" : "") + '">' +
                    logoTag(playerList[i].logo, playerList[i].name) +
                    '<div class="name">' + esc(playerList[i].name) + "</div></div>";
            }
            html += "</div>";
        }
        html += "</div>";
        el(html);
    }

    function render() {
        if (screen === "splash") renderSplash();
        else if (screen === "paywall") renderPaywall();
        else if (screen === "setup") renderSetupChoice();
        else if (screen === "form") renderSetupForm();
        else if (screen === "series") renderSeries();
        else if (screen === "player") renderPlayer();
        else renderHome();
        paintChrome();
    }

    function goHome() {
        screen = "home";
        if (tab === "settings") focusCol = "settings";
        else focusCol = "items";
        render();
    }

    function loadCachedCatalog() {
        provider = Store.provider();
        var cached = Store.catalog();
        if (cached) catalog = cached;
        tab = Store.settings().lastTab || "live";
        var s = Store.settings();
        var age = cached && cached.fetchedAt ? Date.now() - cached.fetchedAt : Infinity;
        var need = s.cacheHours > 0 && age > s.cacheHours * 3600000;
        if (need && provider) {
            Provider.refresh(provider).then(function (c) {
                catalog = c;
                Store.setCatalog(c);
                if (screen === "home") render();
            }).catch(function () {});
        }
    }

    function startPlay(item, list) {
        if (!item) return;
        if (item.kind === "series") {
            playerItem = item;
            statusMsg = t("loading");
            Provider.seriesInfo(provider, item.id).then(function (detail) {
                seriesDetail = detail || { seasons: [] };
                seasonIndex = 0;
                epIndex = 0;
                focusCol = "items";
                screen = "series";
                render();
            }).catch(function () {
                toast(t("noStream"));
            });
            return;
        }
        if (!item.url) {
            toast(t("noStream"));
            return;
        }
        playerItem = item;
        playerList = list || currentItems();
        itemIndex = Math.max(0, playerList.indexOf(item));
        if (itemIndex < 0) itemIndex = 0;
        screen = "player";
        osdVisible = true;
        zapOpen = false;
        playTime = 0;
        playDur = 0;
        render();
        bumpOsd();
        Player.open(item, {
            onTime: function (cur, dur) {
                playTime = cur;
                playDur = dur;
                saveProgress(item, cur, dur);
                if (screen === "player" && osdVisible) render();
            },
            onEnd: function () { stopPlay(); },
            onError: function () {
                if (item.urlTs && item.url !== item.urlTs) {
                    item.url = item.urlTs;
                    Player.open(item, {
                        onTime: function (cur, dur) { playTime = cur; playDur = dur; },
                        onEnd: stopPlay,
                        onError: function () { toast(t("noStream")); stopPlay(); }
                    });
                } else {
                    toast(t("noStream"));
                    stopPlay();
                }
            }
        });
        rememberHistory(item);
    }

    function saveProgress(item, cur, dur) {
        if (!dur || item.kind === "live") return;
        var hist = Store.history();
        var key = Provider.itemKey(item);
        hist = hist.filter(function (h) { return h.key !== key; });
        hist.unshift({ key: key, t: cur, d: dur, at: Date.now() });
        Store.setHistory(hist.slice(0, 40));
    }

    function rememberHistory(item) {
        var hist = Store.history();
        var key = Provider.itemKey(item);
        hist = hist.filter(function (h) { return h.key !== key; });
        hist.unshift({ key: key, name: item.name, at: Date.now() });
        Store.setHistory(hist.slice(0, 40));
    }

    function stopPlay() {
        Player.stop();
        screen = seriesDetail ? "series" : "home";
        render();
    }

    function bumpOsd() {
        osdVisible = true;
        if (osdTimer) clearTimeout(osdTimer);
        osdTimer = setTimeout(function () {
            osdVisible = false;
            zapOpen = false;
            if (screen === "player") render();
        }, 4000);
        if (screen === "player") render();
    }

    function toggleFav(item) {
        if (!item) return;
        var key = Provider.itemKey(item);
        var favs = Store.favorites();
        var i = favs.indexOf(key);
        if (i >= 0) {
            favs.splice(i, 1);
            toast(t("removedFav"));
        } else {
            favs.unshift(key);
            toast(t("addedFav"));
        }
        Store.setFavorites(favs.slice(0, 500));
    }

    function formFieldCount() {
        return setupType === "xtream" ? 3 : 2;
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
        statusMsg = t("connecting");
        render();
        var payload = setupType === "xtream"
            ? { type: "xtream", server: form.server, username: form.username, password: form.password }
            : { type: "m3u", playlist: form.playlist, epg: form.epg };
        Provider.connect(payload).then(function (res) {
            provider = res.provider;
            catalog = res.catalog;
            Store.setProvider(provider);
            Store.setCatalog(catalog);
            statusMsg = "";
            tab = "live";
            catIndex = 0;
            itemIndex = 0;
            goHome();
        }).catch(function () {
            statusMsg = "";
            errorMsg = setupType === "xtream" ? t("badLogin") : t("badPlaylist");
            render();
        });
    }

    function tabIds() { return ["live", "movies", "series", "favorites", "settings"]; }

    function moveTab(dir) {
        var ids = tabIds();
        var i = ids.indexOf(tab);
        i = Math.max(0, Math.min(ids.length - 1, i + dir));
        tab = ids[i];
        catIndex = 0;
        itemIndex = 0;
        query = "";
        var s = Store.settings();
        s.lastTab = tab;
        Store.setSettings(s);
        if (tab === "settings") {
            settingsIndex = 0;
            focusCol = "settings";
        } else focusCol = "items";
        render();
    }

    function onKey(e) {
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

        if (screen === "paywall") {
            if (k === "left") payFocus = Math.max(0, payFocus - 1);
            if (k === "right") payFocus = Math.min(2, payFocus + 1);
            if (k === "enter") {
                if (payFocus === 0) Billing.buy().then(afterBilling);
                else if (payFocus === 1) Billing.check().then(afterBilling);
                else afterSetupGate();
            }
            if (k === "back") exitApp();
            render();
            return;
        }

        if (screen === "setup") {
            if (k === "left") setupChoice = 0;
            if (k === "right") setupChoice = 1;
            if (k === "enter") {
                setupType = setupChoice === 0 ? "xtream" : "m3u";
                formFocus = 0;
                screen = "form";
            }
            if (k === "back") exitApp();
            render();
            return;
        }

        if (screen === "form") {
            var n = formFieldCount() + 2;
            if (k === "up") formFocus = Math.max(0, formFocus - 1);
            if (k === "down") formFocus = Math.min(n - 1, formFocus + 1);
            if (k === "left" && formFocus >= formFieldCount()) formFocus = formFieldCount();
            if (k === "right" && formFocus >= formFieldCount()) formFocus = formFieldCount() + 1;
            if (k === "enter") {
                if (formFocus === formFieldCount()) {
                    screen = "setup";
                    errorMsg = "";
                } else if (formFocus === formFieldCount() + 1) submitForm();
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
                }
            }
            render();
            return;
        }

        if (screen === "series") {
            var seasons = (seriesDetail && seriesDetail.seasons) || [];
            var eps = (seasons[seasonIndex] && seasons[seasonIndex].episodes) || [];
            if (k === "left") focusCol = "cats";
            if (k === "right") focusCol = "items";
            if (k === "up") {
                if (focusCol === "cats") seasonIndex = Math.max(0, seasonIndex - 1);
                else epIndex = Math.max(0, epIndex - 1);
            }
            if (k === "down") {
                if (focusCol === "cats") seasonIndex = Math.min(seasons.length - 1, seasonIndex + 1);
                else epIndex = Math.min(Math.max(0, eps.length - 1), epIndex + 1);
            }
            if (k === "enter" && eps[epIndex]) startPlay(eps[epIndex], eps);
            if (k === "back") {
                seriesDetail = null;
                goHome();
                return;
            }
            render();
            return;
        }

        if (screen === "player") {
            if (k === "back") {
                if (zapOpen || osdVisible) {
                    zapOpen = false;
                    osdVisible = false;
                    render();
                } else stopPlay();
                return;
            }
            if (k === "enter" || k === "info") { bumpOsd(); return; }
            if (k === "playpause") { Player.toggle(); bumpOsd(); return; }
            if (k === "pause") { Player.pause(); bumpOsd(); return; }
            if (k === "stop") { stopPlay(); return; }
            if (k === "ff") { Player.seek(15000); bumpOsd(); return; }
            if (k === "rw") { Player.seek(-15000); bumpOsd(); return; }
            if (k === "red") { toggleFav(playerItem); return; }
            if (k === "chup" || k === "up") {
                if (!zapOpen) { zapOpen = true; bumpOsd(); }
                itemIndex = Math.max(0, itemIndex - 1);
                render();
                return;
            }
            if (k === "chdown" || k === "down") {
                if (!zapOpen) { zapOpen = true; bumpOsd(); }
                itemIndex = Math.min(playerList.length - 1, itemIndex + 1);
                render();
                return;
            }
            if (k === "enter" && zapOpen && playerList[itemIndex]) {
                startPlay(playerList[itemIndex], playerList);
            }
            return;
        }

        if (screen === "home") {
            if (searchMode && k !== "back" && k !== "enter" && k.indexOf("num") !== 0) {
                /* keep IME if any */
            }
            if (k === "yellow") {
                query = window.prompt ? (window.prompt(t("search"), query) || "") : query;
                itemIndex = 0;
                render();
                return;
            }
            if (k === "green") {
                if (provider) {
                    toast(t("connecting"));
                    Provider.refresh(provider).then(function (c) {
                        catalog = c;
                        Store.setCatalog(c);
                        toast(t("refreshed"));
                        render();
                    }).catch(function () { toast(t("badPlaylist")); });
                }
                return;
            }
            if (k === "blue") {
                tab = "settings";
                settingsIndex = 0;
                focusCol = "settings";
                render();
                return;
            }
            if (k === "red") {
                var items = currentItems();
                toggleFav(items[itemIndex]);
                return;
            }
            if (tab === "settings") {
                handleSettingsKey(k);
                return;
            }
            if (k === "up") {
                if (focusCol === "items") {
                    if (tab === "movies" || tab === "series") {
                        itemIndex = Math.max(0, itemIndex - CONFIG.GRID_COLS);
                    } else itemIndex = Math.max(0, itemIndex - 1);
                } else if (focusCol === "cats") catIndex = Math.max(0, catIndex - 1);
                else focusCol = "tabs";
            } else if (k === "down") {
                if (focusCol === "tabs") focusCol = "items";
                else if (focusCol === "cats") catIndex = Math.min(currentCats().length - 1, catIndex + 1);
                else {
                    var max = currentItems().length - 1;
                    if (tab === "movies" || tab === "series") itemIndex = Math.min(max, itemIndex + CONFIG.GRID_COLS);
                    else itemIndex = Math.min(max, itemIndex + 1);
                }
            } else if (k === "left") {
                if (focusCol === "tabs") moveTab(-1);
                else if (focusCol === "items") focusCol = "cats";
                else if (focusCol === "cats") focusCol = "tabs";
            } else if (k === "right") {
                if (focusCol === "tabs") moveTab(1);
                else if (focusCol === "cats") focusCol = "items";
                else if (focusCol === "items" && (tab === "movies" || tab === "series")) {
                    itemIndex = Math.min(currentItems().length - 1, itemIndex + 1);
                }
            } else if (k === "enter") {
                if (focusCol === "tabs") {
                    /* already on tab */
                } else if (focusCol === "cats") {
                    itemIndex = 0;
                    focusCol = "items";
                } else {
                    var list = currentItems();
                    startPlay(list[itemIndex], list);
                    return;
                }
            } else if (k === "back") {
                var now = Date.now();
                if (query) {
                    query = "";
                    render();
                    return;
                }
                if (now - lastBack < 2000) exitApp();
                else {
                    lastBack = now;
                    toast(t("exitHint"));
                }
                return;
            }
            render();
        }
    }

    function handleSettingsKey(k) {
        var rows = 5;
        if (k === "up") settingsIndex = Math.max(0, settingsIndex - 1);
        if (k === "down") settingsIndex = Math.min(rows - 1, settingsIndex + 1);
        if (k === "left") { tab = "favorites"; focusCol = "items"; render(); return; }
        if (k === "enter") {
            var s = Store.settings();
            if (settingsIndex === 0 && provider) {
                toast(t("connecting"));
                Provider.refresh(provider).then(function (c) {
                    catalog = c;
                    Store.setCatalog(c);
                    toast(t("refreshed"));
                }).catch(function () { toast(t("badPlaylist")); });
            } else if (settingsIndex === 1) {
                var opts = [6, 12, 24, 0];
                var i = opts.indexOf(s.cacheHours);
                s.cacheHours = opts[(i + 1) % opts.length];
                Store.setSettings(s);
            } else if (settingsIndex === 2) {
                var sizes = ["small", "medium", "large"];
                var j = sizes.indexOf(s.subtitleSize);
                s.subtitleSize = sizes[(j + 1) % sizes.length];
                Store.setSettings(s);
            } else if (settingsIndex === 3) {
                Store.clearProvider();
                provider = null;
                catalog = { live: [], liveCats: [], vod: [], vodCats: [], series: [], seriesCats: [] };
                screen = "setup";
                render();
                return;
            }
        }
        if (k === "back") {
            tab = "live";
            focusCol = "items";
        }
        render();
    }

    function afterBilling(res) {
        if (res && res.ok) afterSetupGate();
        else toast(t("subscribeTitle"));
    }

    function afterSetupGate() {
        if (Store.provider()) {
            loadCachedCatalog();
            goHome();
        } else {
            screen = "setup";
            render();
        }
    }

    function exitApp() {
        Player.stop();
        try { tizen.application.getCurrentApplication().exit(); } catch (e) {}
    }

    function boot() {
        root = document.getElementById("app");
        Player.init();
        Keys.register();
        document.addEventListener("keydown", onKey, true);
        render();
        statusMsg = t("checking");
        render();
        Billing.check().then(function (res) {
            if (res && res.ok) afterSetupGate();
            else {
                screen = "paywall";
                render();
            }
        });
    }

    return { boot: boot };
})();

window.addEventListener("load", function () {
    App.boot();
});
