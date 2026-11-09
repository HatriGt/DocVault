#!/usr/bin/env python3
"""
Tiny token-protected HTTP bridge to adb, for remote testing from tools that can
only make HTTPS requests (no SSH / WebSockets). Run it on the machine that has
adb and the emulator/device:

    BRIDGE_TOKEN=some-long-random-secret python3 adb-bridge.py   # listens on :3000

Endpoints (all require header  X-Token: <BRIDGE_TOKEN>):
    GET  /health                    -> "ok" + `adb devices`
    POST /install   (body = APK)    -> adb install -r -g
    POST /install-url (body = URL)  -> downloads an .apk (or .zip with one) and installs it
    POST /adb       (body = args)   -> runs `adb <args>` (shell-split), returns output
    GET  /screenshot                -> PNG of the current screen
    GET  /logcat?lines=500          -> recent logcat (threadtime)
    POST /build     (body = branch) -> starts scripts/sandbox-build.sh in the background
    GET  /build?lines=80            -> build state (idle/running/ok/failed) + log tail

Only run this in a disposable sandbox. Anyone with the token can control the device.
"""
import http.server
import threading
import time
import os
import shlex
import subprocess
import tempfile
import urllib.parse
import urllib.request
import zipfile

TOKEN = os.environ.get("BRIDGE_TOKEN")
PORT = int(os.environ.get("PORT", "3000"))
if not TOKEN or len(TOKEN) < 16:
    raise SystemExit("Set BRIDGE_TOKEN to a random secret of 16+ characters.")


BUILD_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sandbox-build.sh")
BUILD_LOG = os.path.join(tempfile.gettempdir(), "docvault-build.log")
build = {"state": "idle", "branch": None, "started": None, "finished": None}
build_lock = threading.Lock()


def start_build(branch):
    with build_lock:
        if build["state"] == "running":
            return False
        build.update(state="running", branch=branch, started=time.time(), finished=None)

    def work():
        with open(BUILD_LOG, "w") as log:
            code = subprocess.call(["bash", BUILD_SCRIPT, branch], stdout=log, stderr=subprocess.STDOUT)
        build.update(state="ok" if code == 0 else "failed", finished=time.time())

    threading.Thread(target=work, daemon=True).start()
    return True


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
        try:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            # The caller (or the HTTPS gateway) gave up before a slow adb command finished.
            pass

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
            elif url.path == "/build":
                lines = int(q.get("lines", ["80"])[0])
                tail = ""
                if os.path.exists(BUILD_LOG):
                    with open(BUILD_LOG, errors="replace") as f:
                        tail = "".join(f.readlines()[-lines:])
                end = build["finished"] or time.time()
                secs = int(end - build["started"]) if build["started"] else 0
                self._send(200, f"state={build['state']} branch={build['branch']} seconds={secs}\n{tail}")
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
            elif url.path == "/install-url":
                # Body = URL of an .apk or a .zip containing one (e.g. a nightly.link artifact).
                # The sandbox downloads it itself, avoiding large uploads through the gateway.
                src = self._body().decode().strip()
                if not src.startswith("https://"):
                    return self._send(400, "https URL required")
                with tempfile.TemporaryDirectory() as d:
                    path = os.path.join(d, "download")
                    urllib.request.urlretrieve(src, path)
                    apk = path
                    if zipfile.is_zipfile(path):
                        with zipfile.ZipFile(path) as z:
                            names = [n for n in z.namelist() if n.endswith(".apk")]
                            if not names:
                                return self._send(400, "zip contains no .apk")
                            apk = z.extract(names[0], d)
                    code, out = run(["install", "-r", "-g", apk], 300)
                self._send(200 if code == 0 else 500, out)
            elif url.path == "/build":
                branch = self._body().decode().strip() or "main"
                if not all(ch.isalnum() or ch in "-_./" for ch in branch) or branch.startswith("-"):
                    return self._send(400, "bad branch name")
                if not start_build(branch):
                    return self._send(409, "a build is already running")
                self._send(202, f"build started for {branch}; poll GET /build")
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
