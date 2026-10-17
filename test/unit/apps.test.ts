import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach } from "vite-plus/test";
import { Laghu } from "../../src/laghu";
import { tick } from "../setup";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

function bootApp(dir: string, files: string[]) {
  const html = fs.readFileSync(path.join(root, "apps", dir, "index.html"), "utf8");
  document.body.innerHTML = `<div id="app-root">${html}</div>`;
  (window as any).Laghu = Laghu;
  for (const f of files) {
    window.eval(fs.readFileSync(path.join(root, "apps", dir, f), "utf8"));
  }
}

beforeEach(() => {
  (window as any).Laghu = Laghu;
});

function cells() {
  return [...document.querySelectorAll("ttt-board .cell")] as HTMLElement[];
}

describe("tictactoe app", () => {
  it("plays X to a top-row win with guards and rounds", async () => {
    bootApp("tictactoe", [
      "js/lib/game.js",
      "js/store.js",
      "js/app.js",
      "js/components/ttt-board.js",
      "js/components/ttt-score.js",
    ]);
    await tick(30);
    expect(cells().length).toBe(9);
    expect(document.querySelector("#status")!.textContent).toBe("Turn: X");
    for (const i of [0, 3, 1, 4, 2]) {
      cells()[i].click();
      await tick();
    }
    const st: any = (document.querySelector("ttt-board") as any).state;
    expect(st.winner && st.winner.b).toBe("X");
    expect(document.querySelector("#status")!.textContent).toContain("Winner: X");
    expect((document.querySelector("ttt-score") as any).state.score.X).toBe(1);
    expect(cells().filter((b) => b.classList.contains("win")).length).toBe(3);
    cells()[5].click();
    await tick();
    expect(cells()[5].textContent).toBe("");
    [...document.querySelectorAll("ttt-board button")]
      .find((b) => b.textContent === "New round")!
      .click();
    await tick(30);
    expect(cells().every((b) => b.textContent === "")).toBe(true);
    expect((document.querySelector("ttt-board") as any).state.winner).toBeNull();
    cells()[0].click();
    await tick();
    cells()[0].click();
    await tick();
    expect(cells()[0].textContent).toBe("X");
    expect((document.querySelector("ttt-board") as any).state.turn).toBe("O");
    [...document.querySelectorAll("ttt-score button")]
      .find((b) => b.textContent === "Reset all")!
      .click();
    await tick();
    expect((document.querySelector("ttt-score") as any).state.score).toEqual({ X: 0, O: 0, D: 0 });
  });
});

describe("sudoku app", () => {
  it("selects, inputs, erases, hints, levels, keys, and wins", async () => {
    bootApp("sudoku", [
      "js/lib/sudoku.js",
      "js/store.js",
      "js/app.js",
      "js/components/sudoku-grid.js",
      "js/components/sudoku-pad.js",
    ]);
    await tick(40);
    const grid = document.querySelector("sudoku-grid") as any;
    const st: any = grid.state;
    expect(document.querySelectorAll("sudoku-grid .cell").length).toBe(81);
    expect(st.cells.filter((c: any) => !c.given).length).toBe(32);
    expect(document.querySelector("#clock")!.textContent).toBe("00:00");
    const emptyIdx = st.cells.findIndex((c: any) => !c.given);
    document.querySelectorAll("sudoku-grid .cell")[emptyIdx].click();
    await tick();
    expect(st.selected).toBe(emptyIdx);
    const right = st.solution[emptyIdx];
    [...document.querySelectorAll("sudoku-pad .pad button")]
      .find((b) => b.textContent === String(right))!
      .click();
    await tick();
    expect(st.cells[emptyIdx].v).toBe(right);
    expect(st.mistakes).toBe(0);
    const empty2 = st.cells.findIndex((c: any, i: number) => !c.given && !c.v && i !== emptyIdx);
    document.querySelectorAll("sudoku-grid .cell")[empty2].click();
    await tick();
    const wrong = (st.solution[empty2] % 9) + 1;
    [...document.querySelectorAll("sudoku-pad .pad button")]
      .find((b) => b.textContent === String(wrong))!
      .click();
    await tick();
    expect(st.cells[empty2].err).toBe(true);
    expect(st.mistakes).toBe(1);
    [...document.querySelectorAll("sudoku-pad .pad button")]
      .find((b) => b.textContent === "erase")!
      .click();
    await tick();
    expect(st.cells[empty2].v).toBe(0);
    const hints0 = st.hints;
    [...document.querySelectorAll("sudoku-pad .pad button")]
      .find((b) => (b.textContent || "").includes("hint"))!
      .click();
    await tick();
    expect(st.hints).toBe(hints0 - 1);
    expect(st.cells[empty2].v).toBe(st.solution[empty2]);
    [...document.querySelectorAll("sudoku-pad .levels button")]
      .find((b) => b.textContent === "Medium")!
      .click();
    await tick(40);
    expect(grid.state.cells.filter((c: any) => !c.given).length).toBe(42);
    const cur: any = grid.state;
    for (let i = 0; i < 81; i++) {
      if (!cur.cells[i].given && cur.cells[i].v !== cur.solution[i]) {
        document.querySelectorAll("sudoku-grid .cell")[i].click();
        [...document.querySelectorAll("sudoku-pad .pad button")]
          .find((b) => b.textContent === String(cur.solution[i]))!
          .click();
      }
    }
    await tick(40);
    expect(cur.status).toBe("won");
    expect((document.querySelector("#won") as HTMLElement).hidden).toBe(false);
  });
});
