# OpenReview Decision Monitor

A Chrome/Edge Manifest V3 extension that tracks OpenReview submission decisions and notifies you when a decision appears.

## Features

- Injects a `Monitor Decision` button on `https://openreview.net/forum?id=...` pages.
- Works on OpenReview Authors list pages such as `https://openreview.net/group?id=.../Authors` and adds inline controls next to forum links.
- Persists a multi-paper watch list in `chrome.storage.local`.
- Polls on a configurable `chrome.alarms` cadence.
- Uses DOM parsing first so logged-in author-only decisions can be detected in the browser session.
- Falls back to the OpenReview API when DOM extraction misses.
- Supports bilingual UI (`English` / `中文`) with a switchable interface language.
- Shows a dynamic paper state for each monitored submission: `Waiting`, `Pending`, `Accepted`, or `Rejected`.
- Supports three notification channels:
  - Chrome desktop notifications
  - EmailJS
  - Gmail API via OAuth

## Project Structure

```text
openreview-decision-monitor/
├── background/
│   └── service-worker.js
├── content/
│   ├── content.css
│   └── content.js
├── icons/
├── lib/
│   └── shared.js
├── options/
│   ├── options.css
│   ├── options.html
│   └── options.js
├── popup/
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
├── manifest.json
└── README.md
```

## Install Locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the [`openreview-decision-monitor`](/Users/run/Documents/local experi/codex/openreview-decision-monitor) folder.
5. Open the extension popup or options page to choose language and notification methods.

## Configuration

### Desktop notifications

No extra setup is required. They are enabled by default.

### EmailJS

1. Create an EmailJS account and configure one email service.
2. Create a template that accepts the following params:
   - `to_email`
   - `paper_title`
   - `decision`
   - `paper_url`
   - `check_time`
3. Open the extension options page and fill in:
   - Public key
   - Service ID
   - Template ID
   - Recipient email

### Gmail API

1. Create a Google Cloud project and enable the Gmail API.
2. Create an OAuth client that allows the redirect returned by `chrome.identity.getRedirectURL("gmail-oauth2")`.
3. Paste the client ID into the options page.
4. Click `Authorize Gmail`.
5. Set the recipient email used for outgoing decision mails.

## Notes

- The DOM strategy is the primary path because it reuses your logged-in browser session.
- The API fallback calls `https://api2.openreview.net/notes?forum=...` with `credentials: "include"`.
- Gmail OAuth tokens obtained by `launchWebAuthFlow` expire. Re-authorize when the token expires.
- On Authors pages, the extension looks for `forum?id=...` links and injects inline `status + refresh + monitor` controls.
