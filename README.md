# 🍪 Cookie Eater

**Cookie Eater** is a powerful, privacy-focused browser extension designed to give you control over your online data. It automatically handles annoying cookie consent banners, blocks invasive trackers, and protects your browser from advanced fingerprinting techniques.

---

## 📥 Installation

### Official Store

- **Firefox:** [Get Cookie Eater on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/cookie-eater/)
- **Chrome/Edge/Brave:** Coming soon to the Web Store.

### Manual Install (Developer Mode)

#### Chrome / Edge / Brave

1.  Download or clone this repository.
2.  Open your browser and navigate to `chrome://extensions`.
3.  Enable **"Developer mode"** in the top right corner.
4.  Click **"Load unpacked"** and select the extension folder.

#### Firefox

1.  Open Firefox and type `about:debugging` in the address bar.
2.  Click on **"This Firefox"** on the left sidebar.
3.  Click **"Load Temporary Add-on..."** and select the `manifest.json` file from the project folder.

---

## 🚀 Key Features

### 1. Smart Banner Rejection

- **Automatic "Reject All":** Uses surgical logic to detect and click "Reject", "No thanks", or "Necessary only" buttons on thousands of websites.
- **Multi-Step Bypass:** Handles complex consent panels (like Didomi, OneTrust, and Cookiebot) by opening settings and opting out automatically.
- **Universal Support:** Supports multiple languages including English, Portuguese, Spanish, French, German, and Italian.

### 2. Network Privacy & Tracker Blocking

- **Active Tracker Blocking:** Intercepts and blocks requests to known analytics and advertising services (Google Analytics, Facebook Pixel, Hotjar, etc.).
- **URL Cleaning:** Automatically strips tracking parameters like `utm_source`, `fbclid`, and `gclid` from URLs.

### 3. Advanced Anti-Fingerprinting

- **API Noise:** Protects against profiling by adding subtle random noise to Canvas, WebGL, and AudioContext APIs.
- **Hardware Masking:** Spoofs hardware concurrency and device memory to prevent unique device identification.

### 4. Storage & Cookie Automation

- **Auto-Delete:** Optionally clears cookies for a domain as soon as you close its last open tab.
- **Scheduled Cleanups:** Set intervals to automatically purge non-whitelisted cookies.

---

## 📁 File Structure

```text
cookie-eater/
├── manifest.json         # Extension configuration (Firefox/Gecko)
├── background.js         # Service worker for stats, sync, and network monitoring
├── content.js            # Surgical script for banner rejection
├── content-privacy.js    # Anti-fingerprinting and URL cleaning
├── rules.json            # DeclarativeNetRequest blocking rules
├── popup.html / .js      # Quick interface and cookie controls
├── options.html / .js    # Advanced settings and reports
└── icons/                # Extension icons
```
