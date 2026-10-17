// @ts-check
/**
 * laghu morph plugin (opt-in, separate file, own 3kB gzip budget).
 *
 * What it does: updates the DOM in place instead of replacing it.
 * Nodes with the same id or data-bkey are reused and moved, so input
 * focus, caret, scroll, video playback, and component instances survive
 * an HTML swap. Unknown nodes fall back to positional reuse by tag name.
 *
 * When to use it: lists and tables fed by the server where a plain
 * inner swap would lose focus or reset state. For static content the
 * default destructive swap is cheaper and simpler.
 *
 * Rules: give stable rows an id or data-bkey. Mark frozen subtrees
 * with data-morph-skip (children included). The core data-preserve
 * rule still applies on top.
 *
 * Load AFTER laghu.js. Registers window.LaghuMorph. The core picks it
 * up automatically for data-swap="morph:inner" and "morph:outer".
 *
 * @example
 * <script src="laghu.min.js"></script>
 * <script src="morph.min.js"></script>
 * <ul id="list" data-get="/rows" data-target="#list" data-swap="morph:inner">
 *   <li id="r1">one</li>
 * </ul>
 */
export interface LaghuMorphAPI {
  morph(target: Element, html: string, opts?: { mode?: string }): void;
  morphEl(liveElement: Element, responseElement: Element): void;
  version: string;
}

export const LaghuMorph: LaghuMorphAPI = (() => {
  "use strict";

  /**
   * Sync form control values and checked state without overwriting active user typing.
   */
  function syncFormControls(liveElement: Element, responseElement: Element): void {
    const isControl =
      liveElement instanceof HTMLInputElement ||
      liveElement instanceof HTMLTextAreaElement ||
      liveElement instanceof HTMLSelectElement;

    if (!isControl) return;

    const responseValue = (responseElement as HTMLInputElement).value;
    const isUnfocused = document.activeElement !== liveElement;
    if (
      responseValue !== undefined &&
      (liveElement as HTMLInputElement).value !== responseValue &&
      isUnfocused
    ) {
      (liveElement as HTMLInputElement).value = responseValue;
    }
    const responseChecked = (responseElement as HTMLInputElement).checked;
    if (responseChecked !== undefined) {
      (liveElement as HTMLInputElement).checked = responseChecked;
    }
  }

  /**
   * Copy attributes from the new node onto the live node, remove stale
   * ones, and sync form control state without touching focused inputs.
   */
  function syncAttrs(liveElement: Element, responseElement: Element): void {
    const responseAttrs = responseElement.attributes;
    const liveAttrs = liveElement.attributes;
    const keepAttributeNames = new Set<string>();

    for (let index = 0; index < responseAttrs.length; index++) {
      const attribute = responseAttrs[index];
      keepAttributeNames.add(attribute.name);
      if (liveElement.getAttribute(attribute.name) !== attribute.value) {
        liveElement.setAttribute(attribute.name, attribute.value);
      }
    }

    const attributesToRemove: string[] = [];
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

  /**
   * Stable identity of an element for reuse across morphs.
   * Element id wins ("#r1"), then data-bkey ("k:42"), else null
   * (positional reuse by tag name).
   */
  function keyOf(element: Element): string | null {
    if (element.id) return "#" + element.id;
    const customKey = element.getAttribute && element.getAttribute("data-bkey");
    if (customKey) return "k:" + customKey;
    return null;
  }

  /**
   * Remove stale children that were not reused in the new reconciliation cycle.
   */
  function removeStaleChildren(liveParent: Element, usedNodes: Set<Node>): void {
    const existingChildren = Array.prototype.slice.call(liveParent.childNodes);
    existingChildren.forEach((childNode: Node) => {
      if (childNode instanceof Element) {
        if (!usedNodes.has(childNode) && liveParent.contains(childNode)) {
          try {
            const laghuInstance = (window as any).Laghu;
            if (laghuInstance && laghuInstance.destroyTree) {
              laghuInstance.destroyTree(childNode);
            }
          } catch {}
          liveParent.removeChild(childNode);
        }
      } else if (childNode.nodeType === 3) {
        liveParent.removeChild(childNode);
      }
    });
  }

  /**
   * Find an unkeyed live element matching the tag for positional reuse.
   */
  function findPositionalMatch(
    liveParent: Element,
    targetTagName: string,
    usedNodes: Set<Node>,
  ): Element | null {
    const liveChildren = liveParent.children;
    for (let index = 0; index < liveChildren.length; index++) {
      const candidate = liveChildren[index];
      if (!usedNodes.has(candidate) && candidate.tagName === targetTagName && !keyOf(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * Reconcile one live element against one fresh element, recursively.
   */
  function morphEl(liveElement: Element, responseElement: Element): void {
    if (
      liveElement instanceof Element &&
      liveElement.hasAttribute &&
      liveElement.hasAttribute("data-morph-skip")
    ) {
      return;
    }
    if (liveElement.tagName !== responseElement.tagName) {
      liveElement.replaceWith(responseElement.cloneNode(true));
      return;
    }
    syncAttrs(liveElement, responseElement);

    // Reconcile children by key, then positionally
    const liveChildByKey = new Map<string, Element>();
    Array.prototype.forEach.call(liveElement.children, (childElement: Element) => {
      const childKey = keyOf(childElement);
      if (childKey && !liveChildByKey.has(childKey)) {
        liveChildByKey.set(childKey, childElement);
      }
    });

    const newChildren = Array.prototype.slice.call(responseElement.childNodes);
    const usedNodes = new Set<Node>();
    const reconciledChildren: Node[] = [];

    newChildren.forEach((newChildNode: Node) => {
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
          const replacementClone = newChildNode.cloneNode(true) as Element;
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

  /**
   * Morph a target from an HTML string. Mode "inner" (default) reconciles
   * children. Mode "outer" reconciles the target element itself.
   */
  function morph(target: Element, html: string, opts?: { mode?: string }): void {
    const mode = (opts && opts.mode) || "inner";
    const template = document.createElement("template");
    template.innerHTML = html;

    if (mode === "outer") {
      const responseRoot =
        template.content.firstElementChild || template.content.cloneNode(true);
      if (responseRoot instanceof Element && target instanceof Element) {
        morphEl(target, responseRoot);
      } else {
        target.replaceWith(template.content.cloneNode(true));
      }
      return;
    }

    const wrapperTag =
      target.tagName.toLowerCase() === "ul" || target.tagName === "OL" ? "ul" : "div";
    const wrapper = document.createElement(wrapperTag);
    wrapper.appendChild(template.content.cloneNode(true));

    const fakeContainer = document.createElement(target.tagName);
    Array.prototype.forEach.call(target.attributes, (attr: Attr) => {
      fakeContainer.setAttribute(attr.name, attr.value);
    });
    Array.prototype.forEach.call(wrapper.childNodes, (node: Node) => {
      fakeContainer.appendChild(node.cloneNode(true));
    });

    morphEl(target, fakeContainer);
  }

  const api: LaghuMorphAPI = {
    morph,
    morphEl,
    version: "1.0.0",
  };
  return api;
})();
