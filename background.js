const contentScriptUrl = "./contentscripts/safeScript.js";
const TabActions = {
  isNavigation: false,
  activeWindowId: null,
  recordedTabs: [],
  tabHistory: [],
  onPopupInit: async function () {
    const isReady = await isPopupReady();
    if (isReady) {
      const currentActiveTab = await asyncStorageGet("lastActiveTabData");
      this.newTab({
        id: currentActiveTab.tabId,
        url: currentActiveTab.url,
        windowId: currentActiveTab.windowId,
      });
    }
  },
  addToHistory: async function (tabId, url, windowId) {
    const isExtensionUI = await isFrontend(tabId);
    if (isExtensionUI) return;

    // when a new tab is created, the startpage url would be "chrome://newtab/",
    // but once a user visits a url, the start page url changes at runtime to "chrome://new-tab-page/".
    // We only store the new start page url in the 'history' because if we stored the old startpage url it won't ever match with the new startpage url.
    if (!this.hasTab(tabId)) {
      this.tabHistory.push({ tabId, windowId, urls: [url], pos: 0 });
      logger.debug(
        "New Tab added To History: ",
        JSON.stringify(this.tabHistory)
      );
    } else {
      this.tabHistory = this.tabHistory.map((history) => {
        if (history.tabId === tabId && history.urls[history.pos] !== url) {
          // Discard urls after the curent pos on a new naviagtion
          if (this.isNavigation) {
            const removedItems = history.urls.splice(history.pos + 1);
            logger.debug("removedItems: ", removedItems);
            this.isNavigation = false;
          }

          // TRACKING CHANGES IN SINGLE PAGE APPLICATION (SPA) URLS
          // Update current top level url if the url ignoring the 'https://domain/' like so URL:"/prev-url/current-url-change", starts with "/prev-url"
          // const url_param = history.urls[history.pos].split("/").slice(3).join("/");
          // if(url_param !== "" && url.startsWith(history.urls[history.pos])) {
          //   history.urls[history.pos] = url;
          //   return { ...history};
          // }

          history.urls.push(url);
          return { ...history, urls: history.urls, pos: history.pos + 1 };
        } else return history;
      });
      logger.debug("Updated History: ", JSON.stringify(this.tabHistory));
    }
  },
  navigate: async function (tabInfo) {
    if (!tabInfo.url || !isSupportedSite(tabInfo.url)) return;
    this.isNavigation = true;
    this.addToHistory(tabInfo.id, tabInfo.url);
    this.sendTabInfo(tabInfo, "Navigate");
  },
  newWindow: function (tabInfo) {
    this.sendTabInfo(tabInfo, "NewWindow");
  },
  newTab: async function (tabInfo) {
    logger.debug("TabActions.newTab");
    tabInfo.url =
      tabInfo.url === "chrome://newtab/"
        ? "chrome://new-tab-page/"
        : tabInfo.url;
    this.addToHistory(tabInfo.id, tabInfo.url, tabInfo.windowId);
    this.sendTabInfo(tabInfo, "NewTab");
  },
  selectWindow: function (tabInfo) {
    if (!this.activeWindowId) {
      this.activeWindowId = tabInfo.windowId;
      return;
    }

    if (this.activeWindowId !== tabInfo.windowId) {
      this.activeWindowId = tabInfo.windowId;
      this.sendTabInfo(tabInfo, "SelectWindow");
    }
  },
  selectTab: async function (tabInfo) {
    let isNewWindow = false;

    if (this.tabHistory.length > 1 && !this.hasWindow(tabInfo.windowId)) {
      logger.debug("selectTab -> NewWindow -> NewTab");
      this.newWindow(tabInfo);
      isNewWindow = true;
    }

    // If the tab hasn't been saved, treat it as a 'NewTab' and return.
    if (!this.hasTab(tabInfo.id)) {
      logger.debug("selectTab -> NewTab");
      tabInfo.url =
        tabInfo.url === "" || tabInfo.url === "chrome://newtab/"
          ? "chrome://new-tab-page/"
          : tabInfo.url;

      this.addToHistory(tabInfo.id, tabInfo.url, tabInfo.windowId);

      // this.tabHistory.push({
      //   tabId: tabInfo.id,
      //   windowId: tabInfo.windowId,
      //   urls: [tabInfo.url],
      //   pos: 0,
      // });

      // Don't send the action if the its a new 'Window' as every new window comes with a new tab already created,
      // So we don't need to explicitly create an action for the new tab. Our goal is not to show every
      // action that takes place but to only show appropriate actions that can serve the actions that follows.
      // This could also happen upon clicking a link that opens a new tab.
      if (!isNewWindow) {
        this.sendTabInfo(tabInfo, "NewTab");
      }

      return;
    }

    tabInfo.url =
      tabInfo.url === "chrome://newtab/"
        ? "chrome://new-tab-page/"
        : tabInfo.url;
    this.sendTabInfo(tabInfo, "SelectTab");
  },
  closeTab: async function (tabId, removeInfo) {
    try {
      const { urls, windowId, pos } = this.tabHistory.filter(
        (history) => history.tabId === tabId
      )[0];

      if (this.hasTab(tabId)) {
        this.tabHistory = this.tabHistory.filter(
          (history) => history.tabId !== tabId
        );
      }

      const windowTabs = await tabsFromWindow(removeInfo.windowId);
      const isTabClosedWindow = windowTabs.length === 0;

      if (removeInfo.isWindowClosing || isTabClosedWindow) {
        this.closeWindow(removeInfo.windowId);
        return;
      }

      this.sendTabInfo({ id: tabId, url: urls[pos], windowId }, "CloseTab");
    } catch (err) {
      logger.error(err);
    }
  },
  closeWindow: function (windowId) {
    this.sendTabInfo(
      { id: null, url: "dummy url", windowId: windowId },
      "CloseWindow"
    );
  },
  back: function (tabId, changed_url, history) {
    logger.debug("isBack");
    this.sendTabInfo(
      {
        tabId: history.tabId,
        url: history.urls[0],
        windowId: history.windowId,
      },
      "Back"
    );
    this.tabHistory = this.tabHistory.map((history) => {
      if (history.tabId === tabId) return { ...history, pos: history.pos - 1 };
      else return history;
    });
  },
  forward: function (tabId, changed_url, history) {
    logger.debug("isForward");
    this.sendTabInfo(
      {
        tabId: history.tabId,
        url: history.urls[0],
        windowId: history.windowId,
      },
      "Forward"
    );
    this.tabHistory = this.tabHistory.map((history) => {
      if (history.tabId === tabId) return { ...history, pos: history.pos + 1 };
      else return history;
    });
  },
  handleForwardBack: function (tabId, changed_url) {
    // STACKOVERFLOW DELETED SUBMISSION: https://stackoverflow.com/questions/25542015/in-chrome-extension-determine-if-the-user-clicked-the-browsers-back-or-forward/76397179#76397179
    if (
      !changed_url ||
      (!isSupportedSite(changed_url) &&
        changed_url !== "chrome://new-tab-page/")
    )
      return;

    const historyTab = this.tabHistory.filter(
      (hist) => hist.tabId === tabId
    )[0];

    const isBack = historyTab.urls[historyTab.pos - 1] === changed_url;
    if (isBack) {
      this.back(tabId, changed_url, historyTab);
      return;
    }

    const isForward = historyTab.urls[historyTab.pos + 1] === changed_url;
    if (isForward) {
      this.forward(tabId, changed_url, historyTab);
      return;
    }
  },
  hasWindow: function (windowId) {
    return this.tabHistory.some((t) => t.windowId === windowId);
  },
  hasHistory: function () {
    return this.tabHistory.length > 0;
  },
  hasTab: function (tabId) {
    return this.tabHistory.some((t) => t.tabId === tabId);
  },
  sendTabInfo: async function (tabInfo, tabAction) {
    const isReady = await isPopupReady();
    if (!isReady || !tabInfo.url) return;

    const popupDetails = await asyncStorageGet("popupDetails");
    const EXT_TAB_ID = popupDetails.tabId;

    try {
      // message the frontend
      logger.debug("sending mesage to frontend, tabAction: ", `'${tabAction}'`);
      await messageTab(
        {
          status: "new-recorded-action",
          payload: {
            type: "RECORDED_ACTION",
            actionType: tabAction,
            payload: {
              url: tabInfo.url,
              tabId: tabInfo.id,
              windowId: tabInfo.windowId,
            },
          },
        },
        EXT_TAB_ID
      );
    } catch (err) {
      logger.debug(err);
    }
  },
};
const logger = {
  disable: true,
  debug: (message, value, color) => {
    if (message && !this.disable)
      console.log(
        `%c ${message}`,
        `color: ${color ? color : "orange"}; font-style: italic;`
      );
    if (value) console.log(value);
  },
  error: (error) => {
    if (error && !this.disable)
      console.log(`%c ${error}`, "color: white; background-color: red;");
  },
};
const RuntimeMessages = {
  "launch-extension": function (sendResponse) {
    createPopupWindow();
    sendResponse({ message: "launch-extension success" });
  },
  "minimize-window": function (sendResponse) {
    (async function () {
      const popupDetails = await asyncStorageGet("popupDetails");
      chrome.windows.update(popupDetails.windowId, { state: "minimise" });
      sendResponse({ message: "minimized-window success" });
    })();
  },
  "bg-recording-status": function (sendResponse) {
    (async function () {
      const isRecording = await asyncStorageGet("recording");
      sendResponse({ recording: isRecording });
    })();
  },
  "recording-started": function (sendResponse) {
    (async function () {
      await asyncStorageSet({ recording: true });
      TabActions.onPopupInit();
      sendResponse({ message: "recording-started success" });
    })();
  },
  "recording-stopped": function (sendResponse) {
    (async function () {
      await asyncStorageSet({ recording: false });
      sendResponse({ message: "recording-stopped success" });
    })();
  },
  "spa-pushstate": async function (sendResponse, request) {
    let activeTabData = await asyncStorageGet("lastActiveTabData");
    TabActions.addToHistory(
      activeTabData.tabId,
      request.url,
      activeTabData.windowId
    );
    TabActions.handleForwardBack(activeTabData.tabId, request.url);
    sendResponse({ message: "dummy-response" });
  },
  "spa-popstate": async function (sendResponse, request) {
    let activeTabData = await asyncStorageGet("lastActiveTabData");
    TabActions.addToHistory(
      activeTabData.tabId,
      request.url,
      activeTabData.windowId
    );
    TabActions.handleForwardBack(activeTabData.tabId, request.url);
    sendResponse({ message: "dummy-response" });
  },
};

