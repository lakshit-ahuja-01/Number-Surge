/* ========================================================
   Math River — Game Logic (Commit 1: Project Setup)
   ========================================================
   
   Architecture Overview
   ---------------------
   The game logic is organized into clear sections:
   
   1. CONSTANTS     – Tunable values (duration, scoring, speeds)
   2. GAME STATE    – Single state object tracking everything
   3. DOM REFS      – Cached references to HTML elements
   4. SCREENS       – Functions to switch between start/game/gameover
   5. (Future)      – Number generation, movement, selection,
                      validation, scoring, timer, difficulty, audio
   ======================================================== */

// ─── 1. CONSTANTS ──────────────────────────────────────────
const CONFIG = Object.freeze({
  GAME_DURATION: 60,         // seconds
  POINTS_CORRECT: 10,        // base points per correct answer
  POINTS_WRONG: -3,          // penalty per wrong answer
  COMBO_BONUS: 5,            // extra points per combo level
  INITIAL_SPEED: 1,          // starting float speed (px/frame)
  INITIAL_NUM_COUNT: 6,      // starting number of floaters
  MIN_NUMBER: 1,             // smallest number that can appear
  MAX_NUMBER_START: 20,      // largest number at game start
});

// ─── 2. GAME STATE ─────────────────────────────────────────
/**
 * Single source of truth for the entire game.
 * Reset this object at the start of each new game.
 */
const gameState = {
  phase: 'menu',             // 'menu' | 'playing' | 'gameover'
  score: 0,
  timeLeft: CONFIG.GAME_DURATION,
  combo: 0,
  bestCombo: 0,
  solved: 0,
  wrongAnswers: 0,
  target: 0,                 // current target sum
  selected: [],              // ids of selected number elements (max 2)
  floaters: [],              // array of floating number objects
  animFrameId: null,         // requestAnimationFrame handle
  timerIntervalId: null,     // setInterval handle for countdown
};

// ─── 3. DOM REFERENCES ─────────────────────────────────────
const dom = {
  // Screens
  startScreen:    document.getElementById('start-screen'),
  gameScreen:     document.getElementById('game-screen'),
  gameoverScreen: document.getElementById('gameover-screen'),

  // Buttons
  startBtn:       document.getElementById('start-btn'),
  playAgainBtn:   document.getElementById('play-again-btn'),
  menuBtn:        document.getElementById('menu-btn'),

  // HUD
  scoreDisplay:   document.getElementById('score-display'),
  timerDisplay:   document.getElementById('timer-display'),
  comboDisplay:   document.getElementById('combo-display'),

  // Equation
  equationText:   document.getElementById('equation-text'),

  // Game area
  river:          document.getElementById('river'),

  // Game Over stats
  finalScore:     document.getElementById('final-score'),
  finalSolved:    document.getElementById('final-solved'),
  finalAccuracy:  document.getElementById('final-accuracy'),
  finalCombo:     document.getElementById('final-combo'),
};

// ─── 4. SCREEN MANAGEMENT ──────────────────────────────────
/**
 * Show exactly one screen and hide the others.
 * @param {'start' | 'game' | 'gameover'} screenName
 */
function showScreen(screenName) {
  dom.startScreen.classList.remove('active');
  dom.gameScreen.classList.remove('active');
  dom.gameoverScreen.classList.remove('active');

  switch (screenName) {
    case 'start':
      dom.startScreen.classList.add('active');
      break;
    case 'game':
      dom.gameScreen.classList.add('active');
      break;
    case 'gameover':
      dom.gameoverScreen.classList.add('active');
      break;
  }
}

// ─── 5. RESET STATE ────────────────────────────────────────
/** Reset gameState to initial values for a new game. */
function resetState() {
  gameState.phase = 'menu';
  gameState.score = 0;
  gameState.timeLeft = CONFIG.GAME_DURATION;
  gameState.combo = 0;
  gameState.bestCombo = 0;
  gameState.solved = 0;
  gameState.wrongAnswers = 0;
  gameState.target = 0;
  gameState.selected = [];
  gameState.floaters = [];
  gameState.animFrameId = null;
  gameState.timerIntervalId = null;
}

// ─── 6. EVENT LISTENERS ────────────────────────────────────
dom.startBtn.addEventListener('click', () => {
  resetState();
  gameState.phase = 'playing';
  showScreen('game');
  // TODO: start the game loop, timer, generate question
});

dom.playAgainBtn.addEventListener('click', () => {
  resetState();
  gameState.phase = 'playing';
  showScreen('game');
  // TODO: start the game loop, timer, generate question
});

dom.menuBtn.addEventListener('click', () => {
  resetState();
  showScreen('start');
});

// ─── INIT ──────────────────────────────────────────────────
showScreen('start');
