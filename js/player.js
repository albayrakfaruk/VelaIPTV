var Player = (function () {
    var av = null;
    var video = null;
    var subEl = null;
    var usingAv = false;
    var current = null;
    var listenerBound = false;
    var timeTimer = null;
    var subHideTimer = null;
    var onTime = null;
    var onEnd = null;
    var onError = null;
    var onSub = null;
    var onBuffer = null;
    var onTracks = null;
    var hls = null;
    var msePlayer = null;
    var textTracks = [];
    var audioTracks = [];
    var subIndex = -1;
    var audioIndex = 0;
    var audioBound = false;
    var audioUserPicked = false;
    var probedAudio = [];
    var probedText = [];
    var probeStarted = false;
    var probeDone = false;
    var subEnabled = false;
    var openToken = 0;
    var liveMode = false;
    var paused = false;
    var userPaused = false;
    var startAtMs = 0;
    var startHold = false;
    var htmlRaw = "";
    var remuxing = false;
    var remuxOffsetMs = 0;
    var playSpeed = 1;
    var ASPECTS = ["fit", "fill", "43", "stretch"];
    var SPEEDS = [0.75, 1, 1.25, 1.5, 2];
    var LANG_NAMES = {
        tur: "Türkçe", tr: "Türkçe", turkish: "Türkçe", turkce: "Türkçe",
        eng: "English", en: "English", english: "English",
        deu: "Deutsch", ger: "Deutsch", de: "Deutsch",
        fra: "Français", fre: "Français", fr: "Français",
        spa: "Español", es: "Español",
        ita: "Italiano", it: "Italiano",
        por: "Português", pt: "Português",
        rus: "Русский", ru: "Русский",
        ara: "العربية", ar: "العربية",
        nld: "Nederlands", dut: "Nederlands", nl: "Nederlands",
        pol: "Polski", pl: "Polski",
        hun: "Magyar", hu: "Magyar",
        ces: "Čeština", cze: "Čeština", cs: "Čeština",
        ron: "Română", rum: "Română", ro: "Română",
        bul: "Български", bg: "Български",
        ell: "Ελληνικά", gre: "Ελληνικά", el: "Ελληνικά",
        swe: "Svenska", sv: "Svenska",
        nor: "Norsk", no: "Norsk",
        dan: "Dansk", da: "Dansk",
        fin: "Suomi", fi: "Suomi",
        ukr: "Українська", uk: "Українська",
        hin: "हिन्दी", hi: "हिन्दी",
        zho: "中文", chi: "中文", zh: "中文",
        jpn: "日本語", ja: "日本語",
        kor: "한국어", ko: "한국어",
        "türkçe": "Türkçe", ingilizce: "English"
    };

    function loadScript(src, cb) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = function () { cb(true); };
        s.onerror = function () { cb(false); };
        document.head.appendChild(s);
    }

    function isLiveItem(item) {
        return !!(item && item.kind === "live");
    }

    function destroyHtmlPlayers() {
        if (hls) {
            try { hls.destroy(); } catch (e) {}
            hls = null;
        }
        if (msePlayer) {
            try {
                msePlayer.pause();
                msePlayer.unload();
                msePlayer.detachMediaElement();
                msePlayer.destroy();
            } catch (e2) {}
            msePlayer = null;
        }
        if (video) {
            video.onwaiting = null;
            video.onplaying = null;
            video.onstalled = null;
            video.oncanplay = null;
            video.onpause = null;
            video.onplay = null;
        }
    }

    function hasAvplay() {
        return !!(window.webapis && webapis.avplay && typeof webapis.avplay.open === "function");
    }

    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
    }

    function clearTimer() {
        if (timeTimer) {
            clearInterval(timeTimer);
            timeTimer = null;
        }
        clearSubTimer();
    }

    function clearSubTimer() {
        if (subHideTimer) {
            clearTimeout(subHideTimer);
            subHideTimer = null;
        }
    }

    function subTextOf(text) {
        if (text == null) return "";
        if (typeof text === "object") {
            if (typeof text.length === "number") {
                var parts = [];
                for (var i = 0; i < text.length; i++) {
                    if (text[i]) parts.push(String(text[i]));
                }
                return parts.join("\n");
            }
            return String(text.text || text.data || "");
        }
        return String(text);
    }

    function subHoldMs(text, duration) {
        var d = Number(duration);
        if (isFinite(d) && d > 0) {
            if (d < 100) d = d * 1000;
            return Math.min(12000, d);
        }
        var n = String(text || "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
        return Math.min(8000, Math.max(2500, 900 + n * 380));
    }

    function emitBuffer(on) {
        if (onBuffer) onBuffer(!!on);
    }

    function emitAvTime(t) {
        if (!onTime || !usingAv) return;
        var cur = t;
        var dur = 0;
        try {
            if (cur == null || cur < 0) cur = webapis.avplay.getCurrentTime();
        } catch (e) { cur = t || 0; }
        try { if (!liveMode) dur = webapis.avplay.getDuration(); } catch (e2) {}
        if (startHold && startAtMs > 1500) {
            var real = 0;
            try { real = webapis.avplay.getCurrentTime(); } catch (e3) {}
            if (real > 1500 && (real + 2500 >= startAtMs || real > startAtMs)) {
                startHold = false;
                cur = real;
            } else {
                cur = startAtMs;
            }
        }
        onTime(cur || 0, dur);
    }

    function tick() {
        if (!onTime) return;
        try {
            if (usingAv) {
                emitAvTime();
            } else if (video) {
                var cur = (video.currentTime || 0) * 1000;
                var dur = video.duration;
                if (!isFinite(dur) || liveMode) dur = 0;
                else dur = dur * 1000;
                if (remuxing) {
                    cur += remuxOffsetMs;
                    if (dur) dur += remuxOffsetMs;
                }
                onTime(cur, dur);
            }
        } catch (e) {}
    }

    function subSizeClass() {
        var s = "medium";
        try { s = Store.settings().subtitleSize || "medium"; } catch (e) {}
        return "sub-layer sub-" + s;
    }

    function showSub(text, duration) {
        if (!subEl) return;
        clearSubTimer();
        var body = subTextOf(text)
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]+>/g, " ")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        if (!subEnabled || !body) {
            subEl.className = "sub-layer";
            subEl.innerHTML = "";
            return;
        }
        subEl.className = subSizeClass();
        subEl.innerHTML = "<span>" + esc(body).replace(/\n/g, "<br/>") + "</span>";
        subHideTimer = setTimeout(function () {
            subHideTimer = null;
            if (subEl) {
                subEl.className = "sub-layer";
                subEl.innerHTML = "";
            }
        }, subHoldMs(body, duration));
    }

    function clearSub() {
        showSub("");
    }

    function paintHtmlCues() {
        if (usingAv || !video || !video.textTracks) return;
        if (!subEnabled || subIndex < 0) {
            clearSub();
            return;
        }
        var track = video.textTracks[subIndex];
        if (!track || !track.activeCues || !track.activeCues.length) {
            clearSub();
            return;
        }
        var lines = [];
        var remainMs = 0;
        var now = video.currentTime || 0;
        for (var i = 0; i < track.activeCues.length; i++) {
            var cue = track.activeCues[i];
            if (cue && cue.text) lines.push(cue.text);
            if (cue && isFinite(cue.endTime)) {
                remainMs = Math.max(remainMs, (cue.endTime - now) * 1000);
            }
        }
        if (!lines.length) clearSub();
        else showSub(lines.join("\n"), remainMs > 200 ? remainMs : undefined);
    }

    function bindHtmlCues() {
        if (usingAv || !video || !video.textTracks) return;
        for (var i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].oncuechange = paintHtmlCues;
        }
    }

    function parseExtra(extra) {
        if (!extra) return {};
        if (typeof extra === "object") {
            var norm = {};
            for (var k in extra) {
                if (Object.prototype.hasOwnProperty.call(extra, k)) {
                    norm[String(k).toLowerCase()] = extra[k];
                }
            }
            return norm;
        }
        var s = String(extra);
        try { return parseExtra(JSON.parse(s)); } catch (e) {}
        var out = {};
        var parts = s.split(/[\s&;,]+/);
        for (var i = 0; i < parts.length; i++) {
            if (!parts[i]) continue;
            var kv = parts[i].split("=");
            if (kv.length >= 2) out[kv[0].trim().toLowerCase()] = kv.slice(1).join("=").trim();
        }
        var scraped = scrapeLang(s);
        if (scraped && !out.track_lang && !out.language && !out.lang) out.track_lang = scraped;
        if (!Object.keys(out).length && s) out.label = s;
        return out;
    }

    function scrapeLang(s) {
        if (s && typeof s === "object") {
            try { s = JSON.stringify(s); } catch (e) { s = ""; }
        }
        s = String(s || "");
        if (!s) return "";
        var m = s.match(/(?:track_lang|subtitle_lang|language_code|lang_code|language|lang)\s*[:=]\s*["']?([a-z]{2,3})(?![a-z])/i);
        if (m) {
            var c = m[1].toLowerCase();
            if (c !== "und" && c !== "mul") return c;
        }
        m = s.match(/\(([a-z]{2,3})\)/i);
        if (m && LANG_NAMES[m[1].toLowerCase()]) return m[1].toLowerCase();
        m = s.match(/\b(eng|tur|fra|deu|ger|spa|ita|por|rus|ara|nld|pol|hun|ces|ron|bul|ell|swe|nor|dan|fin|ukr|hin|zho|jpn|kor|gre|dut|fre|chi|en|tr|de|fr|es|it|pt|ru|ar|nl|pl|hu)\b/i);
        if (m) return m[1].toLowerCase();
        if (/ingilizce|\benglish\b/i.test(s)) return "eng";
        if (/türkçe|turkce|\bturkish\b/i.test(s)) return "tur";
        var t = s.replace(/^\s+|\s+$/g, "");
        if (/^[a-z]{2,3}$/i.test(t) && LANG_NAMES[t.toLowerCase()]) return t.toLowerCase();
        return "";
    }

    function langCode(info, fallback) {
        var raw = (info && (info.language || info.track_lang || info.lang || info.Language ||
            info.subtitle_lang || info.language_code || info.lang_code)) || "";
        raw = String(raw).trim();
        if (!raw) raw = scrapeLang(fallback);
        if (!raw) return "";
        var lower = raw.toLowerCase();
        if (lower === "und" || lower === "null" || lower === "undefined" || lower === "mul") return "";
        var bcp = lower.match(/^([a-z]{2,3})(?:[-_][a-z0-9]+)?$/);
        if (bcp) lower = bcp[1];
        if (LANG_NAMES[lower]) return lower;
        if (/^[a-z]{2,3}$/.test(lower)) return lower;
        return scrapeLang(raw);
    }

    function langName(code) {
        if (!code) return "";
        var c = String(code).toLowerCase();
        if (LANG_NAMES[c]) return LANG_NAMES[c];
        if (c.length === 2 && LANG_NAMES[c]) return LANG_NAMES[c];
        return "";
    }

    function channelTag(info) {
        var ch = Number((info && (info.channels || info.channel || info.num_channels)) || 0);
        if (ch >= 6) return "5.1";
        if (ch === 2) return "Stereo";
        if (ch === 1) return "Mono";
        return "";
    }

    function isChannelLabel(s) {
        s = String(s || "").replace(/^\s+|\s+$/g, "");
        if (!s) return true;
        return /^(?:[0-9]+\.[0-9]|5\.1|7\.1|2\.0|stereo|mono|surround)$/i.test(s);
    }

    function stripChannelFromName(s) {
        return String(s || "")
            .replace(/\s*[\(\[]?\s*(?:5\.1|7\.1|2\.0|stereo|mono|surround)\s*[\)\]]?\s*$/i, "")
            .replace(/^\s+|\s+$/g, "");
    }

    function cleanTrackName(s) {
        return String(s || "")
            .replace(/\s*\|?\s*https?:\/\/\S+/ig, "")
            .replace(/\s*\|?\s*www\.[^\s|]+/ig, "")
            .replace(/\s*\|\s*$/, "")
            .trim();
    }

    function codecShort(id) {
        var s = String(id || "");
        if (/EAC3|EC-3/i.test(s)) return "E-AC3";
        if (/AC3|AC-3/i.test(s)) return "AC3";
        if (/TRUEHD/i.test(s)) return "TrueHD";
        if (/DTS/i.test(s)) return "DTS";
        if (/AAC|MP4A/i.test(s)) return "AAC";
        if (/OPUS/i.test(s)) return "Opus";
        if (/VORBIS/i.test(s)) return "Vorbis";
        if (/PCM/i.test(s)) return "PCM";
        if (/ASS|SSA/i.test(s)) return "ASS";
        if (/VOBSUB/i.test(s)) return "VobSub";
        if (/PGS|HDMV/i.test(s)) return "PGS";
        if (/UTF8|SRT/i.test(s)) return "SRT";
        return "";
    }

    function readBe(b, i, n) {
        var v = 0;
        for (var k = 0; k < n; k++) v = v * 256 + b[i + k];
        return v;
    }

    function ebmlId(b, i) {
        if (i >= b.length) return null;
        var first = b[i];
        var mask = 128;
        var n = 1;
        while (n <= 8 && !(first & mask)) {
            mask >>= 1;
            n += 1;
        }
        if (n > 8 || i + n > b.length) return null;
        return { n: n, v: readBe(b, i, n) };
    }

    function ebmlSize(b, i) {
        if (i >= b.length) return null;
        var first = b[i];
        var mask = 128;
        var n = 1;
        while (n <= 8 && !(first & mask)) {
            mask >>= 1;
            n += 1;
        }
        if (n > 8 || i + n > b.length) return null;
        var v = first & (mask - 1);
        for (var k = 1; k < n; k++) v = v * 256 + b[i + k];
        return { n: n, v: v, unk: v === Math.pow(2, 7 * n) - 1 };
    }

    function ebmlStr(b, i, n) {
        var out = "";
        var end = Math.min(b.length, i + n);
        for (var k = i; k < end; k++) {
            if (!b[k]) break;
            out += String.fromCharCode(b[k]);
        }
        try {
            if (window.TextDecoder) return new TextDecoder("utf-8").decode(b.subarray(i, i + n)).replace(/\0/g, "");
        } catch (e) {}
        return out;
    }

    function walkElems(b, start, end, max, fn) {
        var i = start;
        var n = 0;
        end = Math.min(end, b.length);
        while (i < end - 1 && n < (max || 80)) {
            var id = ebmlId(b, i);
            var sz = id ? ebmlSize(b, i + id.n) : null;
            if (!id || !sz) break;
            var body = i + id.n + sz.n;
            if (body > end) break;
            var payload = sz.unk ? (end - body) : sz.v;
            if (body + payload > end) payload = end - body;
            fn(id.v, body, payload, i);
            if (sz.unk) break;
            var next = body + sz.v;
            if (next > end || next <= i) break;
            i = next;
            n += 1;
        }
    }

    function parseMkvTracks(b) {
        var audio = [];
        var text = [];
        var tracksAt = -1;
        var tracksSize = 0;
        walkElems(b, 0, b.length, 16, function (id, body, size) {
            if (id === 0x18538067) {
                walkElems(b, body, Math.min(b.length, body + size), 48, function (sid, sbody, ssize) {
                    if (sid === 0x1654AE6B && tracksAt < 0) {
                        tracksAt = sbody;
                        tracksSize = ssize;
                    }
                });
            }
        });
        if (tracksAt < 0) {
            for (var p = 0; p < b.length - 8; p++) {
                if (b[p] === 0x16 && b[p + 1] === 0x54 && b[p + 2] === 0xAE && b[p + 3] === 0x6B) {
                    var tsz = ebmlSize(b, p + 4);
                    if (tsz && !tsz.unk) {
                        tracksAt = p + 4 + tsz.n;
                        tracksSize = tsz.v;
                        break;
                    }
                }
            }
        }
        if (tracksAt < 0) return { audio: audio, text: text };
        walkElems(b, tracksAt, Math.min(b.length, tracksAt + tracksSize), 64, function (id, body, size) {
            if (id !== 0xAE) return;
            var rec = { type: 0, num: 0, codec: "", name: "", lang: "", ch: 0, def: 1 };
            walkElems(b, body, body + size, 48, function (cid, cbody, csize) {
                if (cid === 0xD7) rec.num = readBe(b, cbody, csize);
                else if (cid === 0x83) rec.type = readBe(b, cbody, csize);
                else if (cid === 0x86) rec.codec = ebmlStr(b, cbody, csize);
                else if (cid === 0x536E) rec.name = ebmlStr(b, cbody, csize);
                else if (cid === 0x22B59D) rec.lang = ebmlStr(b, cbody, csize);
                else if (cid === 0x22B59C && !rec.lang) rec.lang = ebmlStr(b, cbody, csize);
                else if (cid === 0x88) rec.def = readBe(b, cbody, csize);
                else if (cid === 0xE1) {
                    walkElems(b, cbody, cbody + csize, 16, function (aid, abody, asize) {
                        if (aid === 0x9F) rec.ch = readBe(b, abody, asize);
                    });
                }
            });
            if (String(rec.lang).toLowerCase() === "und") rec.lang = "";
            var info = {
                language: rec.lang,
                label: cleanTrackName(rec.name),
                channels: rec.ch,
                codec: codecShort(rec.codec)
            };
            var row = { index: rec.num, type: rec.type === 17 ? "TEXT" : "AUDIO", extra: rec.lang, info: info };
            if (rec.type === 2) audio.push(row);
            else if (rec.type === 17) text.push(row);
        });
        return { audio: audio, text: text };
    }

    function ascii4(b, i) {
        return String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
    }

    function parseMp4Tracks(b) {
        var audio = [];
        var text = [];
        function boxes(start, end, fn) {
            var i = start;
            var n = 0;
            while (i + 8 <= end && n < 80) {
                var size = readBe(b, i, 4);
                var type = ascii4(b, i + 4);
                if (size < 8 || i + size > end + 8) break;
                fn(type, i + 8, size - 8);
                i += size;
                n += 1;
            }
        }
        function walkMoov(start, end) {
            boxes(start, end, function (type, body, size) {
                if (type !== "trak") return;
                var kind = "";
                var lang = "";
                boxes(body, body + size, function (t2, b2, s2) {
                    if (t2 !== "mdia") return;
                    boxes(b2, b2 + s2, function (t3, b3, s3) {
                        if (t3 === "hdlr" && s3 >= 20) kind = ascii4(b, b3 + 8);
                        if (t3 === "mdhd" && s3 >= 20) {
                            var ver = b[b3];
                            var off = ver === 1 ? 28 : 16;
                            if (b3 + off + 2 <= b.length) {
                                var packed = (b[b3 + off] << 8) | b[b3 + off + 1];
                                lang = String.fromCharCode(96 + ((packed >> 10) & 31), 96 + ((packed >> 5) & 31), 96 + (packed & 31));
                            }
                        }
                    });
                });
                var info = { language: lang, label: "", channels: 0, codec: "" };
                if (kind === "soun") audio.push({ index: audio.length, type: "AUDIO", extra: lang, info: info });
                else if (kind === "sbtl" || kind === "subt" || kind === "text" || kind === "subp") {
                    text.push({ index: text.length, type: "TEXT", extra: lang, info: info });
                }
            });
        }
        boxes(0, b.length, function (type, body, size) {
            if (type === "moov") walkMoov(body, body + size);
        });
        return { audio: audio, text: text };
    }

    function relabelFromProbe(list, probed) {
        if (!list || !list.length || !probed || !probed.length) return;
        for (var i = 0; i < list.length && i < probed.length; i++) {
            var src = probed[i].info || {};
            if (!list[i].info) list[i].info = {};
            if (src.label && !list[i].info.label) list[i].info.label = src.label;
            if (src.language && !langName(langCode(list[i].info, list[i].extra))) {
                list[i].info.language = src.language;
            }
            if (src.channels && !list[i].info.channels) list[i].info.channels = src.channels;
            if (src.codec && !list[i].info.codec) list[i].info.codec = src.codec;
        }
    }

    function probeMediaTracks(url, token) {
        if (!url || liveMode) return;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        xhr.timeout = 12000;
        try { xhr.setRequestHeader("Range", "bytes=0-524287"); } catch (e) {}
        xhr.onprogress = function (ev) {
            if (ev && ev.loaded > 600000) {
                try { xhr.abort(); } catch (e2) {}
            }
        };
        xhr.onload = function () {
            probeStarted = false;
            if (token !== openToken) return;
            if (xhr.status < 200 || xhr.status >= 400 || !xhr.response) return;
            applyProbeBuffer(xhr.response, token);
        };
        xhr.onabort = function () {
            var buf = xhr.response;
            probeStarted = false;
            if (token !== openToken) return;
            if (buf && buf.byteLength >= 16) applyProbeBuffer(buf, token);
        };
        xhr.onerror = function () { probeStarted = false; };
        xhr.ontimeout = function () { probeStarted = false; };
        xhr.send();
    }

    function applyProbeBuffer(buf, token) {
        if (token !== openToken || !buf) return;
        var b = new Uint8Array(buf);
        if (b.length > 524288) b = b.subarray(0, 524288);
        if (b.length < 16) return;
        var found = { audio: [], text: [] };
        if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) found = parseMkvTracks(b);
        else if (ascii4(b, 4) === "ftyp") found = parseMp4Tracks(b);
        probedAudio = found.audio || [];
        probedText = found.text || [];
        for (var i = 0; i < probedAudio.length; i++) probedAudio[i].index = i;
        for (var t = 0; t < probedText.length; t++) probedText[t].index = t;
        if (probedAudio.length || probedText.length) probeDone = true;
        refreshTracks();
    }

    function scheduleTrackProbe(delayMs) {
        if (probeStarted || probeDone || liveMode || !current || !current.url) return;
        probeStarted = true;
        var raw = current.url;
        var url = (Http && Http.wrap) ? Http.wrap(raw) : raw;
        var token = openToken;
        setTimeout(function () {
            if (token !== openToken) return;
            probeMediaTracks(url, token);
        }, delayMs || 0);
    }

    function parseAllTracks(raw) {
        audioTracks = [];
        textTracks = [];
        var list = raw;
        if (typeof raw === "string") {
            try { list = JSON.parse(raw); } catch (e) { list = []; }
        }
        if (!list || !list.length) return;
        for (var i = 0; i < list.length; i++) {
            var tr = list[i];
            var type = (tr.type || tr.trackType || "").toUpperCase();
            var extra = tr.extra_info || tr.extraInfo || tr.extra || "";
            var info = parseExtra(extra);
            var nativeLang = tr.language || tr.lang || tr.track_lang || tr.Language || "";
            if (nativeLang && !info.language && !info.track_lang && !info.lang) {
                info.language = nativeLang;
            }
            var rec = {
                index: tr.index != null ? Number(tr.index) : i,
                type: type,
                extra: extra,
                info: info
            };
            if (type === "AUDIO") audioTracks.push(rec);
            else if (type === "TEXT" || type === "SUBTITLE") textTracks.push(rec);
        }
    }

    function htmlTracks() {
        audioTracks = [];
        textTracks = [];
        if (video && video.audioTracks && video.audioTracks.length) {
            for (var a = 0; a < video.audioTracks.length; a++) {
                var at = video.audioTracks[a];
                audioTracks.push({
                    index: a,
                    type: "AUDIO",
                    extra: at.label || at.language || "",
                    info: { language: at.language || "", label: at.label || "" }
                });
            }
        }
        if (video && video.textTracks && video.textTracks.length) {
            for (var ti = 0; ti < video.textTracks.length; ti++) {
                var tt = video.textTracks[ti];
                var kind = (tt.kind || "").toLowerCase();
                if (kind && kind !== "subtitles" && kind !== "captions" && kind !== "forced") continue;
                textTracks.push({
                    index: ti,
                    type: "TEXT",
                    extra: tt.label || tt.language || "",
                    info: { language: tt.language || "", label: tt.label || "" }
                });
            }
        }
    }

    function trackTitle(rec, fallback, i) {
        if (!rec) return fallback;
        var info = rec.info || parseExtra(rec.extra);
        var code = langCode(info, rec.extra) || scrapeLang(info.label);
        var named = langName(code);
        if (named) return named;
        var lab = stripChannelFromName(cleanTrackName(info.label || ""));
        var fromLab = langName(String(lab).toLowerCase());
        if (fromLab) return fromLab;
        if (lab && lab.length > 2 && !/^[0-9]+$/.test(lab) && !isChannelLabel(lab) &&
            !/^(fourcc|tx3g|stpp|wvtt|utf-?8|ass|ssa|pgs|srt|vobsub|h?dmv|s_text)/i.test(lab)) {
            return lab;
        }
        return fallback + " " + (i + 1);
    }

    function pickDefaultAudio() {
        var prefer = (I18N.lang === "tr")
            ? ["tur", "tr", "turkish", "türkçe", "turkce"]
            : ["eng", "en", "english"];
        for (var p = 0; p < prefer.length; p++) {
            var want = prefer[p];
            for (var i = 0; i < audioTracks.length; i++) {
                var rec = audioTracks[i];
                var c = langCode(rec.info, rec.extra);
                var lab = String((rec.info && rec.info.label) || rec.extra || "").toLowerCase();
                if (c === want || lab.indexOf(want) >= 0) {
                    audioIndex = i;
                    return;
                }
            }
        }
    }

    function refreshTracks(quiet) {
        try {
            if (usingAv) parseAllTracks(webapis.avplay.getTotalTrackInfo());
            else htmlTracks();
        } catch (e) {
            audioTracks = [];
            textTracks = [];
        }
        if (!audioTracks.length && probedAudio.length) audioTracks = probedAudio.slice();
        else relabelFromProbe(audioTracks, probedAudio);
        if (!textTracks.length && probedText.length) textTracks = probedText.slice();
        else relabelFromProbe(textTracks, probedText);
        if (audioTracks.length) {
            if (audioIndex < 0 || audioIndex >= audioTracks.length) audioIndex = 0;
            if (usingAv) {
                if (!audioBound && !audioUserPicked) pickDefaultAudio();
                if (!audioBound) {
                    applyAudioTrack();
                    audioBound = true;
                } else if (audioUserPicked) applyAudioTrack();
                else syncCurrentAudio();
            }
        }
        applySubTrack(quiet);
        if (!usingAv) bindHtmlCues();
        if (!quiet && onTracks) onTracks(trackState());
    }

    function syncCurrentAudio() {
        if (!usingAv || !audioTracks.length) return;
        try {
            var cur = webapis.avplay.getCurrentStreamInfo();
            if (typeof cur === "string") cur = JSON.parse(cur);
            if (!cur || !cur.length) return;
            for (var i = 0; i < cur.length; i++) {
                if ((cur[i].type || "").toUpperCase() !== "AUDIO") continue;
                var idx = Number(cur[i].index);
                for (var j = 0; j < audioTracks.length; j++) {
                    if (audioTracks[j].index === idx) { audioIndex = j; return; }
                }
            }
        } catch (e) {}
    }

    function applyAudioTrack() {
        try {
            if (!audioTracks.length) return;
            if (usingAv) webapis.avplay.setSelectTrack("AUDIO", audioTracks[audioIndex].index);
            else if (video && video.audioTracks && video.audioTracks.length > 1) {
                for (var i = 0; i < video.audioTracks.length; i++) {
                    video.audioTracks[i].enabled = i === audioIndex;
                }
            }
        } catch (e) {}
    }

    function cycleAudio() {
        refreshTracks();
        if (audioTracks.length < 2) return audioState();
        audioUserPicked = true;
        audioIndex = (audioIndex + 1) % audioTracks.length;
        applyAudioTrack();
        return audioState();
    }

    function audioState() {
        if (!audioTracks.length) return { available: false, label: I18N.t("audioDefault") };
        var rec = audioTracks[audioIndex];
        var name = trackTitle(rec, I18N.t("audio"), audioIndex);
        if (audioTracks.length > 1) name += " · " + (audioIndex + 1) + "/" + audioTracks.length;
        return { available: true, label: name };
    }

    function applySubTrack(quiet) {
        try {
            if (usingAv) {
                if (!subEnabled || subIndex < 0 || !textTracks.length) {
                    try { webapis.avplay.setSilentSubtitle(true); } catch (e) {}
                    clearSub();
                    if (!quiet && onSub) onSub(subtitleState());
                    return;
                }
                try { webapis.avplay.setSilentSubtitle(false); } catch (e2) {}
                webapis.avplay.setSelectTrack("TEXT", textTracks[subIndex].index);
            } else if (video && video.textTracks) {
                for (var i = 0; i < video.textTracks.length; i++) {
                    video.textTracks[i].mode = (subEnabled && i === subIndex) ? "hidden" : "disabled";
                }
                bindHtmlCues();
                paintHtmlCues();
            }
        } catch (e) {}
        if (!quiet && onSub) onSub(subtitleState());
    }

    function subtitleState() {
        if (!textTracks.length) return { available: false, on: false, label: I18N.t("subOff") };
        if (!subEnabled || subIndex < 0) return { available: true, on: false, label: I18N.t("subOff") };
        var rec = textTracks[subIndex];
        var name = trackTitle(rec, I18N.t("subtitles"), subIndex);
        if (textTracks.length > 1) name += "  " + (subIndex + 1) + "/" + textTracks.length;
        return { available: true, on: true, label: name };
    }

    function subtitleOptions() {
        refreshTracks(true);
        var rows = [{ index: -1, label: I18N.t("subOff"), on: !subEnabled || subIndex < 0 }];
        for (var i = 0; i < textTracks.length; i++) {
            rows.push({
                index: i,
                label: trackTitle(textTracks[i], I18N.t("subtitles"), i),
                on: !!(subEnabled && subIndex === i)
            });
        }
        return rows;
    }

    function selectSubtitle(i) {
        refreshTracks();
        if (i < 0 || !textTracks.length) {
            subEnabled = false;
            subIndex = -1;
        } else {
            subEnabled = true;
            subIndex = Math.max(0, Math.min(textTracks.length - 1, i));
        }
        applySubTrack();
        return subtitleState();
    }

    function audioOptions() {
        refreshTracks(true);
        if (!audioTracks.length) {
            return [{ index: 0, label: I18N.t("audioDefault"), on: true }];
        }
        var rows = [];
        for (var i = 0; i < audioTracks.length; i++) {
            var rec = audioTracks[i];
            var name = trackTitle(rec, I18N.t("audio"), i);
            var extra = [];
            if (rec.info && rec.info.codec) extra.push(rec.info.codec);
            var ch = channelTag(rec.info || {});
            if (ch) extra.push(ch);
            if (extra.length) name += " · " + extra.join(" · ");
            rows.push({ index: i, label: name, on: i === audioIndex });
        }
        return rows;
    }

    function selectAudio(i) {
        refreshTracks();
        if (!audioTracks.length) return audioState();
        audioUserPicked = true;
        audioIndex = Math.max(0, Math.min(audioTracks.length - 1, i));
        applyAudioTrack();
        return audioState();
    }

    function cycleSubtitle() {
        refreshTracks();
        if (!textTracks.length) {
            subEnabled = false;
            subIndex = -1;
            applySubTrack();
            return subtitleState();
        }
        if (!subEnabled) {
            subEnabled = true;
            subIndex = 0;
        } else if (subIndex >= textTracks.length - 1) {
            subEnabled = false;
            subIndex = -1;
        } else {
            subIndex += 1;
        }
        applySubTrack();
        return subtitleState();
    }

    function speedLabel(v) {
        var n = v == null ? playSpeed : v;
        return String(n) + "x";
    }

    function savedSpeed() {
        try {
            var v = Number(Store.settings().playSpeed);
            if (SPEEDS.indexOf(v) >= 0) return v;
        } catch (e) {}
        return 1;
    }

    function applySpeed() {
        if (liveMode) return;
        try {
            if (usingAv) webapis.avplay.setSpeed(playSpeed);
            else if (video) video.playbackRate = playSpeed;
        } catch (e) {
            playSpeed = 1;
            try {
                if (usingAv) webapis.avplay.setSpeed(1);
                else if (video) video.playbackRate = 1;
            } catch (e2) {}
        }
    }

    function cycleSpeed() {
        if (liveMode) return { value: 1, label: "1x" };
        var i = SPEEDS.indexOf(playSpeed);
        playSpeed = SPEEDS[(i < 0 ? 0 : i + 1) % SPEEDS.length];
        try {
            var s = Store.settings();
            s.playSpeed = playSpeed;
            Store.setSettings(s);
        } catch (e) {}
        applySpeed();
        return { value: playSpeed, label: speedLabel() };
    }

    function trackState() {
        return {
            aspect: aspectMode(),
            aspectLabel: I18N.t("aspect_" + aspectMode()),
            speed: playSpeed,
            speedLabel: speedLabel(),
            sub: subtitleState(),
            audio: audioState()
        };
    }

    function bindAvListener() {
        if (listenerBound) return;
        listenerBound = true;
        webapis.avplay.setListener({
            onbufferingstart: function () { emitBuffer(true); },
            onbufferingprogress: function () {},
            onbufferingcomplete: function () {
                emitBuffer(false);
                refreshTracks();
                emitAvTime();
                if (usingAv && !liveMode && !probeDone && !probeStarted) {
                    scheduleTrackProbe(300);
                }
            },
            onstreamcompleted: function () { if (onEnd) onEnd(); },
            oncurrentplaytime: function (t) {
                emitBuffer(false);
                emitAvTime(t);
            },
            onerror: function (err) { emitBuffer(false); if (onError) onError(err); },
            onevent: function () {},
            onsubtitlechange: function (duration, text) {
                showSub(text, duration);
            }
        });
    }

    function stopAv() {
        try { webapis.avplay.stop(); } catch (e) {}
        try { webapis.avplay.close(); } catch (e) {}
    }

    function savedAspect() {
        var mode = "fit";
        try {
            mode = (Store.settings().aspectMode || "fit");
        } catch (e) {}
        return ASPECTS.indexOf(mode) >= 0 ? mode : "fit";
    }

    function aspectMode() {
        return liveMode ? "fit" : savedAspect();
    }

    function applyHtmlAspect(mode) {
        if (!video) return;
        video.classList.remove("ratio-fit", "ratio-fill", "ratio-stretch", "ratio-43");
        if (mode === "live" || mode === "fit") video.classList.add("ratio-fit");
        else if (mode === "fill") video.classList.add("ratio-fill");
        else if (mode === "43") video.classList.add("ratio-43");
        else video.classList.add("ratio-stretch");
    }

    function applyAvAspect(mode) {
        function rect(x, y, w, h) { webapis.avplay.setDisplayRect(x, y, w, h); }
        function method(m) { webapis.avplay.setDisplayMethod(m); }
        if (mode === "live" || mode === "stretch") {
            rect(0, 0, 1920, 1080);
            method("PLAYER_DISPLAY_MODE_FULL_SCREEN");
            return;
        }
        if (mode === "43") {
            rect(240, 0, 1440, 1080);
            method("PLAYER_DISPLAY_MODE_FULL_SCREEN");
            return;
        }
        if (mode === "fill") {
            try {
                rect(0, 0, 1920, 1080);
                method("PLAYER_DISPLAY_MODE_CROPPED_FULL");
                return;
            } catch (e) {}
            try {
                rect(-160, -90, 2240, 1260);
                method("PLAYER_DISPLAY_MODE_FULL_SCREEN");
                return;
            } catch (e2) {}
            rect(0, 0, 1920, 1080);
            method("PLAYER_DISPLAY_MODE_FULL_SCREEN");
            return;
        }
        rect(0, 0, 1920, 1080);
        try { method("PLAYER_DISPLAY_MODE_LETTER_BOX"); } catch (e3) {
            try { method("PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO"); } catch (e4) {}
        }
    }

    function applyAspect() {
        var mode = liveMode ? "live" : savedAspect();
        applyHtmlAspect(mode);
        if (usingAv) {
            try { applyAvAspect(mode); } catch (e) {}
        }
        return liveMode ? "fit" : mode;
    }

    function cycleAspect() {
        if (liveMode) return "fit";
        var next = ASPECTS[(ASPECTS.indexOf(savedAspect()) + 1) % ASPECTS.length];
        try {
            var s = Store.settings();
            s.aspectMode = next;
            Store.setSettings(s);
        } catch (e) {}
        applyAspect();
        return next;
    }

    function tuneAv(isLive, url) {
        applyAspect();
        try {
            webapis.avplay.setStreamingProperty("PREBUFFER_MODE", isLive ? "1000" : "3500");
        } catch (e3) {}
        try { webapis.avplay.setBufferingTimeout(isLive ? 4 : 12); } catch (e4) {}
        if (url && String(url).indexOf(".m3u8") !== -1) {
            try {
                webapis.avplay.setStreamingProperty("ADAPTIVE_INFO", "FIXED_MAX_RESOLUTION=1920x1080");
            } catch (e5) {}
        }
    }

    function playAv(url, token) {
        stopAv();
        bindAvListener();
        emitBuffer(true);
        webapis.avplay.open(url);
        tuneAv(liveMode, url);
        function afterReady() {
            if (token !== openToken) return;
            applyAspect();
            var sought = false;
            if (!liveMode && startAtMs > 1500) {
                try {
                    webapis.avplay.seekTo(Math.floor(startAtMs));
                    sought = true;
                } catch (e) {}
            }
            webapis.avplay.play();
            paused = false;
            applySpeed();
            refreshTracks();
            clearTimer();
            timeTimer = setInterval(tick, 400);
            if (!sought && !liveMode && startAtMs > 1500) {
                try { webapis.avplay.seekTo(Math.floor(startAtMs)); } catch (e2) {
                    try { webapis.avplay.jumpForward(Math.floor(startAtMs)); } catch (e3) {}
                }
            }
            emitAvTime(startAtMs || 0);
            if (!liveMode) {
                setTimeout(function () {
                    if (token !== openToken) return;
                    if (!probeDone && !probeStarted) scheduleTrackProbe(0);
                }, 5000);
            }
        }
        if (webapis.avplay.prepareAsync) {
            webapis.avplay.prepareAsync(afterReady, function (err) {
                if (token !== openToken) return;
                emitBuffer(false);
                if (onError) onError(err);
            });
        } else {
            webapis.avplay.prepare();
            afterReady();
        }
    }

    function bindVideoBuffer() {
        if (!video) return;
        video.onwaiting = function () { emitBuffer(true); };
        video.onstalled = function () { emitBuffer(true); };
        video.onplaying = function () {
            emitBuffer(false);
            paused = false;
            applySpeed();
            if (video) {
                video.muted = false;
                video.volume = 1;
            }
        };
        video.oncanplay = function () { emitBuffer(false); };
        video.onpause = function () { paused = true; };
        video.onplay = function () { paused = false; };
    }

    function playHtml(url, token, raw) {
        destroyHtmlPlayers();
        if (video) {
            try { video.pause(); } catch (e) {}
        }
        clearTimer();
        timeTimer = setInterval(tick, 400);
        bindVideoBuffer();
        if (video.textTracks) video.textTracks.onaddtrack = function () { refreshTracks(); };
        if (video.audioTracks) video.audioTracks.onaddtrack = function () { refreshTracks(); };
        video.onended = function () { if (onEnd) onEnd(); };
        video.onerror = function () { if (token === openToken && onError) onError("html5"); };
        video.onloadedmetadata = function () {
            if (token !== openToken) return;
            refreshTracks();
            if (!liveMode && !remuxing && startAtMs > 8000 && isFinite(video.duration)) {
                try { video.currentTime = startAtMs / 1000; } catch (e) {}
            }
        };

        function playNative() {
            if (token !== openToken) return;
            emitBuffer(true);
            video.muted = false;
            video.volume = 1;
            video.src = url;
            video.load();
            var p = video.play();
            if (p && p.catch) p.catch(function () {});
        }

        function playMpegTs(isRemux) {
            if (token !== openToken) return;
            if (!window.mpegts || !mpegts.isSupported()) {
                playNative();
                return;
            }
            emitBuffer(true);
            video.muted = false;
            video.volume = 1;
            msePlayer = mpegts.createPlayer({
                type: "mpegts",
                isLive: liveMode && !isRemux,
                hasAudio: true,
                hasVideo: true,
                url: url
            }, {
                enableWorker: false,
                enableStashBuffer: !!isRemux,
                stashInitialSize: isRemux ? 1024 : 64,
                lazyLoad: false,
                deferLoadAfterSourceOpen: false,
                accurateSeek: !liveMode && !isRemux,
                autoCleanupSourceBuffer: true,
                autoCleanupMaxBackwardDuration: liveMode ? 6 : 10,
                autoCleanupMinBackwardDuration: liveMode ? 2 : 4,
                liveBufferLatencyChasing: !!(liveMode && !isRemux),
                liveBufferLatencyMaxLatency: 3,
                liveBufferLatencyMinRemain: 0.6,
                fixAudioTimestampGap: true
            });
            msePlayer.attachMediaElement(video);
            msePlayer.load();
            if (mpegts.Events && msePlayer.on) {
                msePlayer.on(mpegts.Events.ERROR, function () {
                    if (token === openToken && onError) onError("mpegts");
                });
            }
            var p = msePlayer.play();
            if (p && p.catch) p.catch(function () {});
        }

        function playHls() {
            if (token !== openToken) return;
            if (video.canPlayType && video.canPlayType("application/vnd.apple.mpegurl")) {
                playNative();
                return;
            }
            if (window.Hls && Hls.isSupported()) {
                emitBuffer(true);
                hls = new Hls({
                    enableWorker: false,
                    lowLatencyMode: !!liveMode,
                    liveSyncDurationCount: liveMode ? 2 : 3,
                    liveMaxLatencyDurationCount: liveMode ? 5 : 8,
                    maxBufferLength: liveMode ? 6 : 30,
                    maxMaxBufferLength: liveMode ? 10 : 60,
                    backBufferLength: liveMode ? 3 : 30
                });
                hls.loadSource(url);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, function () {
                    if (token !== openToken) return;
                    var p = video.play();
                    if (p && p.catch) p.catch(function () {});
                });
                hls.on(Hls.Events.ERROR, function (ev, data) {
                    if (data && data.fatal && token === openToken && onError) onError("hls");
                });
                return;
            }
            playNative();
        }

        var src = (raw || url || "").toLowerCase();
        var isM3u8 = src.indexOf(".m3u8") !== -1 || url.indexOf(".m3u8") !== -1;
        var isTs = /\.ts(\?|$)/i.test(src) || src.indexOf("/live/") !== -1;
        var needsRemux = Http.isPreview() && !liveMode && /\.(mkv|avi)(\?|$)/.test(src.split("?")[0]);
        remuxing = !!(needsRemux && raw);
        htmlRaw = remuxing ? raw : "";
        remuxOffsetMs = remuxing ? (startAtMs || 0) : 0;
        if (needsRemux && raw) {
            url = remuxUrl(raw);
            if (window.mpegts) playMpegTs(true);
            else loadScript("https://cdn.jsdelivr.net/npm/mpegts.js@1.8.0/dist/mpegts.min.js", function () { playMpegTs(true); });
        } else if (isM3u8) {
            if ((video.canPlayType && video.canPlayType("application/vnd.apple.mpegurl")) || window.Hls) playHls();
            else loadScript("https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js", playHls);
        } else if (liveMode || isTs) {
            if (window.mpegts) playMpegTs(false);
            else loadScript("https://cdn.jsdelivr.net/npm/mpegts.js@1.8.0/dist/mpegts.min.js", function () { playMpegTs(false); });
        } else {
            playNative();
        }
    }

    function showSurface(avOn) {
        if (av) av.classList.toggle("active", avOn);
        if (video) video.classList.toggle("active", !avOn);
    }

    function playUrl(url, token, raw) {
        if (hasAvplay()) {
            usingAv = true;
            showSurface(true);
            try {
                playAv(url, token);
            } catch (e) {
                if (onError) onError(e);
            }
        } else {
            usingAv = false;
            showSurface(false);
            applyAspect();
            playHtml(url, token, raw);
        }
    }

    function open(item, handlers) {
        current = item;
        liveMode = isLiveItem(item);
        startAtMs = liveMode ? 0 : ((handlers && handlers.startAt) || 0);
        startHold = !liveMode && startAtMs > 1500;
        onTime = handlers && handlers.onTime;
        onEnd = handlers && handlers.onEnd;
        onError = handlers && handlers.onError;
        onSub = handlers && handlers.onSub;
        onBuffer = handlers && handlers.onBuffer;
        onTracks = handlers && handlers.onTracks;
        subIndex = -1;
        audioIndex = 0;
        audioBound = false;
        audioUserPicked = false;
        probedAudio = [];
        probedText = [];
        probeStarted = false;
        probeDone = false;
        subEnabled = false;
        playSpeed = liveMode ? 1 : savedSpeed();
        paused = false;
        userPaused = false;
        clearSub();
        var token = ++openToken;
        var raw = item.url;
        if (liveMode && item.urlTs && !item._liveUseTs) raw = item.urlTs;
        var url = raw;
        if (Http && Http.wrap) url = Http.wrap(raw);
        if (!url) {
            if (onError) onError("nostream");
            return;
        }
        playUrl(url, token, raw);
        if (!liveMode) scheduleTrackProbe(0);
    }

    function pause() {
        if (liveMode) return;
        try {
            if (usingAv) webapis.avplay.pause();
            else if (video) video.pause();
            paused = true;
            userPaused = true;
        } catch (e) {}
    }

    function resume() {
        try {
            if (usingAv) webapis.avplay.play();
            else if (video) video.play();
            paused = false;
            userPaused = false;
        } catch (e) {}
    }

    function toggle() {
        if (liveMode) return paused;
        try {
            if (usingAv) {
                var s = webapis.avplay.getState();
                if (s === "PLAYING") pause();
                else resume();
            } else if (video) {
                if (video.paused) resume();
                else pause();
            }
        } catch (e) {}
        return paused;
    }

    function remuxUrl(raw) {
        var u = "/remux?u=" + encodeURIComponent(raw) + "&a=" + String(audioIndex || 0);
        if (remuxOffsetMs > 400) u += "&ss=" + (remuxOffsetMs / 1000).toFixed(3);
        return u;
    }

    function clampSeekMs(ms) {
        var t = Math.max(0, Math.floor(ms || 0));
        if (remuxing) return t;
        try {
            var d = duration();
            if (d > 800) t = Math.min(t, d - 400);
        } catch (e) {}
        return t;
    }

    function seek(ms) {
        if (liveMode) return;
        seekTo(currentTime() + ms);
    }

    function seekTo(ms) {
        if (liveMode) return;
        var target = clampSeekMs(ms);
        startAtMs = target;
        startHold = false;
        try {
            if (usingAv) {
                webapis.avplay.seekTo(target);
            } else if (remuxing && htmlRaw) {
                remuxOffsetMs = target;
                emitBuffer(true);
                playHtml(Http && Http.wrap ? Http.wrap(htmlRaw) : htmlRaw, openToken, htmlRaw);
            } else if (msePlayer) {
                try { msePlayer.currentTime = target / 1000; } catch (e1) {}
                if (video) video.currentTime = target / 1000;
            } else if (video) {
                var next = target / 1000;
                var dur = video.duration;
                if (isFinite(dur) && dur > 0) next = Math.min(dur - 0.3, next);
                video.currentTime = Math.max(0, next);
            }
        } catch (e) {}
    }

    function stop() {
        openToken += 1;
        clearTimer();
        clearSub();
        destroyHtmlPlayers();
        if (usingAv) stopAv();
        else if (video) {
            video.pause();
            video.removeAttribute("src");
            video.load();
        }
        applyHtmlAspect("fit");
        showSurface(false);
        current = null;
        textTracks = [];
        audioTracks = [];
        probedAudio = [];
        probedText = [];
        probeStarted = false;
        probeDone = false;
        subIndex = -1;
        audioIndex = 0;
        audioBound = false;
        audioUserPicked = false;
        paused = false;
        userPaused = false;
        liveMode = false;
        remuxing = false;
        remuxOffsetMs = 0;
        htmlRaw = "";
        emitBuffer(false);
    }

    function currentTime() {
        try {
            if (usingAv) return webapis.avplay.getCurrentTime();
            if (video) {
                var t = (video.currentTime || 0) * 1000;
                return remuxing ? t + remuxOffsetMs : t;
            }
        } catch (e) {}
        return 0;
    }

    function duration() {
        if (liveMode) return 0;
        try {
            if (usingAv) return webapis.avplay.getDuration();
            if (video) {
                var d = video.duration;
                if (!isFinite(d)) return remuxing ? remuxOffsetMs : 0;
                d = d * 1000;
                return remuxing ? d + remuxOffsetMs : d;
            }
        } catch (e) {}
        return 0;
    }

    function init() {
        av = document.getElementById("av-player");
        video = document.getElementById("html5-player");
        subEl = document.getElementById("sub-layer");
    }

    return {
        init: init,
        open: open,
        pause: pause,
        resume: resume,
        toggle: toggle,
        seek: seek,
        seekTo: seekTo,
        stop: stop,
        currentTime: currentTime,
        duration: duration,
        cycleSubtitle: cycleSubtitle,
        subtitleState: subtitleState,
        subtitleOptions: subtitleOptions,
        selectSubtitle: selectSubtitle,
        cycleAudio: cycleAudio,
        audioState: audioState,
        audioOptions: audioOptions,
        selectAudio: selectAudio,
        cycleSpeed: cycleSpeed,
        speedLabel: speedLabel,
        trackState: trackState,
        cycleAspect: cycleAspect,
        aspectMode: aspectMode,
        current: function () { return current; },
        isPaused: function () {
            return !!userPaused;
        },
        isLive: function () { return liveMode; }
    };
})();
