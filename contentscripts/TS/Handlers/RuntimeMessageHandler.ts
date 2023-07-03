/// <reference path="../ActionsRecorderTypes.ts" />
/// <reference path="../ActionsRecorder.ts" />

/**
 * This listener 'this' refers to the current instance of the "ActionRecorder" Object for -
 * convinience to activate() and deActivate() the ActionRecorder.
 * And also respond to other messages. 
*/
const chromeListener = async function (
  request: ChromeExtensionMessage,
  _sender,
  _sendResponse
) {
  console.log("contentscript onMessage called");

  // if Context Invalidated remove listener
  if (!chrome.runtime?.id) {
    console.log("chromeListener context invalidated. Removing listener...");
    
    chrome.runtime.onMessage.removeListener(chromeListener);
  }

  else if (request.message === "start-recording") {
    (this as ActionsRecorder).activate();
    await messageBackground({message: "recording-started"});
  }
  else if (request.message === "stop-recording") {
    (this as ActionsRecorder).deActivate();
    await messageBackground({ message: "recording-stopped" });
  }
  /**
   * This message was previously used by the 'getRecordingStatus' in the 
   * Workflow component of the extension frint end but has been relaced 
   * by directly messaging the background script.
    */
  // else if (request.message === "get-recording-status") {
  //   const currentRecordingStatus: ContentScriptMessage = {
  //     status: "current-recording-status",
  //     payload: (this as ActionsRecorder).isActive,
  //   };
  //   await sendRuntimeMessage(currentRecordingStatus);
  // }
  else if (request.message === "compose-completed") {
    console.log("compose-completed chrome runtime called on firstContent script");
    localStorage.setItem("isComposeCompleted", "true");
    //  Save "composeData" payload send from the EXTENSION's FRONTEND to localstorage so that when as user is composing workflow,
    // it checks both in the extension itself or the current active tab (a user can have either as active so we have to check both places) to find
    // if the compose has completed and get the 'composeData' from either places.
    if(request.payload)
      localStorage.setItem("composeData", JSON.stringify(request.payload));
  }
};

async function sendRuntimeMessage(content: ContentScriptMessage) {
  try {
    await chrome.runtime.sendMessage(null, content);
  } catch (e) {
    console.warn(
      "Error sending Message: ",
      "status: ",
      content.status,
      ", payload: ",
      content.payload,
      ", Error: ",
      e
    );
  }
}
