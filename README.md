# Cookie Eater

Cookie Eater is a privacy-focused browser extension that helps reduce cookie and tracker noise while keeping controls transparent.

## Status

- Current version: `2.1.0`
- Firefox build uses: `manifest.json`
- Chromium build (Chrome/Edge/Brave) uses: `manifest_chrome.json`

## Features

- Automatic cookie banner handling (reject/preferences flows)
- Domain cookie cleanup (single site or global)
- Scheduled cleanup that respects whitelist and site rules
- URL tracking parameter stripping (`utm_*`, `fbclid`, `gclid`, etc.)
- Tracker domain mapping and risk scoring
- Tracker metrics split into:
  - detected tracker requests
  - blocked tracker requests
- Optional localStorage/sessionStorage cleanup for known tracker keys
- Optional anti-fingerprinting hardening (canvas/audio/webgl related)
- Profiles, audit log, GDPR receipts, and JSON import/export

## Installation

### Firefox (Developer Mode)

1. Open `about:debugging`.
2. Go to **This Firefox**.
3. Click **Load Temporary Add-on...**.
4. Select `manifest.json` from this repository.

- or you can download it on the store https://addons.mozilla.org/pt-PT/firefox/addon/cookie-eater/

### Chrome / Edge / Brave (Developer Mode)

Chromium requires the Chrome-specific manifest (`manifest_chrome.json`).

1. Clone or download this repository.
2. Create a copy of the project folder for Chromium.
3. In that copy, rename `manifest_chrome.json` to `manifest.json`.
4. Open `chrome://extensions` (or `edge://extensions`).
5. Enable **Developer mode**.
6. Click **Load unpacked** and select the Chromium folder copy.

Example in PowerShell (inside project root):

```powershell
Copy-Item . ..\cookierefuser-chromium -Recurse -Force
Copy-Item ..\cookierefuser-chromium\manifest_chrome.json ..\cookierefuser-chromium\manifest.json -Force
```

## Main Settings

- `enabled`: Global protection toggle
- `autoDeleteOnTabClose`: Deletes site cookies when the last tab for that domain is closed
- `scheduledCleaningIntervalHours`: Periodic cleanup interval (hours)
- `contextMenuEnabled`: Enables/disables right-click shortcuts
- `showBadgeCount`: Shows per-site cookie count on extension badge
- `autoIncognitoThreshold`: Suggests incognito for high-risk domains

## Privacy Notes

- No remote telemetry is implemented in the extension logic.
- UI assets no longer depend on external font/favicon providers.
- Data is stored in browser extension storage (`storage.local` / `storage.sync`).

## Project Structure

```text
cookierefuser/
|-- manifest.json           # Firefox manifest
|-- manifest_chrome.json    # Chromium manifest
|-- background.js           # Core logic, stats, cleanup, messaging, alarms
|-- content.js              # Cookie banner automation
|-- content-privacy.js      # URL/storage/fingerprint protections
|-- popup.html
|-- popup.js                # Quick actions UI
|-- options.html
|-- options.js              # Full settings/report UI
|-- rules.json              # DeclarativeNetRequest tracker rules
`-- icons/
```

## Development Quick Checks

Run syntax checks after changes:

```powershell
node --check background.js
node --check content.js
node --check content-privacy.js
node --check popup.js
node --check options.js
```
