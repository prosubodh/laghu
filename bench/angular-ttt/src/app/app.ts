import { Component, signal, computed } from "@angular/core";

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

interface Win {
  b: string;
  line: number[];
}

function winnerOf(cells: (string | null)[]): Win | null {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return { b: cells[a] as string, line: [a, b, c] };
    }
  }
  if (cells.every(Boolean)) return { b: "D", line: [] };
  return null;
}

@Component({
  imports: [],
  selector: "app-root",
  styles: [
    `
      .board {
        display: grid;
        grid-template-columns: repeat(3, 96px);
        gap: 8px;
      }
      .cell {
        width: 96px;
        height: 96px;
        font-size: 40px;
        cursor: pointer;
      }
      .cell.win {
        background: #b7f0b7;
      }
      #status {
        font-weight: bold;
        min-height: 1.5em;
      }
      #score {
        color: #444;
      }
    `,
  ],
  template: `
    <h1>TicTacToe</h1>
    <p id="status">{{ status() }}</p>
    <div class="board">
      @for (v of cells(); track $index) {
        <button
          class="cell"
          [class.win]="winner() && winner()!.line.includes($index)"
          (click)="place($index)"
        >
          {{ v }}
        </button>
      }
    </div>
    <p><button (click)="newRound()">New round</button></p>
    <p id="score">
      X <span>{{ score().X }}</span> - O <span>{{ score().O }}</span> - draws
      <span>{{ score().D }}</span>
    </p>
    <p><button (click)="resetAll()">Reset all</button></p>
  `,
})
export class App {
  protected cells = signal<(string | null)[]>(Array(9).fill(null));
  protected turn = signal("X");
  protected winner = signal<Win | null>(null);
  protected score = signal({ X: 0, O: 0, D: 0 });

  protected status = computed(() => {
    const w = this.winner();
    if (!w) return "Turn: " + this.turn();
    if (w.b === "D") return "Draw. New round?";
    return "Winner: " + w.b + ". New round?";
  });

  protected place(i: number): void {
    const cells = this.cells();
    if (cells[i] || this.winner()) return;
    const next = cells.slice();
    next[i] = this.turn();
    const w = winnerOf(next);
    this.cells.set(next);
    if (w) {
      this.winner.set(w);
      const s = { ...this.score() };
      (s as Record<string, number>)[w.b]++;
      this.score.set(s);
    } else {
      this.turn.set(this.turn() === "X" ? "O" : "X");
    }
  }

  protected newRound(): void {
    this.cells.set(Array(9).fill(null));
    this.turn.set("X");
    this.winner.set(null);
  }

  protected resetAll(): void {
    this.newRound();
    this.score.set({ X: 0, O: 0, D: 0 });
  }
}
