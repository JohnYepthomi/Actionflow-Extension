let PAGE_URL = window.location.href || "";
class ActionsRecorder {
    constructor() {
        this.INITIAL_WAIT = 3000;
        this.INTERVAL_WAIT = 10000;
        this.SUPPORTED_EVENTS = [
            "mouseup",
            "keydown",
            "scroll",
            "mousemove",
            "input",
        ];
        this.startTime = Date.now();
        this.endTime = this.startTime + this.INITIAL_WAIT;
        this.isActive = false;
    }
    overrideDefault(INITIAL_WAIT, INTERVAL_WAIT, SUPPORTED_EVENTS) {
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
        this.SUPPORTED_EVENTS.forEach(function (eventType) {
            document.addEventListener(eventType, this.windowRecorderHandler.bind(this, eventType));
        }.bind(this));
        this.attachUnloadListener();
        this.deActivate();
        console.log("Recoding Strated...");
    }
    activate() {
        console.log("Trying to Activate recorder...");
        if (this.isActive) {
            console.warn("Recorder already active...");
            return;
        }
        else {
            this.isActive = true;
            console.log("Recorder Activated");
        }
    }
    deActivate() {
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
    async windowRecorderHandler(eventType, e) {
        if (!this.isActive)
            return;
        this.endTime = Date.now() + this.INTERVAL_WAIT;
        switch (eventType) {
            case "input":
                console.log("%c User input action recorded", "color: teal; font-style=italic;");
                break;
            case "mouseup":
                console.log("%c mouseup action recorded", "color: green; font-style=italic;");
                await this.clickHandler(e);
                break;
        }
    }
    async clickHandler(e) {
        if (!e.target)
            return;
        let el = e.target;
        if ((el.nodeName !== "#document" && el.nodeName === "BUTTON") ||
            el?.getAttribute("type") == "button") {
            console.log("User clicked a Button: ", el.innerText);
        }
        else if (el.nodeName === "A") {
            console.log("User clicked a Link: ", el.href);
        }
        else if (el.nodeName === "INPUT") {
            console.log("User clicked an Input box: ", el.value);
        }
        const shortSelector = new ShortestSelector();
        const cssSelector = shortSelector.getSelector(el, undefined);
        if (!cssSelector) {
            console.log(`%c Could not generate Selector for Element: ${el}`, "color: yellow; font-size: 0.85rem;");
            return;
        }
        if (cssSelector && this.isInteractionElement(el, cssSelector)) {
            let commonProps = {
                nodeName: el.nodeName,
                selector: cssSelector,
            };
            let clickProps = {
                "Wait For New Page To load": false,
                "Wait For File Download": false,
                Description: getActionDescription(el),
            };
            let action = {
                name: "Click",
                actionType: "Interaction",
                props: { ...commonProps, ...clickProps },
            };
            console.log(action);
            this.saveActionDetailsToStorage(action);
            let contentScriptMessage = {
                status: "new-recorded-action",
                payload: action,
            };
            await sendRuntimeMessage(contentScriptMessage);
        }
    }
    isInteractionElement(element, cssSelector) {
        if (cssSelector.includes("button") ||
            cssSelector.includes("input"))
            return true;
        if (document.querySelector(`button  ${cssSelector}`) ||
            document.querySelector(`a  ${cssSelector}`) ||
            document.querySelector(`input  ${cssSelector}`) ||
            element.nodeName === "BUTTON" ||
            element.getAttribute("type") == "button" ||
            element.nodeName === "A" ||
            element.getAttribute("type") == "a" ||
            element.nodeName === "INPUT" ||
            element.getAttribute("type") == "input")
            return true;
        return false;
    }
    textInputHandler() { }
    mouseMoveHandler() { }
    scrollHandler() { }
    attachUnloadListener() {
        console.log("attachUnloadListener called");
        window.addEventListener("beforeunload", (e) => {
            console.log("navigating away form page.");
            localStorage.setItem("isContentScriptRecording", JSON.stringify(this.isActive));
        });
    }
    saveActionDetailsToStorage(newAction) {
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
const isContentScriptRecording = JSON.parse(localStorage.getItem("isContentScriptRecording"));
const actionRecorder = new ActionsRecorder();
actionRecorder.record();
if (isContentScriptRecording)
    actionRecorder.activate();
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log("contentscript onMessage called");
    if (request.message === "start-recording") {
        actionRecorder.activate();
    }
    if (request.message === "stop-recording") {
        actionRecorder.deActivate();
    }
    if (request.message === "get-recording-status") {
        const currentRecordingStatus = {
            status: "current-recording-status",
            payload: actionRecorder.isActive,
        };
        await sendRuntimeMessage(currentRecordingStatus);
    }
});
function getActionDescription(element) {
    if (!element) {
        console.warn("No element was provided: getActionDescription(missing --> element)");
        return "";
    }
    let description = "";
    if (element.textContent !== "" || element.textContent !== undefined)
        description = element.textContent;
    for (const attr of ["aria-label", "title", "placeholder"]) {
        if (element.getAttribute(attr))
            description = element.getAttribute(attr);
    }
    console.log("Action Description: ", description);
    return description;
}
async function sendRuntimeMessage(content) {
    try {
        await chrome.runtime.sendMessage(null, content);
    }
    catch (e) {
        console.warn("Error sending Message: ", "status: ", content.status, ", payload: ", content.payload, ", Error: ", e);
    }
}
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
export {};
