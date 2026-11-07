# DocVault

**Your important documents should always be with you, even when the internet isn't.**

DocVault is a premium, offline-first personal document wallet for iOS and Android. Store passports, IDs, licences, visas, insurance and certificates; they're encrypted on your phone, backed up to *your own* Google Drive as ciphertext, and open instantly with no connection.

Built with **Expo SDK 58 / React Native 0.88 / TypeScript / Expo Router**.

---

## Features

| Area | What's included |
| --- | --- |
| **Onboarding** | 3-step intro (security, offline, sharing) → Google sign-in or on-device-only vault → recovery key creation and confirmation |
| **Home** | Greeting, live security/sync pill, search, quick actions (Scan / Import / Photos), wallet carousel of essentials, expiry banner, recently opened, categories, recently added, FAB |
| **Documents** | List/grid toggle (remembered), full-text search (name, number, holder, issuer, notes), category chips, offline filter, sort by added/name/opened, per-row actions |
| **Details** | Wallet card with a 3D front/back flip for ID-type documents, masked number with tap-to-reveal, expiry warnings, two-tap **Open** and **Share**, offline toggle, sync status, edit, save a copy, delete |
| **Viewer** | PDFs open in the native viewer (QuickLook / system); images open full-screen with pinch-zoom, pan and double-tap |
| **Add flow** | Camera scan, Photos, Files (incl. Google Drive / iCloud providers) → category and type suggestion → details → review → encrypt → success |
| **Favorites** | Stacked wallet layout, Apple-Wallet style, plus pinned files |
| **Settings** | Google Drive connect, sync dashboard (retry failed, Wi-Fi only, auto-sync), offline storage manager (per-document), app lock (Face ID / fingerprint / 6-digit PIN, auto-lock timer), recovery key rotation, expiry reminders, appearance (system/light/dark), custom categories, privacy explainer, sign out & wipe |
| **States** | Empty, loading, error, success; sync states *Synced · Offline · Syncing · Upload pending · Downloading · Sync failed · Cloud only · On this device* |

## Security architecture (zero knowledge)

```
Recovery key (160-bit, shown once)           ── never stored anywhere by DocVault
   └─ scrypt(N=2^15,r=8,p=1) → KEK ─ wraps ─▶ Vault Master Key (VMK, 256-bit)
VMK                                            ── iOS Keychain / Android Keystore (WHEN_UNLOCKED_THIS_DEVICE_ONLY)
   └─ wraps ─▶ per-document DEK (256-bit, random)
DEK ─ AES-256-GCM ─▶ document bytes            ── AAD binds each ciphertext to its document id
```

* Files are encrypted **before** they are written to disk or uploaded. The on-device copy *is* the ciphertext; plaintext only exists briefly in a cache folder while viewing/sharing and is purged afterwards and on every launch/lock.
* Google Drive (hidden `appDataFolder`, scope `drive.appdata`) contains only:
  * `vault.json`: VMK wrapped by the recovery-key KEK + KDF params
  * `<uuid>.meta`: metadata (name, type, expiry, wrapped DEK…) sealed with the VMK
  * `<uuid>.bin`: document ciphertext

  File names reveal nothing, and not even document titles are readable.
* Google sign-in and encryption are independent: Google tokens can fetch ciphertext but can never unlock it. A new device needs the recovery key.
* App lock (biometrics or scrypt-hashed PIN), privacy shield in the app switcher, and in-memory key eviction on lock.
* No analytics, no servers of our own. Classification runs on-device.

## Offline-first sync

The local SQLite DB is the source of truth; Drive is a replica. `src/lib/sync.ts` runs **pull → resolve → push → download**:

* **Pull** uses the Drive *changes* feed (`spaces=appDataFolder`) for multi-device sync, with a full listing on first run.
* **Conflicts:** metadata is last-writer-wins by `updated_at`. If content changed on both sides, the local version is preserved as a *"(conflict copy)"*, so nothing is lost. Remote deletions don't remove documents that were edited locally.
* **Push:** per-document dirty flags; large files use **resumable uploads** whose session URI is persisted, so an interrupted upload resumes after restart. Retries with exponential backoff; permanent failures surface as *Sync failed* with a retry action.
* **Download:** documents marked *Keep offline* are fetched automatically; *cloud-only* ones download when opened.
* Triggers: app launch, after every change (debounced), when the network reconnects, pull-to-refresh, and OS background tasks (`expo-background-task`).
* A document is **never** removed from the device silently. Switching to cloud-only is refused until the upload is confirmed.

## Project layout

```
src/
  app/                    Expo Router screens
    (tabs)/               Home · Documents · Favorites · Settings
    doc/[id].tsx          Document details
    edit/[id].tsx         Edit details
    viewer/[id].tsx       Zoomable image viewer
    add.tsx               Add / scan flow (modal)
    onboarding.tsx        Intro + sign-in
    recovery/             Recovery key setup & restore
    manage/               Settings sub-screens (sync, storage, security, PIN, recovery, privacy, categories, connect)
  components/             Design system (ui.tsx), wallet cards & doc rows (docs.tsx), sheets, app lock
  lib/                    crypto, keys, db, blobs, drive, google, sync, documents, classify, ocr, notifications…
  theme/                  Tokens (warm off-white, charcoal, single indigo accent, dark mode)
tests/                    Node unit tests (crypto, classification, PDF)
```

## Getting started

```bash
npm install --legacy-peer-deps
cp .env.example .env   # add Google OAuth client IDs (optional; on-device mode works without)
npx expo run:ios       # or: npx expo run:android
```

A **development build** is required (not Expo Go) for Google OAuth redirects, Keychain/Keystore options and background tasks.

### Google Cloud setup

1. Create a project and enable the **Google Drive API**.
2. OAuth consent screen: add scopes `openid`, `email`, `profile`, `.../auth/drive.appdata`.
3. Create OAuth clients: **iOS** (bundle id `com.docvault.app`) and **Android** (package `com.docvault.app` + your signing SHA-1).
4. Put the IDs in `.env`.

### Scripts

```bash
npm run typecheck
npm run lint
npm test
npx expo-doctor
```

## Known limitations and next steps

* **OCR:** text recognition needs a native model that isn't in the Expo SDK. `src/lib/ocr.ts` exposes `registerOcrProvider()`; plug in ML Kit / Apple Vision (e.g. `@react-native-ml-kit/text-recognition`) in a dev build. Until then, suggestions use filenames, and the expiry/number extractors are already implemented and tested.
* **Edge-detected document scanning** (VisionKit / ML Kit Document Scanner) would replace the camera + crop flow.
* **Card back side:** wallet cards render front/back from metadata; attaching a separate back-side photo (`back_id` column) is prepared in the schema but has no UI yet.
* **Encryption runs in JS** (`@noble/ciphers`, audited). It's fine for typical documents (a few MB). For very large files, a native AES-GCM module or chunked streaming encryption would be faster.
* Temporary encrypted share links are intentionally not implemented; sharing uses the native share sheet (AirDrop, Quick Share, etc.) and works offline.
* Not yet run on physical devices or simulators in this environment. Verified with typecheck, lint, unit tests, `expo-doctor`, and production bundles for iOS and Android.
