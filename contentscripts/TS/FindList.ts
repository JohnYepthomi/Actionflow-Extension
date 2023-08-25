class FindColParent {
  static siblings: Element[] | undefined;
  static hoverEl: Element;
  static finalCandidate: Element;
  // static prevCounterEls = [];
  // static scrollContainers: [];
  static isActive = false;

  static searchListStructure(candidate: HTMLElement | null) {
    if (!candidate) {
      console.log("No Candidates passed, No More Candidate(ColParent).");
      return;
    }

    this.hoverEl = candidate;
    this.find(candidate);

    return this.siblings;
  }

  static find(candidate: Element) {
    const sibs: HTMLCollection | undefined = candidate?.parentElement?.children;
    const filteredSibs = sibs
      ? Array.from(sibs).filter((s) => filterNode(s))
      : undefined;

    if (!sibs || sibs.length < 2) {
      return this.searchListStructure(candidate?.parentElement);
    } else if (
      ValidateListStructure.isListElement(filteredSibs) ||
      ValidateListStructure.validateSiblings(filteredSibs)
    ) {
      if (sibs.length > 2 && filteredSibs && filteredSibs.length < 3)
        return this.searchListStructure(candidate?.parentElement);

      this.finalCandidate = candidate;
      this.siblings = filteredSibs;
      console.log("FINAL CANDIDATE: ", candidate);
    } else {
      return this.searchListStructure(candidate?.parentElement);
    }
  }

  static addListStructureOverlay() {
    if (!this.siblings) return;

    const prevHighlightEls = document.querySelectorAll(
      ".list-item-highlight-shadow-root"
    );
    if (prevHighlightEls) {
      prevHighlightEls.forEach((el) => {
        el.remove();
      });
    }

    Array.from(this.siblings).forEach((node: Element) => {
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
    spanEl.addEventListener("click", () => {
      console.log("overlayEl clicked!");
      removeDocumentHoverListener();
    });
  }

  static removeAllOverlays() {
    const prevHighlightEls = document.querySelectorAll(
      ".list-item-highlight-shadow-root"
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

    changeCursorStyle("auto");
  }
}

class ValidateListStructure {
  static validate(candidate: Element) {
    return this.level1(candidate) && this.level2(candidate) ? true : false;
  }

  static isListElement(sibs: Element[] | undefined) {
    if (!Array.isArray(sibs)) return;
    return sibs.some((sib) => sib.tagName === "LI");
  }

  static validateByChildExistence(sibs: Element[] | undefined) {
    // This won't work because there can be some sibling
    // that have no children while some siblings have children
    // yet be part of a list structure.

    if (sibs)
      return (
        sibs.some((sib) => sib.childElementCount > 0) &&
        sibs.every((sib) => sib.childElementCount > 0)
      );
  }

  static validateSiblings(sibs: Element[] | undefined) {
    if (!Array.isArray(sibs)) return;

    let FOUND = false;
    let sibsLen = sibs.length - 1;
    let truecount = 0;

    for (let i = 0; i <= sibsLen; i++) {
      if (FOUND) break;
      if (!FOUND) {
        if (this.validate(sibs[i])) {
          FOUND = true;
          truecount++;
        }
      }
    }

    // console.log("truecount: ", truecount) ;
    if (FOUND) return true;
    else return false;
  }

  static level1(candidate: Element) {
    const c1 = candidate?.childElementCount;
    let c2 = candidate?.nextElementSibling?.childElementCount;

    if (c2 !== 0 && !c2) {
      c2 = candidate?.previousElementSibling?.childElementCount;
    }

    return c1 === c2 ? true : false;
    // c1 && c2 &&
  }

  static level2(candidate: Element) {
    const Nodes1 = candidate?.firstElementChild?.children;
    let Nodes2 = candidate?.nextElementSibling?.firstElementChild?.children;

    if (!Nodes1 && !Nodes2) return true;

    if (!Nodes2) {
      Nodes2 = candidate?.previousElementSibling?.firstElementChild?.children;
    }

    if (Nodes1 && Nodes2 && Nodes1.length === 0 && Nodes2.length === 0) {
      return true;
    }

    if (Nodes1 && Nodes2 && Nodes1?.length === Nodes2?.length) {
      if (this.validateByTags(Nodes1, Nodes2)) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  static validateByTags(n1: HTMLCollection, n2: HTMLCollection) {
    if (n1.length !== n2.length) return false;

    let len = n1.length - 1;
    let trueCount = 0;

    for (let i = 0; i < len; i++) {
      if (n1[i].tagName === n2[i].tagName) {
        trueCount++;
      }
    }

    if (trueCount === len) return true;
    else return false;
  }

  static hasSibling(el: Element) {
    if (!el) return;

    return el.previousElementSibling || el.nextElementSibling ? true : false;
  }
}

//find only the items that have duplicates
// function FindDuplicateItems(arry) {
//   const uniqueElements = new Set(arry);
//   const filteredElements = arry.filter((item) => {
//     if (uniqueElements.has(item)) {
//       uniqueElements.delete(item);
//     } else {
//       return item;
//     }
//   });

//   return [...new Set(filteredElements)];
// }

// function getHoverText(el) {
//   if (!el) {
//     return;
//   }

//   let excludeTags = [
//     "B",
//     "STRONG",
//     "I",
//     "EM",
//     "MARK",
//     "SMALL",
//     "DEL",
//     "INS",
//     "SUB",
//     "SUP",
//     "SPAN", // including span tag since some websites include span where you only expect #textnode eg. Amazon product price element would have span  tags seperating "dollars" from "cents" each with it sown span tag
//   ];

//   const children: HTMLElement[] = el.children;
//   /* If the element does not have any  */
//   const filteredNodes = Array.from(children).filter(
//     (n: HTMLElement) => !excludeTags.includes(n.tagName)
//   );
//   const filteredCount = filteredNodes.length;

//   // console.log("filteredNodes: ", filteredNodes);
//   // console.log("hoverEl children: ", children);

//   if (filteredCount === 0) {
//     return el?.innerText?.trim();
//   } else {
//     // console.log("DirtyText: ", el?.textContent?.trim(), ", el: ", el);
//     return null;
//   }
// }

// function highlightHoverEl(e, remove = false) {
//   // if (remove) {
//   //   const col_highlight_els = document.querySelectorAll("#column-highlight");
//   //   console.log("col_highlight_els: ", col_highlight_els);

//   //   Array.from(col_highlight_els).forEach((e) => {
//   //     console.log("removing highlight col");
//   //     e?.remove();
//   //   });
//   // } else if (e && !remove) {
//   //   createColumnHighlight(e);
//   // }

//   if (remove && e) e.style = "";
//   else if (e && !remove)
//     e.style =
//       "background: rgb(38 204 72 / 84%); color: white; border-radius: 3px;";
// }

// function getElementByXpath(path, node) {
//   return document.evaluate(
//     path,
//     node ? node : document,
//     null,
//     XPathResult.FIRST_ORDERED_NODE_TYPE,
//     null
//   ).singleNodeValue;
// }

// function FilterUndefined(query) {
//   return query ? query : "NA";
// }

// const areSiblings = (elm1, elm2) =>
//   elm1 !== elm2 && elm1.parentNode === elm2.parentNode;

// function createHoverControlUI(hoverEl) {
//   document.body.style.position = "relative;";
//   const HTML = `<div style="position: absolute; z-index: 999999999999999; height: 150px; width: 150px; padding: 7px;  top: 0; left: 0;"><button style="padding: 5px; background: green; color: white;" id="my-hover-button-up">Up One Level</button><button style="padding: 5px; background: red; color: white;" id="my-hover-button-down">down One Level</button><button style="padding: 5px; background: orange; color: black;" id="toggle-hover"> Activate hover</button></div>`;
//   const body = document.body;
//   document.body.insertAdjacentHTML("beforeend", HTML);

//   const upEl = body.querySelector("#my-hover-button-up");
//   const downEl = body.querySelector("#my-hover-button-down");
//   const activateHover = body.querySelector("#toggle-hover");

//   upEl?.addEventListener("click", () => {
//     console.log(
//       "up level called with FindColParent.finalCandidate: ",
//       FindColParent.finalCandidate
//     );
//     if (FindColParent.finalCandidate) {
//       FindColParent.find(FindColParent.finalCandidate.parentElement!);
//     }
//   });
//   downEl?.addEventListener("click", () => {
//     if (FindColParent.finalCandidate)
//       FindColParent.find(FindColParent.finalCandidate.firstElementChild!);
//   });
//   activateHover?.addEventListener("click", () => {
//     document.removeEventListener("mousemove", handleDocumentHover);
//     document.addEventListener("mousemove", handleDocumentHover);
//   });
// }

// function getAbsoluteXPath(node) {
//   var comp: any = [];
//   var comps: any = [];
//   var parent = null;
//   var xpath = "";
//   var getPos = function (node) {
//     var position = 1,
//       curNode;
//     if (node.nodeType === Node.ATTRIBUTE_NODE) {
//       return null;
//     }
//     for (
//       curNode = node.previousSibling;
//       curNode;
//       curNode = curNode.previousSibling
//     ) {
//       if (curNode.nodeName === node.nodeName) {
//         ++position;
//       }
//     }
//     return position;
//   };

//   if (node instanceof Document) {
//     return "/";
//   }

//   for (
//     ;
//     node && !(node instanceof Document);
//     node =
//       node.nodeType === Node.ATTRIBUTE_NODE
//         ? node.ownerElement
//         : node.parentNode
//   ) {
//     comp = comps[comps.length] = {};

//     /*eslint default-case: "error"*/
//     switch (node.nodeType) {
//       case Node.TEXT_NODE:
//         comp.name = "text()";
//         break;
//       case Node.ATTRIBUTE_NODE:
//         comp.name = "@" + node.nodeName;
//         break;
//       case Node.PROCESSING_INSTRUCTION_NODE:
//         comp.name = "processing-instruction()";
//         break;
//       case Node.COMMENT_NODE:
//         comp.name = "comment()";
//         break;
//       case Node.ELEMENT_NODE:
//         comp.name = node.nodeName;
//         break;
//       // No Default
//     }
//     comp.position = getPos(node);
//   }

//   for (var i = comps.length - 1; i >= 0; i--) {
//     comp = comps[i];
//     xpath += "/" + comp.name;
//     if (comp.position != null) {
//       xpath += "[" + comp.position + "]";
//     }
//   }

//   return xpath;
// }

// function getRealtiveXPathToChild(childNode, mainNode, Tags) {
//   try {
//     const mainParent = mainNode.parentNode;
//     const currParent = childNode.parentNode;
//     let currTag = childNode?.tagName;
//     Tags = Tags ? Tags : [];

//     if (currParent && mainParent !== currParent) {
//       var els = currParent.querySelectorAll(`:scope > ${currTag}`);

//       els.forEach((el, idx) => {
//         if (els.length > 1 && el === childNode) {
//           currTag += "[" + (idx + 1) + "]";
//         }
//       });

//       if (currTag) Tags.push(currTag);
//       return this.getRealtiveXPathToChild(currParent, mainNode, Tags);
//     }

//     return Tags.reverse().join("/");
//   } catch (e) {
//     console.log({
//       childNode,
//       Tags,
//       mainNode,
//     });
//     throw new Error(
//       "Error getting relativePath to child. Expected arguments (childNode, parentNode)"
//     );
//   }
// }

/* Listeners */
function addDocumentHoverListener() {
  document.addEventListener("mousemove", handleDocumentHover);
}

function removeDocumentHoverListener() {
  console.log("removeDocumentHoverListener called");
  document.removeEventListener("mousemove", handleDocumentHover);
}

let prevHoverElement;
function handleDocumentHover(e: any) {
  if (prevHoverElement === e.target) {
    console.log("ignoring hover handler");
    // , e.target
    return;
  }

  FindColParent.searchListStructure(e.target);
  FindColParent.addListStructureOverlay();
  prevHoverElement = e.target;
}

function filterNode(node) {
  const height = node.getBoundingClientRect().height;
  const visibility = window.getComputedStyle(node, null).visibility;
  const display = window.getComputedStyle(node, null).display;

  // console.log(`%c Height: ${height}, visibility: ${visibility}, display: ${display}`, "color: orange; font-weight: bold;");

  return height > 5 && visibility === "visible" && display !== "none";
}

// function trueElementFromPointWithinCol(x, y, ColParent) {
//   let result;
//   if (ColParent) {
//     const all: NodeListOf<HTMLElement> = ColParent.getElementsByTagName("*");
//     Array.from(all).forEach((el: HTMLElement) => {
//       const bb = el.getBoundingClientRect();
//       if (isPointWithinBoundingBox(x, y, bb)) {
//         result = el;
//       }
//     });
//   }

//   return result;
// }

// function getColParentFromPoint(x, y) {
//   const ColParent = FindColParent.finalCandidate;
//   if (ColParent) {
//     const sibs = ColParent.parentElement?.children;
//     let result: Element | null = null;
//     if (sibs)
//       Array.from(sibs).forEach((sib) => {
//         const bb = sib.getBoundingClientRect();
//         if (isPointWithinBoundingBox(x, y, bb)) {
//           result = sib;
//         }
//       });

//     return result;
//   }
// }

// function isPointWithinBoundingBox(x, y, bb) {
//   return bb.top <= y && y <= bb.bottom && bb.left <= x && x <= bb.right
//     ? true
//     : false;
// }

// function createColumnHighlight(node) {
//   if (!node) return;

//   const rect = node.getBoundingClientRect();
//   console.log({
//     rect,
//   });
//   const factor = 0;
//   const wrapper = document.createElement("span");
//   wrapper.style.position = "absolute";
//   wrapper.style.height = `${rect.height + factor + 0}px`;
//   wrapper.style.width = `${rect.width + factor + 0}px`;
//   wrapper.style.top = `${rect.y - factor}px`;
//   wrapper.style.left = `${rect.x - factor}px`;
//   wrapper.style.zIndex = "999999999";
//   wrapper.style.border = "1px dashed red";
//   // wrapper.style.fontSize = "0.9rem";
//   // wrapper.style.display = "flex";
//   // wrapper.style.alignItems = "center";
//   // wrapper.style.justifyContent = "center";
//   // wrapper.style.backgroundColor = "purple";
//   // wrapper.style.color = "white !important";
//   // wrapper.textContent = node.textContent;

//   const spaneEl = document.createElement("span");
//   spaneEl.id = "column-highlight";

//   document.body.appendChild(spaneEl);
//   const shadow = spaneEl.attachShadow({
//     mode: "open",
//   });
//   shadow.appendChild(wrapper);
// }

// function getAllScrollContainers() {
//   let scrollContainers: any = {
//     auto: [],
//     scroll: [],
//   };

//   Array.from(document.querySelectorAll("*")).forEach((element) => {
//     const style = window.getComputedStyle(element);
//     // if (element.scrollHeight > element.clientHeight) {
//     if (style.overflowY === "auto") scrollContainers.auto.push(element);
//     else if (style.overflowY === "scroll")
//       scrollContainers.scroll.push(element);
//     // }
//   });

//   return scrollContainers;
// }

function addListItemListeners() {
  console.log("adding scroll listener to window");
  window.addEventListener("scroll", (e) => {
    if (FindColParent.isActive) {
      FindColParent.addListStructureOverlay();
    }
  });
  document.addEventListener(
    "click",
    (e) => {
      if (FindColParent.isActive) {
        e.stopPropagation();
        e.preventDefault();
        FindColParent.isActive = false;
        FindColParent.removeAllOverlays();
        removeDocumentHoverListener();
      }
    },
    true
  );
}

function changeCursorStyle(cursorType = "crosshair") {
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
}

FindColParent.addPageOverlay();
FindColParent.isActive = true;
changeCursorStyle();
// addColListeners();
// createHoverControlUI();
addDocumentHoverListener();
addListItemListeners();
