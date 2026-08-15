var Keys = (function () {
    var CODE = {
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        ENTER: 13,
        BACK: 10009,
        RETURN: 8,
        ESC: 27,
        PLAY: 415,
        PAUSE: 19,
        PLAYPAUSE: 10252,
        STOP: 413,
        FF: 417,
        RW: 412,
        CH_UP: 427,
        CH_DOWN: 428,
        RED: 403,
        GREEN: 404,
        YELLOW: 405,
        BLUE: 406,
        INFO: 457,
        EXIT: 10182,
        GUIDE: 458,
        N0: 48, N1: 49, N2: 50, N3: 51, N4: 52,
        N5: 53, N6: 54, N7: 55, N8: 56, N9: 57
    };

    var names = [
        "MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop",
        "MediaFastForward", "MediaRewind", "ChannelUp", "ChannelDown",
        "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue",
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
        "Exit", "Info", "Caption", "Guide"
    ];

    function register() {
        try {
            if (window.tizen && tizen.tvinputdevice) {
                if (tizen.tvinputdevice.registerKeyBatch) tizen.tvinputdevice.registerKeyBatch(names);
                else names.forEach(function (n) { tizen.tvinputdevice.registerKey(n); });
            }
        } catch (e) {}
    }

    function kind(e) {
        var k = e.keyCode;
        if (k === CODE.LEFT) return "left";
        if (k === CODE.RIGHT) return "right";
        if (k === CODE.UP) return "up";
        if (k === CODE.DOWN) return "down";
        if (k === CODE.ENTER) return "enter";
        if (k === CODE.BACK || k === CODE.RETURN || k === CODE.ESC) return "back";
        if (k === CODE.PLAY || k === CODE.PLAYPAUSE) return "playpause";
        if (k === CODE.PAUSE) return "pause";
        if (k === CODE.STOP) return "stop";
        if (k === CODE.FF) return "ff";
        if (k === CODE.RW) return "rw";
        if (k === CODE.CH_UP) return "chup";
        if (k === CODE.CH_DOWN) return "chdown";
        if (k === CODE.RED) return "red";
        if (k === CODE.GREEN) return "green";
        if (k === CODE.YELLOW) return "yellow";
        if (k === CODE.BLUE) return "blue";
        if (k === CODE.INFO) return "info";
        if (k === CODE.EXIT) return "exit";
        if (k >= CODE.N0 && k <= CODE.N9) return "num" + (k - CODE.N0);
        return "";
    }

    return { register: register, kind: kind, CODE: CODE };
})();
