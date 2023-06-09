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
    "keydown",
    "scroll",
    "mousemove",
    "input",
  ];
  startTime: number = Date.now();
  endTime: number = this.startTime + this.INITIAL_WAIT;
  isActive: Boolean = false;
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

  async recordListeners(windowRecorderHandler: (e: Event)=> void) {
    this.SUPPORTED_EVENTS.forEach(
      function (eventType: SUPPORTED_DOM_EVENTS) {
        document.addEventListener(
          eventType,
          windowRecorderHandler
        );
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

    const shortCssSelector = new ShortestSelector();
    const cssSelector = shortCssSelector.getSelector(el, undefined);
    if (!cssSelector) {
      console.log(
        `%c Could not generate Selector for Element: ${el}`,
        "color: yellow; font-size: 0.85rem;"
      );

      return;
    }
    if (cssSelector) {
      let commonProps: CommonProp = {
        nodeName: el.nodeName,
        selector: cssSelector,
      };
      let clickProps: ClickProp = {
        "Wait For New Page To load": false,
        "Wait For File Download": false,
        Description: this.isInteractionElement(el, cssSelector) ? getActionDescription(el) : "",
      };
      let action: Action = {
        actionType: "Click",
        props: { ...commonProps, ...clickProps },
      };

      console.log(action);
      // this.saveActionDetailsToStorage(action);
      let contentScriptMessage: ContentScriptMessage = {
        status: "new-recorded-action",
        actionType: "Click",
        payload: action,
      };
      await sendRuntimeMessage(contentScriptMessage);
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

  textInputHandler() {}

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

  let description = "";

  if (element.textContent !== "" || element.textContent !== undefined)
    description = element.textContent!;

  for (const attr of ["aria-label", "title", "placeholder"]) {
    if (element.getAttribute(attr)) description = element.getAttribute(attr)!;
  }

  console.log("Action Description: ", description);

  return description;
}