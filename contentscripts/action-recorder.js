class ShortestSelector {
    constructor() {
        this.DISABLE_CLASS_SEL = true;
        this.DISABLE_ID_SEL = true;
        this.DISABLE_ATTR_SEL = false;
    }
    getSelector(element, carriedSelector) {
        if (!element ||
            element.nodeName === "#document" ||
            element.nodeName === "html")
            return;
        if (element instanceof SVGElement) {
            return this.getSelector(element.closest("svg").parentNode, null);
        }
        if (element.nodeName.toLowerCase() === "body") {
            this.clearTargetNode();
            if (carriedSelector)
                return "body" + carriedSelector;
            return "body";
        }
        this.TARGET_NODE = !this.TARGET_NODE ? element : this.TARGET_NODE;
        let currentTAG = element.nodeName.toLowerCase();
        const nthTypePos = this.getIndex(element) != 1
            ? `:nth-of-type(${this.getIndex(element)})`
            : "";
        currentTAG = currentTAG + nthTypePos;
        let candidate = "";
        const id_selector = this.id(element, carriedSelector);
        if (id_selector)
            return id_selector;
        const attr_selector = this.attribute(element, carriedSelector);
        if (attr_selector)
            return attr_selector;
        const class_selector = this.class(element, currentTAG, carriedSelector);
        if (class_selector)
            return class_selector;
        if (carriedSelector) {
            if (candidate === "")
                candidate = currentTAG + carriedSelector;
            else
                candidate = candidate + carriedSelector;
        }
        let carrySelector;
        if (candidate !== "") {
            if (this.isUniqForTarget(candidate, this.TARGET_NODE)) {
                this.clearTargetNode();
                return candidate;
            }
            carrySelector = " > " + candidate;
        }
        else
            carrySelector =
                ` > ${currentTAG}` + (carriedSelector ? carriedSelector : "");
        return this.getSelector(element.parentNode, carrySelector);
    }
    id(currrElement, carriedSelector) {
        const HAS_ID = currrElement.id !== "" && currrElement.id !== undefined;
        if (!HAS_ID || this.DISABLE_ID_SEL)
            return;
        if (HAS_ID) {
            let idLeadSelector = "#" + currrElement.id;
            if (carriedSelector)
                idLeadSelector = idLeadSelector + carriedSelector;
            this.clearTargetNode();
            return idLeadSelector;
        }
    }
    attribute(currrElement, carriedSelector) {
        if (this.DISABLE_ATTR_SEL)
            return;
        for (const attr of ["aria-label", "title"]) {
            if (currrElement.getAttribute(attr)) {
                let attrLeadSelector = `${currrElement.nodeName.toLowerCase()}[${attr}="${currrElement.getAttribute(attr)}"]`;
                if (carriedSelector)
                    attrLeadSelector = attrLeadSelector + carriedSelector;
                this.clearTargetNode();
                return attrLeadSelector;
            }
        }
    }
    class(currrElement, currentTAG, carriedSelector) {
        if (this.DISABLE_CLASS_SEL)
            return;
        let foundUniqClass = false;
        let classSelector = "";
        currrElement.classList?.forEach((c) => {
            if (!foundUniqClass) {
                classSelector = currentTAG + "." + c;
                const isTargetSelector = this.isUniqForTarget(classSelector, this.TARGET_NODE);
                if (isTargetSelector) {
                    foundUniqClass = true;
                    if (carriedSelector)
                        classSelector = classSelector + carriedSelector;
                    this.clearTargetNode();
                }
            }
        });
        return foundUniqClass ? classSelector : undefined;
    }
    clearTargetNode() {
        this.TARGET_NODE = undefined;
    }
    getIndex(node) {
        let i = 1;
        let tagName = node.tagName;
        while (node.previousSibling) {
            node = node.previousSibling;
            if (node.nodeType === 1 &&
                tagName.toLowerCase() == node.tagName.toLowerCase()) {
                i++;
            }
        }
        return i;
    }
    isUniqForTarget(selector, targetNode) {
        if (!document.querySelector(selector) && !targetNode)
            return false;
        if (document.querySelector(selector) === targetNode)
            return true;
        else
            return false;
    }
}
class ActionsRecorder {
    constructor() {
        this.INITIAL_WAIT = 3000;
        this.INTERVAL_WAIT = 10000;
        this.SUPPORTED_EVENTS = [
            "mouseup",
            "input",
        ];
        this.startTime = Date.now();
        this.endTime = this.startTime + this.INITIAL_WAIT;
        this.isActive = false;
        this.tempInactive = false;
        this.recordListeners.bind(this);
        this.attachUnloadListener.bind(this);
        this.PAGE_URL = window.location.href || "";
    }
    overrideDefault(INITIAL_WAIT, INTERVAL_WAIT, SUPPORTED_EVENTS) {
        this.INITIAL_WAIT = INITIAL_WAIT;
        this.INTERVAL_WAIT = INTERVAL_WAIT;
        this.SUPPORTED_EVENTS = SUPPORTED_EVENTS;
    }
    async recordListeners(windowRecorderHandler) {
        this.SUPPORTED_EVENTS.forEach(function (eventType) {
            document.addEventListener(eventType, windowRecorderHandler);
        }.bind(this));
    }
    async activate() {
        console.log("Trying to Activate recorder...");
        if (this.isActive) {
            console.warn("Recorder already active...");
            return;
        }
        else {
            this.isActive = true;
            console.log("Recorder Activated");
            localStorage.setItem("isContentScriptRecording", JSON.stringify(this.isActive));
        }
    }
    async deActivate() {
        if (!this.isActive) {
            console.warn("Recorder already deactived");
            return;
        }
        else {
            this.isActive = false;
            console.log("Recorder Deactivated");
            localStorage.setItem("isContentScriptRecording", JSON.stringify(this.isActive));
        }
    }
    async clickHandler(e) {
        let el = e.target;
        if (!el || el.nodeName === "#document")
            return;
        let NODE_TYPE = this.getNodeType(el);
        const shortCssSelector = new ShortestSelector();
        const cssSelector = shortCssSelector.getSelector(el, undefined);
        if (!cssSelector) {
            console.log(`%c Could not generate Selector for Element: ${el}`, "color: yellow; font-size: 0.85rem;");
            return;
        }
        const commonProps = {
            nodeName: el.nodeName,
            selector: cssSelector,
        };
        switch (NODE_TYPE) {
            case "Select":
                const select_el = e.target;
                const selectedValue = select_el.value;
                const availableOptions = Array.from(select_el.options).map((op_el) => op_el.textContent);
                const selectProps = {
                    Selected: selectedValue,
                    Options: availableOptions,
                    Description: this.isInteractionElement(select_el, cssSelector)
                        ? getActionDescription(select_el)
                        : "",
                };
                const selectAction = {
                    actionType: "Select",
                    props: { ...commonProps, ...selectProps },
                };
                const selectmsg = {
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
                const clickProps = {
                    "Wait For New Page To load": false,
                    "Wait For File Download": false,
                    Description: getActionDescription(el).trim(),
                };
                const clickAction = {
                    actionType: "Click",
                    props: { ...commonProps, ...clickProps },
                };
                const clickmsg = {
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
        }
        else if (el.nodeName === "A" || el?.getAttribute("type") == "link") {
            console.log("User clicked a Link: ", el.href);
            return "Link";
        }
        else if (el.nodeName === "INPUT" || el?.getAttribute("type") == "input") {
            console.log("User clicked an Input box: ", el.value);
            return "Input";
        }
        else if (el.nodeName === "SELECT" ||
            el?.getAttribute("type") == "select") {
            console.log("User clicked on Select Node. Selected Option: ", el.value);
            return "Select";
        }
    }
    isInteractionElement(element, cssSelector) {
        if (cssSelector.includes("button") ||
            cssSelector.includes("textarea") ||
            cssSelector.includes("input"))
            return true;
        if (document.querySelector(`button  ${cssSelector}`) ||
            document.querySelector(`a  ${cssSelector}`) ||
            document.querySelector(`input  ${cssSelector}`) ||
            element.nodeName === "BUTTON" ||
            element.nodeName === "TEXTAREA" ||
            element.getAttribute("type") == "button" ||
            element.nodeName === "A" ||
            element.getAttribute("type") == "a" ||
            element.nodeName === "INPUT" ||
            element.getAttribute("type") == "input")
            return true;
        return false;
    }
    async textInputHandler(e) {
        console.log("In textInputHandler");
        let el = e.target;
        const IGNORE_INPUTS = ["checkbox", "radio"];
        const el_type_attr = el.getAttribute("type");
        if (!["INPUT", "TEXTAREA"].includes(el.nodeName) ||
            IGNORE_INPUTS.includes(el_type_attr))
            return;
        const shortCssSelector = new ShortestSelector();
        const cssSelector = shortCssSelector.getSelector(el, undefined);
        if (!cssSelector) {
            console.log(`%c Could not generate Selector for Element: ${el}`, "color: yellow; font-size: 0.85rem;");
            return;
        }
        const typedText = el?.value;
        const commonProps = {
            nodeName: el.nodeName,
            selector: cssSelector,
        };
        const typeProps = {
            Text: typedText,
            "Overwrite Existing Text": false,
        };
        const typeAction = {
            actionType: "Type",
            props: { ...commonProps, ...typeProps },
        };
        const msg = {
            status: "new-recorded-action",
            payload: {
                type: "RECORDED_ACTION",
                actionType: "Type",
                payload: typeAction,
            },
        };
        await sendRuntimeMessage(msg);
    }
    mouseMoveHandler() { }
    scrollHandler() { }
    attachUnloadListener(BeforeWindowUnloadHandler) {
        console.log("attachUnloadListener called");
        window.addEventListener("beforeunload", BeforeWindowUnloadHandler);
    }
    saveActionDetailsToStorage(newAction) {
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
function getActionDescription(element) {
    if (!element) {
        console.warn("No element was provided: getActionDescription(missing --> element)");
        return "";
    }
    for (const attr of ["aria-label", "title", "placeholder"]) {
        if (element.getAttribute(attr)) {
            console.log("Action Description: ", element.getAttribute(attr));
            return element.getAttribute(attr);
        }
    }
    if (element.textContent !== "" || element.textContent !== undefined)
        return element.textContent;
}
class PickList {
    static searchListStructure(candidate) {
        if (!candidate) {
            console.log("No Candidates passed, No More Candidate(ColParent).");
            return;
        }
        this.hoverEl = candidate;
        this.find(candidate);
        return this.siblings;
    }
    static find(candidate) {
        const sibs = candidate?.parentElement?.children;
        const filteredSibs = sibs
            ? Array.from(sibs).filter((s) => filterNode(s))
            : undefined;
        if (!sibs || sibs.length < 2) {
            return this.searchListStructure(candidate?.parentElement);
        }
        else if (ValidateListStructure.isListElement(filteredSibs) ||
            ValidateListStructure.validateSiblings(filteredSibs)) {
            if (sibs.length > 2 && filteredSibs && filteredSibs.length < 3)
                return this.searchListStructure(candidate?.parentElement);
            this.finalCandidate = candidate;
            this.siblings = filteredSibs;
            console.log("FINAL CANDIDATE: ", candidate);
        }
        else {
            return this.searchListStructure(candidate?.parentElement);
        }
    }
    static addListStructureOverlay() {
        if (!this.siblings)
            return;
        const prevHighlightEls = document.querySelectorAll(".list-item-highlight-shadow-root");
        if (prevHighlightEls) {
            prevHighlightEls.forEach((el) => {
                el.remove();
            });
        }
        Array.from(this.siblings).forEach((node) => {
            const rect = node.getBoundingClientRect();
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
            overlayEl.style.border = "1px dashed red";
            const spanEl = document.createElement("span");
            spanEl.classList.add("list-item-highlight-shadow-root");
            spanEl.style.pointerEvents = "none";
            document.body.appendChild(spanEl);
            const shadow = spanEl.attachShadow({
                mode: "open",
            });
            shadow.appendChild(overlayEl);
        });
    }
    static addPageOverlay() {
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
    }
    static removeAllOverlays() {
        const prevHighlightEls = document.querySelectorAll(".list-item-highlight-shadow-root");
        if (prevHighlightEls) {
            prevHighlightEls.forEach((el) => {
                el.remove();
            });
        }
        const pageOverlay = document.querySelector(".page-overlay-highlight-shadow-root");
        if (pageOverlay)
            pageOverlay.remove();
        changeCursorStyle("auto");
    }
}
PickList.isActive = false;
PickList.actionId = undefined;
class ValidateListStructure {
    static validate(candidate) {
        return this.level1(candidate) && this.level2(candidate) ? true : false;
    }
    static isListElement(sibs) {
        if (!Array.isArray(sibs))
            return;
        return sibs.some((sib) => sib.tagName === "LI");
    }
    static validateByChildExistence(sibs) {
        if (sibs)
            return (sibs.some((sib) => sib.childElementCount > 0) &&
                sibs.every((sib) => sib.childElementCount > 0));
    }
    static validateSiblings(sibs) {
        if (!Array.isArray(sibs))
            return;
        let FOUND = false;
        let sibsLen = sibs.length - 1;
        let truecount = 0;
        for (let i = 0; i <= sibsLen; i++) {
            if (FOUND)
                break;
            if (!FOUND) {
                if (this.validate(sibs[i])) {
                    FOUND = true;
                    truecount++;
                }
            }
        }
        if (FOUND)
            return true;
        else
            return false;
    }
    static level1(candidate) {
        const c1 = candidate?.childElementCount;
        let c2 = candidate?.nextElementSibling?.childElementCount;
        if (c2 !== 0 && !c2) {
            c2 = candidate?.previousElementSibling?.childElementCount;
        }
        return c1 === c2 ? true : false;
    }
    static level2(candidate) {
        const Nodes1 = candidate?.firstElementChild?.children;
        let Nodes2 = candidate?.nextElementSibling?.firstElementChild?.children;
        if (!Nodes1 && !Nodes2)
            return true;
        if (!Nodes2) {
            Nodes2 = candidate?.previousElementSibling?.firstElementChild?.children;
        }
        if (Nodes1 && Nodes2 && Nodes1.length === 0 && Nodes2.length === 0) {
            return true;
        }
        if (Nodes1 && Nodes2 && Nodes1?.length === Nodes2?.length) {
            if (this.validateByTags(Nodes1, Nodes2)) {
                return true;
            }
            else {
                return false;
            }
        }
        else {
            return false;
        }
    }
    static validateByTags(n1, n2) {
        if (n1.length !== n2.length)
            return false;
        let len = n1.length - 1;
        let trueCount = 0;
        for (let i = 0; i < len; i++) {
            if (n1[i].tagName === n2[i].tagName) {
                trueCount++;
            }
        }
        if (trueCount === len)
            return true;
        else
            return false;
    }
    static hasSibling(el) {
        if (!el)
            return;
        return el.previousElementSibling || el.nextElementSibling ? true : false;
    }
}
function addDocumentHoverListener() {
    document.addEventListener("mousemove", handleDocumentHover);
}
function removeDocumentHoverListener() {
    console.log("removeDocumentHoverListener called");
    document.removeEventListener("mousemove", handleDocumentHover);
}
let prevHoverElement;
function handleDocumentHover(e) {
    if (prevHoverElement === e.target) {
        console.log("ignoring hover handler");
        return;
    }
    PickList.searchListStructure(e.target);
    PickList.addListStructureOverlay();
    prevHoverElement = e.target;
}
function filterNode(node) {
    const height = node.getBoundingClientRect().height;
    const visibility = window.getComputedStyle(node, null).visibility;
    const display = window.getComputedStyle(node, null).display;
    return height > 5 && visibility === "visible" && display !== "none";
}
function addListItemListeners() {
    console.log("adding scroll listener to window");
    window.addEventListener("scroll", (e) => {
        if (PickList.isActive) {
            PickList.addListStructureOverlay();
        }
    });
    document.addEventListener("click", (e) => {
        if (PickList.isActive) {
            e.stopPropagation();
            e.preventDefault();
            if (PickList.finalCandidate && PickList.actionId) {
                sendRuntimeMessage({
                    status: "element-action-update",
                    payload: {
                        type: "UPDATE_INTERACTION",
                        props: {
                            nodeName: PickList.finalCandidate.nodeName,
                            selector: new ShortestSelector().getSelector(PickList.finalCandidate, null),
                        },
                        actionId: PickList.actionId,
                    },
                });
            }
            finishFindList();
        }
    }, true);
}
function finishFindList() {
    PickList.isActive = false;
    PickList.actionId = undefined;
    PickList.finalCandidate = undefined;
    PickList.siblings = undefined;
    PickList.removeAllOverlays();
    removeDocumentHoverListener();
}
function changeCursorStyle(cursorType = "crosshair") {
    var css = `*{ cursor: ${cursorType} !important; }`, head = document.head || document.getElementsByTagName("head")[0], style = document.createElement("style");
    head.appendChild(style);
    style.type = "text/css";
    if (style.styleSheet) {
        style.styleSheet.cssText = css;
    }
    else {
        style.appendChild(document.createTextNode(css));
    }
}
function handleEscapeKey(e) {
    if (e.key === "Escape") {
        finishFindList();
        document.removeEventListener("keyup", handleEscapeKey);
    }
}
function addEscapeKeyListener() {
    document.addEventListener("keyup", handleEscapeKey);
}
function beginFindList(actionId) {
    PickList.actionId = actionId;
    PickList.addPageOverlay();
    PickList.isActive = true;
    changeCursorStyle();
    addDocumentHoverListener();
    addListItemListeners();
    addEscapeKeyListener();
}
const PickElement = {
    isActive: false,
    mode: undefined,
    actionId: undefined,
    attribute: undefined,
    pickedElement: undefined,
    prevHoverElement: undefined,
    attr: "",
    activate: function (mode, actionId, attribute) {
        if (PickElement.isActive)
            return;
        if (!actionId || !mode)
            throw new Error("Bad Parameter(s) passed to PickElement.activate");
        if (attribute)
            PickElement.attribute = attribute;
        PickElement.mode = mode;
        PickElement.actionId = actionId;
        PickElement.isActive = true;
        PickElement.changeCursorStyle("crosshair");
        PickElement.addPageOverlay();
        PickElement.addListeners();
    },
    hoverHandler: function (e) {
        const node = e.target;
        if (PickElement.prevHoverElement === node)
            return;
        switch (PickElement.mode) {
            case "Text":
                if (node.nodeName === "IMG" ||
                    node.nodeName === "svg" ||
                    !PickElement.hasTextNode(node))
                    return;
                break;
            case "Anchor":
                if (node.nodeName !== "A")
                    return;
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
                    current_props["Description"] = getActionDescription(PickElement.pickedElement);
                    break;
                case "Text":
                    current_props["value"] =
                        PickElement.pickedElement?.textContent?.trim();
                    break;
                case "Attribute":
                    current_props["value"] = PickElement.pickedElement.getAttribute(PickElement.attribute);
                    break;
                case "Anchor":
                    current_props["value"] = PickElement.pickedElement?.href;
                    break;
                case "URL":
                    current_props["value"] = window.location.href;
                    break;
            }
            sendRuntimeMessage({
                status: "element-action-update",
                payload: {
                    type: "UPDATE_INTERACTION",
                    props: {
                        nodeName: PickElement.pickedElement.nodeName,
                        selector: new ShortestSelector().getSelector(PickElement.pickedElement, null),
                        ...current_props,
                    },
                    actionId: PickElement.actionId,
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
        if (!PickElement.pickedElement)
            return;
        const prevHighlightEls = document.querySelectorAll(".element-highlight-shadow-root");
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
        const prevHighlightEls = document.querySelectorAll(".element-highlight-shadow-root");
        if (prevHighlightEls) {
            prevHighlightEls.forEach((el) => {
                el.remove();
            });
        }
        const pageOverlay = document.querySelector(".page-overlay-highlight-shadow-root");
        if (pageOverlay)
            pageOverlay.remove();
        PickElement.changeCursorStyle("auto");
    },
    changeCursorStyle: function (cursorType = "crosshair") {
        var css = `*{ cursor: ${cursorType} !important; }`, head = document.head || document.getElementsByTagName("head")[0], style = document.createElement("style");
        head.appendChild(style);
        style.type = "text/css";
        if (style.styleSheet) {
            style.styleSheet.cssText = css;
        }
        else {
            style.appendChild(document.createTextNode(css));
        }
    },
    hasTextNode: function (node) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
            return true;
        }
        for (const childNode of Object.values(node.childNodes)) {
            if (PickElement.hasTextNode(childNode)) {
                return true;
            }
        }
        return false;
    },
};
const chromeListener = async function (request, _sender, _sendResponse) {
    console.log("contentscript onMessage called");
    if (!chrome.runtime?.id) {
        console.log("chromeListener context invalidated. Removing listener...");
        chrome.runtime.onMessage.removeListener(chromeListener);
    }
    switch (request.message) {
        case "start-recording":
            this.activate();
            await messageBackground({ message: "recording-started" });
            break;
        case "stop-recording":
            this.deActivate();
            await messageBackground({ message: "recording-stopped" });
            break;
        case "compose-completed":
            console.log("compose-completed chrome runtime called on firstContent script");
            localStorage.setItem("isComposeCompleted", "true");
            if ("nestingLevel" in request.payload)
                localStorage.setItem("composeData", JSON.stringify(request.payload));
            break;
        case "element-pick":
            if (typeof request.payload !== "object" ||
                (typeof request.payload === "object" &&
                    !("id" in request.payload) &&
                    !("actionType" in request.payload)))
                return;
            if (this.isActive)
                this.tempInactive = true;
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
async function sendRuntimeMessage(content) {
    try {
        await chrome.runtime.sendMessage(null, content);
    }
    catch (e) {
        console.warn("Error sending Message: ", "status: ", content.status, ", payload: ", content.payload, ", Error: ", e);
    }
}
async function messageBackground(message) {
    return await new Promise(async (res) => {
        await chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.log({ message });
                console.error(chrome.runtime.lastError);
                return;
            }
            if (response)
                res(response);
            else
                res("no-response");
        });
    });
}
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
    async function windowRecorderHandler(e) {
        if (!chrome.runtime?.id) {
            document.removeEventListener(e.type, windowRecorderHandler);
            return;
        }
        if (!recObj.isActive)
            return;
        if (recObj.tempInactive) {
            recObj.tempInactive = false;
            return;
        }
        recObj.endTime = Date.now() + recObj.INTERVAL_WAIT;
        switch (e.type) {
            case "input":
                console.log("%c User input action recorded", "color: teal; font-style=italic;");
                await recObj.textInputHandler(e);
                break;
            case "mouseup":
                console.log("%c mouseup action recorded", "color: green; font-style=italic;");
                await recObj.clickHandler(e);
                break;
            default:
                console.log("action-recorder default event type: ", e.type);
                break;
        }
    }
    function BeforeWindowUnloadHandler() {
        if (!chrome.runtime?.id) {
            document.removeEventListener("beforeunload", BeforeWindowUnloadHandler);
            console.log("BeforeWindowUnloadHandler() removed");
            return;
        }
        console.log("BeforeWindowUnloadHandler() still attached");
        console.log("navigating away form page. isContentScriptRecording: ", recObj.isActive);
        localStorage.setItem("isContentScriptRecording", JSON.stringify(recObj.isActive));
    }
})();
