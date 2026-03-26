🍪 Cookie Eater

Cookie Eater is a powerful, privacy-focused browser extension designed to give you control over your online data. It automatically handles annoying cookie consent banners, blocks invasive trackers, and protects your browser from advanced fingerprinting techniques.
🚀 Key Features

1. Smart Banner Rejection

   Automatic "Reject All": Uses advanced surgical logic to detect and click "Reject", "No thanks", or "Necessary only" buttons on thousands of websites.

   Multi-Step Bypass: Handles complex consent panels (like Didomi, OneTrust, and Cookiebot) by opening settings, opting out, and saving your preferences automatically.

   Universal Support: Supports multiple languages including English, Portuguese, Spanish, French, German, and Italian.

2. Network Privacy & Tracker Blocking

   Active Tracker Blocking: Intercepts and blocks requests to known analytics, heatmaps, and advertising services (Google Analytics, Facebook Pixel, Hotjar, etc.).

   URL Cleaning: Automatically strips tracking parameters like utm_source, fbclid, and gclid from URLs to keep your browsing history clean.

3. Advanced Anti-Fingerprinting

   API Noise: Protects against browser profiling by adding subtle random noise to Canvas, WebGL, and AudioContext APIs.

   Hardware Masking: Spoofs hardware concurrency, device memory, and screen depth to prevent sites from creating a unique hardware ID for your device.

4. Storage & Cookie Automation

   Auto-Delete: Optionally clears cookies for a domain as soon as you close its last open tab.

   Storage Cleaning: Regularly wipes tracking-related data from localStorage and sessionStorage.

   Scheduled Cleanups: Set intervals to automatically purge non-whitelisted cookies.

🛠️ Installation
Chrome / Edge / Brave (Manifest V3)

    Download or clone this repository.

    Open your browser and navigate to chrome://extensions.

    Enable "Developer mode" in the top right corner.

    Click "Load unpacked" and select the extension folder.

Firefox (Manifest V3)

    Open Firefox and type about:debugging in the address bar.

    Click on "This Firefox" on the left sidebar.

    Click "Load Temporary Add-on..." and select the manifest.json file from the project folder.

📁 File Structure
Plaintext

cookie-eater/
├── manifest.json # Extension configuration (Firefox/Gecko)
├── background.js # Service worker for stats, sync, and network monitoring
├── content.js # Surgical script for banner rejection
├── content-privacy.js # Anti-fingerprinting and URL cleaning
├── rules.json # DeclarativeNetRequest blocking rules
├── popup.html / .js # Quick interface and cookie controls
├── options.html / .js # Advanced settings and reports
└── icons/ # Extension icons

🛡️ Privacy Policy

Cookie Eater is built with privacy at its core. No data is ever collected or sent to external servers. All processing, from cookie classification to tracker blocking, happens locally on your machine. Your settings are only synced via your browser's official sync service if enabled.
