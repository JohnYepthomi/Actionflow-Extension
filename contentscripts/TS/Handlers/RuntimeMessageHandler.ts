/// <reference path="../ActionsRecorderTypes.ts" />
/// <reference path="../ActionsRecorder.ts" />
/// <reference path="../PickList.ts" />
/// <reference path="../PickElement.ts" />

/**
 * This listener 'this' refers to the current instance of the "ActionRecorder" Object for -
 * convinience to activate() and deActivate() the ActionRecorder.
 * And also respond to other messages.
 *
 * There are calls to other Object functions as well which can be more properly implemented in production;
 */
const chromeListener = async function (
  request: FromFrontendMessage,
  _sender: any,
  _sendResponse: any
) {
  console.log("contentscript onMessage called");

  // if Context Invalidated remove listener
  if (!chrome.runtime?.id) {
    console.log("chromeListener context invalidated. Removing listener...");

    chrome.runtime.onMessage.removeListener(chromeListener);
  }

  switch (request.message) {
    case "start-recording":
      (this as ActionsRecorder).activate();
      await messageBackground({ message: "recording-started" });
      break;

    case "stop-recording":
      (this as ActionsRecorder).deActivate();
      await messageBackground({ message: "recording-stopped" });
      break;

    case "compose-completed":
      console.log(
        "compose-completed chrome runtime called on firstContent script"
      );
      localStorage.setItem("isComposeCompleted", "true");
      //  Save "composeData" payload send from the EXTENSION's FRONTEND to localstorage so that when as user is composing workflow,
      // it checks both in the extension itself or the current active tab (a user can have either as active so we have to check both places) to find
      // if the compose has completed and get the 'composeData' from either places.
      // if ("nestingLevel" in request.payload)
      localStorage.setItem("composeData", JSON.stringify(request.payload));
      break;

    case "element-pick":
      if (
        typeof request.payload !== "object" ||
        (typeof request.payload === "object" &&
          !("id" in request.payload) &&
          !("actionType" in request.payload))
      )
        return;

      if ((this as ActionsRecorder).isActive)
        (this as ActionsRecorder).tempInactive = true;

      const { id, actionType, props } = request.payload;

      switch (actionType) {
        case "List":
          beginFindList(id);
          break;
        case "Text":
          PickElement.activate("Text", id, null);
          break;
        case "Attribute":
          PickElement.activate("Attribute", id, props.attribute);
          break;
        case "Anchor":
          PickElement.activate("Anchor", id, null);
          break;
        case "URL":
          PickElement.activate("URL", id, null);
          break;
        case "Click":
          PickElement.activate("Click", id, null);
          break;
      }
      break;
  }
};

async function sendRuntimeMessage(content: ToFrontendMessage) {
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
