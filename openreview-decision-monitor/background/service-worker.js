/* global ORMonitor */

importScripts("../lib/shared.js");

const CHECK_STAGGER_MS = 5000;
const TAB_LOAD_TIMEOUT_MS = 25000;
const POST_LOAD_WAIT_MS = 2500;

let isScheduledRunActive = false;

bootstrap().catch((error) => {
  console.error("Bootstrap failed", error);
});

chrome.runtime.onInstalled.addListener(() => {
  bootstrap().catch((error) => {
    console.error("Install bootstrap failed", error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  bootstrap().catch((error) => {
    console.error("Startup bootstrap failed", error);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ORMonitor.ALARM_NAME) {
    return;
  }
  runScheduledChecks().catch((error) => {
    console.error("Scheduled checks failed", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => {
      console.error("Message handler failed", error);
      sendResponse({ ok: false, error: ORMonitor.safeMessage(error) });
    });
  return true;
});

async function bootstrap() {
  await ensureStorageDefaults();
  await reconcileAlarm();
}

async function ensureStorageDefaults() {
  const payload = await ORMonitor.storageGet([
    ORMonitor.STORAGE_KEYS.MONITORS,
    ORMonitor.STORAGE_KEYS.SETTINGS
  ]);

  const updates = {};
  if (!Array.isArray(payload[ORMonitor.STORAGE_KEYS.MONITORS])) {
    updates[ORMonitor.STORAGE_KEYS.MONITORS] = [];
  }

  if (!payload[ORMonitor.STORAGE_KEYS.SETTINGS]) {
    updates[ORMonitor.STORAGE_KEYS.SETTINGS] = ORMonitor.clone(ORMonitor.DEFAULT_SETTINGS);
  } else {
    updates[ORMonitor.STORAGE_KEYS.SETTINGS] = ORMonitor.deepMerge(
      ORMonitor.DEFAULT_SETTINGS,
      payload[ORMonitor.STORAGE_KEYS.SETTINGS]
    );
  }

  if (Object.keys(updates).length) {
    await ORMonitor.storageSet(updates);
  }
}

async function handleMessage(message, sender) {
  switch (message && message.type) {
    case "register-monitor":
      return registerMonitor(message.payload, sender);
    case "unregister-monitor":
      return unregisterMonitor(message.forumId);
    case "list-monitors":
      return { ok: true, monitors: await ORMonitor.getMonitors() };
    case "get-monitor":
      return { ok: true, monitor: await findMonitor(message.forumId) };
    case "refresh-monitor":
      return refreshMonitor(message.forumId, {
        reason: "manual"
      });
    case "refresh-all":
      return refreshAllMonitors();
    case "settings-updated":
      await reconcileAlarm();
      return { ok: true, settings: await ORMonitor.getSettings() };
    case "send-test-notification":
      return sendTestNotification();
    default:
      return { ok: false, error: "Unknown message type" };
  }
}

async function registerMonitor(payload, sender) {
  const forumId = ORMonitor.getForumIdFromUrl(payload && payload.url);
  if (!forumId) {
    return { ok: false, error: "Invalid OpenReview forum URL" };
  }

  const monitors = await ORMonitor.getMonitors();
  const existingIndex = monitors.findIndex((monitor) => monitor.forumId === forumId);
  const monitor = ORMonitor.buildMonitor({
    ...(existingIndex >= 0 ? monitors[existingIndex] : {}),
    forumId,
    title: payload.title,
    url: payload.url,
    status: existingIndex >= 0 ? monitors[existingIndex].status : ORMonitor.STATUS.MONITORING,
    updatedAt: new Date().toISOString()
  });

  if (existingIndex >= 0) {
    monitors.splice(existingIndex, 1, monitor);
  } else {
    monitors.push(monitor);
  }
  await ORMonitor.saveMonitors(monitors);
  await reconcileAlarm();

  checkMonitor(monitor, {
    reason: "register"
  }).catch((error) => {
    console.error(`Initial check failed for ${forumId}`, error);
  });

  return { ok: true, monitor };
}

async function unregisterMonitor(forumId) {
  const monitors = await ORMonitor.getMonitors();
  const nextMonitors = monitors.filter((monitor) => monitor.forumId !== forumId);
  await ORMonitor.saveMonitors(nextMonitors);
  await reconcileAlarm();
  return { ok: true };
}

async function refreshMonitor(forumId, options) {
  const monitor = await findMonitor(forumId);
  if (!monitor) {
    return { ok: false, error: "Monitor not found" };
  }
  return checkMonitor(monitor, options);
}

async function refreshAllMonitors() {
  const monitors = await ORMonitor.getMonitors();
  const results = [];
  for (const [index, monitor] of monitors.entries()) {
    results.push(await checkMonitor(monitor, { reason: "manual-bulk" }));
    if (index < monitors.length - 1) {
      await ORMonitor.sleep(1200);
    }
  }
  return { ok: true, results };
}

async function sendTestNotification() {
  const settings = await ORMonitor.getSettings();
  const language = ORMonitor.resolveLanguage(settings.language);
  if (
    !settings.notifications.desktop &&
    !settings.notifications.emailjs &&
    !settings.notifications.gmail
  ) {
    return { ok: false, error: ORMonitor.t("options.enableOneChannel", language) };
  }

  const recipientEmail = String(settings.recipientEmail || "").trim();
  if ((settings.notifications.emailjs || settings.notifications.gmail) && !ORMonitor.validateEmail(recipientEmail)) {
    return { ok: false, error: ORMonitor.t("options.enterValidRecipient", language) };
  }

  const sampleMonitor = ORMonitor.buildMonitor({
    forumId: "sample-forum-id",
    title: "Sample OpenReview Submission",
    url: "https://openreview.net/forum?id=sample-forum-id",
    status: ORMonitor.STATUS.DECIDED,
    decisionValue: "Accept (Poster)",
    decisionSource: "test"
  });

  await notifyDecision(sampleMonitor, {
    isTest: true,
    decisionValue: sampleMonitor.decisionValue
  });
  return { ok: true };
}

async function runScheduledChecks() {
  if (isScheduledRunActive) {
    return;
  }

  isScheduledRunActive = true;
  try {
    const monitors = await ORMonitor.getMonitors();
    const pendingMonitors = monitors.filter((monitor) => monitor.status !== ORMonitor.STATUS.DECIDED);
    for (const [index, monitor] of pendingMonitors.entries()) {
      await checkMonitor(monitor, { reason: "alarm" });
      if (index < pendingMonitors.length - 1) {
        await ORMonitor.sleep(CHECK_STAGGER_MS);
      }
    }
  } finally {
    isScheduledRunActive = false;
  }
}

async function checkMonitor(monitor, options = {}) {
  const current = await findMonitor(monitor.forumId);
  if (!current) {
    return { ok: false, error: "Monitor no longer exists" };
  }

  const checkedAt = new Date().toISOString();
  const checkingMonitor = {
    ...current,
    status: current.status === ORMonitor.STATUS.DECIDED ? current.status : ORMonitor.STATUS.CHECKING,
    lastChecked: checkedAt,
    lastError: "",
    updatedAt: checkedAt
  };
  await upsertMonitor(checkingMonitor);

  try {
    const domResult = await checkViaDom(current, options);
    const result = domResult.decisionValue ? domResult : await checkViaApi(current, domResult);
    let updatedMonitor = applyCheckResult(current, result, checkedAt);
    await upsertMonitor(updatedMonitor);

    const isNewDecision =
      Boolean(updatedMonitor.decisionValue) &&
      updatedMonitor.decisionValue !== current.decisionValue;

    if (isNewDecision) {
      try {
        await notifyDecision(updatedMonitor, {
          decisionValue: updatedMonitor.decisionValue
        });
      } catch (error) {
        updatedMonitor = {
          ...updatedMonitor,
          lastError: ORMonitor.safeMessage(error),
          updatedAt: new Date().toISOString()
        };
        await upsertMonitor(updatedMonitor);
        return {
          ok: false,
          monitor: updatedMonitor,
          error: ORMonitor.safeMessage(error)
        };
      }
    }

    return { ok: true, monitor: updatedMonitor, result };
  } catch (error) {
    const failedMonitor = {
      ...current,
      status: current.status === ORMonitor.STATUS.DECIDED ? ORMonitor.STATUS.DECIDED : ORMonitor.STATUS.FAILED,
      lastChecked: checkedAt,
      lastError: ORMonitor.safeMessage(error),
      updatedAt: new Date().toISOString()
    };
    await upsertMonitor(failedMonitor);
    return { ok: false, monitor: failedMonitor, error: ORMonitor.safeMessage(error) };
  }
}

function applyCheckResult(current, result, checkedAt) {
  const now = checkedAt || new Date().toISOString();
  const decisionValue = result.decisionValue || current.decisionValue || "";
  const hasDecision = Boolean(result.decisionValue || current.decisionValue);
  const status = hasDecision
    ? ORMonitor.STATUS.DECIDED
    : result.error
      ? ORMonitor.STATUS.FAILED
      : ORMonitor.STATUS.MONITORING;

  return {
    ...current,
    status,
    decisionValue,
    decisionComment: result.decisionComment || current.decisionComment || "",
    decisionSource: result.source || current.decisionSource || "",
    lastChecked: now,
    lastDetected: result.decisionValue ? now : current.lastDetected || "",
    lastError: result.error || "",
    updatedAt: now
  };
}

async function notifyDecision(monitor, { decisionValue, isTest = false }) {
  const settings = await ORMonitor.getSettings();
  const language = ORMonitor.resolveLanguage(settings.language);
  const tasks = [];

  if (settings.notifications.desktop) {
    tasks.push(sendDesktopNotification(monitor, decisionValue, isTest, language));
  }

  if (settings.notifications.emailjs) {
    tasks.push(sendEmailJsNotification(monitor, decisionValue, settings, isTest, language));
  }

  if (settings.notifications.gmail) {
    tasks.push(sendGmailNotification(monitor, decisionValue, settings, isTest, language));
  }

  if (!tasks.length) {
    return;
  }

  const results = await Promise.allSettled(tasks);
  const failures = results
    .filter((result) => result.status === "rejected")
    .map((result) => ORMonitor.safeMessage(result.reason));

  if (failures.length === tasks.length) {
    throw new Error(failures.join(" | "));
  }
}

async function sendDesktopNotification(monitor, decisionValue, isTest, language) {
  await new Promise((resolve, reject) => {
    chrome.notifications.create(
      `decision-${monitor.forumId}-${Date.now()}`,
      {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: isTest
          ? ORMonitor.t("notify.testTitle", language)
          : ORMonitor.t("notify.decisionTitle", language),
        message: `${monitor.title}\n${ORMonitor.t("notify.decisionLine", language, { decision: decisionValue })}`,
        priority: 2
      },
      () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve();
      }
    );
  });
}

async function sendEmailJsNotification(monitor, decisionValue, settings, isTest, language) {
  const recipientEmail = String(settings.recipientEmail || "").trim();
  if (!ORMonitor.validateEmail(recipientEmail)) {
    throw new Error("EmailJS requires a valid recipient email.");
  }

  const { publicKey, serviceId, templateId } = settings.emailjs || {};
  if (!publicKey || !serviceId || !templateId) {
    throw new Error("EmailJS is enabled but not fully configured.");
  }

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        to_email: recipientEmail,
        paper_title: monitor.title,
        decision: decisionValue,
        paper_url: monitor.url,
        check_time: new Date().toLocaleString(),
        subject: isTest
          ? ORMonitor.t("notify.testTitle", language)
          : ORMonitor.t("notify.decisionTitle", language),
        is_test: String(isTest)
      }
    })
  });

  if (!response.ok) {
    throw new Error(`EmailJS request failed with ${response.status}`);
  }
}

