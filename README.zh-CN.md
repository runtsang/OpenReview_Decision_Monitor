# OpenReview Decision Monitor

用于监控 OpenReview Decision 的 Chrome 插件。

英文版说明： [README.md](./README.md)

## 使用前先确认

1. 请使用 Google Chrome 浏览器。
2. 先把这个项目下载到本地，并解压成普通文件夹。
3. 在 Chrome 里真正需要加载的目录是 `openreview-decision-monitor/`，不是仓库根目录，因为 `manifest.json` 在这个目录里面。

## 1. 下载插件

1. 把这个项目下载到本地。你可以直接下载 ZIP 压缩包，也可以使用 `git clone`。
2. 如果你下载的是 ZIP 文件，请先解压。
3. 打开项目目录，确认里面有一个名为 `openreview-decision-monitor/` 的文件夹。
4. 打开 `openreview-decision-monitor/`，确认里面存在 `manifest.json`。只有包含这个文件的目录才能被 Chrome 正常加载。

## 2. 在 Chrome 中加载插件

1. 在 Chrome 中打开 `chrome://extensions/`。
2. 在扩展管理页面右上角开启 `Developer mode`。
3. 开启后，页面上会出现 `Load unpacked` 按钮。
4. 点击 `Load unpacked`。
5. 在文件选择窗口中选中 `openreview-decision-monitor/` 文件夹。
6. 如果加载成功，你会在扩展列表里看到 `OpenReview Decision Monitor`。

## 如果看不到 `Load unpacked`

1. 先确认 `Developer mode` 已经开启。这个按钮只有在开发者模式开启后才会出现。
2. 如果开发者模式已经开启，但按钮仍然没有出现，刷新 `chrome://extensions/` 页面后再检查一次。
3. 如果浏览器窗口过小，顶部工具栏可能不够明显。把窗口放大后再看页面顶部。
4. 如果你使用的是学校、公司或实验室统一管理的 Chrome，管理员策略可能会禁止加载未打包扩展。可以打开 `chrome://management/` 查看浏览器是否被管理。
5. 如果浏览器被管理，通常更实际的办法是换用个人设备或个人 Chrome 配置文件。否则就需要管理员开放相关权限。

## 3. 基本使用

1. 打开 OpenReview 的论文页面，例如 `https://openreview.net/forum?id=...`。
2. 页面上会出现 `Monitor Decision` 按钮。点击后，当前论文会被加入监控列表。
3. 你也可以在 OpenReview 的 Authors 页面里使用每篇论文旁边的内联监控按钮。
4. 点击浏览器工具栏中的插件图标，可以查看当前监控列表、手动刷新状态，或者打开设置页面。
5. 在设置页面中，你可以调整语言、轮询间隔和通知方式。

## 提示

1. 如果 Chrome 提示该扩展来自未打包目录，这是正常现象，因为这个插件是通过开发者模式本地加载的。
2. 如果加载时报错，先确认你选择的是 `openreview-decision-monitor/` 文件夹，并检查该目录下是否存在 `manifest.json`。
