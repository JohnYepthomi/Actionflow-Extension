/// <reference path="../ActionsRecorderTypes.ts" />
/// <reference path="../ActionsRecorder.ts" />

const chromeListener = async function (
  request: ChromeExtensionMessage,
  _sender,
  _sendResponse
) {
  console.log("contentscript onMessage called");

  // if Context Invalidated remove listener
  if (!chrome.runtime?.id) {
    chrome.runtime.onMessage.removeListener(chromeListener);
  }

  if (request.message === "start-recording") {
    (this as ActionsRecorder).activate();
  }
  if (request.message === "stop-recording") {
    (this as ActionsRecorder).deActivate();
  }
  if (request.message === "get-recording-status") {
    const currentRecordingStatus: ContentScriptMessage = {
      status: "current-recording-status",
      payload: (this as ActionsRecorder).isActive,
    };
    await sendRuntimeMessage(currentRecordingStatus);
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
