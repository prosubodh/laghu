/* Sudoku logic. Framework-free: no laghu calls, portable anywhere.
 * Grids are arrays of 81 numbers (0 is empty). A deterministic seeded
 * generator shuffles a base pattern, then digs holes while a counting
 * solver confirms a unique solution. Errors surface through duplicate
 * detection, so casual play never flags a valid alternate path wrong. */
var SudokuLib = (function () {
  'use strict';

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function baseSolution() {
    var g = [];
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        g.push(((3 * (r % 3) + ((r / 3) | 0) + c) % 9) + 1);
      }
    }
    return g;
  }

  function shuffleSolution(sol, seed) {
    var rand = mulberry32(seed);
    var g = sol.slice();
    function row(r) { return g.slice(r * 9, r * 9 + 9); }
    function setRow(r, vals) { for (var c = 0; c < 9; c++) g[r * 9 + c] = vals[c]; }
    var bands = shuffled([0, 1, 2], rand);
    var out = [];
    for (var b = 0; b < 3; b++) {
      var rows = shuffled([0, 1, 2], rand);
      for (var k = 0; k < 3; k++) out.push(row(bands[b] * 3 + rows[k]));
    }
    var flat = [];
    for (var i = 0; i < 9; i++) for (var c2 = 0; c2 < 9; c2++) flat.push(out[i][c2]);
    g = flat;
    var stacks = shuffled([0, 1, 2], rand);
    var cols = [];
    for (var s = 0; s < 3; s++) {
      var inner = shuffled([0, 1, 2], rand);
      for (var m = 0; m < 3; m++) cols.push(stacks[s] * 3 + inner[m]);
    }
    var g2 = [];
    for (var r2 = 0; r2 < 9; r2++) {
      for (var c3 = 0; c3 < 9; c3++) g2.push(g[r2 * 9 + cols[c3]]);
    }
    var perm = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rand);
    return g2.map(function (v) { return perm[v - 1]; });
  }

  function peersOf(i) {
    var r = (i / 9) | 0, c = i % 9;
    var set = {};
    for (var k = 0; k < 9; k++) {
      set[r * 9 + k] = 1;
      set[k * 9 + c] = 1;
      set[((r / 3) | 0) * 27 + ((c / 3) | 0) * 3 + ((k / 3) | 0) * 9 + (k % 3)] = 1;
    }
    delete set[i];
    return Object.keys(set).map(Number);
  }

  var PEERS = [];
  for (var p = 0; p < 81; p++) PEERS.push(peersOf(p));

  function candidates(grid, i) {
    if (grid[i]) return [];
    var used = {};
    var ps = PEERS[i];
    for (var k = 0; k < ps.length; k++) used[grid[ps[k]]] = 1;
    var out = [];
    for (var v = 1; v <= 9; v++) if (!used[v]) out.push(v);
    return out;
  }

  function countSolutions(grid, limit) {
    var best = -1, bestCands = null;
    for (var i = 0; i < 81; i++) {
      if (!grid[i]) {
        var c = candidates(grid, i);
        if (!c.length) return 0;
        if (!bestCands || c.length < bestCands.length) { best = i; bestCands = c; }
      }
    }
    if (best < 0) return 1;
    var total = 0;
    for (var k = 0; k < bestCands.length; k++) {
      grid[best] = bestCands[k];
      total += countSolutions(grid, limit);
      grid[best] = 0;
      if (total >= limit) return total;
    }
    return total;
  }

  var HOLES = { easy: 32, medium: 42, hard: 50 };

  function generate(difficulty, seed) {
    var sol = shuffleSolution(baseSolution(), seed);
    var puzzle = sol.slice();
    var order = shuffled(Object.keys(puzzle).map(Number), mulberry32(seed + 7));
    var target = HOLES[difficulty] || HOLES.easy;
    var dug = 0;
    for (var k = 0; k < order.length && dug < target; k++) {
      var i = order[k];
      var backup = puzzle[i];
      puzzle[i] = 0;
      var test = puzzle.slice();
      if (countSolutions(test, 2) !== 1) puzzle[i] = backup;
      else dug++;
    }
    return { puzzle: puzzle, solution: sol };
  }

  function conflicts(cells) {
    var bad = [];
    for (var i = 0; i < 81; i++) bad.push(false);
    function markDup(indices) {
      var seen = {};
      for (var k = 0; k < indices.length; k++) {
        var v = cells[indices[k]];
        if (!v) continue;
        if (seen[v] !== undefined) { bad[indices[k]] = true; bad[seen[v]] = true; }
        else seen[v] = indices[k];
      }
    }
    for (var r = 0; r < 9; r++) {
      var row = [], col = [], box = [];
      for (var c = 0; c < 9; c++) {
        row.push(r * 9 + c);
        col.push(c * 9 + r);
        box.push(((r / 3) | 0) * 27 + (r % 3) * 3 + ((c / 3) | 0) * 9 + (c % 3));
      }
      markDup(row); markDup(col); markDup(box);
    }
    return bad;
  }

  function isComplete(cells) {
    for (var i = 0; i < 81; i++) if (!cells[i]) return false;
    var bad = conflicts(cells);
    for (var k = 0; k < 81; k++) if (bad[k]) return false;
    return true;
  }

  return {
    generate: generate,
    conflicts: conflicts,
    isComplete: isComplete,
    countSolutions: countSolutions,
    HOLES: HOLES
  };
})();
