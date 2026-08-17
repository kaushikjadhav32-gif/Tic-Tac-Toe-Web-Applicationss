// ===================================================
// STATE
// ===================================================
let board = Array(9).fill(null);
let currentPlayer = "X";
let gameActive = true;

let gameMode = "pvp";       // "pvp" or "ai"
let difficulty = "easy";    // "easy" | "medium" | "hard"

// In AI mode, the human is always X and the computer is always O.
const HUMAN = "X";
const COMPUTER = "O";

const winningCombos = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

// ===================================================
// ELEMENT REFERENCES
// ===================================================
const cells = document.querySelectorAll(".cell");
const statusText = document.getElementById("status");
const resetButton = document.getElementById("reset");

const modeButtons = document.querySelectorAll("#modeGroup .toggle-btn");
const difficultyGroup = document.getElementById("difficultyGroup");
const difficultyButtons = document.querySelectorAll("#difficultyButtons .toggle-btn");

const themeToggle = document.getElementById("themeToggle");

const scoreXEl = document.getElementById("scoreX");
const scoreOEl = document.getElementById("scoreO");
const scoreDrawEl = document.getElementById("scoreDraw");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistory");

// ===================================================
// LOCAL STORAGE HELPERS
// Records need to survive a page refresh, so we read/write
// them to the browser's localStorage as JSON strings.
// ===================================================
function loadScores() {
  const saved = localStorage.getItem("ttt_scores");
  return saved ? JSON.parse(saved) : { X: 0, O: 0, draw: 0 };
}

function saveScores(scores) {
  localStorage.setItem("ttt_scores", JSON.stringify(scores));
}

function loadHistory() {
  const saved = localStorage.getItem("ttt_history");
  return saved ? JSON.parse(saved) : [];
}

function saveHistory(history) {
  localStorage.setItem("ttt_history", JSON.stringify(history));
}

let scores = loadScores();
let history = loadHistory();

// ===================================================
// MODE + DIFFICULTY SELECTION
// ===================================================
modeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    modeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    gameMode = btn.dataset.mode;

    difficultyGroup.classList.toggle("hidden", gameMode !== "ai");
    resetGame();
  });
});

difficultyButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    difficultyButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    difficulty = btn.dataset.level;
    resetGame();
  });
});

// Difficulty only matters in AI mode — hide it by default since pvp is default mode
difficultyGroup.classList.toggle("hidden", gameMode !== "ai");

// ===================================================
// THEME TOGGLE
// ===================================================
function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  themeToggle.textContent = theme === "light" ? "☀️ Light" : "🌙 Dark";
  localStorage.setItem("ttt_theme", theme);
}

themeToggle.addEventListener("click", () => {
  const isLight = document.body.classList.contains("light");
  applyTheme(isLight ? "dark" : "light");
});

// Apply saved theme on load (defaults to dark)
applyTheme(localStorage.getItem("ttt_theme") || "dark");

// ===================================================
// CELL CLICKS
// ===================================================
cells.forEach(cell => {
  cell.addEventListener("click", handleCellClick);
});

resetButton.addEventListener("click", resetGame);
clearHistoryBtn.addEventListener("click", () => {
  scores = { X: 0, O: 0, draw: 0 };
  history = [];
  saveScores(scores);
  saveHistory(history);
  renderScores();
  renderHistory();
});

function handleCellClick(event) {
  const index = Number(event.target.dataset.index);

  if (!gameActive || board[index] !== null) return;

  // In AI mode, ignore clicks when it's the computer's turn
  if (gameMode === "ai" && currentPlayer === COMPUTER) return;

  makeMove(index, currentPlayer);

  if (!gameActive) return;

  // If it's now the computer's turn, let it move after a short pause
  if (gameMode === "ai" && currentPlayer === COMPUTER) {
    statusText.textContent = "Computer is thinking...";
    setTimeout(computerMove, 500);
  }
}

// ===================================================
// SHARED MOVE LOGIC (used by both human and computer)
// ===================================================
function makeMove(index, player) {
  board[index] = player;

  const cell = cells[index];
  cell.textContent = player;
  cell.classList.add(player.toLowerCase());
  cell.disabled = true;

  const winningLine = checkWinner();

  if (winningLine) {
    endGame(player, winningLine);
    return;
  }

  if (board.every(value => value !== null)) {
    endGame(null, null); // draw
    return;
  }

  currentPlayer = player === "X" ? "O" : "X";
  statusText.textContent =
    gameMode === "ai" && currentPlayer === COMPUTER
      ? "Computer is thinking..."
      : `Player ${currentPlayer}'s turn`;
}

