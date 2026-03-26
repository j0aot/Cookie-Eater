# 🍪 Cookie Eater

Extension for Chrome/Edge/Brave that automatically protects your privacy:
- **Rejects cookie banners** on thousands of sites (with granular rejection fallback).
- **Blocks network trackers and analytics** (Google Analytics, Facebook Pixel, Hotjar, etc.).
- **Syncs your settings** securely via your browser's cloud.

---

## 🚀 Installation & Testing

### Chrome / Edge / Brave

1. Open your browser and go to `chrome://extensions` (or `edge://extensions`).
2. Enable **"Developer mode"** in the top right corner.
3. Click on **"Load unpacked"**.
4. Select the folder containing the extension files (where `manifest.json` is located).
5. ✅ Done! Pin the icon to your toolbar for quick access.

### Firefox

> Firefox uses Manifest V2. To port it, you will need to adjust the `manifest.json` and use `browser.*` instead of `chrome.*`.

---

## 🛡️ Features Included

### 1. Cookie Banner Management
- **Auto-click "Reject All":** Works with OneTrust, Cookiebot, Didomi, Axeptio, Klaro, and more.
- **Granular Rejection:** If the total rejection button is hidden, the extension opens the preferences panel and saves the essential settings by default.

### 2. Network Blocking (Trackers)
Uses the high-performance `declarativeNetRequest` API to intercept requests.
| Category | Blocked Services |
|---|---|
| **Analytics** | Google Analytics, Matomo, Piwik PRO, Amplitude, Mixpanel, Segment |
| **Heatmaps** | Hotjar, Mouseflow, Crazy Egg, FullStory, Microsoft Clarity, LogRocket, Heap |
| **Ads** | Facebook Pixel, Google Tag Manager, DoubleClick, Twitter Ads, LinkedIn Insight, Bing Ads, TikTok Ads |

### 3. Advanced Privacy & Synchronization
- Cloud sync for your whitelist, site rules, and profiles.
- Protection against fingerprinting (Canvas, WebGL).
- Automatic URL cleaning (removes `utm_`, `fbclid`, etc.).

---

## 📁 File Structure

```text
cookie-guardian/
├── manifest.json         # Extension configuration (Manifest V3)
├── content.js            # Script to reject banners and save preferences
├── content-privacy.js    # Anti-fingerprinting and URL cleaning script
├── background.js         # Service worker (Statistics and Cloud Sync)
├── rules.json            # Network blocking rules
├── popup.html / .js      # Quick interface (icon click)
├── options.html / .js    # Advanced settings screen
└── icons/                # Extension icons