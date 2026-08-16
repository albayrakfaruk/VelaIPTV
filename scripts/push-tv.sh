#!/usr/bin/env bash
# VELA IPTV — Mac: paketi imzala, TV'ye kur, aç.
# Kullanım:  ./scripts/push-tv.sh [TV_IP]
# Örnek:     ./scripts/push-tv.sh 192.168.1.27
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TV_IP="${1:-${TV_IP:-192.168.1.27}}"
PKG_ID="VelaIPTVtv"
APP_ID="VelaIPTVtv.VelaIPTV"
PROFILE="${TIZEN_PROFILE:-vela}"
STUDIO="${TIZEN_STUDIO:-$HOME/tizen-studio}"
CERT_DIR="${SAMSUNG_CERT_DIR:-$HOME/SamsungCertificate/vela}"
JAVA_HOME="${JAVA_HOME:-$HOME/jdk/jdk-17.0.20+8/Contents/Home}"
if [ ! -x "$JAVA_HOME/bin/java" ]; then
  JAVA_HOME="$STUDIO/jdk/Contents/Home"
fi
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$STUDIO/tools:$STUDIO/tools/ide/bin:$PATH"

SDB="$(command -v sdb || true)"
[ -x "$STUDIO/tools/sdb" ] && SDB="$STUDIO/tools/sdb"
[ -x "$HOME/tizen-tools/data/tools/sdb" ] && SDB="${SDB:-$HOME/tizen-tools/data/tools/sdb}"
TIZEN="$(command -v tizen || true)"
[ -x "$STUDIO/tools/ide/bin/tizen" ] && TIZEN="$STUDIO/tools/ide/bin/tizen"

if [ -z "${SDB:-}" ] || [ ! -x "$SDB" ]; then
  echo "sdb bulunamadı. Tizen Studio kurulu olmalı: $STUDIO/tools/sdb" >&2
  exit 1
fi
if [ -z "${TIZEN:-}" ] || [ ! -x "$TIZEN" ]; then
  echo "tizen CLI bulunamadı. Tizen Studio kurulu olmalı." >&2
  exit 1
fi
if [ ! -f "$CERT_DIR/author.p12" ] || [ ! -f "$CERT_DIR/distributor.p12" ]; then
  echo "Samsung sertifikası yok: $CERT_DIR" >&2
  echo "Certificate Manager ile TV DUID'sine bağlı 'vela' profili oluştur." >&2
  exit 1
fi

STAGING="${TMPDIR:-/tmp}/vela-wgt-$$"
mkdir -p "$STAGING"
trap 'rm -rf "$STAGING"' EXIT
cp "$ROOT/index.html" "$ROOT/config.xml" "$ROOT/icon.png" "$STAGING/"
cp -R "$ROOT/css" "$ROOT/js" "$STAGING/"

"$TIZEN" security-profiles set-active -n "$PROFILE" >/dev/null
"$TIZEN" package -t wgt -s "$PROFILE" -- "$STAGING"
WGT="$(ls "$STAGING"/*.wgt | head -1)"
cp "$WGT" "$STAGING/VelaIPTV.wgt"

echo "TV: $TV_IP:26101"
"$SDB" connect "$TV_IP:26101"
"$SDB" devices

if [ -f "$CERT_DIR/device-profile.xml" ]; then
  "$SDB" push "$CERT_DIR/device-profile.xml" /home/owner/share/tmp/sdk_tools/device-profile.xml
fi
"$SDB" push "$STAGING/VelaIPTV.wgt" /home/owner/share/tmp/sdk_tools/VelaIPTV.wgt
"$SDB" shell 0 vd_appinstall "$PKG_ID" /home/owner/share/tmp/sdk_tools/VelaIPTV.wgt
"$SDB" shell 0 launch "$APP_ID" || "$SDB" shell 0 was_execute "$APP_ID"
echo "Kuruldu ve açıldı."
