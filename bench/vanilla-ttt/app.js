/* TicTacToe, hand-written. No library, no build, no reactivity
 * system: direct DOM reads and writes, the baseline every framework
 * on this page must justify itself against. */
(function () {
  'use strict';
  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  var cells = Array(9).fill(null);
  var turn = 'X';
  var winner = null;
  var score = { X: 0, O: 0, D: 0 };

  var board = document.getElementById('board');
  var statusEl = document.getElementById('status');
  var btns = [];
  for (var i = 0; i < 9; i++) {
    (function (idx) {
      var b = document.createElement('button');
      b.className = 'cell';
      b.addEventListener('click', function () { place(idx); });
      board.appendChild(b);
      btns.push(b);
    })(i);
  }

  function winnerOf(c) {
    for (var k = 0; k < LINES.length; k++) {
      var l = LINES[k];
      if (c[l[0]] && c[l[0]] === c[l[1]] && c[l[0]] === c[l[2]]) {
        return { b: c[l[0]], line: l };
      }
    }
    for (var i = 0; i < 9; i++) if (!c[i]) return null;
    return { b: 'D', line: [] };
  }

  function render() {
    for (var i = 0; i < 9; i++) {
      btns[i].textContent = cells[i] || '';
      btns[i].classList.toggle('win', !!(winner && winner.line.indexOf(i) >= 0));
    }
    statusEl.textContent = !winner
      ? 'Turn: ' + turn
      : winner.b === 'D' ? 'Draw. New round?' : 'Winner: ' + winner.b + '. New round?';
    document.getElementById('sx').textContent = score.X;
    document.getElementById('so').textContent = score.O;
    document.getElementById('sd').textContent = score.D;
  }

  function place(i) {
    if (cells[i] || winner) return;
    cells[i] = turn;
    var w = winnerOf(cells);
    if (w) {
      winner = w;
      score[w.b]++;
    } else {
      turn = turn === 'X' ? 'O' : 'X';
    }
    render();
  }

  document.getElementById('round').addEventListener('click', function () {
    cells = Array(9).fill(null);
    turn = 'X';
    winner = null;
    render();
  });

  document.getElementById('reset').addEventListener('click', function () {
    cells = Array(9).fill(null);
    turn = 'X';
    winner = null;
    score = { X: 0, O: 0, D: 0 };
    render();
  });

  render();
})();
