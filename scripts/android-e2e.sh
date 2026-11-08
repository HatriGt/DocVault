#!/usr/bin/env bash
# Runs the Maestro e2e flows on the emulator and "listens" to the app:
# app log errors, crashes and failed steps become GitHub annotations.
set -u
APK="$1"
PKG=com.hatrigt.docvault
export PATH="$PATH:$HOME/.maestro/bin"
adb wait-for-device
adb install -r -g "$APK" || { echo "::error::adb install failed"; exit 1; }
adb logcat -c

mkdir -p e2e-out
maestro test .maestro/ --format junit --output e2e-out/report.xml --test-output-dir e2e-out 2>&1 | tee e2e-out/maestro.log
RC=${PIPESTATUS[0]}

adb logcat -d -v threadtime > e2e-out/logcat.txt
PID_LINES=$(grep -E " E ReactNativeJS| E AndroidRuntime|FATAL EXCEPTION|Fatal signal| E unknown:ReactNative" e2e-out/logcat.txt | grep -v "ReactNativeJS: Running" | head -40)
if [ -n "$PID_LINES" ]; then
  echo "$PID_LINES" | while IFS= read -r line; do echo "::error title=App log::${line//%/%25}"; done
fi
grep -E "FAILED|Assertion is false|not found|Exception" e2e-out/maestro.log | head -20 | while IFS= read -r line; do echo "::error title=E2E step::${line//%/%25}"; done
# JS warnings worth seeing (non-fatal)
grep -E " W ReactNativeJS" e2e-out/logcat.txt | head -15 | while IFS= read -r line; do echo "::warning title=App warning::${line//%/%25}"; done

if [ "$RC" -ne 0 ]; then echo "::error title=E2E::Maestro flows failed (exit $RC)"; fi
if [ -n "$PID_LINES" ] && [ "$RC" -eq 0 ]; then echo "::error title=E2E::Flows passed but the app logged errors"; exit 1; fi
exit "$RC"
