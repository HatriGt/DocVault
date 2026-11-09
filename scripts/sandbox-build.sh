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

# Make sure an emulator is up before spending time on the build (the sandbox
# machine can be suspended, which kills it). Starts the first AVD if none is running.
ensure_device() {
  if adb devices | grep -qE "\sdevice$"; then return 0; fi
  wait_boot() {
    for _ in $(seq 1 90); do
      adb connect localhost:5555 >/dev/null 2>&1 || true
      [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && { step "Android booted"; return 0; }
      sleep 4
    done
    return 1
  }
  # Sandboxes that run Android in a container (redroid): restart it when adb sees it offline.
  local ctr="${DOCVAULT_ANDROID_CONTAINER:-}"
  [ -z "$ctr" ] && command -v docker >/dev/null && ctr=$(docker ps -a --format '{{.Names}} {{.Image}}' 2>/dev/null | grep -iE "redroid|android" | head -1 | cut -d' ' -f1)
  if [ -n "$ctr" ]; then
    step "Restarting Android container $ctr"
    adb disconnect >/dev/null 2>&1 || true
    docker restart "$ctr" >/dev/null && wait_boot && return 0
    echo "Android container $ctr did not come back"; docker logs --tail 20 "$ctr" 2>&1; return 1
  fi
  local emu=""
  for c in "${DOCVAULT_EMULATOR:-}" "$ANDROID_HOME/emulator/emulator" "$(command -v emulator 2>/dev/null)" \
           "$HOME/Android/Sdk/emulator/emulator" /opt/android-emulator/emulator /opt/emulator/emulator /usr/local/bin/emulator; do
    [ -n "$c" ] && [ -x "$c" ] && { emu="$c"; break; }
  done
  if [ -z "$emu" ]; then
    echo "No device and no emulator binary found. Diagnostics:"
    ps -eo pid,cmd | grep -iE "emulator|qemu|android|redroid|waydroid|anbox" | grep -v grep | head -10
    find / -xdev -maxdepth 6 \( -name emulator -o -name "*.avd" -o -name "start-android*" \) 2>/dev/null | head -20
    ls "$HOME/.android/avd" 2>/dev/null
    return 1
  fi
  local avd="${DOCVAULT_AVD:-$("$emu" -list-avds | head -1)}"
  [ -n "$avd" ] || { echo "No device and no AVD found"; return 1; }
  step "Starting emulator $avd"
  adb kill-server >/dev/null 2>&1 || true
  DISPLAY="${DISPLAY:-:0}" nohup "$emu" -avd "$avd" -no-audio -no-boot-anim >"$HOME/docvault-emulator.log" 2>&1 &
  adb start-server >/dev/null 2>&1 || true
  for _ in $(seq 1 90); do
    [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && { step "Emulator booted"; return 0; }
    sleep 4
  done
  echo "Emulator did not boot; see ~/docvault-emulator.log"; tail -20 "$HOME/docvault-emulator.log"; return 1
}
ensure_device

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

# TLS-inspecting sandbox proxies: curl/npm trust their CA via the system store or
# NODE_EXTRA_CA_CERTS, but Java has its own store. Build one that includes it.
EXTRA_CA="${DOCVAULT_EXTRA_CA:-${NODE_EXTRA_CA_CERTS:-}}"
if [ -z "$EXTRA_CA" ]; then
  for f in /usr/local/share/ca-certificates/*proxy*.crt; do [ -f "$f" ] && EXTRA_CA="$f" && break; done
fi
if [ -n "$EXTRA_CA" ] && [ -f "$EXTRA_CA" ]; then
  JHOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
  STORE="$HOME/.docvault-cacerts"
  if [ ! -f "$STORE" ] || [ "$EXTRA_CA" -nt "$STORE" ]; then
    step "Adding $(basename "$EXTRA_CA") to a Java trust store"
    cp "$JHOME/lib/security/cacerts" "$STORE"
    chmod u+w "$STORE"
    keytool -importcert -noprompt -trustcacerts -alias sandbox-proxy -file "$EXTRA_CA" -keystore "$STORE" -storepass changeit >/dev/null
  fi
  # Applies to the Gradle wrapper, daemon and Kotlin compiler JVMs alike.
  export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Djavax.net.ssl.trustStore=$STORE -Djavax.net.ssl.trustStorePassword=changeit"
  ./android/gradlew --stop >/dev/null 2>&1 || true   # daemons started without the store must not be reused
fi

# Java ignores HTTPS_PROXY; pass it to Gradle if the sandbox uses one.
GRADLE_NET=()
if [ -n "${HTTPS_PROXY:-${https_proxy:-}}" ]; then
  hp="${HTTPS_PROXY:-$https_proxy}"; hp="${hp#*://}"; hp="${hp##*@}"; hp="${hp%%/*}"
  GRADLE_NET+=("-Dhttps.proxyHost=${hp%%:*}" "-Dhttps.proxyPort=${hp##*:}" "-Dhttp.proxyHost=${hp%%:*}" "-Dhttp.proxyPort=${hp##*:}")
fi
# Fewer parallel downloads and retries: the sandbox network drops handshakes under load.
GRADLE_NET+=("-Dorg.gradle.internal.http.connectionTimeout=60000" "-Dorg.gradle.internal.http.socketTimeout=60000" "-Dorg.gradle.internal.repository.max.retries=5")

cd android
for attempt in 1 2 3 4 5 6 7 8; do
  step "Gradle assembleRelease ($ABI), attempt $attempt"
  if ./gradlew assembleRelease --build-cache --parallel -PreactNativeArchitectures="$ABI" "${GRADLE_NET[@]}" 2>&1 | tee /tmp/docvault-gradle.log; then
    break
  fi
  if [ "$attempt" = 8 ] || ! grep -qE "Could not (resolve|GET|download)|handshake|Connection reset|timed out" /tmp/docvault-gradle.log; then
    echo "BUILD FAILED"; exit 1
  fi
  step "Network error while downloading dependencies; retrying with fewer workers"
  GRADLE_NET+=("--max-workers=1" "-Dorg.gradle.parallel=false")
done

APK=app/build/outputs/apk/release/app-release.apk
step "Installing $(du -h "$APK" | cut -f1) APK"
adb install -r -g "$APK"
echo "BUILD OK"
