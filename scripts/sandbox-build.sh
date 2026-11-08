#!/usr/bin/env bash
# Build DocVault on the sandbox and install it on the connected emulator/device.
# Called by adb-bridge.py (POST /build), or run by hand:  scripts/sandbox-build.sh [branch]
#
# Fast path: keeps the checkout, node_modules, the generated android/ project and
# Gradle caches between runs. npm ci / expo prebuild only re-run when their inputs
# change, so a JS/UI-only change is just an incremental Gradle build.
#
# Optional env file ~/.docvault.env (KEY=value lines) for EXPO_PUBLIC_GOOGLE_* client IDs.
set -euo pipefail

BRANCH="${1:-main}"
REPO="${DOCVAULT_REPO:-https://github.com/HatriGt/DocVault.git}"
DIR="${DOCVAULT_BUILD_DIR:-$HOME/docvault-build}"
ABI="${DOCVAULT_ABI:-$(adb shell getprop ro.product.cpu.abi 2>/dev/null | tr -d '\r' || true)}"
ABI="${ABI:-x86_64}"
step() { echo "==> $*"; }

step "Checking tools"
for t in git node npm java adb; do command -v "$t" >/dev/null || { echo "MISSING TOOL: $t"; exit 2; }; done
: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
[ -d "$ANDROID_HOME" ] || { echo "MISSING: Android SDK (set ANDROID_HOME)"; exit 2; }
export ANDROID_HOME
java -version 2>&1 | head -1

if [ -f "$HOME/.docvault.env" ]; then set -a; . "$HOME/.docvault.env"; set +a; fi
export NODE_ENV=production

step "Fetching $BRANCH"
if [ ! -d "$DIR/.git" ]; then git clone --filter=blob:none "$REPO" "$DIR"; fi
cd "$DIR"
git fetch --quiet origin "$BRANCH"
git checkout --quiet -B "$BRANCH" "origin/$BRANCH"
git reset --quiet --hard "origin/$BRANCH"
git log --oneline -1

# Always run the branch's own copy of this script, so fixes to it apply without
# re-downloading anything on the sandbox.
if [ -z "${DOCVAULT_HANDED_OFF:-}" ] && ! cmp -s "$0" scripts/sandbox-build.sh; then
  step "Using the branch's copy of sandbox-build.sh"
  DOCVAULT_HANDED_OFF=1 exec bash scripts/sandbox-build.sh "$BRANCH"
fi

STAMP=.sandbox-build
mkdir -p "$STAMP"
deps_hash=$(sha256sum package-lock.json | cut -c1-16)
if [ ! -d node_modules ] || [ "$(cat $STAMP/deps 2>/dev/null)" != "$deps_hash" ]; then
  step "Installing dependencies"
  npm ci --legacy-peer-deps --no-audit --no-fund
  echo "$deps_hash" > $STAMP/deps
else
  step "Dependencies unchanged"
fi

native_hash=$( { cat package-lock.json app.json app.config.* plugins/* 2>/dev/null || true; } | sha256sum | cut -c1-16)
if [ ! -d android ] || [ "$(cat $STAMP/native 2>/dev/null)" != "$native_hash" ]; then
  step "Generating native project (expo prebuild)"
  npx expo prebuild --platform android --no-install --clean
  cat >> android/gradle.properties <<'PROPS'

org.gradle.caching=true
org.gradle.parallel=true
org.gradle.daemon=true
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+UseParallelGC -Dfile.encoding=UTF-8
PROPS
  echo "$native_hash" > $STAMP/native
else
  step "Native project unchanged"
fi

step "Gradle assembleRelease ($ABI)"
cd android
./gradlew assembleRelease --build-cache --parallel -PreactNativeArchitectures="$ABI"

APK=app/build/outputs/apk/release/app-release.apk
step "Installing $(du -h "$APK" | cut -f1) APK"
adb install -r -g "$APK"
echo "BUILD OK"
