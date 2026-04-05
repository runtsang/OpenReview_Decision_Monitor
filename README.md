# OpenReview Decision Monitor

Chrome extension for monitoring OpenReview decisions.

Chinese version: [README.zh-CN.md](./README.zh-CN.md)

## Before You Start

1. Use Google Chrome.
2. Download this project to your computer and unzip it into a normal folder.
3. The folder you should load into Chrome is `openreview-decision-monitor/`, not the repository root, because `manifest.json` is inside that folder.

## 1. Download the Extension

1. Download this project to your local machine. You can either download a ZIP archive or use `git clone`.
2. If you downloaded a ZIP file, unzip it first.
3. Open the project directory and make sure there is a folder named `openreview-decision-monitor/`.
4. Open `openreview-decision-monitor/` and confirm that `manifest.json` is there. Chrome can only load a folder that contains this file.

## 2. Load the Extension in Chrome

1. Open `chrome://extensions/` in Chrome.
2. Turn on `Developer mode` in the top-right corner of the Extensions page.
3. After that, the `Load unpacked` button should appear.
4. Click `Load unpacked`.
5. In the file picker, select the `openreview-decision-monitor/` folder.
6. If the extension loads successfully, you will see `OpenReview Decision Monitor` in the extension list.

## If You Cannot See `Load unpacked`

1. Make sure `Developer mode` is turned on. The button only appears after Developer mode is enabled.
2. If Developer mode is already on but the button is still missing, refresh `chrome://extensions/` and check again.
3. If the browser window is too small, the toolbar can be easy to miss. Enlarge the window and check the top area again.
4. If you are using a Chrome browser managed by your school, company, or lab, admin policies may block unpacked extensions. Open `chrome://management/` to check whether the browser is managed.
5. If the browser is managed, the practical solution is usually to switch to a personal device or a personal Chrome profile. Otherwise, you need the administrator to allow unpacked extensions.

## 3. Basic Usage

1. Open an OpenReview paper page such as `https://openreview.net/forum?id=...`.
2. A `Monitor Decision` button will appear on the page. Click it to add the current paper to your watch list.
3. You can also use the inline monitor controls on OpenReview Authors pages.
4. Click the extension icon in the browser toolbar to view monitored papers, refresh status manually, or open the settings page.
5. In the settings page, you can change the language, polling interval, and notification methods.

## Tips

1. If Chrome warns that the extension comes from an unpacked directory, that is expected because the extension is loaded locally through Developer mode.
2. If Chrome shows an error while loading, first make sure you selected the `openreview-decision-monitor/` folder and confirm that `manifest.json` is inside it.
