/* <ttt-score> shows the running score from the shared store.
 * Same store as the board: zero prop drilling, zero duplication.
 *
 * Example:
 *   <ttt-score>
 *     X <span data-bind="score.X"></span>
 *   </ttt-score>
 */
Laghu.define("ttt-score", function () {
  const store = Laghu.store("ttt");
  return {
    state: store,
    actions: {
      resetAll: function () {
        TttStore.resetAll(store);
      },
    },
  };
});