async function sendGmailNotification(monitor, decisionValue, settings, isTest, language) {
  const recipientEmail = String(settings.recipientEmail || "").trim();
  if (!ORMonitor.validateEmail(recipientEmail)) {
    throw new Error("Gmail notification requires a valid recipient email.");
  }

  const gmail = settings.gmail || {};
  if (!gmail.accessToken) {
    throw new Error("Gmail is enabled but no OAuth token is stored.");
  }
  if (gmail.expiresAt && new Date(gmail.expiresAt).getTime() <= Date.now()) {
    throw new Error("Stored Gmail OAuth token has expired. Re-authorize in Options.");
  }

  const subject = isTest
    ? `[Test] ${ORMonitor.t("notify.testTitle", language)}`
    : `${ORMonitor.t("notify.decisionTitle", language)}: ${monitor.title}`;
  const body = [
    `Paper: ${monitor.title}`,
    ORMonitor.t("notify.decisionLine", language, { decision: decisionValue }),
    `Forum URL: ${monitor.url}`,
    `Checked at: ${new Date().toLocaleString()}`
  ].join("\n");

  const raw = ORMonitor.createMailMessage({
    to: recipientEmail,
    subject,
    body
  });

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `${gmail.tokenType || "Bearer"} ${gmail.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw })
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Gmail token was rejected. Re-authorize in Options.");
    }
    throw new Error(`Gmail API request failed with ${response.status}`);
  }
}

async function checkViaDom(monitor, options) {
  let tabId = options.sourceTabId;
  let ownsTab = false;

  try {
    if (!tabId) {
      const tab = await createTab({ url: monitor.url, active: false });
      tabId = tab.id;
      ownsTab = true;
    }

    await waitForTabComplete(tabId, TAB_LOAD_TIMEOUT_MS);
    await ORMonitor.sleep(POST_LOAD_WAIT_MS);

    const [execution] = await executeScript(tabId, {
      func: pageDecisionProbe
    });

    const result = execution && execution.result ? execution.result : {};
    const decisionValue = ORMonitor.normalizeDecisionValue(result.decisionValue || "");
    return {
      source: "dom",
      decisionValue: ORMonitor.isSyntheticDecisionValue(decisionValue) ? "" : decisionValue,
      decisionComment: ORMonitor.collapseInlineWhitespace(result.decisionComment || ""),
      error: result.error || ""
    };
  } catch (error) {
    return {
      source: "dom",
      decisionValue: "",
      decisionComment: "",
      error: `DOM check failed: ${ORMonitor.safeMessage(error)}`
    };
  } finally {
    if (ownsTab && tabId) {
      await removeTab(tabId).catch(() => {});
    }
  }
}

async function checkViaApi(monitor, domResult) {
  try {
    const hasCookie = await hasOpenReviewCookie();
    if (!hasCookie) {
      return {
        source: "api",
        decisionValue: "",
        decisionComment: "",
        error: domResult && domResult.error ? domResult.error : ""
      };
    }

    const response = await fetch(
      `https://api2.openreview.net/notes?forum=${encodeURIComponent(monitor.forumId)}`,
      {
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`OpenReview API returned ${response.status}`);
    }

    const payload = await response.json();
    const notes = Array.isArray(payload.notes)
      ? payload.notes
      : Array.isArray(payload.results)
        ? payload.results
        : [];

    const decisionNote = notes.find((note) => {
      const invitation = String(note && note.invitation ? note.invitation : "");
      return /\/Decision$/i.test(invitation);
    });

    if (!decisionNote) {
      return {
        source: "api",
        decisionValue: "",
        decisionComment: "",
        error: domResult && domResult.error ? domResult.error : ""
      };
    }

    const decisionValue = ORMonitor.extractDecisionFromNoteContent(decisionNote.content || {});
    const decisionCommentField = decisionNote.content ? decisionNote.content.comment : "";
    const decisionComment =
      typeof decisionCommentField === "string"
        ? decisionCommentField
        : typeof decisionCommentField.value === "string"
          ? decisionCommentField.value
          : "";

    const fallbackDecisionValue =
      decisionValue ||
      ORMonitor.extractDecisionValueFromText(JSON.stringify(decisionNote.content || {}));

    return {
      source: "api",
      decisionValue: ORMonitor.isSyntheticDecisionValue(fallbackDecisionValue)
        ? ""
        : fallbackDecisionValue,
      decisionComment: ORMonitor.collapseInlineWhitespace(decisionComment),
      error: ""
    };
  } catch (error) {
    return {
      source: "api",
      decisionValue: "",
      decisionComment: "",
      error: domResult && domResult.error
        ? `${domResult.error} | API fallback failed: ${ORMonitor.safeMessage(error)}`
        : ""
    };
  }
}

