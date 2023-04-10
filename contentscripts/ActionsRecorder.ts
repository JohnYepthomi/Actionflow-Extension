import { isExpressionWithTypeArguments } from "../node_modules/typescript/lib/typescript";
import {
  ChromeExtensionMessage,
  ContentScriptMessage,
  ActionClickProp,
  ActionCommonProp,
  Action,
} from "./ActionsRecorderTypes";

let PAGE_URL = window.location.href || "";

/**
 *  ActionEventType: 'click', 'type', 'scroll' etc.
 *  Common Action Properties:  Object that has info about the common properties for an Action. eg. [nodeName, selector]
 *  Action Specific Properties:  Object that has info about the specific options for an Action. eg. ["Wait For Page To Load", "Wait For File To Download", Description]
 * */

class ActionsRecorder {
  INITIAL_WAIT = 3000;
  INTERVAL_WAIT = 10000;
  SUPPORTED_EVENTS: SUPPORTED_DOM_EVENTS[] = [
    "mouseup",
    "keydown",
    "scroll",
    "mousemove",
    "input",
  ];
  startTime: number = Date.now();
  endTime: number = this.startTime + this.INITIAL_WAIT;
  isActive: Boolean = false;

  overrideDefault(
    INITIAL_WAIT: number,
    INTERVAL_WAIT: number,
    SUPPORTED_EVENTS: SUPPORTED_DOM_EVENTS[]
  ) {
    this.INITIAL_WAIT = INITIAL_WAIT;
    this.INTERVAL_WAIT = INTERVAL_WAIT;
    this.SUPPORTED_EVENTS = SUPPORTED_EVENTS;
  }

  record() {
    if (this.isActive) {
      console.warn("Recording already in process...");
      return;
    }

    this.isActive = true;
    this.SUPPORTED_EVENTS.forEach(
      function (eventType: SUPPORTED_DOM_EVENTS) {
        document.addEventListener(
          eventType,
          this.windowRecorderHandler.bind(this, eventType)
        );
      }.bind(this)
    );
    this.attachUnloadListener();

    // Initially Deactivated
    this.deActivate();

    console.log("Recoding Strated...");
  }

  activate() {
    console.log("Trying to Activate recorder...");
    if (this.isActive) {
      console.warn("Recorder already active...");
      return;
    } else {
      this.isActive = true;
      console.log("Recorder Activated");
    }
  }

  deActivate() {
    if (!this.isActive) {
      console.warn("Recorder already deactived");
      return;
    } else {
      this.isActive = false;
      console.log("Recorder Deactivated");
      localStorage.setItem(
        "isContentScriptRecording",
        JSON.stringify(this.isActive)
      );
    }
  }

  async windowRecorderHandler(eventType: SUPPORTED_DOM_EVENTS, e: Event) {
    if (!this.isActive) return;

    this.endTime = Date.now() + this.INTERVAL_WAIT;

    switch (eventType) {
      case "input": // detect when a user starts typing
        console.log(
          "%c User input action recorded",
          "color: teal; font-style=italic;"
        );
        break;
      case "mouseup": // serve as click event
        console.log(
          "%c mouseup action recorded",
          "color: green; font-style=italic;"
        );
        await this.clickHandler(e);
        break;
      // case "mousemove":
      //   console.log("%c mousemove action recorded", "color: orange; font-style=italic;");
      //   break;
      // case "scroll":
      //   console.log("%c scroll action recorded", "color: red; font-style=italic;");
      //   break;
      //No Default
    }
  }

  async clickHandler(e: Event) {
    if (!e.target) return;

    let el = e.target as HTMLElement;

    if (
      (el.nodeName !== "#document" && el.nodeName === "BUTTON") ||
      el?.getAttribute("type") == "button"
    ) {
      console.log("User clicked a Button: ", el.innerText);
    } else if (el.nodeName === "A") {
      console.log("User clicked a Link: ", (el as HTMLLinkElement).href);
    } else if (el.nodeName === "INPUT") {
      console.log(
        "User clicked an Input box: ",
        (el as HTMLInputElement).value
      );
    }

    const shortSelector = new ShortestSelector();
    const cssSelector = shortSelector.getSelector(el, undefined);
    if (!cssSelector) {
      console.log(
        `%c Could not generate Selector for Element: ${el}`,
        "color: yellow; font-size: 0.85rem;"
      );

      return;
    }
    if (cssSelector && this.isInteractionElement(el, cssSelector)) {
      let commonProps: ActionCommonProp = {
        nodeName: el.nodeName,
        selector: cssSelector,
      };
      let clickProps: ActionClickProp = {
        "Wait For New Page To load": false,
        "Wait For File Download": false,
        Description: getActionDescription(el),
      };
      let action: Action = {
        name: "Click",
        actionType: "Interaction",
        props: { ...commonProps, ...clickProps },
      };

      console.log(action);
      this.saveActionDetailsToStorage(action);
      let contentScriptMessage: ContentScriptMessage = {
        status: "new-recorded-action",
        payload: action,
      };
      await sendRuntimeMessage(contentScriptMessage);
    }
  }

