/* Sudoku logic. Framework-free: no laghu calls, portable anywhere.
 * Grids are arrays of 81 numbers (0 is empty). A deterministic seeded
 * generator shuffles a base pattern, then digs holes while a counting
 * solver confirms a unique solution. Errors surface through duplicate
 * detection, so casual play never flags a valid alternate path wrong. */
const SudokuLib = (function () {
  "use strict";

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function baseSolution() {
    const g = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        g.push(((3 * (r % 3) + ((r / 3) | 0) + c) % 9) + 1);
      }
    }
    return g;
  }

  function shuffleSolution(sol, seed) {
    const rand = mulberry32(seed);
    let g = sol.slice();
    function row(r) {
      return g.slice(r * 9, r * 9 + 9);
    }
    const bands = shuffled([0, 1, 2], rand);
    const out = [];
    for (let b = 0; b < 3; b++) {
      const rows = shuffled([0, 1, 2], rand);
      for (let k = 0; k < 3; k++) out.push(row(bands[b] * 3 + rows[k]));
    }
    const flat = [];
    for (let i = 0; i < 9; i++) for (let c2 = 0; c2 < 9; c2++) flat.push(out[i][c2]);
    g = flat;
    const stacks = shuffled([0, 1, 2], rand);
    const cols = [];
    for (let s = 0; s < 3; s++) {
      const inner = shuffled([0, 1, 2], rand);
      for (let m = 0; m < 3; m++) cols.push(stacks[s] * 3 + inner[m]);
    }
    const g2 = [];
    for (let r2 = 0; r2 < 9; r2++) {
      for (let c3 = 0; c3 < 9; c3++) g2.push(g[r2 * 9 + cols[c3]]);
    }
    const perm = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rand);
    return g2.map(function (v) {
      return perm[v - 1];
    });
  }

  function peersOf(i) {
    const r = (i / 9) | 0;
    const c = i % 9;
    const set = {};
    for (let k = 0; k < 9; k++) {
      set[r * 9 + k] = 1;
      set[k * 9 + c] = 1;
      set[((r / 3) | 0) * 27 + ((c / 3) | 0) * 3 + ((k / 3) | 0) * 9 + (k % 3)] = 1;
    }
    delete set[i];
    return Object.keys(set).map(Number);
  }

  const PEERS = [];
  for (let p = 0; p < 81; p++) PEERS.push(peersOf(p));

  function candidates(grid, i) {
    if (grid[i]) return [];
    const used = {};
    const ps = PEERS[i];
    for (let k = 0; k < ps.length; k++) used[grid[ps[k]]] = 1;
    const out = [];
    for (let v = 1; v <= 9; v++) if (!used[v]) out.push(v);
    return out;
  }

  function countSolutions(grid, limit) {
    let best = -1;
    let bestCands = null;
    for (let i = 0; i < 81; i++) {
      if (!grid[i]) {
        const c = candidates(grid, i);
        if (!c.length) return 0;
        if (!bestCands || c.length < bestCands.length) {
          best = i;
          bestCands = c;
        }
      }
    }
    if (best < 0) return 1;
    let total = 0;
    for (let k = 0; k < bestCands.length; k++) {
      grid[best] = bestCands[k];
      total += countSolutions(grid, limit);
      grid[best] = 0;
      if (total >= limit) return total;
    }
    return total;
  }

  const HOLES = { easy: 32, medium: 42, hard: 50 };

  function generate(difficulty, seed) {
    const sol = shuffleSolution(baseSolution(), seed);
    const puzzle = sol.slice();
    const order = shuffled(Object.keys(puzzle).map(Number), mulberry32(seed + 7));
    const target = HOLES[difficulty] || HOLES.easy;
    let dug = 0;
    for (let k = 0; k < order.length && dug < target; k++) {
      const i = order[k];
      const backup = puzzle[i];
      puzzle[i] = 0;
      const test = puzzle.slice();
      if (countSolutions(test, 2) !== 1) puzzle[i] = backup;
      else dug++;
    }
    return { puzzle: puzzle, solution: sol };
  }

  function conflicts(cells) {
    const bad = [];
    for (let i = 0; i < 81; i++) bad.push(false);
    function markDup(indices) {
      const seen = {};
      for (let k = 0; k < indices.length; k++) {
        const v = cells[indices[k]];
        if (!v) continue;
        if (seen[v] !== undefined) {
          bad[indices[k]] = true;
          bad[seen[v]] = true;
        } else seen[v] = indices[k];
      }
    }
    for (let r = 0; r < 9; r++) {
      const row = [];
      const col = [];
      const box = [];
      for (let c = 0; c < 9; c++) {
        row.push(r * 9 + c);
        col.push(c * 9 + r);
        box.push(((r / 3) | 0) * 27 + (r % 3) * 3 + ((c / 3) | 0) * 9 + (c % 3));
      }
      markDup(row);
      markDup(col);
      markDup(box);
    }
    return bad;
  }

  function isComplete(cells) {
    for (let i = 0; i < 81; i++) if (!cells[i]) return false;
    const bad = conflicts(cells);
    for (let k = 0; k < 81; k++) if (bad[k]) return false;
    return true;
  }

  return {
    generate: generate,
    conflicts: conflicts,
    isComplete: isComplete,
    countSolutions: countSolutions,
    HOLES: HOLES,
  };
})();

if (typeof window !== "undefined") {
  window.SudokuLib = SudokuLib;
}