async function hasOpenReviewCookie() {
  const cookies = await new Promise((resolve, reject) => {
    chrome.cookies.getAll({ domain: "openreview.net" }, (items) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(items || []);
    });
  });
  return cookies.length > 0;
}

async function reconcileAlarm() {
  const [settings, monitors] = await Promise.all([
    ORMonitor.getSettings(),
    ORMonitor.getMonitors()
  ]);

  await clearAlarm(ORMonitor.ALARM_NAME);
  if (!monitors.length) {
    return;
  }

  chrome.alarms.create(ORMonitor.ALARM_NAME, {
    periodInMinutes: settings.pollIntervalMinutes
  });
}

async function findMonitor(forumId) {
  const monitors = await ORMonitor.getMonitors();
  return monitors.find((monitor) => monitor.forumId === forumId) || null;
}

async function upsertMonitor(nextMonitor) {
  const monitors = await ORMonitor.getMonitors();
  const existingIndex = monitors.findIndex((monitor) => monitor.forumId === nextMonitor.forumId);
  if (existingIndex >= 0) {
    monitors.splice(existingIndex, 1, nextMonitor);
  } else {
    monitors.push(nextMonitor);
  }
  await ORMonitor.saveMonitors(monitors);
  return nextMonitor;
}

function clearAlarm(name) {
  return new Promise((resolve) => {
    chrome.alarms.clear(name, () => resolve());
  });
}

