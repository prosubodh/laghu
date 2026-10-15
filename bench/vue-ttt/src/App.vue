<script setup>
import { ref, reactive, computed } from 'vue'

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function winnerOf(cells) {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return { b: cells[a], line: [a, b, c] }
    }
  }
  if (cells.every(Boolean)) return { b: 'D', line: [] }
  return null
}

const cells = ref(Array(9).fill(null))
const turn = ref('X')
const winner = ref(null)
const score = reactive({ X: 0, O: 0, D: 0 })

const status = computed(() => {
  if (!winner.value) return 'Turn: ' + turn.value
  if (winner.value.b === 'D') return 'Draw. New round?'
  return 'Winner: ' + winner.value.b + '. New round?'
})

function place(i) {
  if (cells.value[i] || winner.value) return
  const next = cells.value.slice()
  next[i] = turn.value
  const w = winnerOf(next)
  cells.value = next
  if (w) {
    winner.value = w
    score[w.b]++
  } else {
    turn.value = turn.value === 'X' ? 'O' : 'X'
  }
}

function newRound() {
  cells.value = Array(9).fill(null)
  turn.value = 'X'
  winner.value = null
}

function resetAll() {
  newRound()
  score.X = 0
  score.O = 0
  score.D = 0
}
</script>

<template>
  <h1>TicTacToe</h1>
  <p id="status">{{ status }}</p>
  <div class="board">
    <button
      v-for="(v, i) in cells"
      :key="i"
      class="cell"
      :class="{ win: winner && winner.line.includes(i) }"
      @click="place(i)"
    >{{ v }}</button>
  </div>
  <p><button @click="newRound">New round</button></p>
  <p id="score">X <span>{{ score.X }}</span> - O <span>{{ score.O }}</span> - draws <span>{{ score.D }}</span></p>
  <p><button @click="resetAll">Reset all</button></p>
</template>

<style>
body { font-family: system-ui, sans-serif; max-width: 320px; margin: 24px auto; }
.board { display: grid; grid-template-columns: repeat(3, 96px); gap: 8px; }
.cell { width: 96px; height: 96px; font-size: 40px; cursor: pointer; }
.cell.win { background: #b7f0b7; }
#status { font-weight: bold; min-height: 1.5em; }
#score { color: #444; }
</style>
