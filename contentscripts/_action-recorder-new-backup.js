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
                const availableOptions = Array.from(select_el.options).map(op_el => op_el.textContent);
                const selectProps = {
                    Selected: selectedValue,
                    Options: availableOptions,
                    Description: this.isInteractionElement(select_el, cssSelector) ? getActionDescription(select_el) : "",
                };
                const selectAction = {
                    actionType: "Select",
                    props: { ...commonProps, ...selectProps },
                };
                const selectmsg = {
                    status: "new-recorded-action",
                    actionType: "Select",
                    payload: selectAction,
                };
                await sendRuntimeMessage(selectmsg);
                break;
            default:
                const clickProps = {
                    "Wait For New Page To load": false,
                    "Wait For File Download": false,
                    Description: this.isInteractionElement(el, cssSelector) ? getActionDescription(el) : "",
                };
                const clickAction = {
                    actionType: "Click",
                    props: { ...commonProps, ...clickProps },
                };
                const clickmsg = {
                    status: "new-recorded-action",
                    actionType: "Click",
                    payload: clickAction,
                };
                await sendRuntimeMessage(clickmsg);
                break;
        }
    }
    getNodeType(el) {
        if (el.nodeName === "BUTTON" || el?.getAttribute("type") == "button") {
            console.log("User clicked a Button: ", el.innerText);
            return 'Button';
        }
        else if (el.nodeName === "A" || el?.getAttribute("type") == "link") {
            console.log("User clicked a Link: ", el.href);
            return 'Link';
        }
        else if (el.nodeName === "INPUT" || el?.getAttribute("type") == "input") {
            console.log("User clicked an Input box: ", el.value);
            return 'Input';
        }
        else if (el.nodeName === 'SELECT' || el?.getAttribute("type") == "select") {
            console.log("User clicked on Select Node. Selected Option: ", el.value);
            return 'Select';
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
        if (!["INPUT", "TEXTAREA"].includes(el.nodeName) || IGNORE_INPUTS.includes(el_type_attr))
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
            actionType: "Type",
            payload: typeAction,
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
const chromeListener = async function (request, _sender, _sendResponse) {
    console.log("contentscript onMessage called");
    if (!chrome.runtime?.id) {
        console.log("chromeListener context invalidated. Removing listener...");
        chrome.runtime.onMessage.removeListener(chromeListener);
    }
    else if (request.message === "start-recording") {
        this.activate();
        await messageBackground({ message: "recording-started" });
    }
    else if (request.message === "stop-recording") {
        this.deActivate();
        await messageBackground({ message: "recording-stopped" });
    }
    else if (request.message === "compose-completed") {
        console.log("compose-completed chrome runtime called on firstContent script");
        localStorage.setItem("isComposeCompleted", "true");
        if (request.payload)
            localStorage.setItem("composeData", JSON.stringify(request.payload));
    }
    else if (request.message === "find-list-structure"){
        
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
    await messageBackground({ message: 'launch-extension' });
    const isContentScriptRecording = await messageBackground({ message: 'bg-recording-status' });
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
