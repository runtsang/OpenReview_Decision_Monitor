/* global ORMonitor */

(function initContentScript() {
  "use strict";

  const FORUM_PANEL_ID = "or-monitor-panel";
  const INLINE_WIDGET_CLASS = "or-monitor-inline";

  let currentLanguage = "en";
  let monitorsById = new Map();
  let syncScheduled = false;
  let syncRunning = false;
  let lastLocation = "";

  bootstrap().catch((error) => {
    console.error("Content bootstrap failed", error);
  });

  async function bootstrap() {
    await syncUi();

    const observer = new MutationObserver(() => {
      scheduleSync();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.addEventListener("popstate", scheduleSync);
    window.addEventListener("hashchange", scheduleSync);

    setInterval(() => {
      if (window.location.href !== lastLocation) {
        scheduleSync();
        return;
      }
      if (ORMonitor.isForumUrl(window.location.href) || ORMonitor.isAuthorsGroupUrl(window.location.href)) {
        scheduleSync();
      }
    }, 4000);
  }

  function scheduleSync() {
    if (syncScheduled) {
      return;
    }
    syncScheduled = true;
    setTimeout(() => {
      syncScheduled = false;
      syncUi().catch((error) => {
        console.error("Sync failed", error);
      });
    }, 250);
  }

  async function syncUi() {
    if (syncRunning) {
      return;
    }

    syncRunning = true;
    try {
      lastLocation = window.location.href;
      const settings = await ORMonitor.getSettings().catch(() => ORMonitor.DEFAULT_SETTINGS);
      currentLanguage = ORMonitor.resolveLanguage(settings.language);
      const response = await ORMonitor.sendRuntimeMessage({ type: "list-monitors" }).catch(() => ({
        ok: false,
        monitors: []
      }));

      monitorsById = new Map(
        (response.ok ? response.monitors : []).map((monitor) => [monitor.forumId, monitor])
      );

      renderForumPanel();
      renderAuthorsWidgets();
    } finally {
      syncRunning = false;
    }
  }

  function renderForumPanel() {
    const existing = document.getElementById(FORUM_PANEL_ID);
    if (!ORMonitor.isForumUrl(window.location.href)) {
      if (existing) {
        existing.remove();
      }
      return;
    }

    const forumId = ORMonitor.getForumIdFromUrl(window.location.href);
    const monitor = monitorsById.get(forumId) || null;
    const panel = existing || document.createElement("div");
    panel.id = FORUM_PANEL_ID;
    panel.className = "or-monitor-forum-panel";
    panel.dataset.orMonitorRoot = "true";
    panel.innerHTML = "";

    const toolbar = document.createElement("div");
    toolbar.className = "or-monitor-row or-monitor-row-inline";
    toolbar.appendChild(createStatusPill(monitor));
    toolbar.appendChild(
      createActionButton({
        label: ORMonitor.t("content.refreshNow", currentLanguage),
        busyLabel: ORMonitor.t("content.refreshingNow", currentLanguage),
        variant: "ghost",
        compact: true,
        onClick: async (button) => {
          button.disabled = true;
          button.textContent = ORMonitor.t("content.refreshingNow", currentLanguage);
          try {
            await ensureMonitor({
              forumId,
              title: ORMonitor.getPageTitle(document),
              url: window.location.href
            });
            await ORMonitor.sendRuntimeMessage({
              type: "refresh-monitor",
              forumId
            });
            await syncUi();
          } finally {
            button.disabled = false;
            button.textContent = ORMonitor.t("content.refreshNow", currentLanguage);
          }
        }
      })
    );

    const toggleButton = createActionButton({
      label: monitor
        ? ORMonitor.t("content.stopMonitoring", currentLanguage)
        : ORMonitor.t("content.monitorDecision", currentLanguage),
      variant: monitor ? "danger" : "primary",
      compact: true,
      title: monitor
        ? ORMonitor.t("content.removeMonitor", currentLanguage)
        : ORMonitor.t("content.addMonitor", currentLanguage),
      onClick: async (button) => {
        button.disabled = true;
        try {
          if (monitor) {
            await ORMonitor.sendRuntimeMessage({
              type: "unregister-monitor",
              forumId
            });
          } else {
            await ensureMonitor({
              forumId,
              title: ORMonitor.getPageTitle(document),
              url: window.location.href
            });
          }
          await syncUi();
        } finally {
          button.disabled = false;
        }
      }
    });

    toolbar.appendChild(toggleButton);
    panel.appendChild(toolbar);
    panel.appendChild(createLastCheckedMeta(monitor));
    panel.title = [buildMetaText(monitor), monitor && monitor.lastError ? monitor.lastError : ""]
      .filter(Boolean)
      .join("\n");

    mountForumPanel(panel);
  }

  function renderAuthorsWidgets() {
    const widgets = Array.from(document.querySelectorAll(`.${INLINE_WIDGET_CLASS}`));
    if (!ORMonitor.isAuthorsGroupUrl(window.location.href)) {
      widgets.forEach((widget) => widget.remove());
      return;
    }

    const links = findForumLinksOnAuthorsPage();
    const activeForumIds = new Set();

    links.forEach((link) => {
      const forumId = ORMonitor.getForumIdFromUrl(link.getAttribute("href"), window.location.href);
      if (!forumId) {
        return;
      }
      activeForumIds.add(forumId);

      const url = ORMonitor.normalizeForumUrl(link.getAttribute("href"), window.location.href);
      const title = extractTitleFromLink(link);
      const monitor = monitorsById.get(forumId) || null;
      const widget = ensureInlineWidget(link, forumId);
      renderInlineWidget(widget, { forumId, title, url }, monitor);
    });

    widgets.forEach((widget) => {
      if (!activeForumIds.has(widget.dataset.forumId || "")) {
        widget.remove();
      }
    });
  }

  function findForumLinksOnAuthorsPage() {
    const candidates = Array.from(
      document.querySelectorAll("a[href*='/forum?id='], a[href*='openreview.net/forum?id=']")
    );

    return candidates.filter((link) => {
      if (link.closest(`.${INLINE_WIDGET_CLASS}`)) {
        return false;
      }
      const forumId = ORMonitor.getForumIdFromUrl(link.getAttribute("href"), window.location.href);
      return Boolean(forumId);
    });
  }

  function ensureInlineWidget(link, forumId) {
    const parent = link.parentElement || link;
    const existing = parent.querySelector(`.${INLINE_WIDGET_CLASS}[data-forum-id="${forumId}"]`);
    if (existing) {
      return existing;
    }

    const widget = document.createElement("div");
    widget.className = INLINE_WIDGET_CLASS;
    widget.dataset.forumId = forumId;
    widget.dataset.orMonitorRoot = "true";
    link.insertAdjacentElement("afterend", widget);
    return widget;
  }

  function renderInlineWidget(widget, entry, monitor) {
    widget.innerHTML = "";

    const toolbar = document.createElement("div");
    toolbar.className = "or-monitor-inline-toolbar";

    const statusPill = createStatusPill(monitor);
    const refreshButton = createActionButton({
      label: ORMonitor.t("content.refreshNow", currentLanguage),
      busyLabel: ORMonitor.t("content.refreshingNow", currentLanguage),
      variant: "ghost",
      compact: true,
      onClick: async (button) => {
        button.disabled = true;
        button.textContent = ORMonitor.t("content.refreshingNow", currentLanguage);
        try {
          await ensureMonitor(entry);
          await ORMonitor.sendRuntimeMessage({
            type: "refresh-monitor",
            forumId: entry.forumId
          });
          await syncUi();
        } finally {
          button.disabled = false;
          button.textContent = ORMonitor.t("content.refreshNow", currentLanguage);
        }
      }
    });

    const toggleButton = createActionButton({
      label: monitor
        ? ORMonitor.t("content.stopMonitoring", currentLanguage)
        : ORMonitor.t("content.monitorDecision", currentLanguage),
      variant: monitor ? "danger" : "primary",
      compact: true,
      onClick: async (button) => {
        button.disabled = true;
        try {
          if (monitor) {
            await ORMonitor.sendRuntimeMessage({
              type: "unregister-monitor",
              forumId: entry.forumId
            });
          } else {
            await ensureMonitor(entry);
          }
          await syncUi();
        } finally {
          button.disabled = false;
        }
      }
    });

    toolbar.appendChild(statusPill);
    toolbar.appendChild(refreshButton);
    toolbar.appendChild(toggleButton);
    widget.appendChild(toolbar);
    widget.appendChild(createLastCheckedMeta(monitor));
  }

  async function ensureMonitor(entry) {
    const existing = monitorsById.get(entry.forumId);
    if (existing) {
      return existing;
    }

    const response = await ORMonitor.sendRuntimeMessage({
      type: "register-monitor",
      payload: {
        forumId: entry.forumId,
        title: entry.title,
        url: entry.url
      }
    });

    if (!response.ok) {
      throw new Error(response.error || "Failed to register monitor.");
    }

    monitorsById.set(entry.forumId, response.monitor);
    return response.monitor;
  }

  function createStatusPill(monitor) {
    const state = ORMonitor.getMonitorDisplayState(monitor);
    const pill = document.createElement("span");
    pill.className = `or-monitor-pill or-monitor-pill-${state}`;
    pill.textContent = ORMonitor.t(`display.${state}`, currentLanguage);
    pill.title = `${ORMonitor.t("common.status", currentLanguage)}: ${ORMonitor.t(`display.${state}`, currentLanguage)}`;
    return pill;
  }

  function createActionButton({
    label,
    variant = "ghost",
    compact = false,
    title = "",
    onClick
  }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `or-monitor-button or-monitor-button-${variant}`;
    if (compact) {
      button.classList.add("or-monitor-button-compact");
    }
    button.textContent = label;
    if (title) {
      button.title = title;
    }
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick(button).catch((error) => {
        console.error("Action failed", error);
        scheduleSync();
      });
    });
    return button;
  }

  function mountForumPanel(panel) {
    const anchor = locateForumAnchor();
    panel.classList.toggle("or-monitor-forum-panel-fallback", !anchor.inline);

    if (anchor.mode === "append") {
      anchor.node.appendChild(panel);
      return;
    }

    anchor.node.insertAdjacentElement("afterend", panel);
  }

  function locateForumAnchor() {
    const fallbackHeading =
      document.querySelector("main h2") ||
      document.querySelector("main h1");
    if (fallbackHeading) {
      return { mode: "afterend", node: fallbackHeading, inline: false };
    }

    const fallbackContainer = document.querySelector("main") || document.body;
    return { mode: "append", node: fallbackContainer, inline: false };
  }

  function buildMetaText(monitor) {
    if (!monitor) {
      return `${ORMonitor.t("common.status", currentLanguage)}: ${ORMonitor.t("display.non-tracking", currentLanguage)}`;
    }
    if (monitor && monitor.decisionValue) {
      return `${ORMonitor.t("popup.decisionPrefix", currentLanguage)}: ${monitor.decisionValue}`;
    }
    if (monitor && monitor.lastChecked) {
      return `${ORMonitor.t("common.lastChecked", currentLanguage)}: ${ORMonitor.formatDateTime(monitor.lastChecked)}`;
    }
    return `${ORMonitor.t("common.status", currentLanguage)}: ${ORMonitor.t("display.tracking-no-decision", currentLanguage)}`;
  }

  function createLastCheckedMeta(monitor, tagName = "div") {
    const meta = document.createElement(tagName);
    meta.className = "or-monitor-meta";
    meta.textContent = `${ORMonitor.t("common.lastChecked", currentLanguage)}: ${ORMonitor.formatDateTime(
      monitor && monitor.lastChecked ? monitor.lastChecked : ""
    )}`;
    return meta;
  }

  function extractTitleFromLink(link) {
    const ownText = ORMonitor.collapseInlineWhitespace(link.textContent || "");
    if (ownText && ownText.length > 6) {
      return ownText;
    }

    const row = link.closest("tr, li, article, section, div");
    const rowText = ORMonitor.collapseInlineWhitespace(row ? row.textContent || "" : "");
    return rowText || "Untitled Paper";
  }
})();
