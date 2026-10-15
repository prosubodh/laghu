/* Sudoku shared state. Cells are objects so row actions mutate them
 * directly; selected/selVal/status are store-level primitives updated
 * through Laghu.set (or direct writes on the store proxy itself).
 * Mistakes count placements that create a conflict. Hints fill from
 * the known solution and never touch givens. */
var SudokuStore = (function () {
  'use strict';

  var SEEDS = { easy: 11, medium: 22, hard: 33 };

  function initial() {
    return {
      cells: [],
      solution: [],
      selected: -1,
      selVal: 0,
      mistakes: 0,
      hints: 3,
      seconds: 0,
      clock: '00:00',
      status: 'playing',
      difficulty: 'easy',
      digits: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (d) { return { id: d, v: d }; }),
      levels: [
        { id: 'easy', label: 'Easy' },
        { id: 'medium', label: 'Medium' },
        { id: 'hard', label: 'Hard' }
      ]
    };
  }

  function newGame(store, difficulty) {
    var g = SudokuLib.generate(difficulty, SEEDS[difficulty] || 11);
    store.solution = g.solution;
    store.cells = g.puzzle.map(function (v, i) {
      return { id: i, v: v, given: v !== 0, err: false };
    });
    store.selected = -1;
    store.selVal = 0;
    store.mistakes = 0;
    store.hints = 3;
    store.seconds = 0;
    store.clock = SudokuStore.fmtTime(0);
    store.status = 'playing';
    store.difficulty = difficulty;
  }

  function vals(store) {
    return store.cells.map(function (c) { return c.v; });
  }

  function refreshErr(store) {
    var bad = SudokuLib.conflicts(vals(store));
    for (var i = 0; i < 81; i++) store.cells[i].err = bad[i] && !store.cells[i].given;
  }

  function select(store, i) {
    if (store.status !== 'playing') return;
    store.selected = i;
    store.selVal = store.cells[i] ? store.cells[i].v : 0;
  }

  function input(store, d) {
    if (store.status !== 'playing') return;
    var i = store.selected;
    if (i < 0 || store.cells[i].given) return;
    store.cells[i].v = d;
    store.selVal = d;
    refreshErr(store);
    if (store.cells[i].err) store.mistakes++;
    if (SudokuLib.isComplete(vals(store))) store.status = 'won';
  }

  function erase(store) {
    if (store.status !== 'playing') return;
    var i = store.selected;
    if (i < 0 || store.cells[i].given) return;
    store.cells[i].v = 0;
    store.selVal = 0;
    refreshErr(store);
  }

  function hint(store) {
    if (store.status !== 'playing' || store.hints <= 0) return;
    var i = store.selected;
    if (i < 0 || store.cells[i].given || store.cells[i].v === store.solution[i]) {
      for (var k = 0; k < 81; k++) {
        if (!store.cells[k].given && store.cells[k].v !== store.solution[k]) { i = k; break; }
      }
    }
    if (i < 0 || store.cells[i].given) return;
    store.cells[i].v = store.solution[i];
    store.selected = i;
    store.selVal = store.solution[i];
    store.hints--;
    refreshErr(store);
    if (SudokuLib.isComplete(vals(store))) store.status = 'won';
  }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
  }

  return {
    initial: initial,
    newGame: newGame,
    select: select,
    input: input,
    erase: erase,
    hint: hint,
    fmtTime: fmtTime,
    SEEDS: SEEDS
  };
})();
