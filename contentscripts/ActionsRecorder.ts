import {
  RuntimeRequest,
  ActionEventTypes,
  ActionClickProp,
  ActionCommonProp,
} from "./ActionsRecorderTypes";

let PAGE_URL = window.location.href || "";

console.log(
  "///////////////////////////// actions recorder.js ////////////////////////"
);

chrome.runtime.onMessage.addListener(
  async (request: RuntimeRequest, sender, sendResponse) => {
    console.log("contentscript onMessage called");
    if (request.message === "start-recording") {
      const actionRecorder = new ActionsRecorder();
      actionRecorder.activate();
    }
  }
);

/////////////////////////////////////////////////// Actions Recorder //////////////////////////////////////////////
const ActionNodeProps = {
  Common: {
    nodeName: "",
    selector: "",
  },
  Type: {
    Text: "",
    "Overwrite existing text": false,
  },
  Click: {
    "Wait For New Page To load": false,
    "Wait For File Download": false,
    Description: "",
  },
  Scroll: {
    "Scroll Direction": {
      Top: false,
      Bottom: false,
    },
    Description: "",
  },
  Hover: {
    Description: "",
  },
  Prompts: {
    "Response Type": {
      Accept: false,
      Decline: false,
    },
    "Response Text": "",
  },
  Select: {
    Value: "",
    Description: "",
  },
  Keypress: {
    Key: "",
    "Wait For Page To Load": false,
  },
  Date: {
    Date: "",
  },
  Upload: {
    Path: "",
  },
  Code: {
    Code: "",
  },
};

type SUPPORTED_DOM_EVENTS =
  | "mouseup"
  | "keydown"
  | "scroll"
  | "mousemove"
  | "input";

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

  activate() {
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
  }

  deActivate() {
    this.isActive = false;
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
    if (!e.currentTarget) return;

    let el = e.currentTarget as HTMLElement;

    if (el.nodeName === "BUTTON" || el.getAttribute("type") == "button") {
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
    const cssSelector = shortSelector.getSelector(el, null, null);
    if (this.isInteractionElement(el, cssSelector)) {
      let optionProps = getOptionProps("Click");

      let descriptionProp: { Description: string } = {
        Description: getActionDescription(el),
      };

      let actionProps: { props: (ActionCommonProp & ActionClickProp) | {} } = {
        props: combineProps("Click", getCommonProps(el), {
          ...optionProps,
          ...descriptionProp,
        }),
      };

      let action = {
        name: "click",
        actionType: "Interaction",
        ...actionProps,
      };

      console.log(action);
      // this.saveActionDetailsToStorage(actionDetails);
      await sendRuntimeMessage("new-recorded-action", action);
    }
  }

  isInteractionElement(element: HTMLElement, cssSelector: string) {
    if (typeof cssSelector !== "string") return;

    if (
      document.querySelector(`button > ${cssSelector}`) ||
      document.querySelector(`a > ${cssSelector}`) ||
      document.querySelector(`input > ${cssSelector}`) ||
      element.nodeName === "BUTTON" ||
      element.getAttribute("type") == "button" ||
      element.nodeName === "A" ||
      element.getAttribute("type") == "a" ||
      element.nodeName === "INPUT" ||
      element.getAttribute("type") == "input"
    )
      return true;
    else return false;
  }

  textInputHandler() {}

  mouseMoveHandler() {}

  scrollHandler() {}

  attachUnloadListener() {
    console.log("attachUnloadListener called");
    const pollingDiv = document.createElement("div");
    pollingDiv.id = "actionflow-compose-status";
    pollingDiv.setAttribute("actionflow-done", "false");
    pollingDiv.setAttribute("actionflow-reloading", "false");
    document.body.append(pollingDiv);

    window.addEventListener("beforeunload", (e) => {
      console.log("navigating away form page.");
      let actionflowEl = document.querySelector("#actionflow-compose-status");
      if (actionflowEl)
        actionflowEl.setAttribute("actionflow-reloading", "true");
      // e.preventDefault();
      // return (event.returnValue = "");
    });
  }

  saveActionDetailsToStorage(actionDetails: any) {
    const prevSerialized = localStorage.getItem("composeData");

    if (!prevSerialized) {
      let firstKey = `${PAGE_URL}-node-0`;
      let newCompose = { firstKey: actionDetails };
      const serialized = JSON.stringify(newCompose);
      localStorage.setItem("composeData", serialized);
      return;
    }

    const compose = JSON.parse(prevSerialized);
    const actionExist = Object.values(compose).some(
      (n: any) => n.xpath === actionDetails["Common"].xpath
    );

    if (!actionExist) {
      const newKey = `${PAGE_URL}-node-${Object.values(compose).length}`;
      compose[newKey] = actionDetails;
      const serialized = JSON.stringify(compose);
      localStorage.setItem("composeData", serialized);
    }
  }
}

