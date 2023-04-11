// const contentScriptUrl = "./contentscripts/ActionsRecorder.js";
// console.log("contentscriptURL: ", contentScriptUrl);
const contentScriptUrl = "./contentscripts/safeScript.js";
console.log("safeContentScriptUrl: ", contentScriptUrl);

try {
  handlePopupActionWindow();
  enableActiveTabListeners();
  // handleRuntimeMessages();
} catch (e) {
  //log error
  console.log("catchblock : " + e);
}

/* UTILITIES */
function handleRuntimeMessages() {
  chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    if (request.status === "") {
    }
  });
}

function handlePopupActionWindow() {
  chrome.action.onClicked.addListener(function (tab) {
    // const popupUrl = chrome.runtime.getURL("/popup.html");

    chrome.windows.getAll(
      { populate: true, windowTypes: ["popup"] },
      async function (windows) {
        if (windows.length === 0) {
          chrome.windows.create(
            {
              url: chrome.runtime.getURL("./FRONTEND/composer/dist/index.html"),
              type: "popup",
              height: 600,
              width: 500
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
  });
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

  try{
    let response = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        try{
          return window.INJECTED === 1 ? true : false;
        } catch(err){
          console.log(`%c WARNING: ${err.message}`, 'color: yellow;');
        }
      },
    });

    // NOTE: 'response[0].result' may be 'undefined' and will return'false'
    return response[0].result ? true : false;
  }catch(err){
    console.warn(err);
  }
}

async function injectContentScript(activeTabId) {
  const isInjected = await isScriptInjected(activeTabId);
  if (!isInjected) {
    console.log("injecting script from background worker");
    await injectScriptToActiveWindowTab(activeTabId);
  }

  // await messageTab("start-recording", activeTabId);
}

async function messageTab(message, tabId) {
  await chrome.tabs.sendMessage(tabId, { message });
}

async function updateLastActiveTabInLocalStorageAndInject(tabId) {
  const activeTab = await getTabFromId(tabId);
  
  // NOTE: NEED TO CHECK both 'activeTab.url' AND 'activeTab.pendingUrl'
  const ACTIVE_URL = activeTab.url ? activeTab.url : activeTab.pendingUrl;

  if (isSupportedSite(ACTIVE_URL)) { // && activeTab.favIconUrl
    // console.log("lastActiveTab: ", tabId, ", activeTab.url: ", ACTIVE_URL);
    await asyncStorageSet({
      lastActiveTabData: {
        tabId: tabId,
        icon: activeTab.favIconUrl,
        title: activeTab.title,
      },
    });

    await injectContentScript(tabId);
  }
}

function enableActiveTabListeners() {
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await updateLastActiveTabInLocalStorageAndInject(activeInfo.tabId);
  });

  chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
    await updateLastActiveTabInLocalStorageAndInject(tabId);
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
              updateLastActiveTabInLocalStorageAndInject(tab.id);
            }
          });
      });
    },
    { windowTypes: ["normal"] }
  );
}

function isSupportedSite(url) {
  const avoidList = [
    "chrome-extension://",
    "chrome://extensions/",
    "chrome://"
  ];

  for(const avoid_url of avoidList){
      if(url.includes(avoid_url) || url === avoid_url) return false;
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
  var getValue = new Promise(function (resolve, reject) {
    chrome.storage.local.get(item, (data) => {
      resolve(data[item]);
    });
  });

  let gV = await getValue;
  return gV;
}

async function asyncStorageSet(item) {
  new Promise(function (resolve, reject) {
    chrome.storage.local.set(item, () => {
      resolve();
    });
  });
}
