# laghu.js

laghu.js is a tiny front-end helper for small pages. It adds reactivity,
reusable components, and declarative data fetching to plain HTML, using
only the browser. There is no build step, no JSX, and no TypeScript
compiler. You add one script tag and write normal HTML.

The name "laghu" is a Sanskrit word for light and small. That is the
whole idea: a light tool for pages that do not need a heavy framework.

Contents:

- [1. When to use laghu](#1-when-to-use-laghu)
- [2. Quick start](#2-quick-start)
- [3. Loading from a CDN](#3-loading-from-a-cdn)
- [4. Core concepts](#4-core-concepts)
- [5. HTML attribute reference](#5-html-attribute-reference)
- [6. JavaScript API reference](#6-javascript-api-reference)
- [7. Events reference](#7-events-reference)
- [8. Fetching data (JSON and HTML)](#8-fetching-data-json-and-html)
- [9. The morph plugin](#9-the-morph-plugin)
- [10. Type safety without TypeScript](#10-type-safety-without-typescript)
- [11. Content Security Policy notes](#11-content-security-policy-notes)
- [12. Loading flash and SEO notes](#12-loading-flash-and-seo-notes)
- [13. File sizes](#13-file-sizes)
- [14. Worked examples](#14-worked-examples)
- [15. Checking your setup](#15-checking-your-setup)
- [16. Troubleshooting](#16-troubleshooting)
- [17. Project files](#17-project-files)
- [18. Roadmap (explicit non-goals included)](#18-roadmap-explicit-non-goals-included)

## 1. When to use laghu

Use laghu when your page is mostly static HTML with a few interactive
parts: counters, toggles, tabs, a list rendered from JSON, a form that
posts and shows a result, a search box with live results.

Do not use laghu when you need client-side routing with auth guards,
offline sync, huge editable tables, canvas editors, or a large team
hiring for React or Vue skills. At that size, graduate to Svelte,
Solid, Astro islands, React, or Vue.

## 2. Quick start

Step 1. Save this as index.html and open it by double-clicking
(no server needed):

```html
<!doctype html>
<meta charset="utf-8">
<title>counter</title>
<style>
  counter-widget:not(:defined) { visibility: hidden; }
</style>

<counter-widget>
  <p>Count: <strong data-bind="count">0</strong></p>
  <button data-click="increment">Add one</button>
</counter-widget>

<script src="laghu.min.js"></script>
<script>
  Laghu.define('counter-widget', function () {
    return {
      state: { count: 0 },
      actions: {
        increment: function () { this.count++; }
      }
    };
  });
</script>
```

Step 2. Open the file in a browser. The button adds one per click.

What happened: `Laghu.define` registered a real custom element.
When the element connected, laghu made `{ count: 0 }` reactive,
mapped `data-bind="count"` to the `strong` node, and attached the
click handler. When state changes, only that `strong` node updates.

## 3. Loading from a CDN

A direct GitHub link does not work as a script source. A page address
like `github.com/.../blob/...` serves HTML, and
`raw.githubusercontent.com` serves plain text, which browsers refuse
to run as a script.

Use jsDelivr instead. It serves files with the correct
JavaScript content type. Two flavors, pick one per page:

npm package (preferred, versioned by the registry):

```html
<script src="https://cdn.jsdelivr.net/npm/laghu@1.0.0/dist/laghu.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/laghu@1.0.0/dist/morph.min.js"></script>
```

GitHub release files (works without any registry):

```html
<script src="https://cdn.jsdelivr.net/gh/prosubodh/laghu@v1.0.0/dist/laghu.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/prosubodh/laghu@v1.0.0/dist/morph.min.js"></script>
```

With a bundler or Node tooling:

```sh
npm install laghu
```

Rules for production pages:

- Always pin a version (`@v1.0.0`). Never use `@master`, because
  branch content moves and caches shift under you.
- When a new laghu release comes out, move the version number
  forward deliberately after testing.
- For extra safety, add a Subresource Integrity hash to the tag so
  the browser rejects a changed file.
- For local development with no internet, download the two files
  next to your HTML and reference them relatively:
  `<script src="laghu.min.js"></script>`.

Long term, publishing the `laghu` package to npm (the name is free
at the time of writing) unlocks versioned CDN paths such as
`cdn.jsdelivr.net/npm/laghu@1.0.0/...` plus automated update tools.

## 4. Core concepts

State is a plain object. Actions are plain functions that run with
the state as `this`. Bindings are HTML attributes that connect state
to the DOM. Scopes decide which state a binding reads.

There are two ways to use laghu, sharing one engine:

- Islands: any element with `data-scope='{"count": 0}'` becomes an
  independent reactive area, hydrated automatically on page load.
  Good for sprinkling behavior onto server-rendered pages.
- Components: `Laghu.define('my-tag', setup)` registers a custom
  element. Each instance gets fresh state from `setup()`. Good for
  repeated widgets.

Effects are the glue. Each binding creates one effect that re-runs
when state it read changes. Writes batch in a microtask, so ten
synchronous writes cause one DOM update.

Cleanup is automatic. Every binding registers its teardown on its
element. Removing nodes, swapping HTML, or disconnecting a component
stops effects, detaches listeners, clears timers and observers, and
aborts in-flight fetches.

## 5. HTML attribute reference

### data-scope

Marks an island and carries its initial state as JSON (double quotes
required, because JSON keeps the parser small and CSP-safe).

```html
<div data-scope='{"count": 0, "user": {"name": "Ada"}}'>
  <span data-bind="count"></span>
</div>
```

Islands hydrate automatically when the document is ready. To hydrate
manually and keep the state handle:

```js
var root = document.querySelector('[data-scope]');
var state = Laghu.hydrate(root, { count: 0 });
state.count = 5; // bound nodes update shortly after
```

### data-bind and data-text

One-way text binding. Same behavior, two spellings. Sets
`textContent`, so values are never parsed as HTML (safe by default).
Append `| filter[:arg]` pipes for display formatting; `||` stays
logical-or.

```html
<span data-bind="user.name"></span>
<span data-text="count"></span>
<span data-bind="price | currency"></span>
<span data-bind="nick | default:'anon'"></span>
```

Built-in filters: `uppercase`, `lowercase`, `json`, `fixed`,
`currency`, `date`, `default`, `join`, `length`. Register more
with `Laghu.filter(name, fn)`; unknown names warn in development
and pass the value through.

### data-html

Renders a value as HTML. Explicit opt-in because HTML parsing is an
XSS risk. Content passes through the baseline sanitizer, replaceable
with `Laghu.sanitize` (DOMPurify for untrusted sources). Prefer
`data-bind` unless you trust the source.

```html
<div data-html="post.body"></div>
```

### data-bind:attr

Binds any attribute to an expression. Removing values (`false`,
`null`, `undefined`) remove the attribute.

```html
<a data-bind:href="user.url">profile</a>
<img data-bind:src="photo.src" data-bind:alt="photo.alt">
<button data-bind:disabled="!form.valid">Save</button>
```

### data-class:name

Toggles one CSS class by truthiness.

```html
<button data-class:active="tab === 'home'">Home</button>
```

### data-style:prop

Sets one inline style property. Falsey values clear it.

```html
<div data-style:color="error ? 'red' : ''">message</div>
```

### data-model

Two-way form binding. Supported: text, number, checkbox (boolean or
string array for groups sharing one path), radio, single select,
multi select, textarea. State writes skip a focused text field whose
value already matches, so typing never loses the caret.

```html
<input data-model="form.q" placeholder="search">
<input type="checkbox" data-model="form.agree">
<input type="checkbox" value="a" data-model="form.tags">
<input type="checkbox" value="b" data-model="form.tags">
<input type="radio" value="r" data-model="form.color">
<select data-model="form.color"><option value="r">red</option></select>
<select multiple data-model="form.colors">...</select>
<input type="number" data-model="form.qty">
```

### data-show

Toggles `hidden` by truthiness. State and focus are kept because the
node stays in the document.

```html
<p data-show="loading">Loading...</p>
<p data-show="todos.length === 0">Nothing here yet.</p>
```

### data-if on an element

Same hidden toggle as `data-show`, for template-style conditions on
plain elements.

```html
<p data-if="user.isAdmin">Admin panel link</p>
```

### template data-if

Real attach and detach for a block. Content after the anchor inserts
when true and removes when false, running cleanups on removal.

```html
<template data-if="cart.open">
  <aside>Your cart...</aside>
</template>
```

### template data-for and data-key

Renders a list by cloning the template per item. Syntax:
`data-for="item in list"` or `data-for="item, i in list"`. Each row
gets a child scope where `item` (and `i`) are visible alongside the
parent scope.

```html
<ul>
  <template data-for="todo in todos" data-key="id">
    <li>
      <input type="checkbox" data-model="todo.done">
      <span data-bind="todo.title"></span>
    </li>
  </template>
</ul>
```

Always add `data-key` when rows hold inputs or components. Keyed rows
reuse DOM nodes across reorder, so focus and typed text survive.
Unkeyed lists patch by index and are fine for read-only rows under
about a hundred items.

### data-click

Runs an action on click. Forms, in order: a state helper
(`count++`, `count--`, `path = expr`), a named action
(`increment` or `increment()`), or any expression resolving to a
function. Accepts `data-trigger` modifiers (see section 5).

```html
<button data-click="increment">Add</button>
<button data-click="count++">Add (no action needed)</button>
<button data-click="q = ''">Clear</button>
```

Actions run with state as `this`:

```js
Laghu.define('x-y', function () {
  return {
    state: { count: 0 },
    actions: {
      increment: function () { this.count++; }
    }
  };
});
```

Unknown names warn in the console during development and dispatch
`laghu:unknown-action` on document, so typos fail loudly.

### data-on:event

Any DOM event, with optional `.prevent`, `.stop`, `.once` suffixes.
The event is visible inside as `$event`.

```html
<form data-on:submit.prevent="save">...</form>
<input data-on:input="q = $event.target.value">
<div data-on:keydown.enter="send">...</div>
```

Note: `.enter` style key filters are not built in. Branch on
`$event.key` inside the action instead.

### data-init

Runs once per hydration as an action string. Useful for seeding a
row scope or kicking off a load.

```html
<div data-scope='{}' data-init="load">...</div>
```

### data-get, data-post, data-put, data-patch, data-delete

Declarative fetch. The attribute value is the URL. `data-method`
overrides the method. See section 8 for the full fetch guide.

```html
<button data-get="/api/user" data-target="#out">Load</button>
<form data-post="/api/save" data-target="#msg" data-swap="inner">
```

### data-target, data-swap, data-select, data-vals, data-headers

Fetch companions:

- `data-target="#id"`: where the HTML goes. Default is the element.
- `data-swap`: how it goes in. One of `inner`, `outer`, `text`,
  `append` (also `beforeend`), `prepend` (also `afterbegin`),
  `beforebegin`, `afterend`, `delete`, `none`, `morph:inner`,
  `morph:outer`. Default is `inner`.
- `data-select="#part"`: picks one selector out of an HTML response
  before swapping, for endpoints returning full pages.
- `data-vals`: JSON params (`'{"q": "x"}'`), or the word `form`
  to serialize the enclosing form. GET appends a query string,
  other methods send a JSON body. A surrounding form also merges
  for non-GET requests.
- `data-headers`: extra headers as JSON.
- `data-indicator="#spin"`: element shown while the request flies.
- `data-disable`: disables the element while its request flies.
- `data-timeout="5000"`: aborts hung requests (milliseconds);
  timeouts report `laghu:request-error` with `timeout: true`.
- `data-pending`: set on the element during flight (style hooks
  like `[data-pending] { opacity: .5; }`).
- `state.$error`:fetch failures record `{ status }` or `{ message,
  timeout }` here (null when healthy). Bind it directly:
  `<span data-bind="$error.status"></span>`.

### Hash routing (router plugin)

For pages with a handful of views, load `router.min.js` after the
core and declare hash routes. Past about five guarded routes, use
a real router; this one stays small on purpose.

```html
<script src="laghu.min.js"></script>
<script src="router.min.js"></script>
<div id="view"></div>
<script>
  LaghuRouter.route({
    target: '#view',
    scope: state,
    routes: [
      { path: '/', render: function () { return '<h1>Home</h1>'; } },
      { path: '/user/:id', render: function (p) { return '<h1>User ' + p.id + '</h1>'; } }
    ],
    notfound: function () { return '<h1>Missing</h1>'; },
    beforeEach: function (to) { return true; }
  });
  LaghuRouter.navigate('/user/42');
</script>
```

Links are plain anchors (`href="#/user/42"`); hash changes drive
renders, params decode automatically, guards cancel by returning
false, and rendered fragments hydrate with the scope and actions
you pass in.

Declarative alternative: skip render functions and write routes as
templates inside the target. Params bind into a child scope as
`params`, guards are plain expressions, and templates are
harvested once at setup so swaps never destroy them:

```html
<div id="view">
  <template data-route="/"><h1>Home</h1></template>
  <template data-route="/user/:id" data-route-if="isAdmin">
    <h1>User <span data-bind="params.id"></span></h1>
  </template>
  <template data-route-notfound><h1>Missing</h1></template>
</div>
<script>
  LaghuRouter.route({ target: '#view', scope: state });
</script>
```

### data-trigger

Controls when clicks and fetches fire. Grammar (any order, first bare
word is the event):

```html
<button data-get="/s" data-trigger="click delay:500ms">search</button>
<input data-get="/s" data-trigger="change changed throttle:1s">
<div data-get="/t" data-trigger="every 5s">
<div data-get="/b" data-trigger="load">
<div data-get="/b" data-trigger="revealed">
```

Modifiers:

- `delay:500ms`: wait before firing; retrigger restarts the wait.
  Good for search-as-you-type (with `changed`).
- `throttle:1s`: ignore repeats inside the window.
- `once`: fire a single time, then detach.
- `changed`: inputs only; skip when the value is unchanged.
- `queue:last` (default): a new fetch aborts the previous one.
  `queue:first` and `queue:none`: skip while one is in flight.
  `queue:all`: allow parallel requests.
- `from:document`, `from:body`, `from:.selector`: listen on another
  root instead of the element.
- `every 5s`: poll on an interval (cleaned up on removal).
- `load`: fire once the document is ready.
- `revealed`: fire when scrolled into view (needs
  IntersectionObserver, fires at once without it).

Automatic firings combine with the event listener:
`data-trigger="load"` on a button loads on ready and still reloads
on click.

Default event by tag: forms use `submit`, inputs, selects, and
textareas use `change`, everything else uses `click`.

### data-preserve

Marks a node (with an `id`) that survives HTML swaps by identity.
The live node replaces the fresh copy, keeping video playback,
third-party widgets, and local state.

```html
<video id="v" data-preserve src="..."></video>
```

### data-morph-skip

Morph plugin only. Freezes a subtree during morph swaps.

## 6. JavaScript API reference

All methods live on `window.Laghu`.

### Laghu.define(tag, setup)

Registers a Light-DOM custom component. Tag must contain a hyphen.
`setup()` runs fresh per instance and returns state, actions,
observed attribute names, and an optional onMount hook.

- Observed attributes default to primitive state keys. Attribute
  text coerces to the state type (numbers stay numbers).
- Properties set before registration upgrade into state.
- Attributes set before connect apply on connect.
- Sync is one way (attribute into state). Send objects through
  properties or `element.state` instead of attributes.
- Removal destroys all bindings. `moveBefore` moves keep state.

```js
Laghu.define('user-card', function () {
  return {
    state: { name: 'Ada', likes: 0 },
    actions: {
      like: function () { this.likes++; }
    },
    observed: ['name'],
    onMount: function () { /* this is the state */ }
  };
});
```

```html
<user-card name="Grace">
  <span data-bind="name"></span>
  <button data-click="like">like</button>
</userhtml>
```

### Laghu.hydrate(root, state, actions)

Scans `root` and wires all bindings. Returns the reactive state.
Islands with `data-scope` call this automatically on page load.

### Laghu.reactive(obj)

Makes a plain object or array observable. Reads track, writes
trigger. Nested objects wrap on first read.

### Laghu.effect(fn)

Runs `fn` now and again whenever state it read changes. Returns a
stop function that fully unsubscribes. Subscriptions refresh every
run, so untaken branches release. Nested effects compose; a throwing
run reports `laghu:error` and the page survives. One effect per
binding is the normal pattern.

### Laghu.eval(scope, expr)

Reads one expression without `new Function` (CSP-safe). Supports
dotted paths, bracket indexes (`list[0]`, `map["k"]`), literals,
`!` and unary `-`, arithmetic (`+ - * / %`), comparisons, `&&`,
`||`, ternary (`a ? b : c`), parenthesized groups, and calls with
evaluated arguments like `total(qty)`. Anything else is undefined.

State keys may use kebab-case: a whole string that resolves as a
path wins over operators, so `$store.t-read.n` reads literally when
the key exists. Pure arithmetic like `count-1` still subtracts.
Action names are exempt: exact action lookup runs before
expression parsing, so `data-click="my-action"` stays literal.

### Laghu.get(scope, path) and Laghu.set(scope, path, val)

Dotted path access with scope-chain lookup. `$store.name.key`
reaches global stores. Segments `__proto__`, `constructor`, and
`prototype` are refused on read and write. Late-added keys wake
readers: bindings on keys that do not exist yet update when the
keys appear. Writes follow the chain to the owning scope.

### Laghu.parseTrigger(spec, el)

Parses `data-trigger` text into a modifier object. Useful for
testing and custom wiring.

### Laghu.swap(target, html, mode, scope, actions)

Swaps HTML and hydrates the result. See modes in section 5.
Dispatches `laghu:before-swap` and `laghu:after-swap`, preserves
`data-preserve` nodes, restores focus and caret. The optional
`actions` map wires handlers in the new content; fetch swaps reuse
the requesting element's actions automatically.

### Laghu.sanitize(fn)

Replaces the HTML pass-through used by `data-html` and swaps. The
default is a baseline cleaner (scripts, frames, event handlers,
scriptable URLs stripped), not a policy. Install a real sanitizer
when rendering untrusted HTML:

```js
Laghu.sanitize(function (h) { return DOMPurify.sanitize(h); });
```

### Laghu.filter(name, fn) and display pipes

`data-bind` and `data-text` accept `expr | filter[:arg]`
chains. Double pipes stay logical-or. Nine filters ship built in
(`uppercase`, `lowercase`, `json`, `fixed`, `currency`, `date`,
`default`, `join`, `length`); register more with `Laghu.filter`,
which unknown names warn about and pass through.

```html
<span data-bind="price | currency"></span>
<span data-bind="nick | default:'anon'"></span>
<span data-bind="tags | join:', '"></span>
```

```js
Laghu.filter('shout', function (v) { return String(v) + '!'; });
```

### Laghu.scope(parent, vars)

Makes a child scope owning `vars` over `parent`. Needed by custom
renderers (router templates use it for `params`): plain assignment
on a Proxy-prototyped object would write the parent instead.

Creates or fetches a named global reactive store. Read it in any
binding as `$store.cart.n`.

```js
Laghu.store('cart', { n: 0 });
Laghu.store('cart').n++;
```

```html
<span data-bind="$store.cart.n"></span>
```

### Laghu.computed(fn)

Derived value kept fresh by an effect. Call the getter inside
bindings or other effects to subscribe.

```js
var total = Laghu.computed(function () { return state.price * state.qty; });
Laghu.effect(function () { el.textContent = total(); });
```

### Laghu.watch(scope, expr, cb)

Calls back with `(next, prev)` whenever an expression's value
changes. Reads without subscribing the caller's own effect.
Returns the stop function.

### Laghu.persist(name, opts)

Persists a named store to localStorage (debounced) with versioned
restore. Mismatched versions reseed instead of loading.

```js
Laghu.store('cart', { n: 0 });
Laghu.persist('cart', { key: 'cart:v1', version: 1 });
```

### Laghu.directive(name, fn)

Registers `data-name`. The function receives `{ el, get, effect,
scope }` and may return a cleanup function.

```js
Laghu.directive('focus', function (ctx) {
  var stop = ctx.effect(function () {
    if (ctx.get()) ctx.el.focus();
  });
  return stop;
});
```

```html
<input data-focus="shouldFocus">
```

### Laghu.destroyTree(root)

Stops everything under `root`: effects, listeners, timers,
observers, in-flight fetches. Runs automatically on removal and
before swaps. Call it manually before wiping DOM yourself.

### Laghu.css and Laghu.version

`Laghu.css` is the FOUC guard string (hide unregistered tags, show
them with `is-defined`). `Laghu.version` is the release string.

### LaghuMorph.morph(target, html, opts)

From morph.js (load after laghu.js). Reconciles instead of
replacing. `opts.mode` is `inner` (default) or `outer`.
`LaghuMorph.morphEl(a, b)` reconciles two elements directly.

## 7. Events reference

All names are CustomEvents, and all of them bubble, so one listener
on a section or on document observes every child. Listen with
`addEventListener`:

- `laghu:before-request`: cancelable, `detail` has `url`, `method`.
  Call `preventDefault()` to stop the fetch (for confirm dialogs).
- `laghu:after-request`: `detail` has `status`, `url`.
- `laghu:request-error`: network failure or non-OK status.
  `detail` has `error` or `status` plus `url`.
- `laghu:before-swap`: before HTML changes, `detail` has `swap`.
- `laghu:after-swap`: after hydrate, `detail` has `swap`.
- `laghu:unknown-action`: `detail` has `name`. Fires on typos.
- `laghu:mount` and `laghu:unmount`: on component elements.
- `laghu:poll`, `laghu:load`, `laghu:revealed`: synthetic trigger
  events passed to interval, load, and reveal handlers.

## 8. Fetching data (JSON and HTML)

laghu has one rule: JSON merges into state, HTML swaps into the DOM.

JSON example. The response object merges with `Object.assign`, so
bound nodes update through normal reactivity:

```html
<button data-get="/api/user" data-trigger="click queue:last">
  Load user
</button>
<p>Hello, <span data-bind="user.name">stranger</span></p>
```

HTML example. The fragment swaps into the target and hydrates, so
new `data-bind` and `data-click` attributes work at once:

```html
<button data-get="/rows?page=2" data-target="#list" data-swap="append">
  More
</button>
<ul id="list">...</ul>
```

Form example. The enclosing form serializes to JSON automatically:

```html
<form data-post="/api/save" data-target="#msg">
  <input name="email">
  <button>Save</button>
  <p id="msg" data-bind="result"></p>
</form>
```

Confirm example. Cancel in `before-request`:

```js
document.querySelector('#del').addEventListener('laghu:before-request', function (e) {
  if (!confirm('Delete?')) e.preventDefault();
});
```

## 9. The morph plugin

Default swaps replace nodes. Replacement loses input focus, caret,
scroll position, video playback, and component instances inside the
target. The morph plugin updates nodes in place instead.

Load it after the core:

```html
<script src="laghu.min.js"></script>
<script src="morph.min.js"></script>
```

Then use `morph:inner` (reconcile children) or `morph:outer`
(reconcile the element itself):

```html
<ul id="list" data-get="/rows" data-target="#list" data-swap="morph:inner">
  <li id="r1">one</li>
</ul>
```

Rules: stable rows need an `id` or `data-bkey`. Unkeyed same-tag
children reuse positionally. `data-morph-skip` freezes a subtree.
Focused inputs keep typed values. Removed nodes run their laghu
cleanups. Without morph.js loaded, `morph:*` warns in development
and falls back to a plain inner swap.

Use morph for server-fed lists and tables. Keep destructive swaps
for one-shot content where replacement is cheaper and simpler.

## 10. Type safety without TypeScript

laghu ships type checking with zero build output. Every source file
starts with `// @ts-check`, and editors run the TypeScript language
server on plain `.ts` sources. JSDoc examples plus real type
annotations carry the types, and `dist/*.d.ts` is generated from
source on every build, never hand-edited.

To check the whole project:

```sh
npx tsc --noEmit -p tsconfig.json
```

This typechecks only and emits nothing. `npm run build` typechecks,
emits declarations, and bundles `dist/` (plain-JS IIFE plus min).
Implementers still load `dist/*.min.js` with no compiler involved.

One blind spot: HTML attribute strings are invisible to the
checker. Renaming `increment` to `add` breaks
`data-click="increment"` silently at the type level. laghu covers
this three ways: unknown actions warn in development, every unknown
action dispatches `laghu:unknown-action`, and the test suite boots
fixture pages and asserts no unknown-action warnings. Keep action
names in one registry object and test the fixtures.

Library consumers get `dist/laghu.d.ts` with full signatures.

## 11. Content Security Policy notes

laghu runs under strict CSP with no `unsafe-eval` and no
`unsafe-inline`:

- No `new Function`, no `eval`, no string `setTimeout`. Expressions
  use a small built-in reader (paths, indexes, literals, `!`,
  arithmetic, comparisons, `&&`, `||`, ternary, calls with args).
- No inline handlers. All listeners attach with
  `addEventListener` from `data-*` attributes.
- Ship laghu as an external file with a Subresource Integrity hash
  (`node scripts/sri.mjs` prints them for release notes).
- `data-scope` takes JSON only, for the same no-eval reason.

No-eval is not the whole of web security. The rest of the posture:

- `data-html` and swaps pass a baseline sanitizer (scripts, frames,
  event-handler attributes, scriptable URLs stripped). It is a
  floor: point `Laghu.sanitize` at DOMPurify for untrusted content,
  and set `script-src-attr 'none'` in your policy for defense in
  depth.
- Attribute bindings refuse `javascript:`, `data:text/html`, and
  `vbscript:` URLs on navigation and loading attributes.
- State paths refuse `__proto__`, `constructor`, and `prototype`
  segments on read and write, including inside action strings.
- Runtime failures dispatch `laghu:error` (bindings, directives,
  init, unmount) and `laghu:request-error` (fetch) in every
  environment; consoles stay quiet unless you enable dev mode.
- See `SECURITY.md` for reporting, supported versions, and the
  audit-backed regression list.

## 12. Loading flash and SEO notes

Empty custom tags render as unknown inline elements until the script
registers them. Two fixes, best used together:

1. Ship real HTML inside the tag (progressive enhancement). Content
   shows before JS, works without JS, and stays indexable.
2. Hide only the unknown state with CSS:

```css
my-card:not(:defined) { visibility: hidden; }
```

`visibility` (not `display`) avoids layout shift. `Laghu.css`
carries a ready-made version of this rule. Pre-rendered Light DOM
also solves SEO: crawlers and readers see content even when scripts
never run.

## 13. File sizes

Measured after minification:

- Core `dist/laghu.min.js`: about 30.6kB raw, 10.3kB gzip, 9.2kB brotli.
- Morph `dist/morph.min.js`: about 2.3kB raw, 1kB gzip.
- Router `dist/router.min.js`: about 2.4kB raw, 1.1kB gzip.
- Validate `dist/validate.min.js`: about 3.3kB raw, 1.3kB gzip.
- Budgets enforced by `node scripts/size.mjs`: core at or under
  10.5kB gzip, morph at or under 3kB gzip, router at or under
  2.5kB gzip, validate at or under 2kB gzip.

The core grew from 7.1kB across three recorded moves: the security
baseline, the expression grammar, and the declarative push
(filters, scope API, trigger combining, transition baseline).
Each move is logged in `scripts/size.mjs` with its cause; the
total stays roughly a third of htmx alone (~16kB gzip).

The core grew from 7.1kB to 9.2kB for two consensus items: the
security baseline (default sanitizer, URL policy, pollution
guards, error isolation, effect unsubscribe) and the expression
grammar (ternary, arithmetic, argued calls, indexing). Both are
audited-in requirements, not creep: the budget moved openly, and
the total stays under half of htmx alone (~16kB gzip).

For scale: htmx alone is about 16kB gzip, Alpine with a few plugins
is 12 to 15kB. laghu core plus morph stays under half of either.
End-to-end proof lives in `bench/RESULTS.md`: the same TicTacToe in
laghu, vanilla, React, Vue, and Angular, measured in headless
Chromium. laghu ships 3 to 10 times less JavaScript than the
frameworks, holds the lowest heap of the four, and ties them on
interaction latency (all sub-millisecond); vanilla remains the
floor, as zero abstraction must.

## 14. Worked examples

See the `examples/` folder. Each file opens directly from disk.

- `counter.html`: one component, one binding, one action.
- `todo.html`: island with `data-model` input, keyed `data-for`
  list, checkbox models, `data-show` counter.
- `model.html`: every two-way input type (text, number, single
  checkbox, checkbox group, radio, single select, multi select,
  textarea) with live mirrors and reset.
- `triggers.html`: throttle, once, interval, load, init, change
  write-through, and prevented form submit.
- `swaps.html`: every swap mode, the swap event log,
  `data-preserve`, and a morph swap that keeps typing and focus.
- `components.html`: two independent instances, attribute sync,
  mount and unmount observation, removal and restore.
- `store.html`: two islands sharing one `$store` counter and name.
- `directives.html`: custom ticker and autofocus directives,
  template removal running directive cleanup, class binding.
- `fetch.html`: JSON button plus morph list swap (needs a server
  for the URLs, or swap in local JSON files).
- `api.html`: third-party APIs with zero backend of your own
  (GitHub repo card and contributors plus JSONPlaceholder posts).
- `validate.html`: declarative signup validation with submit guard.
- `transitions.html`: enter and leave motion with reduced-motion
  respect.

`test/unit/` covers every behavior above against `src/` with
Vitest: 104 tests green in about 2 seconds. Examples stay
documentation; they are not test fixtures.

## 15. Checking your setup

```sh
npm install
npx tsc --noEmit -p tsconfig.json
npm run build
node scripts/sri.mjs
npm test
```

104 Vitest tests cover (`test/unit/`, happy-dom, ~2s): reactivity,
effects, and cleanup; the full expression grammar; paths with
prototype guards; triggers; stores and persist; all bindings,
conditionals, keyed lists, two-way inputs, and directives;
attribute sync and component lifecycles; every fetch mode, swap,
and morph behavior; validation, transitions, and the hash router;
third-party API flows; and both demo apps played to completion.

Releasing a new version (publishes to npm through CI):

1. Bump `version` in `package.json` and commit.
2. Create a GitHub Release with tag `vX.Y.Z` matching that version
   (example: tag `v1.0.1` for version `1.0.1`).
3. The `Publish` workflow verifies types, tests, sizes, tarball
   contents, and a packed install smoke test, then publishes with
   provenance. It refuses when the tree is dirty or the tag and
   version disagree.
4. Requirements: an `NPM_TOKEN` secret with publish rights on the
   `laghu` package. To check without uploading, run the workflow
   manually from the Actions tab (dry run is the default).

## 16. Troubleshooting

Unknown action warning: the `data-click` or `data-on` name matches
no action and no state function. Check spelling, or add the action
to the component setup return value.

`data-scope must be JSON` warning: attribute text is not valid
JSON. Use double quotes inside single quotes:
`data-scope='{"count": 0}'`.

Binding shows nothing: the path is missing, so the effect wrote an
empty string. Check the path against state, including row variable
names inside `data-for`.

Click does nothing on a fetched button: content swapped without
hydrate cannot happen through `Laghu.swap` (it hydrates), so this
means the HTML was inserted manually. Call
`Laghu.hydrate(parent, state, actions)` or route inserts through
`Laghu.swap`.

Focus jumps on list update: rows need `data-key`, or switch the
swap to `morph:inner` with row ids.

Request never fires with `changed`: the input value never differed.
`changed` compares against the last fired value per element.

morph warns and falls back: `morph.min.js` is not loaded. Add the
script tag after the core.

`data-click="my-action"` does nothing: check the actions map first;
exact names win before expression parsing. `data-bind="a-b"` on the
other hand always subtracts; rename the key to camelCase.

New key renders blank: bindings subscribe to keys that appear later,
but prefer declaring the full shape up front so first paint is
complete.

## 17. Project files

- `src/laghu.ts`: core source (TypeScript, strict). Never loaded
  directly; bundled to `dist/` by `npm run build`.
- `src/morph.ts`, `src/router.ts`, `src/validate.ts`: opt-in
  plugins, same pipeline.
- `src/*.global.ts`: one-line entries assigning each bundle to its
  `window` global for the IIFE builds.
- `dist/laghu.js` plus `.min.js` (and morph, router, validate):
  plain-JS bundles. What tests prove and what ships.
- `dist/*.d.ts`: declarations generated from source on every
  build, never hand-edited.
- `tsconfig.json`: strict check used by editors and CI.
- `tsconfig.build.json`: declaration emit for `dist`.
- `test/unit/`: Vitest suites against `src/` (reactivity, expr,
  dom, fetch, components, security, router, validate, transitions,
  apps, dist load check).
- `test/setup.ts`: shared happy-dom setup and window globals.
- `scripts/size.mjs`: bundles, minifies, and enforces gzip budgets.
- `scripts/sri.mjs`: prints SRI hashes for release notes.
- `examples/`: twelve pages opening from disk.
- `apps/`: full demo projects with the prescribed structure.
- `bench/`: five-way benchmark harness and results.
- `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`: release,
  security, and contribution contracts.
- `memory.md`: decision ledger (ADRs newest-first).

## 18. Roadmap (explicit non-goals included)

Shipped since the roadmap was written: declarative validation
(`data-validate`, `LaghuValidate` plugin), WAAPI transitions
(`data-transition`, reduced-motion aware), async fetch tri-state
(`data-pending`, `state.$error`), hash router plugin,
`computed`/`watch`/`persist`, third-party API example.

Next, in order: async fallback templates for fetch, icon and
Tailwind interop recipes (`data-icon`, class merging), then docs
site, real-browser matrix, and devtools.

Deliberately out of scope: JSX or any compiler toolchain, VDOM
diffing in core, built-in auth/i18n/charts/offline-sync, a Node
SSR server, full SPA parity. laghu owns small interactive pages
and embeds; it graduates users to bigger tools with documented
boundaries instead of cloning them badly.
