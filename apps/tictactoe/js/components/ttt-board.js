/* <ttt-board> renders the 3x3 grid from the shared store.
 *
 * Markup contract: authors write one <template data-for> loop; rows
 * read position with Laghu.get(this, 'i') and write through the store
 * (never `this.x = ...` on row scope). Winning cells get .win via the
 * precomputed cell.win flag. Status line binds store.status.
 *
 * Example:
 *   <ttt-board>
 *     <p data-bind="status"></p>
 *     <div class="board">
 *       <template data-for="c in cells" data-key="id"> ... </template>
 *     </div>
 *   </ttt-board>
 */
Laghu.define("ttt-board", function () {
  var store = Laghu.store("ttt");
  return {
    state: store,
    actions: {
      place: function () {
        var i = Laghu.get(this, "i");
        TttStore.place(store, i);
      },
      newRound: function () {
        TttStore.newRound(store);
      },
    },
  };
});
