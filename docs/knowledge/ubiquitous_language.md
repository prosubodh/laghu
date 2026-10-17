# Ubiquitous language - laghu

Source of truth for laghu terminology: domain meaning plus the
exact code identifier. Terms mean exactly this and nothing else.

## Canonical Domain Vocabulary Matrix

| Canonical Term | Business Definition | Bounded Context | Forbidden Synonyms | Code & Database Identifiers |
|---|---|---|---|---|
| Island | A `data-scope` element hydrated in place with local state | Rendering | zone, region, widget-root | `data-scope`, `hydrate()` |
| Component | A `Laghu.define` custom element with per-instance state | Rendering | widget, control, plugin | `define()`, `SetupResult` |
| Scope | A state object, optionally chained to a parent scope | Reactivity | context, store (for local state) | `scope`, `Laghu.scope()` |
| Binding | One attribute-to-state wiring with its own effect | Rendering | hook, listener, subscription | `claimed()`, `eachEl` |
| Effect | A function re-run when read state changes | Reactivity | watcher, observer, subscriber | `effect()`, `Laghu.effect` |
| Store | A named global reactive object | State | global, singleton, cache | `Laghu.store()`, `$store` |
| Swap | Target HTML replacement plus rehydration | Data | render, inject, patch | `Laghu.swap()`, `swapHtml` |
| Morph | Opt-in in-place reconciliation preserving identity | Data | diff, vdom, reconcile | `LaghuMorph.morph()` |
| Trigger | A `data-trigger` firing rule with modifiers | Events | handler, hook | `parseTrigger()`, `bindTrigger()` |
| Directive | A `data-name` extension receiving context | Extensibility | plugin, mixin, behavior | `Laghu.directive()` |
| Filter | A named display transform for binding pipes | Rendering | pipe, formatter | `Laghu.filter()` |
| Route | A hash path pattern with params and guards | Navigation | page, view, screen | `LaghuRouter.route()` |
| Claim | Single-wiring guard against double binding | Rendering | lock, flag, marker | `claimed()`, `_bH` |
