var Provider = (function () {
    function t() { return I18N.t.apply(I18N, arguments); }

    var MUSIC_RE = /m[uü]zik|music|radio|radyo|\bfm\b|hits|lounge/i;

    function normalizeBase(url) {
        var u = (url || "").trim();
        if (!u) return "";
        if (!/^https?:\/\//i.test(u)) u = "http://" + u;
        return u.replace(/\/+$/, "");
    }

    function itemKey(item) {
        return (item.kind || "x") + ":" + String(item.id);
    }

    function emptyCatalog() {
        return {
            live: [],
            liveCats: [],
            vod: [],
            vodCats: [],
            series: [],
            seriesCats: [],
            music: [],
            musicCats: [{ id: "all", name: t("all") }],
            fetchedAt: 0,
            liveReady: false,
            vodReady: false,
            seriesReady: false
        };
    }

    function buildIndex(items) {
        var map = { all: items || [] };
        var list = map.all;
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            var groups = it.groups;
            if (!groups || !groups.length) groups = [String(it.group || "")];
            for (var g = 0; g < groups.length; g++) {
                var id = String(groups[g] || "");
                if (!id || id === "all") continue;
                if (!map[id]) map[id] = [];
                map[id].push(it);
            }
        }
        return map;
    }

    function stripAll(cats) {
        var out = [];
        var src = cats || [];
        for (var i = 0; i < src.length; i++) {
            if (!src[i] || String(src[i].id) === "all") continue;
            out.push(src[i]);
        }
        return out;
    }

    function uniqueItems(list) {
        var seen = {};
        var out = [];
        var src = list || [];
        for (var i = 0; i < src.length; i++) {
            var it = src[i];
            var k = (it.kind || "x") + ":" + String(it.id);
            if (seen[k]) {
                var prev = seen[k];
                var g = it.groups || (it.group ? [it.group] : []);
                if (!prev.groups) prev.groups = prev.group ? [prev.group] : [];
                for (var j = 0; j < g.length; j++) {
                    if (g[j] && prev.groups.indexOf(g[j]) < 0) prev.groups.push(g[j]);
                }
                continue;
            }
            seen[k] = it;
            out.push(it);
        }
        return out;
    }

    function indexCatalog(c) {
        if (!c) c = emptyCatalog();
        c.live = uniqueItems(c.live);
        c.vod = uniqueItems(c.vod);
        c.series = uniqueItems(c.series);
        c.music = uniqueItems(c.music);
        c.liveCats = stripAll(c.liveCats);
        c.vodCats = stripAll(c.vodCats);
        c.seriesCats = stripAll(c.seriesCats);
        c.musicCats = stripAll(c.musicCats);
        c.liveByCat = buildIndex(c.live);
        c.vodByCat = buildIndex(c.vod);
        c.seriesByCat = buildIndex(c.series);
        c.musicByCat = buildIndex(c.music);
        return c;
    }

    function slimList(list, keepUrl) {
        var out = [];
        var src = list || [];
        for (var i = 0; i < src.length; i++) {
            var it = src[i];
            var row = {
                id: it.id,
                num: it.num,
                name: it.name,
                logo: it.logo,
                group: it.group,
                groups: it.groups,
                kind: it.kind,
                year: it.year,
                rating: it.rating,
                genre: it.genre,
                ext: it.ext,
                epgId: it.epgId,
                trailer: it.trailer,
                duration: it.duration,
                durationSecs: it.durationSecs
            };
            if (keepUrl) {
                row.url = it.url;
                row.urlTs = it.urlTs;
            }
            out.push(row);
        }
        return out;
    }

    function hydrate(c, p) {
        if (!c) return emptyCatalog();
        if (!p || p.type !== "xtream" || !p.base) return indexCatalog(c);
        function fillLive(list) {
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (it.url) continue;
                var fake = { stream_id: it.id };
                it.url = liveUrl(p, fake, "ts");
                it.urlTs = liveUrl(p, fake, "m3u8");
            }
        }
        function fillVod(list) {
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (it.url) continue;
                it.url = vodUrl(p, { stream_id: it.id, container_extension: it.ext || "mp4" });
            }
        }
        fillLive(c.live || []);
        fillLive(c.music || []);
        fillVod(c.vod || []);
        return indexCatalog(c);
    }

    function compactForStore(c, provider) {
        var keep = !(provider && provider.type === "xtream");
        return {
            live: slimList(c.live, keep),
            liveCats: c.liveCats,
            vod: slimList(c.vod, keep),
            vodCats: c.vodCats,
            series: slimList(c.series, true),
            seriesCats: c.seriesCats,
            music: slimList(c.music, keep),
            musicCats: c.musicCats,
            fetchedAt: c.fetchedAt,
            liveReady: c.liveReady,
            vodReady: c.vodReady,
            seriesReady: c.seriesReady
        };
    }

    function mapCats(list) {
        var cats = [];
        var src = list || [];
        for (var i = 0; i < src.length; i++) {
            var c = src[i];
            cats.push({ id: String(c.category_id), name: c.category_name || c.category_id });
        }
        return cats;
    }

    function groupIds(s) {
        var ids = s.category_ids;
        if (ids && ids.length) {
            var out = [];
            for (var i = 0; i < ids.length; i++) out.push(String(ids[i]));
            return out;
        }
        return [String(s.category_id || "")];
    }

    function isMusicName(name) {
        return MUSIC_RE.test(name || "");
    }

    function splitMusic(live, liveCats) {
        var musicCatIds = {};
        var musicCats = [{ id: "all", name: t("all") }];
        for (var i = 1; i < liveCats.length; i++) {
            if (isMusicName(liveCats[i].name)) {
                musicCatIds[liveCats[i].id] = 1;
                musicCats.push(liveCats[i]);
            }
        }
        if (musicCats.length === 1) {
            var music = [];
            for (var j = 0; j < live.length; j++) {
                if (isMusicName(live[j].name)) music.push(live[j]);
            }
            return { music: music, musicCats: musicCats, live: live, liveCats: liveCats };
        }
        var tv = [];
        var music = [];
        var tvCats = [{ id: "all", name: t("all") }];
        for (var k = 1; k < liveCats.length; k++) {
            if (!musicCatIds[liveCats[k].id]) tvCats.push(liveCats[k]);
        }
        for (var n = 0; n < live.length; n++) {
            var it = live[n];
            var inMusic = false;
            var gs = it.groups || [it.group];
            for (var x = 0; x < gs.length; x++) {
                if (musicCatIds[String(gs[x])]) { inMusic = true; break; }
            }
            if (inMusic) music.push(it);
            else tv.push(it);
        }
        return { music: music, musicCats: musicCats, live: tv, liveCats: tvCats };
    }

    function parseExtinf(line) {
        var meta = { name: "", logo: "", group: "", tvgId: "" };
        var comma = line.lastIndexOf(",");
        if (comma >= 0) meta.name = line.slice(comma + 1).trim();
        var attrs = line.slice(0, comma >= 0 ? comma : line.length);
        var re = /([a-zA-Z0-9-]+)\s*=\s*"([^"]*)"/g;
        var m;
        while ((m = re.exec(attrs))) {
            var k = m[1].toLowerCase();
            var v = m[2];
            if (k === "tvg-logo" || k === "logo") meta.logo = v;
            else if (k === "group-title") meta.group = v;
            else if (k === "tvg-id") meta.tvgId = v;
            else if (k === "tvg-name" && !meta.name) meta.name = v;
        }
        return meta;
    }

    function classifyM3U(url, group, name) {
        var u = (url || "").toLowerCase();
        if (u.indexOf("/movie/") !== -1 || u.indexOf("/movies/") !== -1) return "vod";
        if (u.indexOf("/series/") !== -1) return "series";
        if (u.indexOf("/live/") !== -1) return "live";
        var blob = ((group || "") + " " + (name || "")).toLowerCase();
        if (/s\d{1,2}\s*e\d{1,2}|sezon\s*\d/.test(blob)) return "series";
        if (/\b(film|movie|vod|sinema|4k)\b/.test(blob) && !/\b(tv|canl[iı]|live|haber|spor)\b/.test(blob)) return "vod";
        return "live";
    }

    function catsFromGroups(items) {
        var seen = {};
        var cats = [];
        for (var i = 0; i < items.length; i++) {
            var g = items[i].group || "";
            if (!g || g === "all" || seen[g]) continue;
            seen[g] = 1;
            cats.push({ id: g, name: g });
        }
        return cats;
    }

    function parseM3U(text) {
        var lines = text.split(/\r?\n/);
        var buckets = { live: [], vod: [], series: [] };
        var pending = null;
        var n = 0;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            if (line.indexOf("#EXTINF") === 0) {
                pending = parseExtinf(line);
            } else if (line.charAt(0) !== "#") {
                var info = pending || { name: line, logo: "", group: "" };
                var group = info.group || t("all");
                var kind = classifyM3U(line, group, info.name);
                if (!buckets[kind]) kind = "live";
                n += 1;
                buckets[kind].push({
                    id: String(n),
                    num: n,
                    name: info.name || ("Stream " + n),
                    logo: info.logo,
                    group: group,
                    groups: [group],
                    url: line,
                    kind: kind,
                    tvgId: info.tvgId || ""
                });
                pending = null;
            }
        }
        var catalog = emptyCatalog();
        catalog.live = buckets.live;
        catalog.vod = buckets.vod;
        catalog.series = buckets.series;
        catalog.liveCats = catsFromGroups(catalog.live);
        catalog.vodCats = catsFromGroups(catalog.vod);
        catalog.seriesCats = catsFromGroups(catalog.series);
        catalog.fetchedAt = Date.now();
        catalog.liveReady = true;
        catalog.vodReady = true;
        catalog.seriesReady = true;
        return indexCatalog(catalog);
    }

    function xtreamApi(p, action, extra) {
        var url = p.base + "/player_api.php?username=" + encodeURIComponent(p.username) +
            "&password=" + encodeURIComponent(p.password);
        if (action) url += "&action=" + encodeURIComponent(action);
        if (extra) {
            var keys = Object.keys(extra);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                url += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(extra[k]);
            }
        }
        return Http.json(url, action && action.indexOf("get_") === 0 ? 60000 : 20000);
    }

    function liveUrl(p, stream, ext) {
        return p.base + "/live/" + encodeURIComponent(p.username) + "/" +
            encodeURIComponent(p.password) + "/" + stream.stream_id + "." + (ext || "ts");
    }

    function vodUrl(p, stream) {
        var ext = stream.container_extension || "mp4";
        return p.base + "/movie/" + encodeURIComponent(p.username) + "/" +
            encodeURIComponent(p.password) + "/" + stream.stream_id + "." + ext;
    }

    function seriesUrl(p, episode) {
        var ext = episode.container_extension || "mp4";
        return p.base + "/series/" + encodeURIComponent(p.username) + "/" +
            encodeURIComponent(p.password) + "/" + episode.id + "." + ext;
    }

    function emit(hooks, catalog, stage) {
        if (hooks && hooks.onProgress) hooks.onProgress(catalog, stage);
    }

    function loadLive(p) {
        return Promise.all([
            xtreamApi(p, "get_live_categories").catch(function () { return []; }),
            xtreamApi(p, "get_live_streams").catch(function () { return []; })
        ]).then(function (parts) {
            var rawCats = parts[0] || [];
            var streams = parts[1] || [];
            var live = [];
            for (var i = 0; i < streams.length; i++) {
                var s = streams[i];
                var gids = groupIds(s);
                live.push({
                    id: String(s.stream_id),
                    num: s.num || (i + 1),
                    name: s.name,
                    logo: s.stream_icon || "",
                    group: gids[0] || "",
                    groups: gids,
                    url: liveUrl(p, s, "ts"),
                    urlTs: liveUrl(p, s, "m3u8"),
                    kind: "live",
                    epgId: s.epg_channel_id || ""
                });
            }
            var split = { live: live, liveCats: mapCats(rawCats) };
            return split;
        });
    }

    function loadVod(p) {
        return Promise.all([
            xtreamApi(p, "get_vod_categories").catch(function () { return []; }),
            xtreamApi(p, "get_vod_streams").catch(function () { return []; })
        ]).then(function (parts) {
            var streams = parts[1] || [];
            var vod = [];
            for (var i = 0; i < streams.length; i++) {
                var s = streams[i];
                var gids = groupIds(s);
                vod.push({
                    id: String(s.stream_id),
                    name: s.name,
                    logo: s.stream_icon || "",
                    group: gids[0] || "",
                    groups: gids,
                    url: vodUrl(p, s),
                    kind: "vod",
                    year: s.year || "",
                    rating: s.rating || "",
                    genre: s.genre || "",
                    ext: s.container_extension || "mp4",
                    trailer: youtubeId(s.youtube_trailer),
                    duration: s.episode_run_time || s.duration || "",
                    durationSecs: s.duration_secs || ""
                });
            }
            return { vod: vod, vodCats: mapCats(parts[0]) };
        });
    }

    function loadSeries(p) {
        return Promise.all([
            xtreamApi(p, "get_series_categories").catch(function () { return []; }),
            xtreamApi(p, "get_series").catch(function () { return []; })
        ]).then(function (parts) {
            var streams = parts[1] || [];
            var series = [];
            for (var i = 0; i < streams.length; i++) {
                var s = streams[i];
                var gids = groupIds(s);
                series.push({
                    id: String(s.series_id),
                    name: s.name,
                    logo: s.cover || s.stream_icon || "",
                    group: gids[0] || "",
                    groups: gids,
                    kind: "series",
                    year: s.year || "",
                    rating: s.rating || "",
                    genre: s.genre || "",
                    trailer: youtubeId(s.youtube_trailer)
                });
            }
            return { series: series, seriesCats: mapCats(parts[0]) };
        });
    }

    function loadXtream(p, hooks) {
        return xtreamApi(p).then(function (auth) {
            if (!auth || !auth.user_info || Number(auth.user_info.auth) !== 1) {
                throw new Error("auth");
            }
            var catalog = emptyCatalog();
            emit(hooks, catalog, "loading-live");
            return loadLive(p).then(function (livePart) {
                catalog.live = livePart.live;
                catalog.liveCats = livePart.liveCats;
                catalog.liveReady = true;
                catalog.fetchedAt = Date.now();
                indexCatalog(catalog);
                emit(hooks, catalog, "live");
                emit(hooks, catalog, "loading-vod");
                return loadVod(p).then(function (vodPart) {
                    catalog.vod = vodPart.vod;
                    catalog.vodCats = vodPart.vodCats;
                    catalog.vodReady = true;
                    indexCatalog(catalog);
                    emit(hooks, catalog, "vod");
                    emit(hooks, catalog, "loading-series");
                    return loadSeries(p).then(function (serPart) {
                        catalog.series = serPart.series;
                        catalog.seriesCats = serPart.seriesCats;
                        catalog.seriesReady = true;
                        catalog.fetchedAt = Date.now();
                        indexCatalog(catalog);
                        emit(hooks, catalog, "series");
                        return catalog;
                    }).catch(function () {
                        catalog.seriesReady = true;
                        emit(hooks, catalog, "series");
                        return catalog;
                    });
                }).catch(function () {
                    catalog.vodReady = true;
                    emit(hooks, catalog, "loading-series");
                    return loadSeries(p).then(function (serPart) {
                        catalog.series = serPart.series;
                        catalog.seriesCats = serPart.seriesCats;
                        catalog.seriesReady = true;
                        indexCatalog(catalog);
                        emit(hooks, catalog, "series");
                        return catalog;
                    }).catch(function () {
                        catalog.seriesReady = true;
                        emit(hooks, catalog, "series");
                        return catalog;
                    });
                });
            });
        });
    }

    function connect(form, hooks) {
        if (form.type === "xtream") {
            var p = {
                type: "xtream",
                base: normalizeBase(form.server),
                username: (form.username || "").trim(),
                password: form.password || "",
                label: (form.username || "").trim()
            };
            return loadXtream(p, hooks).then(function (catalog) {
                return { provider: p, catalog: catalog };
            });
        }
        var m3u = {
            type: "m3u",
            playlist: (form.playlist || "").trim(),
            epg: (form.epg || "").trim(),
            label: "M3U"
        };
        return Http.request(m3u.playlist, 60000).then(function (text) {
            if (!text || text.indexOf("#EXT") === -1 && text.indexOf("http") === -1) {
                throw new Error("playlist");
            }
            var catalog = parseM3U(text);
            if (hooks && hooks.onProgress) hooks.onProgress(catalog, "live");
            return { provider: m3u, catalog: catalog };
        });
    }

    function refresh(provider, hooks) {
        if (provider.type === "xtream") return loadXtream(provider, hooks);
        return Http.request(provider.playlist, 60000).then(parseM3U);
    }

    function youtubeId(raw) {
        if (!raw) return "";
        var s = String(raw).trim();
        if (!s || /^(none|null|undefined|false|0|n\/a|na)$/i.test(s)) return "";
        var m = s.match(/(?:v=|youtu\.be\/|embed\/|\/shorts\/)([A-Za-z0-9_-]{6,20})/);
        if (m) return m[1];
        if (/^[A-Za-z0-9_-]{6,20}$/.test(s)) return s;
        return "";
    }

    function stripYear(s) {
        return String(s || "").replace(/\s*\(\d{4}\)\s*$/, "").replace(/^\s+|\s+$/g, "");
    }

    function pickYear(info, fallback) {
        var y = String((info && (info.year || info.releaseDate || info.release_date)) || fallback || "");
        var m = y.match(/(19|20)\d{2}/);
        return m ? m[0] : "";
    }

    function cleanEpisodeTitle(title, info, num) {
        var raw = String(title || "").replace(/^\s+|\s+$/g, "");
        var fallback = t("episode") + " " + (num || "");
        if (!raw) return fallback;
        var aliases = [];
        function addAlias(v) {
            v = stripYear(v);
            if (v && aliases.indexOf(v) < 0) aliases.push(v);
        }
        addAlias(info && info.name);
        addAlias(info && info.title);
        var parts = raw.split(/\s+-\s+/);
        var keep = [];
        for (var i = 0; i < parts.length; i++) {
            var p = stripYear(parts[i]);
            if (!p) continue;
            if (/^S\d{1,2}E\d{1,3}$/i.test(p) || /^E\d{1,3}$/i.test(p)) continue;
            var skip = false;
            for (var a = 0; a < aliases.length; a++) {
                if (p === aliases[a]) { skip = true; break; }
                if (aliases[a].length >= 8 && p.indexOf(aliases[a]) >= 0) { skip = true; break; }
                if (p.length >= 8 && aliases[a].indexOf(p) >= 0) { skip = true; break; }
            }
            if (!skip) keep.push(p);
        }
        if (keep.length) return keep[keep.length - 1];
        var last = stripYear(parts[parts.length - 1] || "");
        if (last && last.length < 42) return last;
        return fallback;
    }

    function firstRunTime(v) {
        if (v == null || v === "") return 0;
        if (typeof v === "number") return v > 0 && v < 500 ? Math.round(v) : 0;
        if (Object.prototype.toString.call(v) === "[object Array]") v = v[0];
        var s = String(v).split(/[,\s/]+/)[0];
        var n = parseInt(s, 10);
        return n > 0 && n < 500 ? n : 0;
    }

    function parseDurationMins(s, secs) {
        var rawSecs = String(secs == null ? "" : secs).replace(/^\s+|\s+$/g, "");
        if (/^\d+(\.\d+)?$/.test(rawSecs)) {
            var n = parseFloat(rawSecs);
            if (n >= 300) return Math.round(n / 60);
            if (n > 0 && n < 500) return Math.round(n);
        }
        if (s == null || s === "") return 0;
        if (typeof s === "number") {
            if (s > 1000) return Math.round(s / 60);
            return s > 0 ? Math.round(s) : 0;
        }
        var str = String(s).trim().toLowerCase().replace(",", ".");
        if (!str || /^(0+|0:0+|00:00(:00)?|n\/a|none|null|undefined|false)$/i.test(str)) return 0;
        var colon = str.split(":");
        if (colon.length >= 3 && /^\d+$/.test(colon[0]) && /^\d+$/.test(colon[1])) {
            return parseInt(colon[0], 10) * 60 + parseInt(colon[1], 10) +
                (parseInt(colon[2], 10) >= 30 ? 1 : 0);
        }
        if (colon.length === 2 && /^\d+$/.test(colon[0]) && /^\d+$/.test(colon[1])) {
            var a = parseInt(colon[0], 10);
            var b = parseInt(colon[1], 10);
            if (a >= 3) return a;
            return a * 60 + b;
        }
        var hm = str.match(/(\d+)\s*(?:saat|sa|h|hr|hrs|hours?)\s*(\d+)?/);
        if (hm) return parseInt(hm[1], 10) * 60 + (hm[2] ? parseInt(hm[2], 10) : 0);
        var mins = str.match(/(\d+(?:\.\d+)?)\s*(?:dakika|dk|min|mins|minutes?)/);
        if (mins) return Math.round(parseFloat(mins[1]));
        if (/^\d+$/.test(str)) {
            var num = parseInt(str, 10);
            if (num >= 300 && num < 20000) return Math.round(num / 60);
            if (num > 0 && num < 500) return num;
        }
        return 0;
    }

    function asInfo(raw) {
        if (!raw) return {};
        if (typeof raw === "object") return raw;
        try { return JSON.parse(String(raw)); } catch (e) { return {}; }
    }

    function pickEpisodeTiming(ep, extra) {
        extra = asInfo(extra);
        var video = asInfo(extra.video);
        var cands = [
            extra.duration_secs, extra.duration_sec, extra.durationSecs,
            ep.duration_secs, extra.runtime, extra.time, extra.duration,
            ep.duration, extra.episode_run_time, video.duration
        ];
        for (var i = 0; i < cands.length; i++) {
            var v = cands[i];
            if (v == null || v === "") continue;
            var mins = parseDurationMins(v, v);
            if (mins > 0) return { duration: mins + " dk", durationSecs: String(mins * 60) };
        }
        return { duration: "", durationSecs: "" };
    }

    function normalizeSeriesInfo(inf) {
        inf = inf || {};
        var run = firstRunTime(inf.episode_run_time);
        var back = inf.backdrop_path;
        if (back && back[0]) back = back[0];
        else back = "";
        var title = stripYear(inf.title || inf.name || "");
        return {
            name: title,
            oName: inf.o_name || "",
            plot: inf.plot || inf.overview || "",
            genre: inf.genre || "",
            director: inf.director || "",
            cast: inf.cast || inf.actors || "",
            rating: inf.rating || "",
            rating5: inf.rating_5based || "",
            year: pickYear(inf, ""),
            cover: inf.cover || inf.cover_big || "",
            backdrop: back || inf.cover || "",
            duration: run > 0 ? (run + " dk") : "",
            durationSecs: "",
            country: inf.country || "",
            age: inf.age || "",
            trailer: youtubeId(inf.youtube_trailer)
        };
    }

    function seriesInfo(provider, seriesId) {
        if (provider.type !== "xtream") return Promise.resolve(null);
        return xtreamApi(provider, "get_series_info", { series_id: seriesId }).then(function (data) {
            var inf = data.info || {};
            var seasonMeta = {};
            var apiSeasons = data.seasons || [];
            for (var s = 0; s < apiSeasons.length; s++) {
                var sm = apiSeasons[s] || {};
                var sn = String(sm.season_number != null ? sm.season_number : sm.id || "");
                if (!sn) continue;
                seasonMeta[sn] = sm;
            }
            var seriesRun = firstRunTime(inf.episode_run_time);
            var seasons = [];
            var episodes = data.episodes || {};
            var keys = Object.keys(episodes).sort(function (a, b) { return Number(a) - Number(b); });
            var anyDur = "";
            var anySecs = "";
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var raw = episodes[key] || [];
                var meta = seasonMeta[key] || {};
                var eps = [];
                for (var e = 0; e < raw.length; e++) {
                    var ep = raw[e] || {};
                    var extra = asInfo(ep.info);
                    var num = ep.episode_num || (e + 1);
                    var timing = pickEpisodeTiming(ep, extra);
                    if (timing.duration) {
                        anyDur = anyDur || timing.duration;
                        anySecs = anySecs || timing.durationSecs;
                    }
                    eps.push({
                        id: String(ep.id),
                        name: cleanEpisodeTitle(ep.title, inf, num),
                        num: num,
                        season: key,
                        seriesName: stripYear(inf.title || inf.name || ""),
                        url: seriesUrl(provider, ep),
                        kind: "episode",
                        logo: extra.movie_image || extra.cover_big || "",
                        plot: extra.plot || "",
                        duration: timing.duration,
                        durationSecs: timing.durationSecs
                    });
                }
                var label = meta.name || (t("seasons") + " " + key);
                seasons.push({
                    id: key,
                    name: label,
                    count: meta.episode_count || eps.length,
                    episodes: eps
                });
            }
            var fallbackDur = anyDur || (seriesRun > 0 ? (seriesRun + " dk") : "");
            var fallbackSecs = anySecs;
            for (var si = 0; si < seasons.length; si++) {
                var list = seasons[si].episodes || [];
                for (var ei = 0; ei < list.length; ei++) {
                    if (!list[ei].duration && !list[ei].durationSecs) {
                        list[ei].duration = fallbackDur;
                        list[ei].durationSecs = fallbackSecs;
                    }
                }
            }
            return { info: normalizeSeriesInfo(inf), seasons: seasons };
        });
    }

    function parseVideoSize(info) {
        var v = info && info.video;
        if (!v) return { w: 0, h: 0 };
        if (typeof v === "string") {
            try { v = JSON.parse(v); } catch (e) { return { w: 0, h: 0 }; }
        }
        return {
            w: parseInt(v.width, 10) || 0,
            h: parseInt(v.height, 10) || 0
        };
    }

    function vodInfo(provider, vodId) {
        if (provider.type !== "xtream") return Promise.resolve(null);
        return xtreamApi(provider, "get_vod_info", { vod_id: vodId }).then(function (data) {
            var info = data.info || {};
            var md = data.movie_data || {};
            var size = parseVideoSize(info);
            return {
                name: info.name || md.name || md.title || "",
                oName: info.o_name || "",
                plot: info.plot || info.description || "",
                genre: info.genre || "",
                director: info.director || "",
                cast: info.cast || info.actors || "",
                duration: info.duration || info.duration_secs || md.duration || "",
                durationSecs: info.duration_secs || md.duration_secs || "",
                rating: info.rating || md.rating || "",
                rating5: info.rating_5based || md.rating_5based || "",
                year: md.year || String(info.release_date || info.releasedate || "").slice(0, 4),
                cover: info.movie_image || info.cover_big || "",
                backdrop: (info.backdrop_path && info.backdrop_path[0]) || info.cover_big || "",
                age: info.age || info.mpaa_rating || "",
                country: info.country || "",
                videoWidth: size.w,
                videoHeight: size.h,
                trailer: youtubeId(info.youtube_trailer || md.youtube_trailer)
            };
        });
    }

    function shortEpg(provider, streamId) {
        if (provider.type !== "xtream") return Promise.resolve("");
        return xtreamApi(provider, "get_short_epg", { stream_id: streamId, limit: 1 }).then(function (data) {
            var list = (data && (data.epg_listings || data)) || [];
            if (!list.length) return "";
            var title = list[0].title || list[0].name || "";
            try { title = decodeURIComponent(escape(atob(title))); } catch (e) {}
            return title;
        }).catch(function () { return ""; });
    }

    function filterItems(index, categoryId, query) {
        var list = (index && index[categoryId || "all"]) || (index && index.all) || [];
        if (!query) return list;
        var q = query.toLowerCase();
        var out = [];
        for (var i = 0; i < list.length; i++) {
            if ((list[i].name || "").toLowerCase().indexOf(q) !== -1) out.push(list[i]);
        }
        return out;
    }

    function defaultForm() {
        var d = CONFIG.DEFAULT_XTREAM || {};
        return {
            type: "xtream",
            server: d.server || "",
            username: d.username || "",
            password: d.password || ""
        };
    }

    return {
        connect: connect,
        refresh: refresh,
        seriesInfo: seriesInfo,
        vodInfo: vodInfo,
        shortEpg: shortEpg,
        filterItems: filterItems,
        itemKey: itemKey,
        indexCatalog: indexCatalog,
        compactForStore: compactForStore,
        hydrate: hydrate,
        emptyCatalog: emptyCatalog,
        defaultForm: defaultForm,
        youtubeId: youtubeId
    };
})();