try {
  handlePopupActionWindow();
  enableActiveTabListeners();
  chrome.commands.onCommand.addListener(function (command) {
    if (command === "toggle-window") {
      createPopupWindow();
    }
  });
  chrome.webNavigation.onCommitted.addListener(async function (details) {
    await handleWebNavigation(details);
  });
  chrome.runtime.onMessage.addListener(function (
    request,
    _sender,
    sendResponse
  ) {
    if (Object.keys(RuntimeMessages).includes(request.message)) {
      RuntimeMessages[request.message](sendResponse, request);
    }
    return true;
  });
} catch (e) {
  console.error(e);
}

// ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: SPA HISTORY :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
let prevHistoryDetailsTimeStamp = null;
async function trackURLChanges(details) {
  console.log("trackURLChanges details: ", details);

  // ignore swift changes in url : Only tested on twitter.com SPA Navigation
  let time_Diff = 0;
  if (prevHistoryDetailsTimeStamp) {
    time_Diff = details.timeStamp - prevHistoryDetailsTimeStamp;
  }
  prevHistoryDetailsTimeStamp = details.timeStamp;

  if (
    time_Diff > 1000 &&
    details.frameId === 0 &&
    details.transitionQualifiers.length === 0
  ) {
    var currentURL = details.url;
    console.log("onHistoryStateUpdated: SPA PAGE -> URL Changed:", currentURL);
    let tabDetails = await getTabFromId(details.tabId);
    TabActions.addToHistory(details.tabId, details.url, tabDetails.windowId);
  }

  const NavigatingUrl = details.url;
  console.log("History: ", TabActions.tabHistory);
  console.log("onHistoryStateUpdated -> NavigatingUrl: ", NavigatingUrl);
  const StartPage = NavigatingUrl === "chrome://new-tab-page/";
  const fw_back = details.transitionQualifiers.includes("forward_back");
  if (fw_back || StartPage) {
    console.log("onHistoryStateUpdated: FORWARD_BACK");
    TabActions.handleForwardBack(details.tabId, NavigatingUrl);
  }
}
chrome.webNavigation.onHistoryStateUpdated.addListener(trackURLChanges);
// :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::  END SPA HISTORY :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

