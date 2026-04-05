- ## Context

  学术会议（NeurIPS、ICML、ICLR 等）在 OpenReview 上的 Decision 发布时间不确定，作者需要反复手动刷新页面查看结果。本方案设计一个 Chrome 浏览器插件，自动定时检测 Decision 状态变化并发送邮件通知，解放作者的精力。

  ------

  ## 可行性分析

  **结论：完全可行。** 理由如下：

  | 关键问题                 | 结论                                                         |
  | ------------------------ | ------------------------------------------------------------ |
  | 能否获取 Decision 数据？ | ✅ OpenReview 提供公开的 API v2，可直接查询论文的 replies（含 Decision），无需登录 |
  | 能否定时轮询？           | ✅ Chrome Extension Manifest V3 的 `chrome.alarms` API 支持最低 1 分钟间隔 |
  | 能否从插件发邮件？       | ✅ 使用 EmailJS 服务（免费额度 200 封/月），纯前端调用，无需后端 |
  | 是否有现成竞品？         | ❌ 目前没有专门的 OpenReview Decision 监控插件                |

  ------

  ## 技术架构

  ```
  ┌─────────────────────────────────────────────────┐
  │                Chrome Extension (MV3)            │
  │                                                  │
  │  ┌──────────────┐   ┌────────────────────────┐  │
  │  │ Content Script│   │   Background Service    │  │
  │  │              │   │       Worker            │  │
  │  │ • 检测当前页面 │   │                        │  │
  │  │   是否为      │   │ • chrome.alarms 定时器  │  │
  │  │   OpenReview  │──▶│ • 调用 OpenReview API   │  │
  │  │ • 提取 forum  │   │ • 对比 Decision 状态    │  │
  │  │   ID         │   │ • 触发 EmailJS 发邮件   │  │
  │  │ • 一键添加监控 │   │ • 触发桌面通知          │  │
  │  └──────────────┘   └────────────────────────┘  │
  │                                                  │
  │  ┌──────────────┐   ┌────────────────────────┐  │
  │  │  Popup Page  │   │    Options Page         │  │
  │  │              │   │                        │  │
  │  │ • 监控列表    │   │ • EmailJS 配置          │  │
  │  │ • 手动刷新    │   │ • 收件邮箱设置          │  │
  │  │ • 删除监控    │   │ • 轮询频率设置          │  │
  │  │ • 状态展示    │   │ • 通知偏好              │  │
  │  └──────────────┘   └────────────────────────┘  │
  └─────────────────────────────────────────────────┘
           │                      │
           ▼                      ▼
    OpenReview API v2         EmailJS API
    (GET /notes)           (发送邮件通知)
  ```

  ------

  ## 认证问题与解决方案

  **核心问题**：OpenReview 的 Decision 在公开发布之前，只有论文作者登录后才能看到。纯 API 调用如果不带认证信息，无法获取未公开的 Decision。

  **解决方案**：利用浏览器中已登录的 session，通过两种互补方式获取数据：

  | 方式                   | 原理                                                | 优点                       | 缺点              |
  | ---------------------- | --------------------------------------------------- | -------------------------- | ----------------- |
  | **DOM 解析（主）**     | 后台定时刷新页面 tab，Content Script 读取 DOM       | 天然继承登录态，所见即所得 | 需要保持 tab 存在 |
  | **API + Cookie（备）** | 用 `chrome.cookies` 获取登录 cookie 附加到 API 请求 | 不需要打开 tab，更轻量     | cookie 可能过期   |

  插件默认使用 **DOM 解析方案**（更可靠），当 DOM 方案失败时自动回退到 API + Cookie 方案。

  ------

  ## 核心工作流

  ### 1. 用户添加监控

  ```
  用户打开 openreview.net/forum?id=xxx
    → Content Script 检测到 OpenReview 页面
    → 在页面上注入一个「Monitor Decision」按钮
    → 用户点击按钮
    → 提取 forum ID + 论文标题 + 当前页面 URL
    → 存入 chrome.storage.local
    → Background Worker 注册 chrome.alarms（每分钟触发一次）
  ```

  ### 2. 定时检测（DOM 解析方案 — 主）

  ```
  chrome.alarms 触发（每分钟一次）
    → Background Worker 遍历监控列表
    → 对每个监控项：
        → 用 chrome.tabs.create({ url, active: false }) 创建后台 tab
           （如果对应 tab 已存在，则用 chrome.tabs.reload 刷新）
        → 等待页面加载完成（chrome.tabs.onUpdated, status: "complete"）
        → 通过 chrome.scripting.executeScript 在 tab 中注入脚本
        → 注入脚本扫描 DOM，查找 Decision 相关元素：
            - 查找包含 "Decision" 文本的回复卡片
            - 提取 Decision 内容（Accept/Reject 等）
        → 将结果发回 Background Worker
        → 如果发现新 Decision：
            → 触发通知（桌面通知 / EmailJS / Gmail API）
            → 更新存储状态为 "decided"
        → 关闭后台 tab（或保持用于下次刷新）
  ```

  ### 3. 回退方案（API + Cookie）

  ```
  # 当 DOM 方案失败时（如 tab 创建失败），回退到 API 方案
  
  # Step 1: 获取 OpenReview 登录 cookie
  chrome.cookies.getAll({ domain: "openreview.net" })
  
  # Step 2: 带 cookie 调用 API
  GET https://api2.openreview.net/notes?forum={forumId}
  Headers: Cookie: {session_cookies}
  
  # Step 3: 在 responses 中筛选 Decision
  notes.filter(note => note.invitation.endsWith('Decision'))
  
  # Decision note 结构：
  {
    "id": "xxx",
    "invitation": "Venue/Year/Conference/-/Decision",
    "content": {
      "decision": { "value": "Accept (Poster)" },
      "comment": { "value": "..." }
    }
  }
  ```

  ------

  ## 项目结构

  ```
  openreview-decision-monitor/
  ├── manifest.json              # MV3 配置文件
  ├── background/
  │   └── service-worker.js      # 后台服务：定时轮询 + API 调用 + 邮件发送
  ├── content/
  │   ├── content.js             # 内容脚本：检测页面 + 注入按钮
  │   └── content.css            # 注入按钮的样式
  ├── popup/
  │   ├── popup.html             # 弹出面板 UI
  │   ├── popup.js               # 弹出面板逻辑
  │   └── popup.css              # 弹出面板样式
  ├── options/
  │   ├── options.html           # 设置页面 UI
  │   ├── options.js             # 设置页面逻辑
  │   └── options.css            # 设置页面样式
  ├── lib/
  │   └── emailjs.min.js         # EmailJS SDK
  ├── icons/
  │   ├── icon16.png
  │   ├── icon48.png
  │   └── icon128.png
  └── README.md
  ```

  ------

  ## 实现步骤

  ### Step 1: 项目初始化 + Manifest 配置

  创建 `manifest.json`（Manifest V3）：

  json

  ```json
  {
    "manifest_version": 3,
    "name": "OpenReview Decision Monitor",
    "version": "1.0.0",
    "description": "Monitor OpenReview paper decisions and get email notifications",
    "permissions": ["alarms", "storage", "notifications", "identity", "cookies", "tabs", "scripting"],
    "host_permissions": [
      "https://openreview.net/*",
      "https://api2.openreview.net/*",
      "https://api.emailjs.com/*",
      "https://gmail.googleapis.com/*"
    ],
    "background": {
      "service_worker": "background/service-worker.js"
    },
    "content_scripts": [{
      "matches": ["https://openreview.net/forum*"],
      "js": ["content/content.js"],
      "css": ["content/content.css"]
    }],
    "action": {
      "default_popup": "popup/popup.html",
      "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png" }
    },
    "options_ui": {
      "page": "options/options.html",
      "open_in_tab": true
    },
    "icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  }
  ```

  ### Step 2: Content Script — 页面检测 + 注入按钮

  - 检测 URL 匹配 `openreview.net/forum?id=xxx`
  - 从 URL 提取 `forumId`
  - 从页面 DOM 提取论文标题（`<h2>` 或 meta 标签）
  - 注入「Monitor Decision」按钮到页面
  - 点击按钮后发送 message 给 Background Worker 注册监控

  ### Step 3: Background Service Worker — 核心逻辑

  - **监控注册**：收到 Content Script 消息，将 `{forumId, title, url, status, lastChecked, tabId}` 存入 `chrome.storage.local`，创建 `chrome.alarms`

  - 定时检测

    ：监听 

    ```
    chrome.alarms.onAlarm
    ```

    ，遍历所有监控项：

    1. 首先尝试 DOM 方案：创建/刷新后台 tab → 注入 DOM 解析脚本 → 获取结果
    2. 如果 DOM 方案失败：回退到 API + Cookie 方案

  - **DOM 解析逻辑**：通过 `chrome.scripting.executeScript` 在目标 tab 中执行脚本，扫描页面中包含 "Decision" 的回复元素，提取 Decision 内容

  - **Decision 判断**：检查是否存在 Decision 条目，且与上次检查的状态不同

  - **通知触发**：发现新 Decision 后根据用户设置触发通知（桌面通知 / EmailJS / Gmail API，可多选）

  - **状态更新**：更新 storage 中的监控状态

  ### Step 4: Popup 页面 — 监控管理面板

  - 显示所有监控中的论文列表（标题、状态、上次检查时间）
  - 提供手动刷新按钮
  - 提供删除监控按钮
  - 状态标识：🔍 监控中 / ✅ 已出结果 / ❌ 检查失败

  ### Step 5: Options 页面 — 设置

  - 通知方式选择

    （三选多，可同时启用）：

    - ✅ Chrome 桌面通知（默认开启，零配置）
    - ✅ EmailJS 邮件通知
    - ✅ Gmail API 邮件通知

  - EmailJS 配置区：Service ID、Template ID、Public Key

  - Gmail API 配置区：OAuth 授权按钮、授权状态显示

  - 收件人邮箱地址（EmailJS 模式下使用）

  - 轮询频率（1/5/10/30 分钟）

  ### Step 6: 通知系统集成（三种方式）

  #### 6a. Chrome 桌面通知（默认，零配置）

  javascript

  ```javascript
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Decision Released!",
    message: `${paper.title}\nDecision: ${decisionValue}`,
  });
  ```

  #### 6b. EmailJS 邮件通知（免费 200 封/月）

  javascript

  ```javascript
  emailjs.init("YOUR_PUBLIC_KEY");
  emailjs.send("service_id", "template_id", {
    to_email: userEmail,
    paper_title: paper.title,
    decision: decisionValue,
    paper_url: paper.url,
    check_time: new Date().toLocaleString()
  });
  ```

  用户需要：在 emailjs.com 注册免费账号 → 配置 Email Service → 创建邮件模板 → 填入插件设置

  #### 6c. Gmail API + OAuth（原生 Gmail 发送）

  - 使用 `chrome.identity.launchWebAuthFlow` 进行 Google OAuth 2.0 授权
  - 获取 access token 后调用 Gmail API `users.messages.send` 发送邮件
  - 需要在 Google Cloud Console 创建 OAuth Client ID（类型选 Chrome Extension）
  - Scope：`https://www.googleapis.com/auth/gmail.send`

  javascript

  ```javascript
  // OAuth 授权
  chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  }, (redirectUrl) => {
    const token = extractToken(redirectUrl);
    chrome.storage.local.set({ gmailToken: token });
  });
  
  // 发送邮件
  fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64EncodedEmail })
  });
  ```

  用户需要：在 Google Cloud Console 创建项目 → 启用 Gmail API → 创建 OAuth Client ID → 在插件设置中点击授权

  ------

  ## 关键设计决策

  ### 为什么 DOM 解析为主、API 为辅？

  **核心原因**：Decision 在公开发布前只有作者可见，必须以登录身份访问。

  |          | DOM 解析（主方案）         | API + Cookie（回退方案）      |
  | -------- | -------------------------- | ----------------------------- |
  | 认证     | ✅ 天然继承浏览器登录态     | ⚠️ 需手动附加 cookie，可能过期 |
  | 可靠性   | ⚠️ DOM 结构变更可能需要适配 | ✅ API 结构稳定                |
  | 后台运行 | ✅ 通过后台 tab 刷新实现    | ✅ Service Worker 直接调用     |
  | 资源占用 | ⚠️ 需要加载完整页面         | ✅ 轻量 JSON 响应              |

  两种方案互补：DOM 方案解决认证问题，API 方案作为轻量回退。

  ### 为什么提供三种通知方式？

  | 方式            | 优点                     | 缺点                                     |
  | --------------- | ------------------------ | ---------------------------------------- |
  | Chrome 桌面通知 | 零配置，开箱即用         | 需要浏览器运行，容易漏看                 |
  | EmailJS         | 配置简单，纯前端         | 需注册第三方账号，免费额度有限           |
  | Gmail API OAuth | 原生 Gmail，无第三方依赖 | 需要 Google Cloud Console 配置，步骤较多 |

  用户可根据需求任选一种或多种同时启用。

  ------

  ## 注意事项

  1. **页面加载开销**：DOM 方案需要加载完整页面，同时监控多篇论文时建议错开刷新时间（每个间隔 5-10 秒），避免同时打开过多 tab
  2. **Service Worker 生命周期**：MV3 的 Service Worker 会被浏览器休眠，`chrome.alarms` 会唤醒它，这是官方推荐的定时方式
  3. **存储限制**：`chrome.storage.local` 限制 10MB，监控数据极小，完全够用
  4. **隐私安全**：EmailJS 的 API Key 存储在本地 `chrome.storage.local` 中，不上传任何地方

  ------

  ## 验证方案

  1. **安装测试**：在 `chrome://extensions` 加载未打包的插件，确认无报错
  2. **页面检测测试**：打开任意 OpenReview forum 页面，确认按钮正确注入
  3. **API 测试**：选一个已有 Decision 的论文（如 ICLR 2025 的某篇），验证 API 能正确返回 Decision
  4. **轮询测试**：添加一个监控，观察 Background Worker 是否按时触发检查
  5. **邮件测试**：配置 EmailJS 后，手动触发一次通知，确认邮件到达
  6. **端到端测试**：监控一个已有 Decision 的论文，确认从检测到邮件通知的完整流程

  ------

  ## 已确认决策

  - ✅ **通知方式**：三种全部支持（Chrome 桌面通知 + EmailJS + Gmail API OAuth），用户可任选
  - ✅ **多论文监控**：支持同时监控多篇论文
  - ✅ **浏览器支持**：仅 Chrome/Edge（Manifest V3）