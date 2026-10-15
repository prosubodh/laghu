# laghu app structure

This folder holds complete laghu applications. Every app follows the
same layout so any developer can open an unfamiliar app and know
where everything lives.

## Layout

```text
apps/<name>/
  index.html              page shell, markup written out (SEO friendly)
  styles.css              all styling, plain CSS, global by design
  js/app.js               entry point: stores, directives, top-level wiring
  js/store.js             state shape plus pure helpers (loads before components)
  js/lib/*.js             framework-free logic (rules, solvers, formatting)
  js/components/*.js      one file per custom element (define call plus docs)
```

Load order in `index.html` (classic scripts, no modules, works from
file://). Stores first, components last: custom elements upgrade the
moment `define` runs, so the store must already exist or the first
instance hydrates empty.

```html
<script src="../../dist/laghu.min.js"></script>
<script src="js/lib/game.js"></script>
<script src="js/store.js"></script>
<script src="js/app.js"></script>
<script src="js/components/ttt-board.js"></script>
<script src="js/components/ttt-score.js"></script>
```

Each file owns exactly one global (for example `TttGame`,
`TttStore`) or registers exactly one thing (one component, one
directive set). Files never reach into each other's internals;
shared state travels through `Laghu.store`.

## The five rules

1. State lives in stores, components render it. A component file
   defines markup behavior, never private copies of shared data.
   Two components showing the same match read one
   `Laghu.store('ttt')`.
2. Logic lives in lib, actions are thin. Win checks, solvers, and
   formatters are plain functions in `js/lib` with no laghu calls,
   so they stay testable in Node and portable anywhere.
3. Row actions read position, write through scope. Inside
   `data-for` rows, `this` is the row scope. Read the index with
   `Laghu.get(this, 'i')`, write with `Laghu.set` (which writes the
   owning scope, never a shadow copy), or mutate objects directly
   (`this.todo.done = true`). Never assign a row-level primitive
   with `this.x = ...`; it lands on the row, not the state.
   Replacing a whole array rebinds rows whose item identity changed
   (new objects, same keys); mutating items in place keeps every
   binding and focus untouched.
4. Lists are objects with ids. Rows are `{ id, ... }`, loops use
   `data-key="id"`. Keyed rows survive reorder with focus intact.
5. Markup stays in HTML. Repeatable structure uses `data-for` over
   data. Components hydrate the children authors write; pages stay
   readable without JS and indexable by crawlers.
6. Stores load before components. Custom elements upgrade the moment
   `define` runs, so `app.js` (which creates the stores) loads before
   any `js/components/*.js` file. A component defined before its
   store exists hydrates its first instance empty.

## Composition patterns

- Islands: `data-scope` areas for page-level glue (toolbars,
  filters) hydrated by `app.js`.
- Components: `<ttt-board>`, `<sudoku-grid>` for reusable widgets
  with their own markup contract documented at the top of the file.
- Store sharing: the header, the board, and the scoreboard all read
  `$store.ttt` and stay in sync with zero prop drilling.
- Light-DOM passthrough: a component renders whatever children the
  page author wrote inside its tag, so composition reads like HTML,
  not configuration.

## When to graduate

This structure carries apps to roughly a dozen components. Past
that (client routing with guards, offline sync, large teams),
move to Svelte, Solid, Astro islands, React, or Vue. laghu owns
the small end; it does not pretend to own the large end.