async function handleWebNavigation(details) {
  console.log("webNavigation: ", details);
  const isReady = await isPopupReady();
  if (!isReady) return;

  const NavTabId = details.tabId;
  const NavigatingUrl = details.url;
  const StartPage = NavigatingUrl === "chrome://new-tab-page/";
  const NavigatingTab = await getTabFromId(NavTabId);
  const ActiveTab = await asyncStorageGet("lastActiveTabData");
  const isActiveTab = ActiveTab.tabId === NavTabId ? true : false;

  if (!isActiveTab) return;

  if (!NavigatingTab || (!isSupportedSite(NavigatingTab.url) && !StartPage))
    return;

  if (
    details.frameType === "outermost_frame" &&
    details.transitionType === "link" &&
    details.transitionQualifiers.length === 0
  ) {
    console.log("WebNavigation: LINK -> NAVIGATE");
    TabActions.navigate(NavigatingTab);
  }

  // New Window
  if (
    details.transitionType === "typed" &&
    TabActions.hasHistory() &&
    !TabActions.hasWindow(NavigatingTab.windowId)
  ) {
    console.log("WebNavigation: NEW_WINDOW");
    TabActions.newWindow(NavigatingTab);
  }

  // New Tab
  if (
    details.transitionType === "typed" &&
    !TabActions.hasTab(NavigatingTab.id)
  ) {
    // && !tab.formSelect
    console.log("WebNavigation: NEW_TAB");
    TabActions.newTab(NavigatingTab);
    return;
  }

  // Navigate using Address Bar
  // in WebDriver chrome client, we get "server_redirect" transitionQualifiers as well
  const from_address_bar_or_server_redirect =
    (["typed", "generated"].includes(details.transitionType) &&
      details.transitionQualifiers.includes("from_address_bar") &&
      !details.transitionQualifiers.includes("forward_back")) ||
    (details.transitionQualifiers.includes("server_redirect") &&
      !details.transitionQualifiers.includes("forward_back"));
  if (from_address_bar_or_server_redirect) {
    console.log("WebNavigation: NAVIGATE");
    TabActions.navigate(NavigatingTab);
    return;
  }

  // Move Across History
  console.log("NavigatingUrl: ", NavigatingUrl);
  const fw_back = details.transitionQualifiers.includes("forward_back");
  if (fw_back || StartPage) {
    console.log("WebNavigation: FORWARD_BACK");
    TabActions.handleForwardBack(NavTabId, NavigatingUrl);
  }
}

