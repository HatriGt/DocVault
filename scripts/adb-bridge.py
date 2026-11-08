#!/usr/bin/env python3
"""
Tiny token-protected HTTP bridge to adb, for remote testing from tools that can
only make HTTPS requests (no SSH / WebSockets). Run it on the machine that has
adb and the emulator/device:

    BRIDGE_TOKEN=some-long-random-secret python3 adb-bridge.py   # listens on :3000

Endpoints (all require header  X-Token: <BRIDGE_TOKEN>):
    GET  /health                    -> "ok" + `adb devices`
    POST /install   (body = APK)    -> adb install -r -g
    POST /adb       (body = args)   -> runs `adb <args>` (shell-split), returns output
    GET  /screenshot                -> PNG of the current screen
    GET  /logcat?lines=500          -> recent logcat (threadtime)

Only run this in a disposable sandbox. Anyone with the token can control the device.
"""
import http.server
import os
import shlex
import subprocess
import tempfile
import urllib.parse

TOKEN = os.environ.get("BRIDGE_TOKEN")
PORT = int(os.environ.get("PORT", "3000"))
if not TOKEN or len(TOKEN) < 16:
    raise SystemExit("Set BRIDGE_TOKEN to a random secret of 16+ characters.")


def run(args, timeout=180, binary=False):
    p = subprocess.run(["adb", *args], capture_output=True, timeout=timeout)
    return p.returncode, (p.stdout if binary else (p.stdout + p.stderr))


class H(http.server.BaseHTTPRequestHandler):
    def _ok(self):
        if self.headers.get("X-Token") != TOKEN:
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"unauthorized")
            return False
        return True

    def _send(self, code, body, ctype="text/plain; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length", "0"))
        return self.rfile.read(n) if n else b""

    def do_GET(self):
        if not self._ok():
            return
        url = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(url.query)
        try:
            if url.path == "/health":
                _, out = run(["devices"], 20)
                self._send(200, b"ok\n" + out)
            elif url.path == "/screenshot":
                code, png = run(["exec-out", "screencap", "-p"], 30, binary=True)
                self._send(200 if code == 0 else 500, png, "image/png")
            elif url.path == "/logcat":
                lines = q.get("lines", ["500"])[0]
                _, out = run(["logcat", "-d", "-v", "threadtime", "-t", str(int(lines))], 30)
                self._send(200, out)
            else:
                self._send(404, "not found")
        except subprocess.TimeoutExpired:
            self._send(504, "adb timed out")

    def do_POST(self):
        if not self._ok():
            return
        url = urllib.parse.urlparse(self.path)
        try:
            if url.path == "/install":
                with tempfile.NamedTemporaryFile(suffix=".apk", delete=False) as f:
                    f.write(self._body())
                code, out = run(["install", "-r", "-g", f.name], 300)
                os.unlink(f.name)
                self._send(200 if code == 0 else 500, out)
            elif url.path == "/adb":
                args = shlex.split(self._body().decode())
                code, out = run(args, 180)
                self._send(200 if code == 0 else 500, out)
            else:
                self._send(404, "not found")
        except subprocess.TimeoutExpired:
            self._send(504, "adb timed out")

    def log_message(self, fmt, *a):
        print("%s %s" % (self.address_string(), fmt % a))


if __name__ == "__main__":
    print(f"adb bridge on :{PORT}")
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