/**
 *  actionType: click, type, scroll etc.
 *  actionNodeCommon:  Object that has info about the common properties for an Action Element. eg. [nodeName, classes, xpath]
 *  actionOptionValues:  Object that has info about the specific options for an Action Element. eg. ["Wait For Page To Load", "Wait For File To Download",...]
 * */

function getActionDescription(element: HTMLElement) {
  if (!element) {
    console.warn(
      "No element was provided: getActionDescription(missing --> element)"
    );
    return "";
  }

  let description: string = "";

  if (element.textContent !== "" || element.textContent !== undefined)
    description = element.textContent!;

  for (const attr of ["aria-label", "title", "placeholder"]) {
    if (element.getAttribute(attr)) description = element.getAttribute(attr)!;
  }

  console.log("Action Description: ", description);

  return description;
}

function getOptionProps(actionType: ActionEventTypes): ActionClickProp | {} {
  let actionOptionValues = {};

  if (actionType === "Click") {
    Object.keys(ActionNodeProps["Click"]).forEach((key) => {
      if (key === "Wait For New Page To load") actionOptionValues[key] = false;
      else if (key === "Wait For File Download")
        actionOptionValues[key] = false;
      else if (key === "Description") actionOptionValues[key] = "";
    });
  }

  return actionOptionValues;
}

function combineProps(
  actionType: ActionEventTypes,
  actionNodeCommon: ActionCommonProp | {},
  actionOptionValues
): (ActionCommonProp & ActionClickProp) | {} {
  actionNodeCommon["options"] = {};
  Object.keys(ActionNodeProps[actionType]).forEach((key) => {
    actionNodeCommon["options"][key] = actionOptionValues[key];
  });

  return actionNodeCommon;
}

function getCommonProps(element: HTMLElement): ActionCommonProp | {} {
  let actionNodeCommon = {} as ActionCommonProp;

  let nodeClassList = "";
  element.classList?.forEach((c) => {
    nodeClassList += "." + c;
  });

  const shortSelector = new ShortestSelector();
  const cssSelector = shortSelector.getSelector(element, null, null);

  Object.keys(ActionNodeProps["Common"]).forEach((key) => {
    if (key === "nodeName") actionNodeCommon[key] = element.nodeName;
    else if (key === "selector") actionNodeCommon[key] = cssSelector;
  });

  return actionNodeCommon;
}

async function sendRuntimeMessage(status, payload) {
  try {
    await chrome.runtime.sendMessage(null, { status, payload });
  } catch (e) {
    console.warn(
      "Error sending Message: ",
      "status: ",
      status,
      ", payload: ",
      payload,
      ", Error: ",
      e
    );
  }
}

class ShortestSelector {
  DISABLE_CLASS_SEL = false;
  DISABLE_ID_SEL = true;
  DISABLE_ATTR_SEL = true;
  TARGET_NODE;

  getSelector(element: HTMLElement | undefined, carriedSelector, targetNode) {
    if (!element) return;

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
    let carrySelector;
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

    return this.getSelector(
      element.parentNode as HTMLElement,
      carrySelector,
      this.TARGET_NODE
    );
  }

  id(currrElement: HTMLElement, carriedSelector: string) {
    if (this.DISABLE_ID_SEL) return;

    const HAS_ID = currrElement.id !== "" && currrElement.id !== undefined;
    if (HAS_ID) {
      let idLeadSelector = "#" + currrElement.id;

      if (carriedSelector) idLeadSelector = idLeadSelector + carriedSelector;

      this.clearTargetNode();
      return idLeadSelector;
    }
  }

  attribute(currrElement: HTMLElement, carriedSelector: string) {
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
    carriedSelector: string
  ) {
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

  getIndex(node: HTMLElement) {
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

  isUniqForTarget(selector: string, targetNode: HTMLElement) {
    if (typeof selector !== "string") return false;

    try {
      if (document.querySelector(selector) === targetNode) return true;
      else return false;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
}