function endGame(winner, winningLine) {
  gameActive = false;

  if (winner) {
    statusText.textContent =
      gameMode === "ai" && winner === COMPUTER
        ? "Computer wins!"
        : `Player ${winner} wins! 🎉`;
    highlightWin(winningLine);
    scores[winner]++;
    recordHistory(winner);
  } else {
    statusText.textContent = "It's a draw!";
    scores.draw++;
    recordHistory(null);
  }

  saveScores(scores);
  saveHistory(history);
  renderScores();
  renderHistory();
}

function recordHistory(winner) {
  const label =
    winner === null ? "Draw" : gameMode === "ai" && winner === COMPUTER ? "Computer won" : `${winner} won`;

  const modeLabel = gameMode === "ai" ? `vs Computer (${difficulty})` : "1 vs 1";

  history.unshift({ label, modeLabel, time: new Date().toLocaleString() });
  history = history.slice(0, 10); // keep only the 10 most recent games
}

function checkWinner() {
  for (const combo of winningCombos) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return combo;
    }
  }
  return null;
}

function highlightWin(combo) {
  combo.forEach(index => cells[index].classList.add("win"));
}

// ===================================================
// COMPUTER AI
// Easy: random move.
// Hard: minimax — recursively simulates every possible
//       game to the end and picks the move that guarantees
//       the best outcome. It never loses.
// Medium: flips a coin between the two each turn.
// ===================================================
function computerMove() {
  if (!gameActive) return;

  const emptyIndexes = board.reduce((acc, val, i) => {
    if (val === null) acc.push(i);
    return acc;
  }, []);

  let chosenIndex;

  if (difficulty === "easy") {
    chosenIndex = randomMove(emptyIndexes);
  } else if (difficulty === "hard") {
    chosenIndex = bestMove();
  } else {
    // medium: 50% best move, 50% random
    chosenIndex = Math.random() < 0.5 ? bestMove() : randomMove(emptyIndexes);
  }

  makeMove(chosenIndex, COMPUTER);
}

function randomMove(emptyIndexes) {
  return emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
}

function bestMove() {
  let bestScore = -Infinity;
  let move = null;

  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = COMPUTER;
      const score = minimax(board, 0, false);
      board[i] = null; // undo — this was just a simulation

      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }
  return move;
}

// minimax explores every future move: the COMPUTER tries to
// maximize its score, the HUMAN tries to minimize it.
function minimax(currentBoard, depth, isMaximizing) {
  const winningLine = checkWinnerOnBoard(currentBoard);

  if (winningLine) {
    const winner = currentBoard[winningLine[0]];
    if (winner === COMPUTER) return 10 - depth;   // computer winning sooner is better
    if (winner === HUMAN) return depth - 10;      // human winning sooner is worse
  }

  if (currentBoard.every(v => v !== null)) return 0; // draw

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (currentBoard[i] === null) {
        currentBoard[i] = COMPUTER;
        best = Math.max(best, minimax(currentBoard, depth + 1, false));
        currentBoard[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (currentBoard[i] === null) {
        currentBoard[i] = HUMAN;
        best = Math.min(best, minimax(currentBoard, depth + 1, true));
        currentBoard[i] = null;
      }
    }
    return best;
  }
}

function checkWinnerOnBoard(b) {
  for (const combo of winningCombos) {
    const [a, bIdx, c] = combo;
    if (b[a] && b[a] === b[bIdx] && b[a] === b[c]) return combo;
  }
  return null;
}

// ===================================================
// RENDERING SCORES + HISTORY
// ===================================================
function renderScores() {
  scoreXEl.textContent = scores.X;
  scoreOEl.textContent = scores.O;
  scoreDrawEl.textContent = scores.draw;
}

function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<li class="empty-note">No games played yet.</li>';
    return;
  }

  historyList.innerHTML = history
    .map(
      entry => `
      <li>
        <span>${entry.modeLabel} — ${entry.time}</span>
        <span class="result">${entry.label}</span>
      </li>`
    )
    .join("");
}

// ===================================================
// RESET
// ===================================================
function resetGame() {
  board = Array(9).fill(null);
  currentPlayer = "X";
  gameActive = true;
  statusText.textContent = "Player X's turn";

  cells.forEach(cell => {
    cell.textContent = "";
    cell.disabled = false;
    cell.classList.remove("x", "o", "win");
  });
}

// ===================================================
// INITIAL RENDER
// ===================================================
renderScores();
renderHistory();