  isInteractionElement(element: HTMLElement, cssSelector: string) {
    if (
      cssSelector.includes("button") ||
      // cssSelector.includes("a") ||
      cssSelector.includes("input")
    )
      return true;

    if (
      document.querySelector(`button  ${cssSelector}`) || // removed '>' direct-descendant
      document.querySelector(`a  ${cssSelector}`) || // removed '>' direct-descendant
      document.querySelector(`input  ${cssSelector}`) || // removed '>' direct-descendant
      element.nodeName === "BUTTON" ||
      element.getAttribute("type") == "button" ||
      element.nodeName === "A" ||
      element.getAttribute("type") == "a" ||
      element.nodeName === "INPUT" ||
      element.getAttribute("type") == "input"
    )
      return true;

    return false;
  }

  textInputHandler() {}

  mouseMoveHandler() {}

  scrollHandler() {}

  attachUnloadListener() {
    console.log("attachUnloadListener called");
    // const pollingDiv = document.createElement("div");
    // pollingDiv.id = "actionflow-compose-status";
    // pollingDiv.setAttribute("actionflow-done", "false");
    // pollingDiv.setAttribute("actionflow-reloading", "false");
    // document.body.append(pollingDiv);

    window.addEventListener("beforeunload", (e) => {
      console.log("navigating away form page.");
      localStorage.setItem(
        "isContentScriptRecording",
        JSON.stringify(this.isActive)
      );
      // let actionflowEl = document.querySelector("#actionflow-compose-status");
      // if (actionflowEl)
      //   actionflowEl.setAttribute("actionflow-reloading", "true");
      // e.preventDefault();
      // return (event.returnValue = "");
    });
  }

  saveActionDetailsToStorage(newAction: Action) {
    const prevSerialized = localStorage.getItem("composeData");

    if (!prevSerialized) {
      let newCompose = { [`${PAGE_URL}-node-0`]: newAction };
      localStorage.setItem("composeData", JSON.stringify(newCompose));
      return;
    }

    const compose = JSON.parse(prevSerialized);
    compose[`${PAGE_URL}-node-${Object.values(compose).length}`] = newAction;
    localStorage.setItem("composeData", JSON.stringify(compose));
  }
}

console.log("///////////// actions recorder.js /////////////");

const isContentScriptRecording = JSON.parse(
  localStorage.getItem("isContentScriptRecording")
);
const actionRecorder = new ActionsRecorder();
actionRecorder.record();

if (isContentScriptRecording) actionRecorder.activate();

chrome.runtime.onMessage.addListener(
  async (request: ChromeExtensionMessage, sender, sendResponse) => {
    console.log("contentscript onMessage called");
    if (request.message === "start-recording") {
      actionRecorder.activate();
    }

    if (request.message === "stop-recording") {
      actionRecorder.deActivate();
    }

    if (request.message === "get-recording-status") {
      const currentRecordingStatus: ContentScriptMessage = {
        status: "current-recording-status",
        payload: actionRecorder.isActive,
      };
      await sendRuntimeMessage(currentRecordingStatus);
    }
  }
);

// const ActionNodeProps = {
//   Common: {
//     nodeName: "",
//     selector: "",
//   },
//   Type: {
//     Text: "",
//     "Overwrite existing text": false,
//   },
//   Click: {
//     "Wait For New Page To load": false,
//     "Wait For File Download": false,
//     Description: "",
//   },
//   Scroll: {
//     "Scroll Direction": {
//       Top: false,
//       Bottom: false,
//     },
//     Description: "",
//   },
//   Hover: {
//     Description: "",
//   },
//   Prompts: {
//     "Response Type": {
//       Accept: false,
//       Decline: false,
//     },
//     "Response Text": "",
//   },
//   Select: {
//     Value: "",
//     Description: "",
//   },
//   Keypress: {
//     Key: "",
//     "Wait For Page To Load": false,
//   },
//   Date: {
//     Date: "",
//   },
//   Upload: {
//     Path: "",
//   },
//   Code: {
//     Code: "",
//   },
// };

type SUPPORTED_DOM_EVENTS =
  | "mouseup"
  | "keydown"
  | "scroll"
  | "mousemove"
  | "input";

function getActionDescription(element: HTMLElement): string {
  if (!element) {
    console.warn(
      "No element was provided: getActionDescription(missing --> element)"
    );
    return "";
  }

  let description = "";

  if (element.textContent !== "" || element.textContent !== undefined)
    description = element.textContent!;

  for (const attr of ["aria-label", "title", "placeholder"]) {
    if (element.getAttribute(attr)) description = element.getAttribute(attr)!;
  }

  console.log("Action Description: ", description);

  return description;
}

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

