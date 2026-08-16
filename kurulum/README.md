# Arkadaş TV kurulumu

Hepsi **senin evinde**: senin PC, senin Wi-Fi, senin Samsung TV. Başka ağa bağlanmana gerek yok.

Bu klasörde olması gerekenler:

- `duid.bat`
- `kur.bat`
- `sdb.exe` (Tizen Studio içinden kopyala: `tizen-studio\tools\sdb.exe`)

`VelaIPTV.wgt` ilk başta **olmayacak**. Paket DUID’den sonra gelir.

## 1. Developer Mode

1. PC ve TV aynı Wi-Fi’de olsun.
2. TV’de **Uygulamalar** → en altta ayar / dişli → kumandada **12345** (olmazsa **00000**).
3. Developer Mode **On**.
4. `duid.bat` çalıştır, ekrandaki **PC IP**’yi TV’deki Host IP’ye yaz.
5. TV’yi kapat-aç. Apps’in üstünde **Develop Mode** yazmalı.

## 2. DUID al

1. TV’nin IP’sini not et (Ayarlar → Destek → Bu TV hakkında).
2. `duid.bat` çalıştır, TV IP’yi yaz.
3. Ekrandaki **DUID** satırını gönder.

## 3. Paketi kur

1. Sana `VelaIPTV.wgt` gelir.
2. Dosyayı **bu klasöre** koy (`duid.bat` ile aynı yer).
3. `kur.bat` çalıştır, yine TV IP’yi yaz.
4. TV’de **VELA IPTV PLAYER** açılır.

## Olmazsa

- PC IP modem adresi değil, `duid.bat`’ın yazdığı adres olmalı.
- Developer Mode her TV açılışında kapanabilir; kapanırsa 12345’i tekrar yap.
- `sdb.exe` bu klasörde yoksa script durur.
- `VelaIPTV.wgt` yokken `kur.bat` çalışmaz; önce DUID, sonra paket.
