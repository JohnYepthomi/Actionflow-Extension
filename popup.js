let blogContents;

document.addEventListener("DOMContentLoaded", async function () {
  const activeTabDetails = await chromeStorageGet("lastActiveTabData");
  const startInjBtn = document.querySelector("#start-injection");
  const activeTabBtn = document.querySelector("#active-tab");
  const clearContentBtn = document.querySelector("#clear-content");

  activeTabBtn.innerText = activeTabDetails.title;

  startInjBtn.addEventListener("click", async () => {
    const isInjected = await isScriptInjected();
    if (!isInjected) await injectScriptToActiveWindowTab();
    messageTab("get-blog-contents");
  });

  clearContentBtn.addEventListener("click", () => {
    const rootEl = document.querySelector("#root");
    rootEl.innerHTML = "";
  });

  await chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
      if (request.status === "blog-contents-completed") {
        displayBlogContents(request.payload);
      }
    }
  );

  async function injectScriptToActiveWindowTab() {
    const tabData = await chromeStorageGet("lastActiveTabData");
    // const currentActiveTab = await getTabFromId(tabData.tabId);
    // console.log({ currentActiveTab });
    await chrome.scripting.executeScript({
      target: { tabId: tabData.tabId },
      files: ["./contentscripts/BlogScraper.js"],
    });
  }

  window.addEventListener("beforeunload", function (e) {
    e.preventDefault();
    e.returnValue = "";
  });
});

async function displayBlogContents(blogContents) {
  const rootEl = document.querySelector("#root");
  const activeTabDetails = await chromeStorageGet("lastActiveTabData");

  if (!blogContents.some((n) => n.text === activeTabDetails.title)) {
    const h2 = document.createElement("h2");
    h2.innerText = activeTabDetails.title;
    h2.classList.add("p-1");
    h2.classList.add("fw-bold");
    h2.classList.add("text-light");
    rootEl.appendChild(h2);
  }

  let allRenderedTexts = [];
  blogContents.forEach((n, nodeIdx) => {
    const tag = document.createElement(n.node);

    if (!allRenderedTexts.includes(n.text)) {
      tag.classList.add("text-light");
      tag.innerText = n.text;
    }
    if (n.text) allRenderedTexts.push(n.text);
    if (n.node.toLowerCase() === "span") {
      const wrapperDiv = document.createElement("div");
      wrapperDiv.classList.add("p-1");

      wrapperDiv.appendChild(tag);
      rootEl.appendChild(wrapperDiv);
    } else if (n.node.toLowerCase() === "img") {
      console.log("image node: ", n);
      const img = document.createElement("img");
      if (img.src) img.src = n.src;
      if (n.srcset) img.srcset = n.srcset || undefined;
      if (n.dataLazySrcSet)
        img.setAttribute("data-lazy-srcset", n.dataLazySrcSet);
      if (n.dataLazySizes) img.setAttribute("data-lazy-sizes", n.dataLazySizes);
      img.style = `width: ${n.width}; height: ${n.height}`;
      rootEl.appendChild(img);
    } else {
      rootEl.appendChild(tag);
    }
  });
}

async function isScriptInjected() {
  const tabData = await chromeStorageGet("lastActiveTabData");

  let response = await chrome.scripting.executeScript({
    target: { tabId: tabData.tabId },
    func: () => (BLOG_SCRAPER_INJECTED ? true : false),
  });
  console.log({ response });
  return response[0].result ? true : false;
}

async function chromeStorageGet(item) {
  var getValue = new Promise(function (resolve, reject) {
    chrome.storage.local.get(item, (data) => {
      resolve(data[item]);
    });
  });

  let gV = await getValue;
  return gV;
}

async function messageTab(message) {
  const tabData = await chromeStorageGet("lastActiveTabData");
  await chrome.tabs.sendMessage(tabData.tabId, { message });
}

// chrome.storage.onChanged.addListener(async function (changes, namespace) {
//   for (key in changes) {
//     console.log({ key });
//     if (key === "bookDetails") {
//       let lastIndex = changes.bookDetails.newValue.length - 1;
//       console.log('changes: ', changes.bookDetails.newValue[lastIndex]);
//       createTableRowWithData(changes.bookDetails.newValue[lastIndex]);
//     }
//   }
// });