class ShortestSelector {
  DISABLE_CLASS_SEL = true;
  DISABLE_ID_SEL = true;
  DISABLE_ATTR_SEL = false;
  TARGET_NODE: HTMLElement | undefined;

  getSelector(
    element: HTMLElement | undefined,
    carriedSelector: string | undefined
  ): string | undefined {
    if (
      !element ||
      element.nodeName === "#document" ||
      element.nodeName === "html"
    )
      return;

    if (element.nodeName.toLowerCase() === "body") {
      this.clearTargetNode();
      if (carriedSelector) return "body" + carriedSelector;
      return "body";
    }

    this.TARGET_NODE = !this.TARGET_NODE ? element : this.TARGET_NODE;
    let currentTAG = element.nodeName.toLowerCase();
    const nthTypePos =
      this.getIndex(element) != 1
        ? `:nth-of-type(${this.getIndex(element)})`
        : "";
    // include position of current element to TAG
    currentTAG = currentTAG + nthTypePos;

    let candidate = "";

    // Try ID
    const id_selector = this.id(element, carriedSelector);
    if (id_selector) return id_selector;

    // Try ATTRIBUTE
    const attr_selector = this.attribute(element, carriedSelector);
    if (attr_selector) return attr_selector;

    // Try CLASS
    const class_selector = this.class(element, currentTAG, carriedSelector);
    if (class_selector) return class_selector;

    // Update candidate if necessary
    if (carriedSelector) {
      if (candidate === "") candidate = currentTAG + carriedSelector;
      else candidate = candidate + carriedSelector;
    }

    // Prepare carrySelector for next iteration
    let carrySelector: string;
    if (candidate !== "") {
      // Check if candidate is eligible
      if (this.isUniqForTarget(candidate, this.TARGET_NODE)) {
        this.clearTargetNode();
        return candidate;
      }
      carrySelector = " > " + candidate;
    } else
      carrySelector =
        ` > ${currentTAG}` + (carriedSelector ? carriedSelector : "");

    return this.getSelector(element.parentNode as HTMLElement, carrySelector);
  }

  id(
    currrElement: HTMLElement,
    carriedSelector: string | undefined
  ): string | undefined {
    const HAS_ID = currrElement.id !== "" && currrElement.id !== undefined;

    if (!HAS_ID || this.DISABLE_ID_SEL) return;

    if (HAS_ID) {
      let idLeadSelector = "#" + currrElement.id;

      if (carriedSelector) idLeadSelector = idLeadSelector + carriedSelector;

      this.clearTargetNode();
      return idLeadSelector;
    }
  }

  attribute(
    currrElement: HTMLElement,
    carriedSelector: string | undefined
  ): string | undefined {
    if (this.DISABLE_ATTR_SEL) return;

    for (const attr of ["aria-label", "title"]) {
      if (currrElement.getAttribute(attr)) {
        let attrLeadSelector = `${currrElement.nodeName.toLowerCase()}[${attr}="${currrElement.getAttribute(
          attr
        )}"]`;

        if (carriedSelector)
          attrLeadSelector = attrLeadSelector + carriedSelector;

        this.clearTargetNode();
        return attrLeadSelector;
      }
    }
  }

  class(
    currrElement: HTMLElement,
    currentTAG: string,
    carriedSelector: string | undefined
  ): string | undefined {
    if (this.DISABLE_CLASS_SEL) return;

    let foundUniqClass = false;
    let classSelector = "";
    currrElement.classList?.forEach((c) => {
      if (!foundUniqClass) {
        classSelector = currentTAG + "." + c;
        const isTargetSelector = this.isUniqForTarget(
          classSelector,
          this.TARGET_NODE
        );

        if (isTargetSelector) {
          foundUniqClass = true;
          if (carriedSelector) classSelector = classSelector + carriedSelector;
          this.clearTargetNode();
        }
      }
    });

    return foundUniqClass ? classSelector : undefined;
  }

  clearTargetNode() {
    this.TARGET_NODE = undefined;
  }

  getIndex(node: HTMLElement): number {
    let i = 1;
    let tagName = node.tagName;

    while (node.previousSibling) {
      node = node.previousSibling as HTMLElement;
      if (
        node.nodeType === 1 &&
        tagName.toLowerCase() == node.tagName.toLowerCase()
      ) {
        i++;
      }
    }
    return i;
  }

  isUniqForTarget(
    selector: string,
    targetNode: HTMLElement | undefined
  ): boolean {
    if (!document.querySelector(selector) && !targetNode) return false;
    if (document.querySelector(selector) === targetNode) return true;
    else return false;
  }
}