async function isPopupReady() {
  const popup = await asyncStorageGet("popupDetails");
  const popupTab = await getTabFromId(popup.tabId);
  const isRecording = await asyncStorageGet("recording");
  if (popupTab && isRecording) return true;
  else return false;
}

function handlePopupActionWindow() {
  chrome.action.onClicked.addListener(function (tab) {
    createPopupWindow();
  });
}

async function createPopupWindow() {
  chrome.windows.getAll(
    { populate: true, windowTypes: ["popup"] },
    async function (windows) {
      if (windows.length === 0) {
        chrome.windows.create(
          {
            url: chrome.runtime.getURL("./dist/index.html"),
            type: "popup",
            height: 700,
            width: 450,
          },
          async function (window) {
            await asyncStorageSet({
              popupDetails: { tabId: window.tabs[0].id, windowId: window.id },
            });
            setTimeout(() => {
              TabActions.onPopupInit();
            }, 500);
          }
        );
      } else {
        const popupDetails = await asyncStorageGet("popupDetails");
        chrome.windows.update(popupDetails.windowId, { focused: true });
      }
    }
  );
}

async function getActiveWindowTab() {
  let windowWithTabId = {};
  const windows = await chrome.windows.getAll({
    populate: true,
    windowTypes: ["normal"],
  });

  windows.forEach((window) => {
    if (window.focused)
      window.tabs.forEach((tab) => {
        if (tab.active) {
          windowWithTabId = { window, tab };
        }
      });
  });

  return windowWithTabId;
}

