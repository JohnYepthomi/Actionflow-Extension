type TPickElementMode = Exclude<
  ElementActionStartMessage["payload"]["actionType"],
  "List"
>;

type TPickElement = {
  isActive: boolean;
  mode: TPickElementMode;
  actionId: string;
  attribute: string | undefined;
  pickedElement: HTMLElement | undefined;
  prevHoverElement: Element | undefined;
  attr: string;
  activate: (
    mode: TPickElementMode,
    actionId: string,
    attribute: string | undefined
  ) => void;
  hoverHandler: (e: Event) => void;
  addElementOverlay: () => void;
  addPageOverlay: () => void;
  esacpehoverHandler: (e: KeyboardEvent) => void;
  addListeners: () => void;
  removeListeners: () => void;
  finish: (e: Event) => void;
  removeAllOverlays: () => void;
  changeCursorStyle: (cursorType: "auto" | "crosshair") => void;
  hasTextNode: (node: Element) => boolean;
};

const PickElement: TPickElement = {
  isActive: false,
  mode: undefined,
  actionId: undefined,
  attribute: undefined,
  pickedElement: undefined,
  prevHoverElement: undefined,
  attr: "",
  activate: function (mode, actionId: string, attribute: string | undefined) {
    if (PickElement.isActive) return;

    if (!actionId || !mode)
      throw new Error("Bad Parameter(s) passed to PickElement.activate");

    if (attribute) PickElement.attribute = attribute;

    PickElement.mode = mode;
    PickElement.actionId = actionId;
    PickElement.isActive = true;
    PickElement.changeCursorStyle("crosshair");
    PickElement.addPageOverlay();
    PickElement.addListeners();
  },
  hoverHandler: function (e) {
    const node = e.target as HTMLElement;
    if (PickElement.prevHoverElement === node) return;

    switch (PickElement.mode) {
      case "Text":
        if (
          node.nodeName === "IMG" ||
          node.nodeName === "svg" ||
          !PickElement.hasTextNode(node)
        )
          return;
        break;
      case "Anchor":
        if (node.nodeName !== "A") return;
        break;
      default:
        console.warn(`in default case: '${PickElement.mode}'`);
        break;
    }
    PickElement.pickedElement = node;
    PickElement.prevHoverElement = node;
    PickElement.addElementOverlay();
  },
  finish: function (e) {
    if (PickElement.isActive) {
      e.stopPropagation();
      e.preventDefault();

      let current_props = {};

      switch (PickElement.mode) {
        case "Click":
          const element = PickElement.pickedElement;
          current_props["Description"] = getActionDescription(
            PickElement.pickedElement
          );
          break;
        case "Text":
          current_props["value"] =
            PickElement.pickedElement?.textContent?.trim();
          break;
        case "Attribute":
          current_props["value"] = PickElement.pickedElement.getAttribute(
            PickElement.attribute
          );
          break;
        case "Anchor":
          current_props["value"] = (
            PickElement.pickedElement as HTMLAnchorElement
          )?.href;

          break;
        case "URL":
          current_props["value"] = window.location.href;
          break;
      }

      sendRuntimeMessage({
        status: "element-action-update",
        payload: {
          type: "UPDATE_INTERACTION",
          payload: {
            props: {
              nodeName: PickElement.pickedElement.nodeName,
              selector: new ShortestSelector().getSelector(
                PickElement.pickedElement as HTMLElement,
                null
              ),
              ...current_props,
            },
            actionId: PickElement.actionId,
          },
        },
      });

      PickElement.mode = undefined;
      PickElement.isActive = false;
      PickElement.prevHoverElement = undefined;
      PickElement.removeAllOverlays();
      PickElement.removeListeners();
    }
  },
  addElementOverlay: function () {
    if (!PickElement.pickedElement) return;

    const prevHighlightEls = document.querySelectorAll(
      ".element-highlight-shadow-root"
    );
    if (prevHighlightEls) {
      prevHighlightEls.forEach((el) => {
        el.remove();
      });
    }

    const rect = PickElement.pickedElement.getBoundingClientRect();
    const overlayEl = document.createElement("span");
    overlayEl.style.position = "absolute";
    overlayEl.style.height = `${rect.height}px`;
    overlayEl.style.width = `${rect.width}px`;
    overlayEl.style.top = window.scrollY
      ? `${rect.y - -window.scrollY}px`
      : `${rect.y}px`;
    overlayEl.style.left = window.scrollX
      ? `${rect.x - -window.scrollX}px`
      : `${rect.x}px`;
    overlayEl.style.zIndex = "9999999991";
    overlayEl.style.backgroundColor = "rgba(156,156,230, 0.3)";
    overlayEl.style.border = "1px dashed purple";

    const spanEl = document.createElement("span");
    spanEl.classList.add("element-highlight-shadow-root");
    spanEl.style.pointerEvents = "none";

    document.body.appendChild(spanEl);
    const shadow = spanEl.attachShadow({
      mode: "open",
    });
    shadow.appendChild(overlayEl);
  },
  addPageOverlay: function () {
    const overlayEl = document.createElement("span");
    overlayEl.style.position = "fixed";
    overlayEl.style.height = `100%`;
    overlayEl.style.width = `100%`;
    overlayEl.style.top = "0";
    overlayEl.style.left = "0";
    overlayEl.style.zIndex = "9999999990";
    overlayEl.style.backgroundColor = "rgba(000,000,000, 0.3)";

    const spanEl = document.createElement("span");
    spanEl.classList.add("page-overlay-highlight-shadow-root");
    spanEl.style.pointerEvents = "none";
    document.body.appendChild(spanEl);
    const shadow = spanEl.attachShadow({
      mode: "open",
    });
    shadow.appendChild(overlayEl);
  },
  addListeners: function () {
    document.addEventListener("mousemove", PickElement.hoverHandler);
    document.addEventListener("keyup", PickElement.esacpehoverHandler);
    document.addEventListener("click", PickElement.finish, true);
    window.addEventListener("scroll", (e) => {
      if (PickElement.isActive) {
        PickElement.addElementOverlay();
      }
    });
  },
  removeListeners: function () {
    document.removeEventListener("mousemove", PickElement.hoverHandler);
    document.removeEventListener("keyup", PickElement.esacpehoverHandler);
    document.removeEventListener("click", PickElement.finish);
  },
  esacpehoverHandler: function (e) {
    if (e.key === "Escape") {
      PickElement.finish(e);
    }
  },
  removeAllOverlays: function () {
    const prevHighlightEls = document.querySelectorAll(
      ".element-highlight-shadow-root"
    );
    if (prevHighlightEls) {
      prevHighlightEls.forEach((el) => {
        el.remove();
      });
    }

    const pageOverlay = document.querySelector(
      ".page-overlay-highlight-shadow-root"
    );
    if (pageOverlay) pageOverlay.remove();

    PickElement.changeCursorStyle("auto");
  },
  changeCursorStyle: function (cursorType = "crosshair") {
    var css = `*{ cursor: ${cursorType} !important; }`,
      head = document.head || document.getElementsByTagName("head")[0],
      style = document.createElement("style") as any;

    head.appendChild(style);

    style.type = "text/css";
    if (style.styleSheet) {
      // This is required for IE8 and below.
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
  },
  hasTextNode: function (node) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
      return true;
    }

    for (const childNode of Object.values(node.childNodes) as Element[]) {
      if (PickElement.hasTextNode(childNode)) {
        return true;
      }
    }

    return false;
  },
};
