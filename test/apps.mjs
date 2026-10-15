import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const laghuSrc = fs.readFileSync(path.join(root, 'src', 'laghu.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, extra); }
}
async function tick(ms = 15) { await new Promise((r) => setTimeout(r, ms)); }

// Boot a full app exactly as shipped: real index.html plus real js
// files evaluated in script-tag order. No network, no build.
function bootApp(dir, files) {
  const html = fs.readFileSync(path.join(root, 'apps', dir, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.HTMLElement = window.HTMLElement;
  global.Element = window.Element;
  global.Node = window.Node;
  global.HTMLInputElement = window.HTMLInputElement;
  global.HTMLTextAreaElement = window.HTMLTextAreaElement;
  global.HTMLSelectElement = window.HTMLSelectElement;
  global.HTMLFormElement = window.HTMLFormElement;
  global.customElements = window.customElements;
  global.MutationObserver = window.MutationObserver;
  global.CustomEvent = window.CustomEvent;
  global.Event = window.Event;
  global.KeyboardEvent = window.KeyboardEvent;
  global.FormData = window.FormData;
  global.IntersectionObserver = class { observe() {} disconnect() {} };
  window.__LAGHU_DEV__ = false;
  window.eval(laghuSrc);
  for (const f of files) {
    window.eval(fs.readFileSync(path.join(root, 'apps', dir, f), 'utf8'));
  }
  return window.Laghu;
}

function cellButtons() {
  return [...document.querySelectorAll('ttt-board .cell')];
}

// --- tictactoe: full X win, draw-free flow, guards, rounds ---
{
  bootApp('tictactoe', ['js/lib/game.js', 'js/store.js', 'js/app.js', 'js/components/ttt-board.js', 'js/components/ttt-score.js']);
  await tick(30);
  ok('ttt: nine cells render', cellButtons().length === 9);
  ok('ttt: status opens X', document.querySelector('#status').textContent === 'Turn: X');
  const play = [0, 3, 1, 4, 2]; // X takes top row
  for (const i of play) { cellButtons()[i].click(); await tick(); }
  const st = document.querySelector('ttt-board').state;
  ok('ttt: X wins top row', st.winner && st.winner.b === 'X', JSON.stringify(st.winner));
  ok('ttt: status names winner', document.querySelector('#status').textContent.includes('Winner: X'));
  ok('ttt: score counts X', document.querySelector('ttt-score').state.score.X === 1);
  const wins = cellButtons().filter((b) => b.classList.contains('win')).length;
  ok('ttt: three cells highlighted', wins === 3, String(wins));
  cellButtons()[5].click(); // after win: ignored
  await tick();
  ok('ttt: post-win clicks ignored', cellButtons()[5].textContent === '');
  [...document.querySelectorAll('ttt-board button')].find((b) => b.textContent === 'New round').click();
  await tick(30);
  ok('ttt: new round clears', cellButtons().every((b) => b.textContent === '') && document.querySelector('ttt-board').state.winner === null);
  cellButtons()[0].click(); await tick();
  cellButtons()[0].click(); await tick(); // occupied: ignored
  ok('ttt: occupied cell keeps mark', cellButtons()[0].textContent === 'X' && document.querySelector('ttt-board').state.turn === 'O');
  [...document.querySelectorAll('ttt-score button')].find((b) => b.textContent === 'Reset all').click();
  await tick();
  const sc = document.querySelector('ttt-score').state.score;
  ok('ttt: reset clears score', sc.X === 0 && sc.O === 0 && sc.D === 0);
}

// --- sudoku: select, input, erase, hint, levels, keyboard, full win ---
{
  bootApp('sudoku', ['js/lib/sudoku.js', 'js/store.js', 'js/app.js', 'js/components/sudoku-grid.js', 'js/components/sudoku-pad.js']);
  await tick(40);
  const grid = document.querySelector('sudoku-grid');
  const st = grid.state;
  ok('sudoku: 81 cells render', document.querySelectorAll('sudoku-grid .cell').length === 81);
  ok('sudoku: easy has 32 empties', st.cells.filter((c) => !c.given).length === 32);
  ok('sudoku: clock starts 00:00', document.querySelector('#clock').textContent === '00:00');
  const emptyIdx = st.cells.findIndex((c) => !c.given);
  document.querySelectorAll('sudoku-grid .cell')[emptyIdx].click();
  await tick();
  ok('sudoku: select tracks cell', st.selected === emptyIdx && st.selVal === 0);
  const right = st.solution[emptyIdx];
  [...document.querySelectorAll('sudoku-pad .pad button')]
    .find((b) => b.textContent === String(right)).click();
  await tick();
  ok('sudoku: right digit sticks clean', st.cells[emptyIdx].v === right && !st.cells[emptyIdx].err && st.mistakes === 0);
  const empty2 = st.cells.findIndex((c, i) => !c.given && !c.v && i !== emptyIdx);
  document.querySelectorAll('sudoku-grid .cell')[empty2].click();
  await tick();
  const wrong = (st.solution[empty2] % 9) + 1;
  [...document.querySelectorAll('sudoku-pad .pad button')]
    .find((b) => b.textContent === String(wrong)).click();
  await tick();
  ok('sudoku: wrong digit flags conflict', st.cells[empty2].err === true && st.mistakes === 1);
  ok('sudoku: error class shows', document.querySelectorAll('sudoku-grid .cell')[empty2].classList.contains('err'));
  [...document.querySelectorAll('sudoku-pad .pad button')].find((b) => b.textContent === 'erase').click();
  await tick();
  ok('sudoku: erase clears cell', st.cells[empty2].v === 0 && !st.cells[empty2].err);
  const hints0 = st.hints;
  [...document.querySelectorAll('sudoku-pad .pad button')].find((b) => b.textContent.includes('hint')).click();
  await tick();
  ok('sudoku: hint fills from solution', st.hints === hints0 - 1 && st.cells[empty2].v === st.solution[empty2]);
  const wrap = document.querySelector('sudoku-grid .grid');
  wrap.dispatchEvent(new window.KeyboardEvent('keydown', { key: '9', bubbles: true }));
  await tick();
  ok('sudoku: keyboard digit enters', st.cells[empty2].v === 9 || st.cells[empty2].err === true);
  [...document.querySelectorAll('sudoku-pad .levels button')].find((b) => b.textContent === 'Medium').click();
  await tick(40);
  ok('sudoku: medium deals 42 empties', grid.state.cells.filter((c) => !c.given).length === 42);
  // finish the board through the real UI path
  const cur = grid.state;
  for (let i = 0; i < 81; i++) {
    if (!cur.cells[i].given && cur.cells[i].v !== cur.solution[i]) {
      document.querySelectorAll('sudoku-grid .cell')[i].click();
      [...document.querySelectorAll('sudoku-pad .pad button')]
        .find((b) => b.textContent === String(cur.solution[i])).click();
    }
  }
  await tick(40);
  ok('sudoku: completing board wins', cur.status === 'won', cur.status);
  ok('sudoku: won banner shows', document.querySelector('#won').hidden === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
