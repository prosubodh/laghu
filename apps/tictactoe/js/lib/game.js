/* TicTacToe rules. Framework-free: no laghu calls, portable anywhere.
 * Contract: cells are viewed as a plain array of 9 ('X', 'O', or null).
 * winnerOf returns null (playing), { b: 'X'|'O', line: [a,b,c] } (win),
 * or { b: 'D', line: [] } (draw). */
var TttGame = (function () {
  "use strict";
  var LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  function winnerOf(cells) {
    for (var k = 0; k < LINES.length; k++) {
      var line = LINES[k];
      var a = cells[line[0]];
      if (a && a === cells[line[1]] && a === cells[line[2]]) {
        return { b: a, line: line };
      }
    }
    for (var i = 0; i < 9; i++) {
      if (!cells[i]) return null;
    }
    return { b: "D", line: [] };
  }

  function statusText(store) {
    if (store.winner) {
      if (store.winner.b === "D") return "Draw. New round?";
      return "Winner: " + store.winner.b + ". New round?";
    }
    return "Turn: " + store.turn;
  }

  return { winnerOf: winnerOf, statusText: statusText, LINES: LINES };
})();
