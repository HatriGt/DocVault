#!/usr/bin/env bash
# Keeps an instabox sandbox from auto-suspending while it's used for remote testing.
# Instabox pauses a machine after a stretch of idleness (no agent, no terminal, little CPU);
# each run makes a little of the activity it counts: an inbound request through the public
# port URL and a short CPU burst. Installed as a systemd timer by:
#   sudo scripts/sandbox-keepalive.sh install [public-url]      (every 20 minutes)
#   sudo scripts/sandbox-keepalive.sh uninstall
# The official alternative, if your plan allows it: `instabox auto-suspend <machine> 0`.
set -euo pipefail

URL_FILE=/etc/sandbox-keepalive.url

ping_once() {
  local url; url=$(cat "$URL_FILE" 2>/dev/null || true)
  [ -n "$url" ] && curl -s -o /dev/null -m 20 "$url" || true
  # ~20 s of real work on one core.
  timeout 20 sh -c 'while :; do head -c 50M /dev/zero | sha256sum >/dev/null; done' || true
  logger -t sandbox-keepalive "ping ${url:-<no url>}"
}

case "${1:-ping}" in
  ping) ping_once ;;
  install)
    [ -n "${2:-}" ] && echo "$2" > "$URL_FILE"
    install -m 755 "$0" /usr/local/bin/sandbox-keepalive
    cat > /etc/systemd/system/sandbox-keepalive.service <<UNIT
[Unit]
Description=Keep the instabox sandbox from auto-suspending
[Service]
Type=oneshot
Nice=10
ExecStart=/usr/local/bin/sandbox-keepalive ping
UNIT
    cat > /etc/systemd/system/sandbox-keepalive.timer <<UNIT
[Unit]
Description=Run sandbox-keepalive every 20 minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=20min
AccuracySec=30s
Persistent=true
[Install]
WantedBy=timers.target
UNIT
    systemctl daemon-reload
    systemctl enable --now sandbox-keepalive.timer
    systemctl start sandbox-keepalive.service
    systemctl list-timers sandbox-keepalive.timer --no-pager
    ;;
  uninstall)
    systemctl disable --now sandbox-keepalive.timer || true
    rm -f /etc/systemd/system/sandbox-keepalive.{service,timer} /usr/local/bin/sandbox-keepalive "$URL_FILE"
    systemctl daemon-reload
    ;;
  *) echo "usage: $0 [ping|install [url]|uninstall]"; exit 2 ;;
esac
