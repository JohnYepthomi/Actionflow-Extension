/// <reference path="../ActionsRecorder.ts" />

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
    (this as ActionsRecorder).isActive
  );
  localStorage.setItem(
    "isContentScriptRecording",
    JSON.stringify((this as ActionsRecorder).isActive)
  );

  // let actionflowEl = document.querySelector("#actionflow-compose-status");
  // if (actionflowEl)
  //   actionflowEl.setAttribute("actionflow-reloading", "true");
  // e.preventDefault();
  // return (event.returnValue = "");
}
