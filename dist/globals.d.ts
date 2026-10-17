/**
 * Script-tag globals and the npm typing entry.
 *
 * JSR rejects global augmentations, so the `declare global` blocks that
 * used to sit in each module live here instead. This file is outside the
 * published JSR module graph, while the emitted `dist/globals.d.ts`
 * re-exports the API surface and adds `window.Laghu` (and friends) for
 * `<script>` users.
 */
import type { LaghuAPI } from "./laghu";
import type { LaghuMorphAPI } from "./morph";
import type { LaghuRouterAPI } from "./router";
import type { LaghuValidateAPI } from "./validate";
export * from "./laghu";
export * from "./morph";
export * from "./router";
export * from "./validate";
declare global {
    interface Window {
        Laghu: LaghuAPI;
        __LAGHU_DEV__?: boolean;
        LaghuRouter?: LaghuRouterAPI;
        LaghuMorph?: LaghuMorphAPI;
        LaghuValidate?: LaghuValidateAPI;
    }
    interface Element {
        _bcu?: Array<Function>;
        _bH?: Record<string, number>;
        _bReq?: any;
        _bReqs?: Set<any>;
        _bN?: number;
        _bScope?: any;
        _bActions?: Record<string, Function>;
        _bInit?: boolean;
        _bPend?: Record<string, string | null> | null;
        _bOnUnmount?: Function;
    }
    interface HTMLElement {
        _bcu?: Array<Function>;
        _bH?: Record<string, number>;
        _bT?: number;
        _bHide?: boolean;
        _bVal?: boolean;
        _bValForm?: boolean;
        _bTried?: boolean;
        _bTouched?: boolean;
    }
}
