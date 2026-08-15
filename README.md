# VELA IPTV PLAYER

Samsung Tizen TV uygulaması. Kendi yasal **M3U** listenizi veya **Xtream Codes** hesabınızı oynatır. Kanal, oynatma listesi veya abonelik satmaz / paketlemez.

Bu kopya, kaybolan kaynak kodun [Vela-support](https://github.com/albayrakfaruk/Vela-support) ürün tanımına (ve TV’de çalışan sürüme) göre yeniden yazılmış halidir.

## Özellikler

- Kumanda odaklı arayüz (D-pad, CH+/−, renk tuşları)
- Xtream Codes: canlı, film, dizi
- M3U oynatma listesi
- Favoriler (kırmızı tuş), katalog önbelleği, izleme geçmişi
- Samsung AVPlay (HLS / MPEG-TS); tarayıcıda HTML5 yedek oynatıcı
- Samsung Checkout iskeleti (Seller Office kimlikleri `js/config.js` içine yazılır)

## Kumanda

| Tuş | İşlev |
| --- | --- |
| OK | Oynat / OSD |
| Geri | Üst ekran / oynatıcıdan çık |
| KIRMIZI | Favori |
| YEŞİL | Kataloğu yenile |
| SARI | Ara |
| MAVİ | Ayarlar |
| CH+/− | Canlı kanal değiştir |

## Geliştirme

1. [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download) + TV Extension kurun.
2. TV’de **Developer Mode** açın, PC IP’sini yazın.
3. `sdb connect <TV_IP>:26101`
4. Projeyi Tizen Studio’da TV-Samsung Web App olarak açın veya CLI ile paketleyin:

```bash
tizen package -t wgt -s <sertifika> -- .
tizen install -n VelaIPTV.wgt
tizen run -id VelaIPTVtv.VelaIPTV
```

Mağaza kimliği sizin Seller Office paket ID’nizden farklıysa `config.xml` içindeki `tizen:application id` / `package` değerlerini oradakiyle değiştirin.

## Samsung Checkout

`js/config.js`:

- `CHECKOUT_APP_ID` — Seller Office uygulama kimliği
- `CHECKOUT_ITEM_ID` — abonelik ürün kimliği
- `ENTITLEMENT_URL` — HTTPS entitlement servisi (gizlilik metnindeki VELA servisi)

Bunlar boşken uygulama sideload / geliştirme için abonelik kapısını atlar.

## Not

VELA, kullanıcının girdiği sağlayıcı adresine bağlanır. Kimlik bilgileri yalnızca o adrese gider; VELA sunucusuna playlist veya parola gönderilmez.
