/// <reference path="./Handlers/RuntimeMessageHandler.ts" />
/// <reference path="./ActionsRecorder.ts" />

console.log("///////////// actions recorder.js /////////////");

// Get the Prev State before calling 'actionsRecorder.record()'
const isContentScriptRecording =
  localStorage.getItem("isContentScriptRecording") !== "undefined"
    ? JSON.parse(localStorage.getItem("isContentscriptRecording"))
    : false;

console.log({ isContentScriptRecording });
let recObj = new ActionsRecorder();
recObj.record(windowRecorderHandler);
recObj.attachUnloadListener(BeforeWindowUnloadHandler);
if (isContentScriptRecording) recObj.activate();

chrome.runtime.onMessage.addListener(chromeListener.bind(recObj));

async function windowRecorderHandler(e: Event) {
  // Check if Context has been Invalidated and Remove Listener
  if (!chrome.runtime?.id) {
    document.removeEventListener(e.type, windowRecorderHandler);
    return;
  }

  if (!recObj.isActive) return;
  recObj.endTime = Date.now() + recObj.INTERVAL_WAIT;
  switch (e.type) {
    case "input":
      console.log(
        "%c User input action recorded",
        "color: teal; font-style=italic;"
      );
      break;
    case "mouseup":
      console.log(
        "%c mouseup action recorded",
        "color: green; font-style=italic;"
      );
      await recObj.clickHandler(e);
      break;
  }
}

// This listener will have duplicates on every script invalidation re-injection
function BeforeWindowUnloadHandler() {
  // Check if Context has been Invalidated and Remove Listener
  if (!chrome.runtime?.id) {
    document.removeEventListener("beforeunload", BeforeWindowUnloadHandler);
    console.log("BeforeWindowUnloadHandler() removed");
    return;
  }

  console.log("BeforeWindowUnloadHandler() still attached");

  console.log(
    "navigating away form page. isContentScriptRecording: ",
    recObj.isActive
  );
  localStorage.setItem(
    "isContentScriptRecording",
    JSON.stringify(recObj.isActive)
  );

  // let actionflowEl = document.querySelector("#actionflow-compose-status");
  // if (actionflowEl)
  //   actionflowEl.setAttribute("actionflow-reloading", "true");
  // e.preventDefault();
  // return (event.returnValue = "");
}