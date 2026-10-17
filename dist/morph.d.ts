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
    morph(target: Element, html: string, opts?: {
        mode?: string;
    }): void;
    morphEl(a: Element, b: Element): void;
    version: string;
}
export declare const LaghuMorph: LaghuMorphAPI;
