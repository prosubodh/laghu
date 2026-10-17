"use strict";
(() => {
  // src/morph.ts
  var LaghuMorph = (() => {
    "use strict";
    function syncFormControls(liveElement, responseElement) {
      const isControl = liveElement instanceof HTMLInputElement || liveElement instanceof HTMLTextAreaElement || liveElement instanceof HTMLSelectElement;
      if (!isControl) return;
      const responseValue = responseElement.value;
      const isUnfocused = document.activeElement !== liveElement;
      if (responseValue !== void 0 && liveElement.value !== responseValue && isUnfocused) {
        liveElement.value = responseValue;
      }
      const responseChecked = responseElement.checked;
      if (responseChecked !== void 0) {
        liveElement.checked = responseChecked;
      }
    }
    function syncAttrs(liveElement, responseElement) {
      const responseAttrs = responseElement.attributes;
      const liveAttrs = liveElement.attributes;
      const keepAttributeNames = /* @__PURE__ */ new Set();
      for (let index = 0; index < responseAttrs.length; index++) {
        const attribute = responseAttrs[index];
        keepAttributeNames.add(attribute.name);
        if (liveElement.getAttribute(attribute.name) !== attribute.value) {
          liveElement.setAttribute(attribute.name, attribute.value);
        }
      }
      const attributesToRemove = [];
      for (let index = 0; index < liveAttrs.length; index++) {
        const name = liveAttrs[index].name;
        if (!keepAttributeNames.has(name)) {
          attributesToRemove.push(name);
        }
      }
      attributesToRemove.forEach((attributeName) => {
        liveElement.removeAttribute(attributeName);
      });
      syncFormControls(liveElement, responseElement);
    }
    function keyOf(element) {
      if (element.id) return "#" + element.id;
      const customKey = element.getAttribute && element.getAttribute("data-bkey");
      if (customKey) return "k:" + customKey;
      return null;
    }
    function removeStaleChildren(liveParent, usedNodes) {
      const existingChildren = Array.prototype.slice.call(liveParent.childNodes);
      existingChildren.forEach((childNode) => {
        if (childNode instanceof Element) {
          if (!usedNodes.has(childNode) && liveParent.contains(childNode)) {
            try {
              const laghuInstance = window.Laghu;
              if (laghuInstance && laghuInstance.destroyTree) {
                laghuInstance.destroyTree(childNode);
              }
            } catch {
            }
            liveParent.removeChild(childNode);
          }
        } else if (childNode.nodeType === 3) {
          liveParent.removeChild(childNode);
        }
      });
    }
    function findPositionalMatch(liveParent, targetTagName, usedNodes) {
      const liveChildren = liveParent.children;
      for (let index = 0; index < liveChildren.length; index++) {
        const candidate = liveChildren[index];
        if (!usedNodes.has(candidate) && candidate.tagName === targetTagName && !keyOf(candidate)) {
          return candidate;
        }
      }
      return null;
    }
    function morphEl(liveElement, responseElement) {
      if (liveElement instanceof Element && liveElement.hasAttribute && liveElement.hasAttribute("data-morph-skip")) {
        return;
      }
      if (liveElement.tagName !== responseElement.tagName) {
        liveElement.replaceWith(responseElement.cloneNode(true));
        return;
      }
      syncAttrs(liveElement, responseElement);
      const liveChildByKey = /* @__PURE__ */ new Map();
      Array.prototype.forEach.call(liveElement.children, (childElement) => {
        const childKey = keyOf(childElement);
        if (childKey && !liveChildByKey.has(childKey)) {
          liveChildByKey.set(childKey, childElement);
        }
      });
      const newChildren = Array.prototype.slice.call(responseElement.childNodes);
      const usedNodes = /* @__PURE__ */ new Set();
      const reconciledChildren = [];
      newChildren.forEach((newChildNode) => {
        if (newChildNode.nodeType === 3) {
          if (newChildNode.textContent !== null && newChildNode.textContent.trim() !== "") {
            const freshTextNode = document.createTextNode(newChildNode.textContent);
            reconciledChildren.push(freshTextNode);
          }
          return;
        }
        if (!(newChildNode instanceof Element)) {
          reconciledChildren.push(newChildNode.cloneNode(true));
          return;
        }
        const nodeKey = keyOf(newChildNode);
        const matchedLiveNode = nodeKey ? liveChildByKey.get(nodeKey) : null;
        if (matchedLiveNode && !usedNodes.has(matchedLiveNode)) {
          usedNodes.add(matchedLiveNode);
          if (matchedLiveNode.tagName !== newChildNode.tagName) {
            const replacementClone = newChildNode.cloneNode(true);
            matchedLiveNode.replaceWith(replacementClone);
            usedNodes.add(replacementClone);
            reconciledChildren.push(replacementClone);
          } else {
            morphEl(matchedLiveNode, newChildNode);
            reconciledChildren.push(matchedLiveNode);
          }
        } else {
          const positionalMatch = findPositionalMatch(liveElement, newChildNode.tagName, usedNodes);
          if (positionalMatch) {
            usedNodes.add(positionalMatch);
            morphEl(positionalMatch, newChildNode);
            reconciledChildren.push(positionalMatch);
          } else {
            reconciledChildren.push(newChildNode.cloneNode(true));
          }
        }
      });
      removeStaleChildren(liveElement, usedNodes);
      reconciledChildren.forEach((childNode) => {
        liveElement.appendChild(childNode);
      });
    }
    function morph(target, html, opts) {
      const mode = opts && opts.mode || "inner";
      const template = document.createElement("template");
      template.innerHTML = html;
      if (mode === "outer") {
        const responseRoot = template.content.firstElementChild || template.content.cloneNode(true);
        if (responseRoot instanceof Element && target instanceof Element) {
          morphEl(target, responseRoot);
        } else {
          target.replaceWith(template.content.cloneNode(true));
        }
        return;
      }
      const wrapperTag = target.tagName.toLowerCase() === "ul" || target.tagName === "OL" ? "ul" : "div";
      const wrapper = document.createElement(wrapperTag);
      wrapper.appendChild(template.content.cloneNode(true));
      const fakeContainer = document.createElement(target.tagName);
      Array.prototype.forEach.call(target.attributes, (attr) => {
        fakeContainer.setAttribute(attr.name, attr.value);
      });
      Array.prototype.forEach.call(wrapper.childNodes, (node) => {
        fakeContainer.appendChild(node.cloneNode(true));
      });
      morphEl(target, fakeContainer);
    }
    const api = {
      morph,
      morphEl,
      version: "1.0.0"
    };
    return api;
  })();

  // src/morph.global.ts
  window.LaghuMorph = LaghuMorph;
})();
