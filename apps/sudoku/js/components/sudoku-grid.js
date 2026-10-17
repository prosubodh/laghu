/* <sudoku-grid> renders 81 keyed cells plus status, timer, and
 * mistake readouts. Cells are data-for rows; the row action selects
 * through the store. Keyboard play works because the wrapper is
 * focusable and data-on:keydown reads $event.key (writes flow to the
 * owning scope through Laghu.set semantics).
 *
 * Cell classes: .given (clue), .sel (selected), .same (same digit as
 * selection), .err (conflict). All precomputed or scope-readable so
 * templates stay free of function calls with arguments.
 */
Laghu.define("sudoku-grid", function () {
  const store = Laghu.store("sudoku");
  return {
    state: store,
    actions: {
      select: function () {
        SudokuStore.select(store, Laghu.get(this, "c.id"));
      },
      key: function () {
        const k = (Laghu.get(this, "$event") || {}).key;
        if (!k) return;
        if (k >= "1" && k <= "9") SudokuStore.input(store, Number(k));
        else if (k === "Backspace" || k === "Delete" || k === "0") SudokuStore.erase(store);
        else if (k === "ArrowUp") SudokuStore.select(store, move(store.selected, -9));
        else if (k === "ArrowDown") SudokuStore.select(store, move(store.selected, 9));
        else if (k === "ArrowLeft") SudokuStore.select(store, move(store.selected, -1));
        else if (k === "ArrowRight") SudokuStore.select(store, move(store.selected, 1));
      },
    },
  };

  function move(i, d) {
    if (i < 0) return 40;
    let n = i + d;
    if (n < 0) n = 0;
    if (n > 80) n = 80;
    if ((d === -1 || d === 1) && ((n / 9) | 0) !== ((i / 9) | 0)) return i;
    return n;
  }
});
