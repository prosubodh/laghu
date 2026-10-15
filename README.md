# laghu.js

laghu.js is a tiny front-end helper for small pages. It adds reactivity,
reusable components, and declarative data fetching to plain HTML, using
only the browser. There is no build step, no JSX, and no TypeScript
compiler. You add one script tag and write normal HTML.

The name "laghu" is a Sanskrit word for light and small. That is the
whole idea: a light tool for pages that do not need a heavy framework.

Contents:

1. When to use laghu
2. Quick start
3. Core concepts
4. HTML attribute reference
5. JavaScript API reference
6. Events reference
7. Fetching data (JSON and HTML)
8. The morph plugin
9. Type safety without TypeScript
10. Content Security Policy notes
11. Loading flash and SEO notes
12. File sizes
13. Worked examples
14. Checking your setup
15. Troubleshooting
16. Project files

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

## 3. Core concepts

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

## 4. HTML attribute reference

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

```html
<span data-bind="user.name"></span>
<span data-text="count"></span>
```

### data-html

Renders a value as HTML. Explicit opt-in because HTML parsing is an
XSS risk. Content passes through the sanitize hook (see
`Laghu.sanitize`). Prefer `data-bind` unless you trust the source.

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
function. Accepts `data-trigger` modifiers (see section 7).

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
overrides the method. See section 7 for the full fetch guide.

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

## 5. JavaScript API reference

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
stop function. One effect per binding is the normal pattern.

### Laghu.eval(scope, expr)

Reads one expression without `new Function` (CSP-safe). Supports
paths, literals, `!`, comparisons, `&&`, `||`, and no-argument
calls like `reset()`.

### Laghu.get(scope, path) and Laghu.set(scope, path, val)

Dotted path access with scope-chain lookup. `$store.name.key`
reaches global stores.

### Laghu.parseTrigger(spec, el)

Parses `data-trigger` text into a modifier object. Useful for
testing and custom wiring.

### Laghu.swap(target, html, mode, scope)

Swaps HTML and hydrates the result. See modes in section 4.
Dispatches `laghu:before-swap` and `laghu:after-swap`, preserves
`data-preserve` nodes, restores focus and caret.

### Laghu.sanitize(fn)

Replaces the HTML pass-through used by `data-html` and swaps.
Install a real sanitizer when rendering server HTML:

```js
Laghu.sanitize(function (h) { return DOMPurify.sanitize(h); });
```

### Laghu.store(name, init)

Creates or fetches a named global reactive store. Read it in any
binding as `$store.cart.n`.

```js
Laghu.store('cart', { n: 0 });
Laghu.store('cart').n++;
```

```html
<span data-bind="$store.cart.n"></span>
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

## 6. Events reference

All names are CustomEvents. Listen with `addEventListener`:

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

## 7. Fetching data (JSON and HTML)

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

## 8. The morph plugin

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

## 9. Type safety without TypeScript

laghu ships type checking with zero build output. Every source file
starts with `// @ts-check`, and editors run the TypeScript language
server on plain `.js` files. JSDoc comments carry the types.

To check the whole project:

```sh
npx tsc --noEmit -p jsconfig.json
```

This typechecks only and emits nothing. The browser runs the same
`.js` files untouched.

One blind spot: HTML attribute strings are invisible to the
checker. Renaming `increment` to `add` breaks
`data-click="increment"` silently at the type level. laghu covers
this three ways: unknown actions warn in development, every unknown
action dispatches `laghu:unknown-action`, and the test suite boots
fixture pages and asserts no unknown-action warnings. Keep action
names in one registry object and test the fixtures.

Library consumers get `dist/laghu.d.ts` with full signatures.

## 10. Content Security Policy notes

laghu runs under strict CSP with no `unsafe-eval` and no
`unsafe-inline`:

- No `new Function`, no `eval`, no string `setTimeout`. Expressions
  use a small built-in reader (paths, literals, `!`, comparisons,
  `&&`, `||`, no-argument calls).
- No inline handlers. All listeners attach with
  `addEventListener` from `data-*` attributes.
- Ship laghu as an external file with a Subresource Integrity hash.
- `data-scope` takes JSON only, for the same no-eval reason.
- `data-html` and swaps accept HTML by design. Point
  `Laghu.sanitize` at DOMPurify when content comes from a server.

## 11. Loading flash and SEO notes

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

## 12. File sizes

Measured after minification:

- Core `dist/laghu.min.js`: about 21kB raw, 6.8kB gzip, 6.1kB brotli.
- Morph `dist/morph.min.js`: about 2.3kB raw, 1kB gzip.
- Budgets enforced by `node scripts/size.mjs`: core at or under
  7.5kB gzip, morph at or under 3kB gzip.

For scale: htmx alone is about 16kB gzip, Alpine with a few plugins
is 12 to 15kB. laghu core plus morph stays under half of either.

## 13. Worked examples

See the `examples/` folder. Each file opens directly from disk.

- `counter.html`: one component, one binding, one action.
- `todo.html`: island with `data-model` input, keyed `data-for`
  list, checkbox models, `data-show` counter.
- `fetch.html`: JSON button plus morph list swap (needs a server
  for the URLs, or swap in the stub URLs for local JSON files).

## 14. Checking your setup

```sh
npm install
npx tsc --noEmit -p jsconfig.json
node scripts/size.mjs
node test/run.mjs
```

37 tests cover: counter increments, text and attribute bindings,
conditionals, keyed reorder reuse, two-way inputs, attribute sync,
triggers, JSON merge, all swap modes, morph focus preservation,
stores, directives with cleanup, and unknown-action warnings.

## 15. Troubleshooting

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

## 16. Project files

- `src/laghu.js`: core source with full JSDoc, loaded directly in
  development.
- `src/morph.js`: opt-in morph plugin source with full JSDoc.
- `dist/laghu.min.js`, `dist/morph.min.js`: minified builds.
- `dist/laghu.d.ts`: TypeScript declarations for consumers.
- `test/run.mjs`: jsdom suite, 37 assertions.
- `scripts/size.mjs`: minifies and enforces gzip budgets.
- `examples/`: three pages opening from disk.
- `jsconfig.json`: strict `checkJs` config used by editors and CI.
