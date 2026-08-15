var Billing = (function () {
    function hasApi() {
        return !!(window.webapis && webapis.billing && webapis.billing.buyItem);
    }

    function uid() {
        try { return webapis.sso.getLoginUid(); } catch (e) { return "device"; }
    }

    function country() {
        try { return webapis.productinfo.getSmartTVServer() || ""; } catch (e) { return ""; }
    }

    function configured() {
        return !!(CONFIG.CHECKOUT_APP_ID && CONFIG.CHECKOUT_ITEM_ID);
    }

    function verifyRemote(invoice) {
        if (!CONFIG.ENTITLEMENT_URL) {
            return Promise.resolve({ ok: true, reason: "no-entitlement-url" });
        }
        var body = JSON.stringify({
            uid: uid(),
            appId: CONFIG.CHECKOUT_APP_ID || CONFIG.PACKAGE_ID,
            productId: CONFIG.CHECKOUT_ITEM_ID,
            country: country(),
            invoiceId: invoice || ""
        });
        return new Promise(function (resolve) {
            var xhr = new XMLHttpRequest();
            xhr.open("POST", CONFIG.ENTITLEMENT_URL, true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.timeout = 12000;
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                try {
                    var data = JSON.parse(xhr.responseText || "{}");
                    resolve({ ok: !!data.ok || data.status === "entitled", reason: data.reason || "remote" });
                } catch (e) {
                    resolve({ ok: false, reason: "bad-entitlement" });
                }
            };
            xhr.ontimeout = xhr.onerror = function () {
                resolve({ ok: false, reason: "entitlement-network" });
            };
            xhr.send(body);
        });
    }

    function check() {
        if (!configured()) {
            return Promise.resolve({ ok: true, reason: "dev-unconfigured" });
        }
        if (!hasApi()) {
            return Promise.resolve({ ok: true, reason: "browser" });
        }
        return new Promise(function (resolve) {
            try {
                webapis.billing.getPurchases("2", CONFIG.CHECKOUT_SERVER || "PRD", function (data) {
                    var entitled = false;
                    var invoice = "";
                    try {
                        var parsed = typeof data === "string" ? JSON.parse(data) : data;
                        var list = parsed.InvoiceDetails || parsed.payResult || parsed || [];
                        if (!Array.isArray(list)) list = [list];
                        list.forEach(function (row) {
                            var id = row.ItemID || row.itemId || "";
                            if (!CONFIG.CHECKOUT_ITEM_ID || id === CONFIG.CHECKOUT_ITEM_ID) {
                                entitled = true;
                                invoice = row.InvoiceID || row.invoiceId || "";
                            }
                        });
                    } catch (e) {}
                    if (!entitled) {
                        resolve({ ok: false, reason: "none" });
                        return;
                    }
                    verifyRemote(invoice).then(resolve);
                }, function () {
                    resolve({ ok: false, reason: "billing-error" });
                });
            } catch (e) {
                resolve({ ok: false, reason: "billing-exception" });
            }
        });
    }

    function buy() {
        if (!hasApi() || !configured()) {
            return Promise.resolve({ ok: false, reason: "unavailable" });
        }
        var details = JSON.stringify({
            OrderItemID: CONFIG.CHECKOUT_ITEM_ID,
            OrderTitle: CONFIG.CHECKOUT_ITEM_TITLE,
            OrderTotal: CONFIG.CHECKOUT_ITEM_PRICE,
            OrderCurrencyID: CONFIG.CHECKOUT_CURRENCY,
            OrderCustomID: uid()
        });
        return new Promise(function (resolve) {
            webapis.billing.buyItem(
                CONFIG.CHECKOUT_APP_ID,
                CONFIG.CHECKOUT_SERVER || "PRD",
                details,
                function () { check().then(resolve); },
                function () { resolve({ ok: false, reason: "cancelled" }); }
            );
        });
    }

    return { check: check, buy: buy, configured: configured };
})();
