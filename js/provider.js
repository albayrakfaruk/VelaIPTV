var Provider = (function () {
    function t() { return I18N.t.apply(I18N, arguments); }

    function normalizeBase(url) {
        var u = (url || "").trim();
        if (!u) return "";
        if (!/^https?:\/\//i.test(u)) u = "http://" + u;
        return u.replace(/\/+$/, "");
    }

    function itemKey(item) {
        return (item.kind || "x") + ":" + String(item.id);
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

    function parseM3U(text) {
        var lines = text.split(/\r?\n/);
        var live = [];
        var groups = {};
        var pending = null;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            if (line.indexOf("#EXTINF") === 0) {
                pending = parseExtinf(line);
            } else if (line.charAt(0) !== "#") {
                var info = pending || { name: line, logo: "", group: "" };
                var group = info.group || t("all");
                if (!groups[group]) groups[group] = 1;
                live.push({
                    id: String(live.length + 1),
                    name: info.name || ("Stream " + (live.length + 1)),
                    logo: info.logo,
                    group: group,
                    url: line,
                    kind: "live",
                    tvgId: info.tvgId || ""
                });
                pending = null;
            }
        }
        var cats = [{ id: "all", name: t("all") }];
        Object.keys(groups).sort().forEach(function (g) {
            cats.push({ id: g, name: g });
        });
        return {
            live: live,
            liveCats: cats,
            vod: [],
            vodCats: [{ id: "all", name: t("all") }],
            series: [],
            seriesCats: [{ id: "all", name: t("all") }],
            fetchedAt: Date.now()
        };
    }

    function xtreamApi(p, action, extra) {
        var url = p.base + "/player_api.php?username=" + encodeURIComponent(p.username) +
            "&password=" + encodeURIComponent(p.password);
        if (action) url += "&action=" + encodeURIComponent(action);
        if (extra) {
            Object.keys(extra).forEach(function (k) {
                url += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(extra[k]);
            });
        }
        return Http.json(url, 30000);
    }

    function liveUrl(p, stream, ext) {
        return p.base + "/live/" + encodeURIComponent(p.username) + "/" +
            encodeURIComponent(p.password) + "/" + stream.stream_id + "." + (ext || "m3u8");
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

    function mapCats(list) {
        var cats = [{ id: "all", name: t("all") }];
        (list || []).forEach(function (c) {
            cats.push({ id: String(c.category_id), name: c.category_name || c.category_id });
        });
        return cats;
    }

    function loadXtream(p) {
        return xtreamApi(p).then(function (auth) {
            if (!auth || !auth.user_info || Number(auth.user_info.auth) !== 1) {
                throw new Error("auth");
            }
            var proto = (auth.server_info && auth.server_info.server_protocol) || "http";
            var host = auth.server_info && auth.server_info.url;
            var port = auth.server_info && (auth.server_info.port || auth.server_info.https_port);
            if (host) {
                p.base = normalizeBase(proto + "://" + host + (port ? ":" + port : ""));
            }
            return Promise.all([
                xtreamApi(p, "get_live_categories").catch(function () { return []; }),
                xtreamApi(p, "get_live_streams").catch(function () { return []; }),
                xtreamApi(p, "get_vod_categories").catch(function () { return []; }),
                xtreamApi(p, "get_vod_streams").catch(function () { return []; }),
                xtreamApi(p, "get_series_categories").catch(function () { return []; }),
                xtreamApi(p, "get_series").catch(function () { return []; })
            ]).then(function (parts) {
                var live = (parts[1] || []).map(function (s) {
                    return {
                        id: String(s.stream_id),
                        name: s.name,
                        logo: s.stream_icon || "",
                        group: String(s.category_id || ""),
                        url: liveUrl(p, s, "m3u8"),
                        urlTs: liveUrl(p, s, "ts"),
                        kind: "live",
                        epgId: s.epg_channel_id || ""
                    };
                });
                var vod = (parts[3] || []).map(function (s) {
                    return {
                        id: String(s.stream_id),
                        name: s.name,
                        logo: s.stream_icon || "",
                        group: String(s.category_id || ""),
                        url: vodUrl(p, s),
                        kind: "vod",
                        plot: s.plot || "",
                        year: s.year || ""
                    };
                });
                var series = (parts[5] || []).map(function (s) {
                    return {
                        id: String(s.series_id),
                        name: s.name,
                        logo: s.cover || s.stream_icon || "",
                        group: String(s.category_id || ""),
                        kind: "series",
                        plot: s.plot || ""
                    };
                });
                return {
                    live: live,
                    liveCats: mapCats(parts[0]),
                    vod: vod,
                    vodCats: mapCats(parts[2]),
                    series: series,
                    seriesCats: mapCats(parts[4]),
                    fetchedAt: Date.now()
                };
            });
        });
    }

    function connect(form) {
        if (form.type === "xtream") {
            var p = {
                type: "xtream",
                base: normalizeBase(form.server),
                username: (form.username || "").trim(),
                password: form.password || "",
                label: (form.username || "").trim()
            };
            return loadXtream(p).then(function (catalog) {
                return { provider: p, catalog: catalog };
            });
        }
        var m3u = {
            type: "m3u",
            playlist: (form.playlist || "").trim(),
            epg: (form.epg || "").trim(),
            label: "M3U"
        };
        return Http.request(m3u.playlist, 40000).then(function (text) {
            if (!text || text.indexOf("#EXT") === -1 && text.indexOf("http") === -1) {
                throw new Error("playlist");
            }
            return { provider: m3u, catalog: parseM3U(text) };
        });
    }

    function refresh(provider) {
        if (provider.type === "xtream") return loadXtream(provider);
        return Http.request(provider.playlist, 40000).then(parseM3U);
    }

    function seriesInfo(provider, seriesId) {
        if (provider.type !== "xtream") return Promise.resolve(null);
        return xtreamApi(provider, "get_series_info", { series_id: seriesId }).then(function (info) {
            var seasons = [];
            var episodes = info.episodes || {};
            Object.keys(episodes).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (sn) {
                var eps = (episodes[sn] || []).map(function (ep) {
                    return {
                        id: String(ep.id),
                        name: ep.title || ("E" + ep.episode_num),
                        num: ep.episode_num,
                        season: sn,
                        url: seriesUrl(provider, ep),
                        kind: "episode",
                        logo: (info.info && info.info.cover) || ""
                    };
                });
                seasons.push({ id: sn, name: t("seasons") + " " + sn, episodes: eps });
            });
            return { info: info.info || {}, seasons: seasons };
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

    function filterItems(items, categoryId, query) {
        var q = (query || "").toLowerCase();
        return (items || []).filter(function (it) {
            if (categoryId && categoryId !== "all" && String(it.group) !== String(categoryId)) return false;
            if (q && (it.name || "").toLowerCase().indexOf(q) === -1) return false;
            return true;
        });
    }

    return {
        connect: connect,
        refresh: refresh,
        seriesInfo: seriesInfo,
        shortEpg: shortEpg,
        filterItems: filterItems,
        itemKey: itemKey
    };
})();
