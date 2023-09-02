/// <reference path="./ShortestCssSelector.ts" />
/// <reference path="./ActionsRecorderTypes.ts" />
/// <reference path="./Handlers/RuntimeMessageHandler.ts" />

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
    // "keydown",
    // "scroll",
    // "mousemove",
    "input",
  ];
  startTime: number = Date.now();
  endTime: number = this.startTime + this.INITIAL_WAIT;
  isActive: Boolean = false;
  tempInactive = false;
  PAGE_URL: string;

  constructor() {
    this.recordListeners.bind(this); // test
    this.attachUnloadListener.bind(this);
    this.PAGE_URL = window.location.href || "";
  }

  overrideDefault(
    INITIAL_WAIT: number,
    INTERVAL_WAIT: number,
    SUPPORTED_EVENTS: SUPPORTED_DOM_EVENTS[]
  ) {
    this.INITIAL_WAIT = INITIAL_WAIT;
    this.INTERVAL_WAIT = INTERVAL_WAIT;
    this.SUPPORTED_EVENTS = SUPPORTED_EVENTS;
  }

  async recordListeners(windowRecorderHandler: (e: Event) => void) {
    this.SUPPORTED_EVENTS.forEach(
      function (eventType: SUPPORTED_DOM_EVENTS) {
        document.addEventListener(eventType, windowRecorderHandler);
      }.bind(this)
    );
  }

  async activate() {
    console.log("Trying to Activate recorder...");
    if (this.isActive) {
      console.warn("Recorder already active...");
      return;
    } else {
      this.isActive = true;

      /**
       * A Change in a the current tab's url would change the local storage and
       * we will loose recording status when navigating to another url.
       * So, we store the status in the backgroundscript which is the only Source of truth.
       * */
      console.log("Recorder Activated");
      localStorage.setItem(
        "isContentScriptRecording",
        JSON.stringify(this.isActive)
      );
    }
  }

  async deActivate() {
    if (!this.isActive) {
      console.warn("Recorder already deactived");
      return;
    } else {
      this.isActive = false;

      /**
       * A Change in a the current tab's url would change the local storage and
       * we will loose recording status when navigating to another url.
       * So, we store the status in the backgroundscript which is the only Source of truth.
       * */
      console.log("Recorder Deactivated");
      localStorage.setItem(
        "isContentScriptRecording",
        JSON.stringify(this.isActive)
      );
    }
  }

  async clickHandler(e: Event) {
    let el = e.target as HTMLElement;
    if (!el || el.nodeName === "#document") return;

    let NODE_TYPE: string = this.getNodeType(el);

    const shortCssSelector = new ShortestSelector();
    const cssSelector = shortCssSelector.getSelector(el, undefined);
    if (!cssSelector) {
      console.log(
        `%c Could not generate Selector for Element: ${el}`,
        "color: yellow; font-size: 0.85rem;"
      );

      return;
    }

    const commonProps: CommonProp = {
      nodeName: el.nodeName,
      selector: cssSelector,
    };

    switch (NODE_TYPE) {
      case "Select":
        const select_el = e.target as HTMLSelectElement;
        const selectedValue = select_el.value;
        const availableOptions = Array.from(select_el.options).map(
          (op_el) => op_el.textContent
        );
        const selectProps: SelectProp = {
          Selected: selectedValue,
          Options: availableOptions,
          Description: this.isInteractionElement(select_el, cssSelector)
            ? getActionDescription(select_el)
            : "",
        };
        const selectAction: Action = {
          actionType: "Select",
          props: { ...commonProps, ...selectProps },
        };
        const selectmsg: ToFrontendMessage = {
          status: "new-recorded-action",
          payload: {
            type: "RECORDED_ACTION",
            actionType: "Select",
            payload: selectAction,
          },
        };
        await sendRuntimeMessage(selectmsg);
        break;
      default:
        const clickProps: ClickProp = {
          "Wait For New Page To load": false,
          "Wait For File Download": false,
          Description: getActionDescription(el).trim(),
        };
        const clickAction: Action = {
          actionType: "Click",
          props: { ...commonProps, ...clickProps },
        };
        const clickmsg: ToFrontendMessage = {
          status: "new-recorded-action",
          payload: {
            type: "RECORDED_ACTION",
            actionType: "Click",
            payload: clickAction,
          },
        };
        await sendRuntimeMessage(clickmsg);
        break;
    }
  }

  getNodeType(el) {
    if (el.nodeName === "BUTTON" || el?.getAttribute("type") == "button") {
      console.log("User clicked a Button: ", el.innerText);
      return "Button";
    } else if (el.nodeName === "A" || el?.getAttribute("type") == "link") {
      console.log("User clicked a Link: ", (el as HTMLLinkElement).href);
      return "Link";
    } else if (el.nodeName === "INPUT" || el?.getAttribute("type") == "input") {
      console.log(
        "User clicked an Input box: ",
        (el as HTMLInputElement).value
      );
      return "Input";
    } else if (
      el.nodeName === "SELECT" ||
      el?.getAttribute("type") == "select"
    ) {
      console.log(
        "User clicked on Select Node. Selected Option: ",
        (el as HTMLInputElement).value
      );
      return "Select";
    }
  }

  isInteractionElement(element: HTMLElement, cssSelector: string) {
    if (
      cssSelector.includes("button") ||
      cssSelector.includes("textarea") ||
      cssSelector.includes("input")
    )
      return true;

    if (
      document.querySelector(`button  ${cssSelector}`) || // removed '>' direct-descendant
      document.querySelector(`a  ${cssSelector}`) || // removed '>' direct-descendant
      document.querySelector(`input  ${cssSelector}`) || // removed '>' direct-descendant
      element.nodeName === "BUTTON" ||
      element.nodeName === "TEXTAREA" ||
      element.getAttribute("type") == "button" ||
      element.nodeName === "A" ||
      element.getAttribute("type") == "a" ||
      element.nodeName === "INPUT" ||
      element.getAttribute("type") == "input"
    )
      return true;

    return false;
  }

  async textInputHandler(e: Event) {
    console.log("In textInputHandler");

    let el = e.target as HTMLInputElement;
    const IGNORE_INPUTS = ["checkbox", "radio"];
    const el_type_attr = el.getAttribute("type");
    if (
      !["INPUT", "TEXTAREA"].includes(el.nodeName) ||
      IGNORE_INPUTS.includes(el_type_attr)
    )
      return;

    const shortCssSelector = new ShortestSelector();
    const cssSelector = shortCssSelector.getSelector(el, undefined);
    if (!cssSelector) {
      console.log(
        `%c Could not generate Selector for Element: ${el}`,
        "color: yellow; font-size: 0.85rem;"
      );

      return;
    }

    const typedText = el?.value;
    const commonProps: CommonProp = {
      nodeName: el.nodeName,
      selector: cssSelector,
    };
    const typeProps: TypeProp = {
      Text: typedText,
      "Overwrite Existing Text": false,
    };
    const typeAction: Action = {
      actionType: "Type",
      props: { ...commonProps, ...typeProps },
    };
    const msg: ToFrontendMessage = {
      status: "new-recorded-action",
      payload: {
        type: "RECORDED_ACTION",
        actionType: "Type",
        payload: typeAction,
      },
    };
    await sendRuntimeMessage(msg);
  }

  mouseMoveHandler() {}

  scrollHandler() {}

  attachUnloadListener(BeforeWindowUnloadHandler: () => void) {
    console.log("attachUnloadListener called");
    // const pollingDiv = document.createElement("div");
    // pollingDiv.id = "actionflow-compose-status";
    // pollingDiv.setAttribute("actionflow-done", "false");
    // pollingDiv.setAttribute("actionflow-reloading", "false");
    // document.body.append(pollingDiv);

    window.addEventListener("beforeunload", BeforeWindowUnloadHandler);
  }

  saveActionDetailsToStorage(newAction: Action) {
    const prevSerialized = localStorage.getItem("composeData");

    if (!prevSerialized) {
      let newCompose = { [`${this.PAGE_URL}-node-0`]: newAction };
      localStorage.setItem("composeData", JSON.stringify(newCompose));

      return;
    }

    const compose = JSON.parse(prevSerialized);
    compose[`${this.PAGE_URL}-node-${Object.values(compose).length}`] =
      newAction;
    localStorage.setItem("composeData", JSON.stringify(compose));
  }
}

function getActionDescription(element: HTMLElement): string {
  if (!element) {
    console.warn(
      "No element was provided: getActionDescription(missing --> element)"
    );
    return "";
  }

  for (const attr of ["aria-label", "title", "placeholder"]) {
    if (element.getAttribute(attr)) {
      console.log("Action Description: ", element.getAttribute(attr));
      return element.getAttribute(attr);
    }
  }

  if (element.textContent !== "" || element.textContent !== undefined)
    return element.textContent!;
}