function createTab(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(tab);
    });
  });
}

function removeTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.remove(tabId, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve();
    });
  });
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timerId = 0;

    function cleanup() {
      clearTimeout(timerId);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    }

    function onRemoved(removedTabId) {
      if (removedTabId !== tabId) {
        return;
      }
      cleanup();
      reject(new Error("Tab closed before load completed."));
    }

    function onUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }
      cleanup();
      resolve();
    }

    timerId = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for tab to finish loading."));
    }, timeoutMs);

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);

    chrome.tabs.get(tabId, (tab) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        cleanup();
        reject(new Error(lastError.message));
        return;
      }
      if (tab && tab.status === "complete") {
        cleanup();
        resolve();
      }
    });
  });
}

function executeScript(tabId, injection) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        ...injection
      },
      (result) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(result || []);
      }
    );
  });
}

function pageDecisionProbe() {
  const INJECTED_SELECTOR = "[data-or-monitor-root='true']";

  function clean(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeDecisionValue(value) {
    return clean(value).replace(/\n+/g, " ").replace(/^[\s:：-]+/, "").trim();
  }

  function readDecision(text) {
    const normalized = clean(text);
    const patterns = [
      /(?:^|\n)\s*(?:paper\s+)?decision\s*[:：-]?\s*([^\n]+)/i,
      /(?:^|\n)\s*decision\s*\n+\s*([^\n]+)/i,
      /(?:^|\n)\s*(accept(?:ed)?(?:\s*\([^)]+\))?|reject(?:ed)?(?:\s*\([^)]+\))?|conditional accept(?:ed)?(?:\s*\([^)]+\))?|desk reject(?:ed)?|withdrawn?)(?=\s*$|\n)/i
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      const candidate = normalizeDecisionValue(match && match[1] ? match[1] : match && match[0] ? match[0] : "");
      if (candidate && !/^decision$/i.test(candidate)) {
        return candidate;
      }
    }
    return "";
  }

  function scan() {
    const selectors = [
      "[class*='decision']",
      "[data-testid*='decision']",
      "article",
      "section",
      "main div",
      "main li"
    ];
    const inspected = new Set();

    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        if (inspected.has(node)) {
          continue;
        }
        if (node.closest(INJECTED_SELECTOR)) {
          continue;
        }
        inspected.add(node);
        const text = clean(node.innerText || node.textContent || "");
        if (!text || !/decision/i.test(text)) {
          continue;
        }
        const decisionValue = readDecision(text);
        if (decisionValue) {
          return {
            decisionValue,
            decisionComment: text.slice(0, 500)
          };
        }
      }
    }

    const pageClone = document.body ? document.body.cloneNode(true) : null;
    if (pageClone) {
      pageClone.querySelectorAll(INJECTED_SELECTOR).forEach((node) => node.remove());
    }
    const pageText = clean(pageClone ? pageClone.innerText || pageClone.textContent || "" : "");
    return {
      decisionValue: readDecision(pageText),
      decisionComment: pageText.slice(0, 500)
    };
  }

  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 10;
    const timerId = setInterval(() => {
      attempts += 1;
      const result = scan();
      if (result.decisionValue || attempts >= maxAttempts) {
        clearInterval(timerId);
        resolve(result);
      }
    }, 700);
  });
}
