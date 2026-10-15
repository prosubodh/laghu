# TicTacToe benchmark: laghu vs vanilla vs React vs Vue vs Angular

Same game in five implementations: identical rules, identical markup
contract (`h1`, `p#status`, nine `button.cell` in DOM order,
`p#score`, New round and Reset all buttons), identical scripted game
(X0 O3 X1 O4 X2, X wins the top row). Production builds everywhere:
laghu ships its minified dist, the other three ship `vite build` /
`ng build` output, vanilla ships one hand-written file.

## What is measured

- exec JS raw and gzip: bytes of JavaScript the browser must
  download, parse, and compile for one play. File lists keep this
  honest (the laghu app loads `laghu.min.js` only, never
  `morph.min.js`). App code is included for every contender.
- load ms: navigation to nine cells plus non-empty status, median
  of 5 cold loads. Localhost numbers, so treat gaps under ~10ms as
  noise and focus on ordering, not absolutes.
- click ms: synchronous dispatch inside the page, MutationObserver
  timestamp on the updated cell. No Playwright actionability or
  rAF polling overhead. Median of 25 clicks. Sub-millisecond values
  are ties, not victories.
- heap KB: CDP `JSHeapUsedSize` after a full game, median of 5.

## How to reproduce

```sh
cd bench
npm install
npx playwright install chromium
node bench.mjs
```

This serves the repo over localhost, drives headless Chromium, and
rewrites `RESULTS.md` plus `results.json`. To rebuild the framework
bundles first: `npm run build` in `react-ttt` and `vue-ttt` (with
`--base=./` so assets resolve under the harness paths), `npx ng
build --base-href ./` in `angular-ttt`.

## Reading the table honestly

Bundle size is the decisive column at this scale: interaction costs
are sub-millisecond for everyone, so shipping 10x less JavaScript is
the whole game. Heap ordering mirrors runtime weight. Load times on
localhost compress differences that widen on real networks and
low-end phones, where parse and compile dominate. Vanilla is the
floor no abstraction can beat; the question for each framework is
what it costs over vanilla and what it pays back in structure.
