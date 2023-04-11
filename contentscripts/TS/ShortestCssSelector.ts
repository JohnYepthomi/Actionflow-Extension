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
