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

const TabActions = {
  activeWindowId: null,
  recordedTabs: [],
  navigate: async function (tabInfo, composeData) {
    if (!tabInfo?.url || !isSupportedSite(tabInfo.url)) return;

    // In navigate , we should already have the tab info. stored in recordedTabs[].
    // We just have to update the url, the tab will have the same id.
    if (
      this.recordedTabs.some(
        (tab) => tab.id === tabInfo.id && tab.url !== tabInfo.url
      )
    ) {
      console.log("Visit: saving tab. tabInfo.url: ", tabInfo.url);
      this.recordedTabs = this.recordedTabs.map((rtab) => {
        if (rtab.id === tabInfo.id)
          return { ...rtab, url: tabInfo.url }; // update the url
        else return rtab;
      });
      this.sendTabInfo(tabInfo, "Navigate");
    }
  },
  newWindow: function (tabInfo) {
    this.sendTabInfo(tabInfo, "NewWindow");
  },
  newTab: async function (tabInfo) {
    if (!tabInfo?.url) return;

    if (!isSupportedSite(tabInfo.url)) return;

    if (
      this.recordedTabs.length > 0 &&
      !this.recordedTabs.some((t) => t.windowId === tabInfo.windowId)
    ) {
      this.recordedTabs.push({
        id: tabInfo.id,
        url: tabInfo.url,
        windowId: tabInfo.windowId,
      });
      this.newWindow(tabInfo);
      return;
    }

    if (this.recordedTabs.filter((tab) => tab.id === tabInfo.id).length === 0) {
      console.log("NewTab: saving tab");
      this.recordedTabs.push({
        id: tabInfo.id,
        url: tabInfo.url,
        windowId: tabInfo.windowId,
      });
      this.sendTabInfo(tabInfo, "NewTab");
    }
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
    if (!tabInfo?.url) return;

    if (!isSupportedSite(tabInfo.url)) return;

    // If the tab hasn't been saved, treat it as a 'NewTab' and return.
    if (!this.recordedTabs.some((t) => t.id === tabInfo.id)) {
      console.log("SelectTab: saving tab");
      this.recordedTabs.push({
        id: tabInfo.id,
        url: tabInfo.url,
        windowId: tabInfo.windowId,
      });
      this.sendTabInfo(tabInfo, "NewTab");

      return;
    }

    this.sendTabInfo(tabInfo, "SelectTab");
  },
  closeTab: function (tabId) {
    if (this.recordedTabs.some((tab) => tab.id === tabId)) {
      console.log("CloseTab: saving tab");
      const { url, windowId } = this.recordedTabs.filter(
        (t) => t.id === tabId
      )[0];
      this.sendTabInfo({ id: tabId, url, windowId }, "CloseTab");
      this.recordedTabs = this.recordedTabs.filter((t) => t.id !== tabId);
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
};

/* UTILITIES */
function handleRuntimeMessages() {
  chrome.runtime.onMessage.addListener(function (
    request,
    _sender,
    sendResponse
  ) {
    if (request.status === "launch-extension") {
      console.log("launch-extension: called");
      createPopupWindow();
    } else if (request.message === "minimize-window") {
      console.log("minimize-window");
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
      console.log("message from content script: 'bg-recording-status'");
      (async function () {
        const isRecording = await asyncStorageGet("recording");
        sendResponse({ recording: isRecording });
      })();
    } else if (request.message === "recording-started") {
      console.log("message from content script: 'recording-started'");
      (async function () {
        await asyncStorageSet({ recording: true });
      })();
    } else if (request.message === "recording-stopped") {
      console.log("message from content script: 'recording-stopped'");
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
  console.log("windows: ", windows);
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
  console.log({ isInjected });

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
    if (!isSupportedSite(ACTIVE_URL)) return;

    TabActions.selectTab(activeTab);
    await updateLastActiveTabInLocalStorageAndInject(activeTab);
  });

  chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
    const ACTIVE_URL = tab?.url ? tab.url : tab.pendingUrl;
    if (!isSupportedSite(ACTIVE_URL)) return;

    TabActions.navigate(tab, []);
    TabActions.newTab(tab);
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
            if (tab.active && tab.favIconUrl) {
              updateLastActiveTabInLocalStorageAndInject(tab);
              TabActions.selectWindow(tab);
            }
          });
      });
    },
    { windowTypes: ["normal"] }
  );

  // chrome.tabs.onCreated.addListener( tab => {});
  // chrome.windows.onRemoved.addListener(function(windowId) {});
  // chrome.windows.onCreated.addListener( window => {});
}

function isSupportedSite(url) {
  const avoidList = [
    "chrome-extension://",
    "chrome://extensions/",
    "chrome://",
    "http://",
  ];

  for (const avoid_url of avoidList) {
    if (url.includes(avoid_url) || url === avoid_url) return false;
  }

  return true;
}

function isTargetUrl(url) {
  let targetTag = url.split("").splice(getChar(url, "i", 2) + 2);
  return targetTag
    .join("")
    .split("")
    .splice(0, getChar(targetTag.join(""), "&", 1))
    .join("") === "digital-text"
    ? true
    : false;
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
