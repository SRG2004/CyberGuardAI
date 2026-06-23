# CyberGuard AI — Chrome Extension

## Loading the Extension (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. The CyberGuard AI icon will appear in your toolbar

## Configuration

By default, the extension connects to:
- **Development**: `http://localhost:5000` (local backend)
- **Production**: Update `DEFAULT_API` in `background.js` to your deployed backend URL

To change the API URL:
1. Click the CyberGuard extension icon
2. Go to Settings
3. Update the API URL field

## Features (v2.0.0)

- **Real-time URL scanning** — All links on a page are analyzed by the ML model
- **Email phishing detection** — Works on Gmail, Outlook, Yahoo Mail, ProtonMail
- **Form interception** — Detects credential-harvesting forms
- **Iframe analysis** — Flags hidden or cross-origin iframes
- **DOM anomaly detection** — Transparent overlays, clickjacking, favicon mismatches
- **JS obfuscation signals** — `eval()`, `document.write()`, base64 encoding patterns
- **Redirect chain tracking** — Monitors excessive redirects
- **Clipboard hijacking detection** — Alerts when pages intercept clipboard events

## Permissions Used

| Permission | Why |
|---|---|
| `activeTab` | Access the current page for scanning |
| `storage` | Save settings and session data |
| `alarms` | Periodic blocklist sync |
| `notifications` | Alert user of threats |
| `tabs` | Track page navigation |
| `webNavigation` | Detect redirect chains |

## Chrome Web Store Submission

To publish on Chrome Web Store:
1. Create a [Chrome Developer account](https://chrome.google.com/webstore/devconsole) ($5 one-time fee)
2. Zip the `extension/` folder
3. Upload to the Developer Dashboard
4. Fill in listing details, screenshots, and privacy policy
5. Submit for review (typically 1-3 business days)
