/* TicTacToe entry point. Creates the store, then components pick it
 * up by name. Nothing else to wire: custom elements upgrade on parse,
 * islands hydrate on DOMContentLoaded. */
Laghu.store("ttt", TttStore.initial());
