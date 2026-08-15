var Player = (function () {
    var av = null;
    var video = null;
    var usingAv = false;
    var current = null;
    var listenerBound = false;
    var timeTimer = null;
    var onTime = null;
    var onEnd = null;
    var onError = null;

    function hasAvplay() {
        return !!(window.webapis && webapis.avplay && typeof webapis.avplay.open === "function");
    }

    function clearTimer() {
        if (timeTimer) {
            clearInterval(timeTimer);
            timeTimer = null;
        }
    }

    function tick() {
        if (!onTime) return;
        try {
            if (usingAv) {
                onTime(webapis.avplay.getCurrentTime(), webapis.avplay.getDuration());
            } else if (video) {
                onTime((video.currentTime || 0) * 1000, (video.duration || 0) * 1000);
            }
        } catch (e) {}
    }

    function bindAvListener() {
        if (listenerBound) return;
        listenerBound = true;
        webapis.avplay.setListener({
            onbufferingstart: function () {},
            onbufferingprogress: function () {},
            onbufferingcomplete: function () {},
            onstreamcompleted: function () { if (onEnd) onEnd(); },
            oncurrentplaytime: function (t) {
                if (onTime) {
                    try { onTime(t, webapis.avplay.getDuration()); } catch (e) {}
                }
            },
            onerror: function (err) { if (onError) onError(err); },
            onevent: function () {},
            onsubtitlechange: function () {}
        });
    }

    function stopAv() {
        try { webapis.avplay.stop(); } catch (e) {}
        try { webapis.avplay.close(); } catch (e) {}
    }

    function playAv(url) {
        stopAv();
        bindAvListener();
        webapis.avplay.open(url);
        webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
        try { webapis.avplay.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX"); } catch (e) {}
        if (webapis.avplay.prepareAsync) {
            webapis.avplay.prepareAsync(function () {
                webapis.avplay.play();
            }, function (err) {
                if (onError) onError(err);
            });
        } else {
            webapis.avplay.prepare();
            webapis.avplay.play();
        }
    }

    function playHtml(url) {
        video.pause();
        video.src = url;
        video.load();
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
        clearTimer();
        timeTimer = setInterval(tick, 500);
        video.onended = function () { if (onEnd) onEnd(); };
        video.onerror = function () { if (onError) onError("html5"); };
    }

    function showSurface(avOn) {
        if (av) av.classList.toggle("active", avOn);
        if (video) video.classList.toggle("active", !avOn);
    }

    function open(item, handlers) {
        current = item;
        onTime = handlers && handlers.onTime;
        onEnd = handlers && handlers.onEnd;
        onError = handlers && handlers.onError;
        var url = item.url;
        if (!url) {
            if (onError) onError("nostream");
            return;
        }
        if (hasAvplay()) {
            usingAv = true;
            showSurface(true);
            try {
                playAv(url);
            } catch (e) {
                if (item.urlTs) {
                    try { playAv(item.urlTs); return; } catch (e2) {}
                }
                if (onError) onError(e);
            }
        } else {
            usingAv = false;
            showSurface(false);
            playHtml(url);
        }
    }

    function pause() {
        try {
            if (usingAv) webapis.avplay.pause();
            else if (video) video.pause();
        } catch (e) {}
    }

    function resume() {
        try {
            if (usingAv) webapis.avplay.play();
            else if (video) video.play();
        } catch (e) {}
    }

    function toggle() {
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
    }

    function seek(ms) {
        try {
            if (usingAv) {
                if (ms >= 0) webapis.avplay.jumpForward(ms);
                else webapis.avplay.jumpBackward(-ms);
            } else if (video) {
                video.currentTime = Math.max(0, (video.currentTime || 0) + ms / 1000);
            }
        } catch (e) {}
    }

    function stop() {
        clearTimer();
        if (usingAv) stopAv();
        else if (video) {
            video.pause();
            video.removeAttribute("src");
            video.load();
        }
        showSurface(false);
        current = null;
    }

    function currentTime() {
        try {
            if (usingAv) return webapis.avplay.getCurrentTime();
            if (video) return (video.currentTime || 0) * 1000;
        } catch (e) {}
        return 0;
    }

    function duration() {
        try {
            if (usingAv) return webapis.avplay.getDuration();
            if (video) return (video.duration || 0) * 1000;
        } catch (e) {}
        return 0;
    }

    function init() {
        av = document.getElementById("av-player");
        video = document.getElementById("html5-player");
    }

    return {
        init: init,
        open: open,
        pause: pause,
        resume: resume,
        toggle: toggle,
        seek: seek,
        stop: stop,
        currentTime: currentTime,
        duration: duration,
        current: function () { return current; }
    };
})();
