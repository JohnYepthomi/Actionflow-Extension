// const contentScriptUrl = "./contentscripts/ActionsRecorder.js";
// console.log("contentscriptURL: ", contentScriptUrl);
const contentScriptUrl = "./contentscripts/safeScript.js";
console.log("safeContentScriptUrl: ", contentScriptUrl);

try {
  handlePopupActionWindow();
  enableActiveTabListeners();
  handleRuntimeMessages();

  chrome.commands.onCommand.addListener(function (command) {
    if (command === "toggle-window") {
      createPopupWindow();
    }
  });
} catch (e) {
  //log error
  console.log("Caught Error : " + e);
}

console.log("github push check");

const TabActions = {
  isNavigation: false,
  activeWindowId: null,
  recordedTabs: [],
  tabHistory: [],
  addToHistory: function (tabId, url, windowId) {
    // when a new tab is created, the startpage url would be "chrome://newtab/",
    // but once a user visits a url, the start page url changes at runtime to "chrome://new-tab-page/".
    // We only store the new start page url in the 'history' because if we stored the old startpage url it won't ever match with the new startpage url.
    if (!this.tabHistory.some((history) => history.tabId === tabId)) {
      this.tabHistory.push({ tabId, windowId, urls: [url], pos: 0 });
      console.log(
        "New Tab added To History: ",
        JSON.stringify(this.tabHistory)
      );
    } else {
      this.tabHistory = this.tabHistory.map((history) => {
        if (history.tabId === tabId) {
          // Discard urls after the curent pos on a new naviagtion
          if (this.isNavigation) {
            const removedItems = history.urls.splice(history.pos + 1);
            console.log("remvoedItems: ", removedItems);
            this.isNavigation = false;
          }

          history.urls.push(url);
          return { ...history, urls: history.urls, pos: history.pos + 1 };
        } else return history;
      });
      console.log("Updated History: ", JSON.stringify(this.tabHistory));
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
    console.log("TabActions.newTab");
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
  selectTab: function (tabInfo) {
    let isNewWindow = false;

    if (
      this.tabHistory.length > 1 &&
      !this.tabHistory.some((his) => his.windowId === tabInfo.windowId)
    ) {
      console.log("selectTab -> NewWindow -> NewTab");
      this.newWindow(tabInfo);
      isNewWindow = true;
    }

    // If the tab hasn't been saved, treat it as a 'NewTab' and return.
    if (!this.tabHistory.some((history) => history.tabId === tabInfo.id)) {
      console.log("selectTab -> NewTab");
      tabInfo.url =
        tabInfo.url === "" || tabInfo.url === "chrome://newtab/"
          ? "chrome://new-tab-page/"
          : tabInfo.url;
      this.tabHistory.push({
        tabId: tabInfo.id,
        windowId: tabInfo.windowId,
        urls: [tabInfo.url],
        pos: 0,
        fromSelect: true,
      });

      // Don't send the action if the its a new 'Window' as every new window comes with a new tab already created,
      // So we don't need to explicitly create an action for the new tab. Our goal is not to show every
      // action that takes place but to only show appropriate actions that can serve the actions that follows.
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
  closeTab: async function (tabId) {
    try {
      const { urls, windowId, pos } = this.tabHistory.filter(
        (history) => history.tabId === tabId
      )[0];

      if (this.tabHistory.some((history) => history.tabId === tabId)) {
        this.tabHistory = this.tabHistory.filter(
          (history) => history.tabId !== tabId
        );
      }

      this.sendTabInfo({ id: tabId, url: urls[pos], windowId }, "CloseTab");
    } catch (err) {
      console.log(err);
    }
  },
  back: function (tabId, changed_url, history) {
    console.log("isBack");
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
    console.log("isForward");
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

    const history = this.tabHistory.filter(
      (history) => history.tabId === tabId
    )[0];

    const isBack = history.urls[history.pos - 1] === changed_url;
    if (isBack) {
      this.back(tabId, changed_url, history);
      return;
    }

    const isForward = history.urls[history.pos + 1] === changed_url;
    if (isForward) {
      this.forward(tabId, changed_url, history);
      return;
    }
  },
  sendTabInfo: async function (tabInfo, tabAction) {
    const isRecording = await asyncStorageGet("recording");
    if (!isRecording) return;
    if (tabInfo.url) {
      const popupDetails = await asyncStorageGet("popupDetails");
      const EXT_TAB_ID = popupDetails.tabId;

      try {
        // message the frontend
        await messageTab(
          {
            status: "new-recorded-action",
            actionType: tabAction,
            payload: {
              url: tabInfo.url,
              tabId: tabInfo.id,
              windowId: tabInfo.windowId,
            },
          },
          EXT_TAB_ID
        );
      } catch (err) {
        console.log(err);
      }
    }
  },
  hasWindow: function (windowId) {
    return this.tabHistory.some((t) => t.windowId === windowId);
  },
  hasHistory: function () {
    return this.tabHistory.length > 0;
  },
};

/* UTILITIES */
chrome.webNavigation.onCommitted.addListener(async function (details) {
  // console.log("webNavigation", details);
  const tabId = details.tabId;
  const url = details.url;
  const TrType = details.transitionType === "typed" ? "typed" : null;
  const Qual = details.transitionQualifiers.filter(
    (q) => q === "forward_back" || q === "from_address_bar"
  )[0];
  const CURR_TAB_INFO = await getTabFromId(tabId);
  const startPageUrl = url === "chrome://new-tab-page/";

  if (!CURR_TAB_INFO || (!isSupportedSite(CURR_TAB_INFO.url) && !startPageUrl))
    return;

  // New Window
  if (
    TrType === "typed" &&
    TabActions.hasHistory() &&
    !TabActions.hasWindow(CURR_TAB_INFO.windowId)
  ) {
    TabActions.newWindow(CURR_TAB_INFO);
  }

  // New Tab
  if (
    TrType === "typed" &&
    !TabActions.tabHistory.some(
      (tab) => tab.tabId === CURR_TAB_INFO.id && !tab.formSelect
    )
  ) {
    console.log("NewTab: ", CURR_TAB_INFO);
    TabActions.newTab(CURR_TAB_INFO);
    return;
  }

  // Navigate using Address Bar
  if (TrType === "typed" && Qual === "from_address_bar") {
    console.log("User Navigating");
    TabActions.navigate(CURR_TAB_INFO);
    return;
  }

  // Navigate History
  if ((TrType === "typed" && Qual === "forward_back") || startPageUrl) {
    TabActions.handleForwardBack(tabId, url);
  }
});

function handleRuntimeMessages() {
  chrome.runtime.onMessage.addListener(function (
    request,
    _sender,
    sendResponse
  ) {
    if (request.message === "launch-extension") {
      createPopupWindow();
    } else if (request.message === "minimize-window") {
      (async function () {
        const popupDetails = await asyncStorageGet("popupDetails");
        chrome.windows.update(popupDetails.windowId, { state: "minimise" });
      })();
    } else if (request.message === "bg-recording-status") {
      /**
     * This message is Sent from the Extension Frontend's "RecordingButton" component.
     * This same message is also sent to the contentScript that is recording actions on the active tab.
     * We can do this from the contentscript itself but we kept it here to group and execute all 'TAB RELATED ACTIONS'
      from here.
    */
      (async function () {
        const isRecording = await asyncStorageGet("recording");
        sendResponse({ recording: isRecording });
      })();
    } else if (request.message === "recording-started") {
      (async function () {
        await asyncStorageSet({ recording: true });
      })();
    } else if (request.message === "recording-stopped") {
      (async function () {
        await asyncStorageSet({ recording: false });
      })();
    }

    // return true to indicate you want to send a response asynchronously
    return true;
  });
}

function handlePopupActionWindow() {
  chrome.action.onClicked.addListener(function (tab) {
    // const popupUrl = chrome.runtime.getURL("/popup.html");
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
            height: 500,
            width: 400,
            // state: "normal"
          },
          async function (window) {
            await asyncStorageSet({
              popupDetails: { tabId: window.tabs[0].id, windowId: window.id },
            });
            // const temp = await asyncStorageGet("popupDetails");
            // console.log(temp);
          }
        );
      } else {
        const popupDetails = await asyncStorageGet("popupDetails");
        chrome.windows.update(
          popupDetails.windowId,
          { focused: true },
          function (window) {
            //no op
          }
        );
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
  // console.log("windows: ", windows);
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
  // const currentActivetab = await getTabFromId(tabId);

  try {
    let response = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        try {
          return window.INJECTED === 1 ? true : false;
        } catch (err) {
          console.log(`%c WARNING: ${err.message}`, "color: yellow;");
        }
      },
    });

    // NOTE: 'response[0].result' may be 'undefined' and will return'false'
    return response[0].result ? true : false;
  } catch (err) {
    console.warn(err);
  }
}

async function injectContentScript(activeTabId) {
  const isInjected = await isScriptInjected(activeTabId);
  // console.log({ isInjected });

  if (!isInjected) {
    console.log("injecting script from background worker");
    await injectScriptToActiveWindowTab(activeTabId);
  }

  // await messageTab("start-recording", activeTabId);
}

async function messageTab(message, tabId) {
  await chrome.tabs.sendMessage(tabId, message);
}

async function updateLastActiveTabInLocalStorageAndInject(tabInfo) {
  await asyncStorageSet({
    lastActiveTabData: {
      tabId: tabInfo.id,
      icon: tabInfo.favIconUrl,
      title: tabInfo.title,
    },
  });

  await injectContentScript(tabInfo.id);
}

function enableActiveTabListeners() {
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const activeTab = await getTabFromId(activeInfo.tabId);
    const ACTIVE_URL = activeTab?.url ? activeTab.url : activeTab.pendingUrl;

    TabActions.selectTab(activeTab);

    if (isSupportedSite(ACTIVE_URL))
      await updateLastActiveTabInLocalStorageAndInject(activeTab);
  });

  chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
    const ACTIVE_URL = tab?.url ? tab.url : tab.pendingUrl;

    // console.log("before ACTIVE_URL: ", ACTIVE_URL);
    if (!isSupportedSite(ACTIVE_URL)) return;
    // console.log("after ACTIVE_URL: ", ACTIVE_URL);

    // TabActions.newTab(tab);
    await updateLastActiveTabInLocalStorageAndInject(tab);
  });

  chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    const currentActiveTab = await asyncStorageGet("lastActiveTabData");
    if (currentActiveTab.tabId === tabId) {
      await asyncStorageSet({ lastActiveTabData: {} });
    }

    TabActions.closeTab(tabId);
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
              updateLastActiveTabInLocalStorageAndInject(tab);
            }
          });
      });
    },
    { windowTypes: ["normal"] }
  );

  chrome.windows.onRemoved.addListener(function (windowId) {});
}

function isSupportedSite(url) {
  const avoidList = [
    "chrome-extension://",
    "chrome://extensions/",
    "chrome://",
    "chrome://newtab/",
    "http://",
  ];

  for (const avoid_url of avoidList) {
    if (url.includes(avoid_url) || url === avoid_url) return false;
  }

  return true;
}

function getChar(str, char, n) {
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
