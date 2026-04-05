(function initShared(globalScope) {
  "use strict";

  const ALARM_NAME = "openreview-decision-monitor-check";
  const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";

  const STORAGE_KEYS = Object.freeze({
    MONITORS: "monitors",
    SETTINGS: "settings"
  });

  const STATUS = Object.freeze({
    MONITORING: "monitoring",
    CHECKING: "checking",
    DECIDED: "decided",
    FAILED: "failed"
  });

  const DECISION_STATES = Object.freeze({
    WAITING: "waiting",
    PENDING: "pending",
    ACCEPTED: "accepted",
    REJECTED: "rejected"
  });

  const DISPLAY_STATES = Object.freeze({
    NON_TRACKING: "non-tracking",
    TRACKING_NO_DECISION: "tracking-no-decision",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    PENDING: "pending"
  });

  const POLL_INTERVAL_OPTIONS = Object.freeze([1, 2, 3, 4, 5, 10, 30]);
  const LANGUAGE_OPTIONS = Object.freeze(["auto", "en", "zh"]);

  const DEFAULT_SETTINGS = Object.freeze({
    language: "auto",
    pollIntervalMinutes: 5,
    recipientEmail: "",
    notifications: {
      desktop: true,
      emailjs: false,
      gmail: false
    },
    emailjs: {
      publicKey: "",
      serviceId: "",
      templateId: ""
    },
    gmail: {
      clientId: "",
      accessToken: "",
      tokenType: "Bearer",
      expiresAt: "",
      grantedAt: ""
    }
  });

  const SYNTHETIC_DECISION_VALUES = Object.freeze([
    "decision monitor",
    "monitor decision",
    "decision 监控",
    "监控 decision",
    "monitor",
    "monitoring",
    "stop monitoring",
    "refresh",
    "refreshing",
    "监控",
    "停止监控",
    "刷新",
    "刷新中"
  ]);

  const TRANSLATIONS = Object.freeze({
    en: {
      "common.auto": "Auto",
      "common.english": "English",
      "common.chinese": "Chinese",
      "common.refresh": "Refresh",
      "common.refreshing": "Refreshing...",
      "common.monitor": "Monitor",
      "common.remove": "Remove",
      "common.save": "Save settings",
      "common.openSettings": "Open settings",
      "common.lastChecked": "Last checked",
      "common.status": "Status",
      "common.decision": "Decision",
      "common.recipientEmail": "Recipient email",
      "common.pollInterval": "Polling interval",
      "common.language": "Language",
      "common.paperSingular": "paper",
      "common.paperPlural": "papers",
      "common.enabled": "Enabled",
      "common.disabled": "Disabled",
      "decision.waiting": "Waiting",
      "decision.pending": "Pending",
      "decision.accepted": "Accepted",
      "decision.rejected": "Rejected",
      "display.non-tracking": "Non-Tracking",
      "display.tracking-no-decision": "Tracking: No Decision Yet",
      "display.pending": "Pending",
      "display.accepted": "Accepted",
      "display.rejected": "Rejected",
      "popup.eyebrow": "OpenReview",
      "popup.title": "Decision Monitor",
      "popup.refreshAll": "Refresh all",
      "popup.refreshingAll": "Refreshing...",
      "popup.summaryCount": "Tracking {count} {noun}",
      "popup.summaryCopy": "The worker checks on your configured cadence and updates every paper dynamically.",
      "popup.emptyTitle": "No papers are being monitored yet.",
      "popup.emptyCopy": "Open an OpenReview forum or Authors page and click Monitor.",
      "popup.methodsLabel": "Notification methods",
      "popup.methodsNone": "None selected",
      "popup.errorPrefix": "Last error",
      "popup.statusPrefix": "Status",
      "popup.decisionPrefix": "Decision",
      "popup.checking": "Checking now",
      "options.eyebrow": "Settings",
      "options.title": "OpenReview Decision Monitor",
      "options.lede": "Configure language, polling cadence, and specific notification methods.",
      "options.general": "General",
      "options.language": "Interface language",
      "options.pollInterval": "Polling interval",
      "options.recipientEmail": "Recipient email",
      "options.notifications": "Notification methods",
      "options.chromeNotifications": "Chrome notifications",
      "options.enableDesktop": "Enable desktop notifications",
      "options.desktopCopy": "Desktop notifications require no extra setup and are enabled by default.",
      "options.emailjs": "EmailJS",
      "options.enableEmailjs": "Enable EmailJS delivery",
      "options.publicKey": "Public key",
      "options.serviceId": "Service ID",
      "options.templateId": "Template ID",
      "options.gmail": "Gmail API",
      "options.enableGmail": "Enable Gmail delivery",
      "options.oauthClientId": "OAuth client ID",
      "options.notAuthorized": "Not authorized",
      "options.authorizedUntil": "Authorized. Token expires: {expiry}",
      "options.authorizeGmail": "Authorize Gmail",
      "options.clearToken": "Clear token",
      "options.testNotification": "Send test notification",
      "options.statusSaved": "Settings saved.",
      "options.statusTokenRemoved": "Stored Gmail token removed.",
      "options.statusGmailAuthorized": "Gmail authorization completed.",
      "options.statusTestSent": "Test notification sent.",
      "options.enterClientId": "Enter a Gmail OAuth client ID first.",
      "options.enterValidRecipient": "Enter a valid recipient email for email notifications.",
      "options.enableOneChannel": "Enable at least one notification channel before sending a test.",
      "content.pageTitle": "Decision Monitor",
      "content.monitorDecision": "Monitor Decision",
      "content.stopMonitoring": "Stop Monitoring",
      "content.refreshNow": "Refresh",
      "content.refreshingNow": "Refreshing...",
      "content.authorsHint": "Works on forum pages and Authors lists.",
      "content.removeMonitor": "Remove this paper from the monitor list.",
      "content.addMonitor": "Track this paper for decision updates.",
      "notify.testTitle": "OpenReview test notification",
      "notify.decisionTitle": "OpenReview decision released",
      "notify.decisionLine": "Decision: {decision}"
    },
    zh: {
      "common.auto": "自动",
      "common.english": "英文",
      "common.chinese": "中文",
      "common.refresh": "刷新",
      "common.refreshing": "刷新中...",
      "common.monitor": "监控",
      "common.remove": "移除",
      "common.save": "保存设置",
      "common.openSettings": "打开设置",
      "common.lastChecked": "上次检查",
      "common.status": "状态",
      "common.decision": "Decision",
      "common.recipientEmail": "收件邮箱",
      "common.pollInterval": "轮询频率",
      "common.language": "语言",
      "common.paperSingular": "篇论文",
      "common.paperPlural": "篇论文",
      "common.enabled": "已启用",
      "common.disabled": "未启用",
      "decision.waiting": "Waiting",
      "decision.pending": "Pending",
      "decision.accepted": "已接收",
      "decision.rejected": "已拒绝",
      "display.non-tracking": "未监控",
      "display.tracking-no-decision": "监控中：暂无 Decision",
      "display.pending": "Pending",
      "display.accepted": "已接收",
      "display.rejected": "已拒绝",
      "popup.eyebrow": "OpenReview",
      "popup.title": "Decision 监控",
      "popup.refreshAll": "刷新全部",
      "popup.refreshingAll": "刷新中...",
      "popup.summaryCount": "当前监控 {count}{noun}",
      "popup.summaryCopy": "后台会按你设置的频率自动检查，并动态更新每篇文章的状态。",
      "popup.emptyTitle": "还没有正在监控的论文。",
      "popup.emptyCopy": "打开 OpenReview 的 forum 页面或 Authors 列表页面，然后点击监控。",
      "popup.methodsLabel": "通知方式",
      "popup.methodsNone": "尚未选择",
      "popup.errorPrefix": "最近错误",
      "popup.statusPrefix": "状态",
      "popup.decisionPrefix": "Decision",
      "popup.checking": "正在检查",
      "options.eyebrow": "设置",
      "options.title": "OpenReview Decision 监控插件",
      "options.lede": "配置界面语言、轮询频率，以及具体的通知方式。",
      "options.general": "通用设置",
      "options.language": "界面语言",
      "options.pollInterval": "轮询频率",
      "options.recipientEmail": "收件邮箱",
      "options.notifications": "通知方式",
      "options.chromeNotifications": "Chrome 桌面通知",
      "options.enableDesktop": "启用桌面通知",
      "options.desktopCopy": "桌面通知无需额外配置，默认开启。",
      "options.emailjs": "EmailJS",
      "options.enableEmailjs": "启用 EmailJS 邮件通知",
      "options.publicKey": "Public Key",
      "options.serviceId": "Service ID",
      "options.templateId": "Template ID",
      "options.gmail": "Gmail API",
      "options.enableGmail": "启用 Gmail 通知",
      "options.oauthClientId": "OAuth Client ID",
      "options.notAuthorized": "未授权",
      "options.authorizedUntil": "已授权，Token 过期时间：{expiry}",
      "options.authorizeGmail": "授权 Gmail",
      "options.clearToken": "清除 Token",
      "options.testNotification": "发送测试通知",
      "options.statusSaved": "设置已保存。",
      "options.statusTokenRemoved": "已清除本地 Gmail Token。",
      "options.statusGmailAuthorized": "Gmail 授权完成。",
      "options.statusTestSent": "测试通知已发送。",
      "options.enterClientId": "请先填写 Gmail OAuth Client ID。",
      "options.enterValidRecipient": "启用邮件通知前，请填写有效的收件邮箱。",
      "options.enableOneChannel": "发送测试通知前，请至少启用一种通知方式。",
      "content.pageTitle": "Decision 监控",
      "content.monitorDecision": "监控 Decision",
      "content.stopMonitoring": "停止监控",
      "content.refreshNow": "刷新",
      "content.refreshingNow": "刷新中...",
      "content.authorsHint": "支持 forum 页面和 Authors 列表页面。",
      "content.removeMonitor": "将这篇论文从监控列表移除。",
      "content.addMonitor": "开始跟踪这篇论文的 Decision 状态。",
      "notify.testTitle": "OpenReview 测试通知",
      "notify.decisionTitle": "OpenReview Decision 已发布",
      "notify.decisionLine": "Decision: {decision}"
    }
  });

  function clone(value) {
    if (value === undefined || value === null) {
      return value;
    }
    if (typeof value !== "object") {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function deepMerge(base, override) {
    if (override === null || override === undefined) {
      return clone(base);
    }
    if (Array.isArray(base)) {
      return Array.isArray(override) ? override.slice() : base.slice();
    }
    if (
      typeof base !== "object" ||
      base === null ||
      typeof override !== "object" ||
      override === null ||
      Array.isArray(override)
    ) {
      return clone(override);
    }

    const result = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);
    keys.forEach((key) => {
      const baseValue = base[key];
      const overrideValue = override ? override[key] : undefined;
      if (overrideValue === undefined) {
        result[key] = clone(baseValue);
      } else if (
        typeof baseValue === "object" &&
        baseValue !== null &&
        !Array.isArray(baseValue)
      ) {
        result[key] = deepMerge(baseValue, overrideValue);
      } else {
        result[key] = clone(overrideValue);
      }
    });
    return result;
  }

  function collapseWhitespace(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function collapseInlineWhitespace(text) {
    return collapseWhitespace(text).replace(/\n+/g, " ");
  }

  function toAbsoluteUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl || globalScope.location?.href || "https://openreview.net").toString();
    } catch (error) {
      return String(url || "");
    }
  }

  function getForumIdFromUrl(url, baseUrl) {
    try {
      const parsed = new URL(url, baseUrl || globalScope.location?.href || "https://openreview.net");
      return parsed.searchParams.get("id") || "";
    } catch (error) {
      return "";
    }
  }

  function isForumUrl(url) {
    try {
      const parsed = new URL(url, globalScope.location?.href || "https://openreview.net");
      return (
        parsed.hostname === "openreview.net" &&
        parsed.pathname === "/forum" &&
        Boolean(parsed.searchParams.get("id"))
      );
    } catch (error) {
      return false;
    }
  }

  function isAuthorsGroupUrl(url) {
    try {
      const parsed = new URL(url, globalScope.location?.href || "https://openreview.net");
      const groupId = parsed.searchParams.get("id") || "";
      return parsed.hostname === "openreview.net" && parsed.pathname === "/group" && /\/Authors$/i.test(groupId);
    } catch (error) {
      return false;
    }
  }

  function normalizeForumUrl(url, baseUrl) {
    if (!url) {
      return "";
    }
    const absoluteUrl = toAbsoluteUrl(url, baseUrl);
    if (!isForumUrl(absoluteUrl)) {
      return absoluteUrl;
    }
    const parsed = new URL(absoluteUrl);
    const forumId = parsed.searchParams.get("id");
    return `https://openreview.net/forum?id=${encodeURIComponent(forumId)}`;
  }

  function getPageTitle(doc) {
    const selectors = [
      "main h2",
      "main h1",
      "h2",
      "h1",
      "meta[property='og:title']",
      "title"
    ];

    for (const selector of selectors) {
      const node = doc.querySelector(selector);
      if (!node) {
        continue;
      }
      const text =
        node.tagName === "META"
          ? node.getAttribute("content")
          : node.textContent || "";
      const cleaned = collapseInlineWhitespace(text);
      if (cleaned) {
        return cleaned;
      }
    }
    return "Untitled Paper";
  }

  function normalizeDecisionValue(value) {
    return collapseInlineWhitespace(value)
      .replace(/^[\s:：-]+/, "")
      .replace(/\s+[|·•].*$/, "")
      .trim();
  }

  function extractDecisionValueFromText(text) {
    const normalized = collapseWhitespace(text);
    if (!normalized) {
      return "";
    }

    const patterns = [
      /(?:^|\n)\s*(?:paper\s+)?decision\s*[:：-]?\s*([^\n]+)/i,
      /(?:^|\n)\s*decision\s*\n+\s*([^\n]+)/i,
      /(?:^|\n)\s*(accept(?:ed)?(?:\s*\([^)]+\))?|reject(?:ed)?(?:\s*\([^)]+\))?|conditional accept(?:ed)?(?:\s*\([^)]+\))?|desk reject(?:ed)?|withdrawn?|accepted as [^\n]+)(?=\s*$|\n)/i
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      const candidate = normalizeDecisionValue(
        match && match[1] ? match[1] : match && match[0] ? match[0] : ""
      );
      if (candidate && !/^decision$/i.test(candidate)) {
        return candidate;
      }
    }
    return "";
  }

  function extractDecisionFromNoteContent(content) {
    const keys = ["decision", "Decision", "verdict", "recommendation"];
    for (const key of keys) {
      const field = content ? content[key] : undefined;
      if (!field) {
        continue;
      }
      const value =
        typeof field === "string"
          ? field
          : typeof field.value === "string"
            ? field.value
            : Array.isArray(field.value)
              ? field.value.join(", ")
              : "";
      const cleaned = normalizeDecisionValue(value);
      if (cleaned) {
        return cleaned;
      }
    }
    return "";
  }

  function inferDecisionState(decisionValue, monitorStatus) {
    if (monitorStatus === STATUS.CHECKING) {
      return DECISION_STATES.PENDING;
    }

    const value = normalizeDecisionValue(decisionValue).toLowerCase();
    if (!value) {
      return DECISION_STATES.WAITING;
    }

    if (
      /(reject|declin|withdraw|desk reject|not accept|not accepted)/i.test(value)
    ) {
      return DECISION_STATES.REJECTED;
    }

    if (
      /(accept|oral|poster|spotlight|award|conditional accept|camera ready)/i.test(value)
    ) {
      return DECISION_STATES.ACCEPTED;
    }

    return DECISION_STATES.PENDING;
  }

  function isSyntheticDecisionValue(decisionValue) {
    const normalized = normalizeDecisionValue(decisionValue).toLowerCase();
    if (!normalized) {
      return false;
    }
    if (SYNTHETIC_DECISION_VALUES.includes(normalized)) {
      return true;
    }
    return (
      /^decision\s+(monitor|监控)$/i.test(normalized) ||
      /^(monitor|监控)\s+decision$/i.test(normalized)
    );
  }

  function sanitizeMonitorRecord(monitor) {
    if (!monitor || !isSyntheticDecisionValue(monitor.decisionValue)) {
      return monitor;
    }

    return {
      ...monitor,
      status: monitor.status === STATUS.CHECKING ? STATUS.CHECKING : STATUS.MONITORING,
      decisionValue: "",
      decisionComment: "",
      decisionSource: "",
      lastDetected: ""
    };
  }

  function getMonitorDecisionState(monitor) {
    if (!monitor) {
      return DECISION_STATES.WAITING;
    }
    const sanitizedMonitor = sanitizeMonitorRecord(monitor);
    return inferDecisionState(sanitizedMonitor.decisionValue || "", sanitizedMonitor.status);
  }

  function getMonitorDisplayState(monitor) {
    if (!monitor) {
      return DISPLAY_STATES.NON_TRACKING;
    }

    const sanitizedMonitor = sanitizeMonitorRecord(monitor);
    const decisionState = inferDecisionState(
      sanitizedMonitor.decisionValue || "",
      sanitizedMonitor.status
    );

    if (decisionState === DECISION_STATES.ACCEPTED) {
      return DISPLAY_STATES.ACCEPTED;
    }

    if (decisionState === DECISION_STATES.REJECTED) {
      return DISPLAY_STATES.REJECTED;
    }

    if (sanitizedMonitor.decisionValue) {
      return DISPLAY_STATES.PENDING;
    }

    return DISPLAY_STATES.TRACKING_NO_DECISION;
  }

  function formatDateTime(value) {
    if (!value) {
      return "Never";
    }
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return value;
    }
  }

  function safeMessage(error) {
    if (!error) {
      return "Unknown error";
    }
    if (typeof error === "string") {
      return error;
    }
    return error.message || String(error);
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  function toBase64Url(value) {
    return btoa(unescape(encodeURIComponent(value)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function createMailMessage({ to, subject, body }) {
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      body
    ].join("\r\n");
    return toBase64Url(message);
  }

  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (value) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(value);
      });
    });
  }

  function storageSet(value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(value, () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  async function getMonitors() {
    const stored = await storageGet(STORAGE_KEYS.MONITORS);
    const monitors = Array.isArray(stored[STORAGE_KEYS.MONITORS])
      ? stored[STORAGE_KEYS.MONITORS]
      : [];
    return monitors
      .map((monitor) => sanitizeMonitorRecord(monitor))
      .slice()
      .sort((left, right) => {
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });
  }

  async function saveMonitors(monitors) {
    const sanitized = Array.isArray(monitors)
      ? monitors.map((monitor) => sanitizeMonitorRecord(monitor))
      : [];
    await storageSet({ [STORAGE_KEYS.MONITORS]: sanitized });
    return sanitized;
  }

  async function getSettings() {
    const stored = await storageGet(STORAGE_KEYS.SETTINGS);
    return deepMerge(DEFAULT_SETTINGS, stored[STORAGE_KEYS.SETTINGS] || {});
  }

  async function saveSettings(settings) {
    const merged = deepMerge(DEFAULT_SETTINGS, settings || {});
    await storageSet({ [STORAGE_KEYS.SETTINGS]: merged });
    return merged;
  }

  function resolveLanguage(preferredLanguage) {
    if (preferredLanguage === "en" || preferredLanguage === "zh") {
      return preferredLanguage;
    }
    const browserLanguage = String(
      (preferredLanguage && preferredLanguage !== "auto" ? preferredLanguage : "") ||
      globalScope.navigator?.language ||
      globalScope.navigator?.languages?.[0] ||
      "en"
    ).toLowerCase();
    return browserLanguage.startsWith("zh") ? "zh" : "en";
  }

  function lookupTranslation(language, key) {
    const table = TRANSLATIONS[language] || TRANSLATIONS.en;
    return table[key] || TRANSLATIONS.en[key] || key;
  }

  function t(key, language, variables) {
    const template = lookupTranslation(resolveLanguage(language), key);
    return Object.keys(variables || {}).reduce((message, variableKey) => {
      return message.replaceAll(`{${variableKey}}`, String(variables[variableKey]));
    }, template);
  }

  function buildMonitor(input) {
    const now = new Date().toISOString();
    return {
      forumId: input.forumId,
      title: collapseInlineWhitespace(input.title) || "Untitled Paper",
      url: normalizeForumUrl(input.url),
      status: input.status || STATUS.MONITORING,
      decisionValue: input.decisionValue || "",
      decisionComment: input.decisionComment || "",
      decisionSource: input.decisionSource || "",
      lastChecked: input.lastChecked || "",
      lastDetected: input.lastDetected || "",
      lastError: input.lastError || "",
      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now
    };
  }

  async function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  globalScope.ORMonitor = {
    ALARM_NAME,
    DECISION_STATES,
    DISPLAY_STATES,
    DEFAULT_SETTINGS,
    GMAIL_SCOPE,
    LANGUAGE_OPTIONS,
    POLL_INTERVAL_OPTIONS,
    STATUS,
    STORAGE_KEYS,
    TRANSLATIONS,
    buildMonitor,
    clone,
    collapseInlineWhitespace,
    collapseWhitespace,
    createMailMessage,
    deepMerge,
    extractDecisionFromNoteContent,
    extractDecisionValueFromText,
    formatDateTime,
    getForumIdFromUrl,
    getMonitorDisplayState,
    getMonitorDecisionState,
    getMonitors,
    getPageTitle,
    getSettings,
    inferDecisionState,
    isSyntheticDecisionValue,
    isAuthorsGroupUrl,
    isForumUrl,
    normalizeDecisionValue,
    normalizeForumUrl,
    resolveLanguage,
    sanitizeMonitorRecord,
    safeMessage,
    saveMonitors,
    saveSettings,
    sendRuntimeMessage,
    sleep,
    storageGet,
    storageSet,
    t,
    toAbsoluteUrl,
    toBase64Url,
    validateEmail
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
