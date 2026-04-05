/* global ORMonitor */

(function initOptionsPage() {
  "use strict";

  const nodes = {
    authorizeGmail: document.getElementById("authorize-gmail"),
    chromeHeading: document.getElementById("chrome-heading"),
    clearGmailToken: document.getElementById("clear-gmail-token"),
    desktopCopy: document.getElementById("desktop-copy"),
    desktopEnabled: document.getElementById("desktop-enabled"),
    desktopEnabledLabel: document.getElementById("desktop-enabled-label"),
    emailjsEnabled: document.getElementById("emailjs-enabled"),
    emailjsEnabledLabel: document.getElementById("emailjs-enabled-label"),
    emailjsHeading: document.getElementById("emailjs-heading"),
    emailjsPublicKey: document.getElementById("emailjs-public-key"),
    emailjsPublicKeyLabel: document.getElementById("emailjs-public-key-label"),
    emailjsServiceId: document.getElementById("emailjs-service-id"),
    emailjsServiceIdLabel: document.getElementById("emailjs-service-id-label"),
    emailjsTemplateId: document.getElementById("emailjs-template-id"),
    emailjsTemplateIdLabel: document.getElementById("emailjs-template-id-label"),
    generalHeading: document.getElementById("general-heading"),
    gmailClientId: document.getElementById("gmail-client-id"),
    gmailClientIdLabel: document.getElementById("gmail-client-id-label"),
    gmailEnabled: document.getElementById("gmail-enabled"),
    gmailEnabledLabel: document.getElementById("gmail-enabled-label"),
    gmailHeading: document.getElementById("gmail-heading"),
    gmailStatus: document.getElementById("gmail-status"),
    languageLabel: document.getElementById("language-label"),
    languageSelect: document.getElementById("language-select"),
    notificationsHeading: document.getElementById("notifications-heading"),
    optionsEyebrow: document.getElementById("options-eyebrow"),
    optionsLede: document.getElementById("options-lede"),
    optionsTitle: document.getElementById("options-title"),
    pollInterval: document.getElementById("poll-interval"),
    pollIntervalLabel: document.getElementById("poll-interval-label"),
    recipientEmail: document.getElementById("recipient-email"),
    recipientEmailLabel: document.getElementById("recipient-email-label"),
    saveSettings: document.getElementById("save-settings"),
    statusMessage: document.getElementById("status-message"),
    testNotification: document.getElementById("test-notification")
  };

  let currentLanguage = "en";
  let currentSettings = ORMonitor.DEFAULT_SETTINGS;

  nodes.saveSettings.addEventListener("click", () => {
    saveSettings().catch((error) => {
      showStatus(ORMonitor.safeMessage(error), true);
    });
  });

  nodes.languageSelect.addEventListener("change", () => {
    currentLanguage = ORMonitor.resolveLanguage(nodes.languageSelect.value);
    renderStaticText();
  });

  nodes.authorizeGmail.addEventListener("click", () => {
    authorizeGmail().catch((error) => {
      showStatus(ORMonitor.safeMessage(error), true);
    });
  });

  nodes.clearGmailToken.addEventListener("click", () => {
    clearGmailToken().catch((error) => {
      showStatus(ORMonitor.safeMessage(error), true);
    });
  });

  nodes.testNotification.addEventListener("click", async () => {
    nodes.testNotification.disabled = true;
    try {
      await saveSettings({ silent: true });
      const response = await ORMonitor.sendRuntimeMessage({
        type: "send-test-notification"
      });
      if (!response.ok) {
        throw new Error(response.error || "Test notification failed");
      }
      showStatus(ORMonitor.t("options.statusTestSent", currentLanguage));
    } catch (error) {
      showStatus(ORMonitor.safeMessage(error), true);
    } finally {
      nodes.testNotification.disabled = false;
    }
  });

  loadSettings().catch((error) => {
    showStatus(ORMonitor.safeMessage(error), true);
  });

  async function loadSettings() {
    currentSettings = await ORMonitor.getSettings();
    currentLanguage = ORMonitor.resolveLanguage(currentSettings.language);
    renderSelectOptions();
    renderStaticText();
    applySettingsToForm(currentSettings);
  }

  function applySettingsToForm(settings) {
    nodes.languageSelect.value = settings.language || "auto";
    nodes.pollInterval.value = String(settings.pollIntervalMinutes);
    nodes.recipientEmail.value = settings.recipientEmail || "";
    nodes.desktopEnabled.checked = Boolean(settings.notifications.desktop);
    nodes.emailjsEnabled.checked = Boolean(settings.notifications.emailjs);
    nodes.gmailEnabled.checked = Boolean(settings.notifications.gmail);
    nodes.emailjsPublicKey.value = settings.emailjs.publicKey || "";
    nodes.emailjsServiceId.value = settings.emailjs.serviceId || "";
    nodes.emailjsTemplateId.value = settings.emailjs.templateId || "";
    nodes.gmailClientId.value = settings.gmail.clientId || "";
    renderGmailStatus(settings.gmail);
  }

  function renderStaticText() {
    document.documentElement.lang = currentLanguage;
    nodes.optionsEyebrow.textContent = ORMonitor.t("options.eyebrow", currentLanguage);
    nodes.optionsTitle.textContent = ORMonitor.t("options.title", currentLanguage);
    nodes.optionsLede.textContent = ORMonitor.t("options.lede", currentLanguage);
    nodes.saveSettings.textContent = ORMonitor.t("common.save", currentLanguage);
    nodes.generalHeading.textContent = ORMonitor.t("options.general", currentLanguage);
    nodes.languageLabel.textContent = ORMonitor.t("options.language", currentLanguage);
    nodes.pollIntervalLabel.textContent = ORMonitor.t("options.pollInterval", currentLanguage);
    nodes.recipientEmailLabel.textContent = ORMonitor.t("options.recipientEmail", currentLanguage);
    nodes.notificationsHeading.textContent = ORMonitor.t("options.notifications", currentLanguage);
    nodes.chromeHeading.textContent = ORMonitor.t("options.chromeNotifications", currentLanguage);
    nodes.desktopEnabledLabel.textContent = ORMonitor.t("options.enableDesktop", currentLanguage);
    nodes.desktopCopy.textContent = ORMonitor.t("options.desktopCopy", currentLanguage);
    nodes.emailjsHeading.textContent = ORMonitor.t("options.emailjs", currentLanguage);
    nodes.emailjsEnabledLabel.textContent = ORMonitor.t("options.enableEmailjs", currentLanguage);
    nodes.emailjsPublicKeyLabel.textContent = ORMonitor.t("options.publicKey", currentLanguage);
    nodes.emailjsServiceIdLabel.textContent = ORMonitor.t("options.serviceId", currentLanguage);
    nodes.emailjsTemplateIdLabel.textContent = ORMonitor.t("options.templateId", currentLanguage);
    nodes.gmailHeading.textContent = ORMonitor.t("options.gmail", currentLanguage);
    nodes.gmailEnabledLabel.textContent = ORMonitor.t("options.enableGmail", currentLanguage);
    nodes.gmailClientIdLabel.textContent = ORMonitor.t("options.oauthClientId", currentLanguage);
    nodes.authorizeGmail.textContent = ORMonitor.t("options.authorizeGmail", currentLanguage);
    nodes.clearGmailToken.textContent = ORMonitor.t("options.clearToken", currentLanguage);
    nodes.testNotification.textContent = ORMonitor.t("options.testNotification", currentLanguage);
    renderSelectOptions();
    renderGmailStatus(currentSettings.gmail || {});
  }

  function renderSelectOptions() {
    const selectedLanguage = (nodes.languageSelect.value || currentSettings.language || "auto");
    nodes.languageSelect.innerHTML = "";
    ORMonitor.LANGUAGE_OPTIONS.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.selected = value === selectedLanguage;
      if (value === "zh") {
        option.textContent = ORMonitor.t("common.chinese", currentLanguage);
      } else if (value === "en") {
        option.textContent = ORMonitor.t("common.english", currentLanguage);
      } else {
        option.textContent = ORMonitor.t("common.auto", currentLanguage);
      }
      nodes.languageSelect.appendChild(option);
    });

    const selectedInterval = String(nodes.pollInterval.value || currentSettings.pollIntervalMinutes || 5);
    nodes.pollInterval.innerHTML = "";
    ORMonitor.POLL_INTERVAL_OPTIONS.forEach((value) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.selected = String(value) === selectedInterval;
      option.textContent = currentLanguage === "zh"
        ? `${value} 分钟`
        : value === 1
          ? "1 minute"
          : `${value} minutes`;
      nodes.pollInterval.appendChild(option);
    });
  }

  async function saveSettings({ silent = false } = {}) {
    currentLanguage = ORMonitor.resolveLanguage(nodes.languageSelect.value);

    currentSettings = ORMonitor.deepMerge(ORMonitor.DEFAULT_SETTINGS, {
      language: nodes.languageSelect.value,
      pollIntervalMinutes: Number(nodes.pollInterval.value),
      recipientEmail: String(nodes.recipientEmail.value || "").trim(),
      notifications: {
        desktop: nodes.desktopEnabled.checked,
        emailjs: nodes.emailjsEnabled.checked,
        gmail: nodes.gmailEnabled.checked
      },
      emailjs: {
        publicKey: String(nodes.emailjsPublicKey.value || "").trim(),
        serviceId: String(nodes.emailjsServiceId.value || "").trim(),
        templateId: String(nodes.emailjsTemplateId.value || "").trim()
      },
      gmail: {
        ...(await ORMonitor.getSettings()).gmail,
        clientId: String(nodes.gmailClientId.value || "").trim()
      }
    });

    if (
      (currentSettings.notifications.emailjs || currentSettings.notifications.gmail) &&
      !ORMonitor.validateEmail(currentSettings.recipientEmail)
    ) {
      throw new Error(ORMonitor.t("options.enterValidRecipient", currentLanguage));
    }

    await ORMonitor.saveSettings(currentSettings);
    await ORMonitor.sendRuntimeMessage({ type: "settings-updated" });
    renderStaticText();

    if (!silent) {
      showStatus(ORMonitor.t("options.statusSaved", currentLanguage));
    }
  }

  async function authorizeGmail() {
    nodes.authorizeGmail.disabled = true;

    try {
      const settings = await ORMonitor.getSettings();
      const clientId = String(nodes.gmailClientId.value || settings.gmail.clientId || "").trim();
      if (!clientId) {
        throw new Error(ORMonitor.t("options.enterClientId", currentLanguage));
      }

      const redirectUri = chrome.identity.getRedirectURL("gmail-oauth2");
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "token",
        scope: ORMonitor.GMAIL_SCOPE,
        include_granted_scopes: "true",
        prompt: "consent"
      });

      const redirectUrl = await launchWebAuthFlow(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
      );
      const tokenPayload = parseOAuthRedirect(redirectUrl);

      currentSettings = await ORMonitor.getSettings();
      currentSettings.language = nodes.languageSelect.value;
      currentSettings.gmail.clientId = clientId;
      currentSettings.gmail.accessToken = tokenPayload.accessToken;
      currentSettings.gmail.tokenType = tokenPayload.tokenType;
      currentSettings.gmail.grantedAt = new Date().toISOString();
      currentSettings.gmail.expiresAt = new Date(Date.now() + tokenPayload.expiresIn * 1000).toISOString();

      await ORMonitor.saveSettings(currentSettings);
      await ORMonitor.sendRuntimeMessage({ type: "settings-updated" });
      renderGmailStatus(currentSettings.gmail);
      showStatus(ORMonitor.t("options.statusGmailAuthorized", currentLanguage));
    } finally {
      nodes.authorizeGmail.disabled = false;
    }
  }

  async function clearGmailToken() {
    currentSettings = await ORMonitor.getSettings();
    currentSettings.gmail.accessToken = "";
    currentSettings.gmail.tokenType = "Bearer";
    currentSettings.gmail.expiresAt = "";
    currentSettings.gmail.grantedAt = "";
    await ORMonitor.saveSettings(currentSettings);
    await ORMonitor.sendRuntimeMessage({ type: "settings-updated" });
    renderGmailStatus(currentSettings.gmail);
    showStatus(ORMonitor.t("options.statusTokenRemoved", currentLanguage));
  }

  function renderGmailStatus(gmail) {
    if (!gmail || !gmail.accessToken) {
      nodes.gmailStatus.textContent = ORMonitor.t("options.notAuthorized", currentLanguage);
      return;
    }
    const expiry = gmail.expiresAt ? ORMonitor.formatDateTime(gmail.expiresAt) : "unknown";
    nodes.gmailStatus.textContent = ORMonitor.t("options.authorizedUntil", currentLanguage, {
      expiry
    });
  }

  function showStatus(message, isError = false) {
    nodes.statusMessage.textContent = message;
    nodes.statusMessage.dataset.error = isError ? "true" : "false";
  }

  function launchWebAuthFlow(url) {
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url,
          interactive: true
        },
        (redirectUrl) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          resolve(redirectUrl);
        }
      );
    });
  }

  function parseOAuthRedirect(redirectUrl) {
    if (!redirectUrl) {
      throw new Error("Google OAuth flow did not return a redirect URL.");
    }

    const parsed = new URL(redirectUrl);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const tokenType = hash.get("token_type") || "Bearer";
    const expiresIn = Number(hash.get("expires_in") || "0");

    if (!accessToken) {
      throw new Error("OAuth token was not present in the redirect URL.");
    }

    return {
      accessToken,
      tokenType,
      expiresIn: expiresIn || 3600
    };
  }
})();
