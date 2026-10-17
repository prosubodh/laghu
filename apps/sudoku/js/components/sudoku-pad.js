/* <sudoku-pad> digit entry, erase, hint, and difficulty buttons.
 * Digits loop with data-for so the row action reads its own digit
 * (Laghu.get(this, 'd.v')). Difficulty buttons do the same with
 * Laghu.get(this, 'l.id'). One shared store, zero duplication.
 */
Laghu.define("sudoku-pad", function () {
  const store = Laghu.store("sudoku");
  return {
    state: store,
    actions: {
      put: function () {
        SudokuStore.input(store, Laghu.get(this, "d.v"));
      },
      erase: function () {
        SudokuStore.erase(store);
      },
      hint: function () {
        SudokuStore.hint(store);
      },
      level: function () {
        SudokuStore.newGame(store, Laghu.get(this, "l.id"));
      },
    },
  };
});
