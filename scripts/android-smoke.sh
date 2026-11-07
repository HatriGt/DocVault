#!/usr/bin/env bash
# Installs the APK on a running emulator, launches it, and fails with the crash
# stack (as GitHub annotations) if the app dies during startup.
set -u
APK="$1"
PKG=com.hatrigt.docvault
adb wait-for-device
adb install -r -g "$APK" || { echo "::error::adb install failed"; exit 1; }
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 30
adb logcat -d -v brief > logcat.txt
adb shell screencap -p /sdcard/smoke.png && adb pull /sdcard/smoke.png smoke.png >/dev/null || true

PID=$(adb shell pidof "$PKG" | tr -d '\r')
CRASH=$(grep -nE "FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|Fatal signal|libc *:|DEBUG *:|SoLoader|UnsatisfiedLink|Invariant Violation|TypeError|ReferenceError|Error:" logcat.txt | grep -iE "$PKG|AndroidRuntime|ReactNativeJS|Fatal|DEBUG|Error" | head -60)

if [ -z "$PID" ] || grep -q "FATAL EXCEPTION" logcat.txt; then
  echo "App is not running after launch (pid='${PID}')."
  # One annotation per line, so the messages can be read without logs access.
  echo "$CRASH" | head -40 | while IFS= read -r line; do
    echo "::error title=Startup crash::${line//%/%25}"
  done
  exit 1
fi
echo "App is running (pid $PID)."
[ -n "$CRASH" ] && echo "$CRASH" | head -20 | while IFS= read -r line; do echo "::warning title=Startup log::${line//%/%25}"; done
exit 0
