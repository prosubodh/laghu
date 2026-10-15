import { useState } from 'react'
import './App.css'

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

export default function App() {
  const [cells, setCells] = useState(() => Array(9).fill(null))
  const [turn, setTurn] = useState('X')
  const [winner, setWinner] = useState(null)
  const [score, setScore] = useState({ X: 0, O: 0, D: 0 })

  const status = !winner
    ? 'Turn: ' + turn
    : winner.b === 'D'
      ? 'Draw. New round?'
      : 'Winner: ' + winner.b + '. New round?'

  function place(i) {
    if (cells[i] || winner) return
    const next = cells.slice()
    next[i] = turn
    const w = winnerOf(next)
    setCells(next)
    if (w) {
      setWinner(w)
      setScore((s) => ({ ...s, [w.b]: s[w.b] + 1 }))
    } else {
      setTurn(turn === 'X' ? 'O' : 'X')
    }
  }

  function newRound() {
    setCells(Array(9).fill(null))
    setTurn('X')
    setWinner(null)
  }

  function resetAll() {
    newRound()
    setScore({ X: 0, O: 0, D: 0 })
  }

  return (
    <>
      <h1>TicTacToe</h1>
      <p id="status">{status}</p>
      <div className="board">
        {cells.map((v, i) => (
          <button
            key={i}
            className={'cell' + (winner && winner.line.includes(i) ? ' win' : '')}
            onClick={() => place(i)}
          >{v}</button>
        ))}
      </div>
      <p><button onClick={newRound}>New round</button></p>
      <p id="score">X <span>{score.X}</span> - O <span>{score.O}</span> - draws <span>{score.D}</span></p>
      <p><button onClick={resetAll}>Reset all</button></p>
    </>
  )
}