async function injectScriptToActiveWindowTab(activeTabId) {
  await chrome.scripting.executeScript({
    target: { tabId: activeTabId },
    files: [contentScriptUrl],
  });
}

async function getTabFromId(tabId) {
  const allTabs = await chrome.tabs.query({});
  return allTabs.filter((tab) => tab.id == tabId)[0];
}

async function isScriptInjected(tabId) {
  try {
    let response = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          return window.INJECTED === 1 ? true : false;
        } catch (err) {
          logger.debug("%c WARNING: ", err.message, "yellow");
        }
      },
    });

    // NOTE: 'response[0].result' may be 'undefined' for which we return'false'
    return response[0].result ? true : false;
  } catch (err) {
    logger.debug(err, "yellow");
  }
}

async function injectContentScript(activeTabId) {
  const isInjected = await isScriptInjected(activeTabId);

  if (!isInjected) {
    logger.debug("injecting script from background worker");
    try {
      await injectScriptToActiveWindowTab(activeTabId);
    } catch (error) {
      console.warn(error);
    }
  }
}

async function messageTab(message, tabId) {
  await chrome.tabs.sendMessage(tabId, message);
}

async function isFrontend(tabId) {
  const popupTab = await asyncStorageGet("popupDetails");
  return popupTab?.tabId === tabId ? true : false;
}

async function UpdateActiveTab(tabInfo) {
  const isExtensionUI = await isFrontend(tabInfo.id);
  if (isExtensionUI) return;

  await asyncStorageSet({
    lastActiveTabData: {
      tabId: tabInfo.id,
      icon: tabInfo.favIconUrl,
      title: tabInfo.title,
      url: tabInfo.url,
      windowId: tabInfo.windowId,
    },
  });
}

function enableActiveTabListeners() {
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const activeTab = await getTabFromId(activeInfo.tabId);
    const ACTIVE_URL = activeTab?.url ? activeTab.url : activeTab.pendingUrl;

    await UpdateActiveTab(activeTab);

    const isReady = await isPopupReady();
    if (isReady) TabActions.selectTab(activeTab);

    if (isSupportedSite(ACTIVE_URL)) await injectContentScript(activeTab.id);
  });

  chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
    await UpdateActiveTab(tab);
    const ACTIVE_URL = tab?.url ? tab.url : tab.pendingUrl;
    if (isSupportedSite(ACTIVE_URL)) {
      await injectContentScript(tab.id);
    }
  });

  chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    TabActions.closeTab(tabId, removeInfo);
  });

  chrome.windows.onFocusChanged.addListener(
    async (windowId) => {
      const windows = await chrome.windows.getAll({
        populate: true,
        windowTypes: ["normal"],
      });
      windows.forEach((window) => {
        if (window.id == windowId)
          window.tabs.forEach(async (tab) => {
            TabActions.selectWindow(tab);
            if (tab.active && tab.favIconUrl) {
              await UpdateActiveTab(tab);
              await injectContentScript(tab.id);
            }
          });
      });
    },
    { windowTypes: ["normal"] }
  );
}

async function tabsFromWindow(windowId) {
  return await new Promise((resolve) => {
    chrome.tabs.query({ windowId }, function (tabs) {
      resolve(tabs);
    });
  });
}

function isSupportedSite(url) {
  const avoidList = [
    "chrome-extension://",
    "chrome://extensions/",
    "chrome://",
    "chrome://newtab/",
  ];

  for (const avoid_url of avoidList) {
    if (url.includes(avoid_url) || url === avoid_url) return false;
  }

  return true;
}

function getCharIndex(str, char, n) {
  return str.split(char).slice(0, n).join(char).length;
}

async function asyncStorageGet(item) {
  return await new Promise(async (resolve) => {
    await chrome.storage.local.get(item, (data) => {
      resolve(data[item]);
    });
  });
}

async function asyncStorageSet(item) {
  new Promise(function (resolve, reject) {
    chrome.storage.local.set(item, () => {
      resolve();
    });
  });
}
