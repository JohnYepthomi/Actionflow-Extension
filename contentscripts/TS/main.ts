/// <reference path="./Handlers/RuntimeMessageHandler.ts" />
/// <reference path="./ActionsRecorder.ts" />
/// <reference path="./Utils/messageBackground.ts" />

console.log("///////////// action-recorder.js /////////////");

(async () => {
  await messageBackground({ message: "launch-extension" });
  const isContentScriptRecording = await messageBackground({
    message: "bg-recording-status",
  });
  console.log({ isContentScriptRecording });
  let recObj = new ActionsRecorder();
  recObj.recordListeners(windowRecorderHandler);
  recObj.attachUnloadListener(BeforeWindowUnloadHandler);
  if (isContentScriptRecording && isContentScriptRecording !== "no-response")
    recObj.activate();
  chrome.runtime.onMessage.addListener(chromeListener.bind(recObj));

  async function windowRecorderHandler(e: Event) {
    // Check if Context has been Invalidated and Remove Listener
    if (!chrome.runtime?.id) {
      document.removeEventListener(e.type, windowRecorderHandler);
      return;
    }

    if (!recObj.isActive) return;

    // if Temporarily disabled recorder , enable it and return; 'ListAction' or 'ELementText' enables it.
    if (recObj.tempInactive) {
      recObj.tempInactive = false;
      return;
    }

    recObj.endTime = Date.now() + recObj.INTERVAL_WAIT;
    switch (e.type) {
      case "input":
        console.log(
          "%c User input action recorded",
          "color: teal; font-style=italic;"
        );
        await recObj.textInputHandler(e);
        break;

      case "mouseup":
        console.log(
          "%c mouseup action recorded",
          "color: green; font-style=italic;"
        );
        await recObj.clickHandler(e);
        break;

      default:
        console.log("action-recorder default event type: ", e.type);
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

  // Get Access Token from Parent site
  if (window.location.href === "http://localhost:3000") {
    const email_el = document.querySelector(".email");
    const token_el = document.querySelector(".token");
    if (email_el && token_el) {
      sendRuntimeMessage({
        tokenInfo: {
          email: email_el.textContent(),
          accessToken: token_el.textContent(),
        },
      });
    } else {
      console.warn("Could not get the email and access token");
    }
  }
})();
