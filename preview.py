#!/usr/bin/env python3
"""Local browser preview: static files + CORS proxy that rewrites HLS playlists."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote, quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
UA = "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36"


def abs_url(ref, u):
    u = (u or "").strip().strip('"')
    parsed = urlparse(ref)
    origin = "%s://%s" % (parsed.scheme, parsed.netloc)
    base_dir = origin + parsed.path.rsplit("/", 1)[0] + "/"
    if u.startswith("http://") or u.startswith("https://"):
        return u
    if u.startswith("//"):
        return parsed.scheme + ":" + u
    if u.startswith("/"):
        return origin + u
    return base_dir + u


def proxied(ref, u):
    return "/proxy?u=" + quote(abs_url(ref, u), safe="")


def ffmpeg_exe():
    p = shutil.which("ffmpeg")
    if p:
        return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def rewrite_m3u8(body, final_url):
    def key_repl(m):
        return m.group(1) + proxied(final_url, m.group(2)) + m.group(3)

    lines = []
    for line in body.decode("utf-8", "replace").splitlines():
        if line.startswith("#"):
            lines.append(re.sub(r'(URI=")([^"]+)(")', key_repl, line))
        elif line.strip():
            lines.append(proxied(final_url, line.strip()))
        else:
            lines.append(line)
    return ("\n".join(lines) + "\n").encode("utf-8")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if "webapis.js" in parsed.path:
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.end_headers()
            self.wfile.write(b"window.webapis=window.webapis||{};\n")
            return
        if parsed.path == "/proxy":
            self.proxy(parse_qs(parsed.query).get("u", [""])[0])
            return
        if parsed.path == "/remux":
            qs = parse_qs(parsed.query)
            self.remux(
                qs.get("u", [""])[0],
                qs.get("a", ["0"])[0],
                qs.get("ss", ["0"])[0],
            )
            return
        if parsed.path == "/" or parsed.path == "":
            self.path = "/index.html"
        return super().do_GET()

    def remux(self, target, audio_idx, start_s="0"):
        target = unquote(target or "")
        if not target.startswith("http://") and not target.startswith("https://"):
            self.send_error(400, "bad url")
            return
        ff = ffmpeg_exe()
        if not ff:
            self.send_error(500, "ffmpeg missing")
            return
        try:
            a = str(max(0, min(8, int(audio_idx))))
        except Exception:
            a = "0"
        try:
            ss = float(start_s or 0)
        except Exception:
            ss = 0
        cmd = [
            ff, "-hide_banner", "-nostdin", "-loglevel", "error",
            "-user_agent", UA,
            "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "8",
        ]
        if ss > 0.4:
            cmd.extend(["-ss", ("%.3f" % ss)])
        cmd.extend([
            "-i", target,
            "-map", "0:v:0", "-map", "0:a:" + a,
            "-c:v", "copy",
            "-c:a", "aac", "-ac", "2", "-ar", "48000", "-b:a", "160k",
            "-sn", "-dn",
            "-f", "mpegts", "-mpegts_flags", "+resend_headers",
            "pipe:1",
        ])
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=65536
        )
        try:
            self.send_response(200)
            self.send_header("Content-Type", "video/MP2T")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            while True:
                chunk = proc.stdout.read(65536)
                if not chunk:
                    break
                self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            try:
                proc.kill()
            except Exception:
                pass
            try:
                proc.wait(timeout=2)
            except Exception:
                pass

    def proxy(self, target):
        target = unquote(target or "")
        if not target.startswith("http://") and not target.startswith("https://"):
            self.send_error(400, "bad url")
            return
        headers = {"User-Agent": UA}
        rng = self.headers.get("Range")
        if rng:
            headers["Range"] = rng
        try:
            req = Request(target, headers=headers)
            with urlopen(req, timeout=180) as resp:
                final = resp.geturl() or target
                ctype = resp.headers.get("Content-Type") or "application/octet-stream"
                path = urlparse(final).path.lower()
                src_path = urlparse(target).path.lower()
                is_m3u = (
                    src_path.endswith(".m3u8")
                    or path.endswith(".m3u8")
                    or "mpegurl" in ctype.lower()
                    or "m3u8" in ctype.lower()
                )
                if is_m3u:
                    data = rewrite_m3u8(resp.read(), final)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/vnd.apple.mpegurl")
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return
                self.send_response(getattr(resp, "status", 200))
                self.send_header("Content-Type", ctype)
                is_ts = (
                    path.endswith(".ts")
                    or src_path.endswith(".ts")
                    or "mp2t" in ctype.lower()
                )
                if resp.headers.get("Content-Range"):
                    self.send_header("Content-Range", resp.headers.get("Content-Range"))
                    clen = resp.headers.get("Content-Length")
                    if clen:
                        self.send_header("Content-Length", clen)
                elif not is_ts:
                    clen = resp.headers.get("Content-Length")
                    if clen:
                        self.send_header("Content-Length", clen)
                self.end_headers()
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except HTTPError as e:
            body = e.read() if e.fp else b""
            self.send_response(e.code)
            self.send_header(
                "Content-Type",
                e.headers.get("Content-Type", "text/plain") if e.headers else "text/plain",
            )
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if body:
                self.wfile.write(body)
        except Exception as e:
            msg = str(e).encode("utf-8", "replace")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)


if __name__ == "__main__":
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("VELA preview  http://127.0.0.1:%s" % PORT, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
