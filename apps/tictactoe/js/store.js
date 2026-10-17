/* TicTacToe shared state. One store, read by the board, the status
 * line, and the scoreboard. Cells are objects (not primitives) so row
 * actions can mutate them without scope shadowing. See apps/README. */
var TttStore = (function () {
  "use strict";

  function freshCells() {
    var out = [];
    for (var i = 0; i < 9; i++) out.push({ id: i, v: null, win: false });
    return out;
  }

  function initial() {
    return {
      cells: freshCells(),
      turn: "X",
      winner: null,
      status: "Turn: X",
      score: { X: 0, O: 0, D: 0 },
    };
  }

  function refresh(store) {
    var vals = store.cells.map(function (c) {
      return c.v;
    });
    var w = TttGame.winnerOf(vals);
    store.winner = w;
    for (var i = 0; i < 9; i++) {
      store.cells[i].win = !!(w && w.line.indexOf(i) >= 0);
    }
    if (w) store.score[w.b]++;
    store.status = TttGame.statusText(store);
  }

  function place(store, i) {
    var cell = store.cells[i];
    if (!cell || cell.v || store.winner) return false;
    cell.v = store.turn;
    if (!store.winner) store.turn = store.turn === "X" ? "O" : "X";
    refresh(store);
    return true;
  }

  function newRound(store) {
    store.cells = freshCells();
    store.turn = "X";
    store.winner = null;
    store.status = TttGame.statusText(store);
  }

  function resetAll(store) {
    var s = initial();
    store.cells = s.cells;
    store.turn = s.turn;
    store.winner = s.winner;
    store.status = s.status;
    store.score = s.score;
  }

  return {
    initial: initial,
    refresh: refresh,
    place: place,
    newRound: newRound,
    resetAll: resetAll,
  };
})();
