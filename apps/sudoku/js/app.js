/* Sudoku entry point. Creates the store and starts an easy game,
 * then registers the shared clock directive (ticks store.seconds
 * while a game is playing; removal clears the interval). */
Laghu.store("sudoku", SudokuStore.initial());
SudokuStore.newGame(Laghu.store("sudoku"), "easy");

Laghu.directive("clock", function (ctx) {
  const id = setInterval(function () {
    if (ctx.scope.status === "playing") {
      ctx.scope.seconds++;
      ctx.scope.clock = SudokuStore.fmtTime(ctx.scope.seconds);
    }
  }, 1000);
  return function () {
    clearInterval(id);
  };
});
