/* global ORMonitor */

(function initPopup() {
  "use strict";

  const nodes = {
    emptyCopy: document.getElementById("empty-copy"),
    emptyNode: document.getElementById("empty-state"),
    emptyTitle: document.getElementById("empty-title"),
    eyebrow: document.getElementById("popup-eyebrow"),
    languageSelect: document.getElementById("language-select"),
    list: document.getElementById("monitor-list"),
    methodsLine: document.getElementById("methods-line"),
    openSettingsLink: document.getElementById("open-settings-link"),
    refreshAllButton: document.getElementById("refresh-all"),
    summaryCopy: document.getElementById("summary-copy"),
    summaryCount: document.getElementById("summary-count"),
    title: document.getElementById("popup-title")
  };

  let currentLanguage = "en";
  let currentSettings = ORMonitor.DEFAULT_SETTINGS;

  nodes.refreshAllButton.addEventListener("click", async () => {
    setRefreshingState(true);
    try {
      await ORMonitor.sendRuntimeMessage({ type: "refresh-all" });
      await render();
    } catch (error) {
      console.error("Refresh all failed", error);
    } finally {
      setRefreshingState(false);
    }
  });

  nodes.languageSelect.addEventListener("change", async () => {
    currentSettings.language = nodes.languageSelect.value;
    await ORMonitor.saveSettings(currentSettings);
    currentLanguage = ORMonitor.resolveLanguage(currentSettings.language);
    renderStaticText();
    await ORMonitor.sendRuntimeMessage({ type: "settings-updated" });
    await render();
  });

  render().catch((error) => {
    console.error("Popup render failed", error);
  });

  setInterval(() => {
    render().catch((error) => {
      console.error("Popup auto-refresh failed", error);
    });
  }, 5000);

  async function render() {
    currentSettings = await ORMonitor.getSettings();
    currentLanguage = ORMonitor.resolveLanguage(currentSettings.language);
    renderLanguageSelect();
    renderStaticText();

    const response = await ORMonitor.sendRuntimeMessage({ type: "list-monitors" });
    const monitors = response.ok ? response.monitors : [];

    const noun = monitors.length === 1
      ? ORMonitor.t("common.paperSingular", currentLanguage)
      : ORMonitor.t("common.paperPlural", currentLanguage);

    nodes.summaryCount.textContent = ORMonitor.t("popup.summaryCount", currentLanguage, {
      count: monitors.length,
      noun
    });
    nodes.methodsLine.textContent = `${ORMonitor.t("popup.methodsLabel", currentLanguage)}: ${notificationMethodsSummary()}`;
    nodes.list.innerHTML = "";
    nodes.emptyNode.hidden = monitors.length > 0;

    monitors.forEach((monitor) => {
      nodes.list.appendChild(renderMonitorCard(monitor));
    });
  }

  function renderStaticText() {
    document.documentElement.lang = currentLanguage;
    nodes.eyebrow.textContent = ORMonitor.t("popup.eyebrow", currentLanguage);
    nodes.title.textContent = ORMonitor.t("popup.title", currentLanguage);
    nodes.summaryCopy.textContent = ORMonitor.t("popup.summaryCopy", currentLanguage);
    nodes.emptyTitle.textContent = ORMonitor.t("popup.emptyTitle", currentLanguage);
    nodes.emptyCopy.textContent = ORMonitor.t("popup.emptyCopy", currentLanguage);
    nodes.openSettingsLink.textContent = ORMonitor.t("common.openSettings", currentLanguage);
    nodes.refreshAllButton.textContent = ORMonitor.t("popup.refreshAll", currentLanguage);
  }

  function renderLanguageSelect() {
    const selected = currentSettings.language || "auto";
    nodes.languageSelect.innerHTML = "";
    ORMonitor.LANGUAGE_OPTIONS.forEach((languageOption) => {
      const option = document.createElement("option");
      option.value = languageOption;
      option.selected = languageOption === selected;
      option.textContent = languageLabel(languageOption);
      nodes.languageSelect.appendChild(option);
    });
  }

  function renderMonitorCard(monitor) {
    const card = document.createElement("article");
    card.className = "monitor-card";

    const titleLink = document.createElement("a");
    titleLink.className = "monitor-title";
    titleLink.href = monitor.url;
    titleLink.target = "_blank";
    titleLink.rel = "noreferrer";
    titleLink.textContent = monitor.title;

    const toolbar = document.createElement("div");
    toolbar.className = "monitor-toolbar";
    toolbar.appendChild(createStatusPill(monitor));

    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.className = "mini-button";
    refreshButton.textContent = ORMonitor.t("common.refresh", currentLanguage);
    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;
      refreshButton.textContent = ORMonitor.t("common.refreshing", currentLanguage);
      try {
        await ORMonitor.sendRuntimeMessage({
          type: "refresh-monitor",
          forumId: monitor.forumId
        });
        await render();
      } catch (error) {
        console.error("Refresh failed", error);
      } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = ORMonitor.t("common.refresh", currentLanguage);
      }
    });
    toolbar.appendChild(refreshButton);

    const detail = document.createElement("p");
    detail.className = "monitor-meta";
    detail.textContent = monitor.decisionValue
      ? `${ORMonitor.t("popup.decisionPrefix", currentLanguage)}: ${monitor.decisionValue}`
      : `${ORMonitor.t("common.lastChecked", currentLanguage)}: ${ORMonitor.formatDateTime(monitor.lastChecked)}`;

    const error = document.createElement("p");
    error.className = "monitor-error";
    error.hidden = !monitor.lastError;
    error.textContent = monitor.lastError
      ? `${ORMonitor.t("popup.errorPrefix", currentLanguage)}: ${monitor.lastError}`
      : "";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "mini-button danger";
    removeButton.textContent = ORMonitor.t("common.remove", currentLanguage);
    removeButton.addEventListener("click", async () => {
      removeButton.disabled = true;
      try {
        await ORMonitor.sendRuntimeMessage({
          type: "unregister-monitor",
          forumId: monitor.forumId
        });
        await render();
      } catch (error) {
        console.error("Delete failed", error);
      } finally {
        removeButton.disabled = false;
      }
    });

    toolbar.appendChild(removeButton);

    card.appendChild(titleLink);
    card.appendChild(toolbar);
    card.appendChild(detail);
    card.appendChild(error);
    return card;
  }

  function createStatusPill(monitor) {
    const state = ORMonitor.getMonitorDisplayState(monitor);
    const pill = document.createElement("span");
    pill.className = `status-pill status-${state}`;
    pill.textContent = ORMonitor.t(`display.${state}`, currentLanguage);
    return pill;
  }

  function notificationMethodsSummary() {
    const labels = [];
    if (currentSettings.notifications.desktop) {
      labels.push(ORMonitor.t("options.chromeNotifications", currentLanguage));
    }
    if (currentSettings.notifications.emailjs) {
      labels.push(ORMonitor.t("options.emailjs", currentLanguage));
    }
    if (currentSettings.notifications.gmail) {
      labels.push(ORMonitor.t("options.gmail", currentLanguage));
    }
    return labels.length ? labels.join(" / ") : ORMonitor.t("popup.methodsNone", currentLanguage);
  }

  function languageLabel(value) {
    if (value === "zh") {
      return ORMonitor.t("common.chinese", currentLanguage);
    }
    if (value === "en") {
      return ORMonitor.t("common.english", currentLanguage);
    }
    return ORMonitor.t("common.auto", currentLanguage);
  }

  function setRefreshingState(isRefreshing) {
    nodes.refreshAllButton.disabled = isRefreshing;
    nodes.refreshAllButton.textContent = isRefreshing
      ? ORMonitor.t("popup.refreshingAll", currentLanguage)
      : ORMonitor.t("popup.refreshAll", currentLanguage);
  }
})();
