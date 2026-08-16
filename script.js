/* ========================================================
   Number Surge — Game Logic
   ========================================================

   Architecture
   ─────────────────────────────────────────────────────────
   1.  CONFIG        – Frozen constants (scoring, speeds, timing)
   2.  MODES         – Definitions for all 5 game modes
   3.  GAME STATE    – Central state object
   4.  DOM REFS      – Cached element references
   5.  SCREEN MGMT  – show / hide screens
   6.  QUESTION GEN  – Target + guaranteed-solvable numbers per mode
   7.  FLOATER SYS   – Create / move / remove floating bubbles
   8.  SELECTION     – Click handling
   9.  VALIDATION    – Correct / wrong answer logic
  10.  SCORING       – Points, combos, speed bonus
  11.  SPEED BAR     – Draining bar that rewards fast answers
  12.  TIMER         – 60-second countdown
  13.  HUD           – Update display values
  14.  GAME LOOP     – requestAnimationFrame movement
  15.  GAME OVER     – End state + stats
  16.  AUDIO         – Web Audio API synthesis
  17.  START / RESET – Game flow
  18.  EVENTS        – Button listeners, mode picker, keyboard
   ======================================================== */

'use strict';

// ─── 1. CONFIG ───────────────────────────────────────────────
const CONFIG = Object.freeze({
  GAME_DURATION:        60,     // seconds
  POINTS_CORRECT:       10,     // base points per correct answer
  POINTS_WRONG:         -3,     // penalty (score floor is 0)
  COMBO_BONUS:          5,      // extra points per combo level above 1
  SPEED_MAX_BONUS:      20,     // max extra points for instant answer
  SPEED_WINDOW:         8,      // seconds in which full speed bonus decays
  INITIAL_SPEED:        0.55,   // px/frame at 60fps, starting difficulty
  MAX_SPEED:            2.8,    // cap
  INITIAL_NUM_COUNT:    12,     // floaters at game start (more numbers!)
  MAX_NUM_COUNT:        20,     // cap
  MIN_NUMBER:           1,
  MAX_NUMBER_START:     20,
  MAX_NUMBER_CAP:       99,
  FLOATER_SIZE:         58,     // must match --bubble in CSS
  SPAWN_MARGIN:         36,
  DIFFICULTY_INTERVAL:  3,      // solved questions between difficulty bumps
  BUBBLE_HUES: ['hue-blue','hue-purple','hue-teal','hue-rose'],
});

// ─── 2. GAME MODES ───────────────────────────────────────────
/**
 * Each mode defines:
 *  label      – Short display name for the badge
 *  symbol     – Operator symbol shown in the equation
 *  generateQ  – fn(difficulty) → { target, operandA, operandB, check(a,b) }
 *
 * generateQ guarantees at least one valid pair exists in the pool.
 */
const MODES = {
  addition: {
    label:  '+',
    badge:  'ADD',
    symbol: '+',
    /** target = a + b  →  need two numbers that SUM to target */
    generateQ(diffLevel) {
      const max = getMaxNumber(diffLevel);
      const minT = 5, maxT = Math.min(Math.floor(max * 1.8), 99);
      const target = randInt(minT, maxT);
      const minA = Math.max(CONFIG.MIN_NUMBER, target - max);
      const maxA = Math.min(max, target - CONFIG.MIN_NUMBER);
      const a = minA > maxA ? Math.floor(target / 2) : randInt(minA, maxA);
      const b = target - a;
      return { target, pairA: a, pairB: b, check: (x, y) => x + y === target };
    },
  },

  subtraction: {
    label:  '−',
    badge:  'SUB',
    symbol: '−',
    /** target = a − b  →  need a larger and a smaller number */
    generateQ(diffLevel) {
      const max = getMaxNumber(diffLevel);
      const target = randInt(1, Math.min(max - 1, 40));
      // a = target + b,  b ∈ [1, max-target]
      const b = randInt(1, Math.min(max - target, max - 1));
      const a = target + b;
      return { target, pairA: a, pairB: b, check: (x, y) => Math.abs(x - y) === target };
    },
  },

  multiplication: {
    label:  '×',
    badge:  'MUL',
    symbol: '×',
    /** target = a × b  →  need a factor pair */
    generateQ(diffLevel) {
      // Keep multiplication ranges reasonable
      const maxFactor = Math.min(3 + diffLevel, 12);
      const a = randInt(2, maxFactor);
      const b = randInt(2, maxFactor);
      const target = a * b;
      return { target, pairA: a, pairB: b, check: (x, y) => x * y === target };
    },
  },

  division: {
    label:  '÷',
    badge:  'DIV',
    symbol: '÷',
    /** target = a ÷ b  →  show dividend and divisor, player finds them */
    generateQ(diffLevel) {
      const maxFactor = Math.min(3 + diffLevel, 12);
      const b = randInt(2, maxFactor);            // divisor
      const target = randInt(1, maxFactor);        // quotient
      const a = target * b;                        // dividend
      return { target, pairA: a, pairB: b, check: (x, y) => {
        const big = Math.max(x, y), small = Math.min(x, y);
        return small !== 0 && big % small === 0 && big / small === target;
      }};
    },
  },

  mixed: {
    label:  '±',
    badge:  'MIX',
    symbol: '?',
    /** Randomly pick one of the four modes each question */
    generateQ(diffLevel) {
      const pick = ['addition','subtraction','multiplication','division'];
      const chosen = pick[randInt(0, pick.length - 1)];
      const q = MODES[chosen].generateQ(diffLevel);
      q.chosenMode = chosen;   // so we can show the right symbol
      return q;
    },
  },
};

// ─── 3. GAME STATE ───────────────────────────────────────────
const gameState = {
  phase:           'menu',       // 'menu' | 'playing' | 'gameover'
  mode:            'addition',   // current game mode key
  score:           0,
  timeLeft:        CONFIG.GAME_DURATION,
  combo:           0,
  bestCombo:       0,
  solved:          0,
  wrongAnswers:    0,
  target:          0,
  currentCheck:    null,         // fn(a,b) → bool for current question
  currentSymbol:   '+',
  selected:        [],           // floater IDs currently selected
  floaters:        [],           // { id, value, el, x, y, vx, vy }
  nextId:          0,
  animFrameId:     null,
  timerIntervalId: null,
  lastFrameTime:   0,
  difficultyLevel: 0,
  isMuted:         false,
  questionStartMs: 0,            // Date.now() when current question appeared
  bestSpeedBonus:  0,            // biggest single speed bonus this game
};

// ─── 4. DOM REFERENCES ───────────────────────────────────────
const dom = {
  startScreen:    document.getElementById('start-screen'),
  gameScreen:     document.getElementById('game-screen'),
  gameoverScreen: document.getElementById('gameover-screen'),

  startBtn:       document.getElementById('start-btn'),
  playAgainBtn:   document.getElementById('play-again-btn'),
  menuBtn:        document.getElementById('menu-btn'),
  soundToggle:    document.getElementById('sound-toggle'),
  modeGrid:       document.getElementById('mode-grid'),

  scoreDisplay:   document.getElementById('score-display'),
  timerDisplay:   document.getElementById('timer-display'),
  comboDisplay:   document.getElementById('combo-display'),
  speedBar:       document.getElementById('speed-bar'),
  speedBonusToast:document.getElementById('speed-bonus-toast'),

  equationText:   document.getElementById('equation-text'),
  modeBadge:      document.getElementById('mode-badge'),
  river:          document.getElementById('river'),

  hudScore:       document.getElementById('hud-score'),
  hudCombo:       document.getElementById('hud-combo'),

  finalScore:     document.getElementById('final-score'),
  finalSolved:    document.getElementById('final-solved'),
  finalAccuracy:  document.getElementById('final-accuracy'),
  finalCombo:     document.getElementById('final-combo'),
  finalSpeed:     document.getElementById('final-speed'),
};

// ─── 5. SCREEN MANAGEMENT ────────────────────────────────────
function showScreen(name) {
  [dom.startScreen, dom.gameScreen, dom.gameoverScreen]
    .forEach(s => s.classList.remove('active'));
  const map = { start: dom.startScreen, game: dom.gameScreen, gameover: dom.gameoverScreen };
  if (map[name]) map[name].classList.add('active');
}

// ─── 6. QUESTION GENERATION ──────────────────────────────────
function getMaxNumber(diffLevel) {
  const d = diffLevel !== undefined ? diffLevel : gameState.difficultyLevel;
  return Math.min(CONFIG.MAX_NUMBER_START + d * 8, CONFIG.MAX_NUMBER_CAP);
}

function getCurrentSpeed() {
  return Math.min(CONFIG.INITIAL_SPEED + gameState.difficultyLevel * 0.18, CONFIG.MAX_SPEED);
}

function getCurrentNumCount() {
  return Math.min(
    CONFIG.INITIAL_NUM_COUNT + Math.floor(gameState.difficultyLevel * 1.2),
    CONFIG.MAX_NUM_COUNT
  );
}

/**
 * Generate a new question for the active mode,
 * spawn floaters guaranteed to include at least one valid pair.
 */
function generateQuestion() {
  const modeDef = MODES[gameState.mode];
  const q = modeDef.generateQ(gameState.difficultyLevel);

  gameState.target      = q.target;
  gameState.currentCheck = q.check;

  // For mixed mode: use the chosen sub-mode's symbol
  let symbol = modeDef.symbol;
  let badge  = modeDef.badge;
  if (q.chosenMode) {
    symbol = MODES[q.chosenMode].symbol;
    badge  = MODES[q.chosenMode].badge;
  }
  gameState.currentSymbol = symbol;

  // Update equation display with pop animation
  dom.equationText.classList.remove('eq-pop');
  // Force reflow so animation restarts
  void dom.equationText.offsetWidth;
  dom.equationText.textContent = `_ ${symbol} _ = ${q.target}`;
  dom.equationText.classList.add('eq-pop');
  dom.modeBadge.textContent = badge;

  // Record when this question started (for speed bonus)
  gameState.questionStartMs = Date.now();
  resetSpeedBar();

  // Build number pool with guaranteed pair
  clearAllFloaters();
  const numbers = buildNumberPool(q, gameState.difficultyLevel);
  numbers.forEach(v => createFloater(v));
}

/**
 * Build a shuffled array of numbers containing the valid pair + distractors.
 */
function buildNumberPool(q, diffLevel) {
  const count = getCurrentNumCount();
  const max = getMaxNumber(diffLevel);
  const numbers = [q.pairA, q.pairB];

  // Sometimes add a second valid pair (60% chance if room)
  if (count >= 8 && Math.random() < 0.6) {
    // Try to generate another valid pair
    const q2 = MODES[gameState.mode === 'mixed' ? (q.chosenMode || 'addition') : gameState.mode]
                 .generateQ(diffLevel);
    // Only add if it's a different pair
    if (q2.pairA !== q.pairA || q2.pairB !== q.pairB) {
      numbers.push(q2.pairA, q2.pairB);
    }
  }

  // Fill with random distractors
  while (numbers.length < count) {
    numbers.push(randInt(CONFIG.MIN_NUMBER, max));
  }

  // Fisher-Yates shuffle
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }

  return numbers;
}

// ─── 7. FLOATER SYSTEM ───────────────────────────────────────
function createFloater(value) {
  const rw = dom.river.clientWidth;
  const rh = dom.river.clientHeight;
  const m  = CONFIG.SPAWN_MARGIN;
  const sz = CONFIG.FLOATER_SIZE;

  const x = randInt(m, Math.max(m + 1, rw - sz - m));
  const y = randInt(m, Math.max(m + 1, rh - sz - m));

  const speed = getCurrentSpeed();
  const angle = Math.random() * Math.PI * 2;
  const vx = Math.cos(angle) * speed * (.5 + Math.random() * .5);
  const vy = Math.sin(angle) * speed * (.5 + Math.random() * .5);

  const el = document.createElement('button');
  el.className = 'floater ' + CONFIG.BUBBLE_HUES[randInt(0, CONFIG.BUBBLE_HUES.length - 1)];
  el.textContent = value;
  el.setAttribute('aria-label', `Number ${value}`);
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.width  = `${sz}px`;
  el.style.height = `${sz}px`;

  const id = gameState.nextId++;
  el.dataset.floaterId = id;
  el.addEventListener('click', () => onFloaterClick(id));

  dom.river.appendChild(el);

  // Entrance animation: CSS class after a frame
  requestAnimationFrame(() => el.classList.add('visible'));

  const floater = { id, value, el, x, y, vx, vy };
  gameState.floaters.push(floater);
  return floater;
}

function clearAllFloaters() {
  gameState.floaters.forEach(f => f.el.parentNode && f.el.parentNode.removeChild(f.el));
  gameState.floaters = [];
  gameState.selected = [];
}

function removeFloater(id, reason = 'remove') {
  const idx = gameState.floaters.findIndex(f => f.id === id);
  if (idx === -1) return;

  const { el } = gameState.floaters[idx];
  if (reason === 'correct') {
    el.className = 'floater floater-correct';
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 150);
  } else {
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  gameState.floaters.splice(idx, 1);
}

// ─── 8. SELECTION ─────────────────────────────────────────────
function onFloaterClick(floaterId) {
  if (gameState.phase !== 'playing') return;

  const floater = gameState.floaters.find(f => f.id === floaterId);
  if (!floater) return;

  // Deselect if already selected
  const selIdx = gameState.selected.indexOf(floaterId);
  if (selIdx !== -1) {
    gameState.selected.splice(selIdx, 1);
    floater.el.classList.remove('floater-selected');
    playSound('click');
    return;
  }

  // Max 2 selected
  if (gameState.selected.length >= 2) return;

  gameState.selected.push(floaterId);
  floater.el.classList.add('floater-selected');
  playSound('click');

  if (gameState.selected.length === 2) {
    setTimeout(validateSelection, 140);
  }
}

// ─── 9. VALIDATION ────────────────────────────────────────────
function validateSelection() {
  if (gameState.selected.length !== 2) return;

  const f1 = gameState.floaters.find(f => f.id === gameState.selected[0]);
  const f2 = gameState.floaters.find(f => f.id === gameState.selected[1]);

  if (!f1 || !f2) { gameState.selected = []; return; }

  const correct = gameState.currentCheck
    ? gameState.currentCheck(f1.value, f2.value)
    : false;

  if (correct) {
    onCorrectAnswer(f1, f2);
  } else {
    onWrongAnswer(f1, f2);
  }
}

// ─── 10. SCORING ──────────────────────────────────────────────
/**
 * Calculate speed bonus: answers within SPEED_WINDOW seconds
 * get up to SPEED_MAX_BONUS extra points (linearly decaying).
 */
function calcSpeedBonus() {
  const elapsed = (Date.now() - gameState.questionStartMs) / 1000;
  if (elapsed >= CONFIG.SPEED_WINDOW) return 0;
  const ratio = 1 - elapsed / CONFIG.SPEED_WINDOW;
  return Math.round(CONFIG.SPEED_MAX_BONUS * ratio);
}

function onCorrectAnswer(f1, f2) {
  gameState.combo++;
  if (gameState.combo > gameState.bestCombo) gameState.bestCombo = gameState.combo;

  // Speed bonus
  const speedBonus = calcSpeedBonus();
  if (speedBonus > gameState.bestSpeedBonus) gameState.bestSpeedBonus = speedBonus;

  // Combo bonus
  const comboBonus = Math.max(0, gameState.combo - 1) * CONFIG.COMBO_BONUS;
  const points = CONFIG.POINTS_CORRECT + comboBonus + speedBonus;
  gameState.score += points;
  gameState.solved++;

  // Difficulty scaling
  gameState.difficultyLevel = Math.floor(gameState.solved / CONFIG.DIFFICULTY_INTERVAL);

  // Feedback
  showScorePopup(`+${points}`, f1.el, 'positive');
  if (speedBonus > 0) showSpeedToast(speedBonus);
  removeFloater(f1.id, 'correct');
  removeFloater(f2.id, 'correct');
  gameState.selected = [];

  playSound('correct');
  spawnParticles(f1.el);
  animScoreBump();
  updateComboDisplay();
  updateHUD();

  setTimeout(() => { if (gameState.phase === 'playing') generateQuestion(); }, 380);
}

function onWrongAnswer(f1, f2) {
  gameState.combo = 0;
  gameState.score = Math.max(0, gameState.score + CONFIG.POINTS_WRONG);
  gameState.wrongAnswers++;

  showScorePopup(`${CONFIG.POINTS_WRONG}`, f1.el, 'negative');

  f1.el.classList.add('floater-wrong');
  f2.el.classList.add('floater-wrong');
  setTimeout(() => {
    f1.el.classList.remove('floater-wrong','floater-selected');
    f2.el.classList.remove('floater-wrong','floater-selected');
  }, 500);

  gameState.selected = [];
  playSound('wrong');
  updateComboDisplay();
  updateHUD();
}

function animScoreBump() {
  dom.hudScore.classList.remove('bump');
  void dom.hudScore.offsetWidth;
  dom.hudScore.classList.add('bump');
}

function updateComboDisplay() {
  const c = gameState.combo;
  dom.comboDisplay.textContent = c > 0 ? `×${c}` : '×0';
  if (c >= 4) {
    dom.hudCombo.classList.add('on-fire');
  } else {
    dom.hudCombo.classList.remove('on-fire');
  }
}

// ─── 11. SPEED BAR ────────────────────────────────────────────
let speedBarFrameId = null;

function resetSpeedBar() {
  dom.speedBar.style.width = '100%';
  dom.speedBar.style.background = 'linear-gradient(90deg, var(--success), var(--warning))';
  cancelAnimationFrame(speedBarFrameId);
  drainSpeedBar();
}

function drainSpeedBar() {
  const elapsed = (Date.now() - gameState.questionStartMs) / 1000;
  const pct = Math.max(0, 1 - elapsed / CONFIG.SPEED_WINDOW) * 100;
  dom.speedBar.style.width = `${pct}%`;

  // Color shifts red as it empties
  const r = Math.round(52 + (248 - 52) * (1 - pct / 100));
  const g = Math.round(211 - 211 * (1 - pct / 100));
  dom.speedBar.style.background = `rgb(${r},${g},80)`;

  if (pct > 0 && gameState.phase === 'playing') {
    speedBarFrameId = requestAnimationFrame(drainSpeedBar);
  }
}

function showSpeedToast(bonus) {
  const el = dom.speedBonusToast;
  el.textContent = `⚡ Speed Bonus +${bonus}`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 900);
}

// ─── 12. TIMER ────────────────────────────────────────────────
function startTimer() {
  gameState.timeLeft = CONFIG.GAME_DURATION;
  updateHUD();

  gameState.timerIntervalId = setInterval(() => {
    gameState.timeLeft--;
    updateHUD();

    if (gameState.timeLeft <= 10) dom.timerDisplay.classList.add('timer-low');
    if (gameState.timeLeft <= 0)  endGame();
  }, 1000);
}

function stopTimer() {
  clearInterval(gameState.timerIntervalId);
  gameState.timerIntervalId = null;
}

// ─── 13. HUD ──────────────────────────────────────────────────
function updateHUD() {
  dom.scoreDisplay.textContent = gameState.score;
  dom.timerDisplay.textContent = gameState.timeLeft;
  updateComboDisplay();
}

// ─── 14. GAME LOOP ────────────────────────────────────────────
function gameLoop(timestamp) {
  if (gameState.phase !== 'playing') return;

  if (!gameState.lastFrameTime) gameState.lastFrameTime = timestamp;
  const dt = Math.min((timestamp - gameState.lastFrameTime) / 16.67, 3);
  gameState.lastFrameTime = timestamp;

  const rw = dom.river.clientWidth;
  const rh = dom.river.clientHeight;
  const sz = CONFIG.FLOATER_SIZE;

  gameState.floaters.forEach(f => {
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    if (f.x <= 0)       { f.x = 0;        f.vx =  Math.abs(f.vx); }
    else if (f.x >= rw - sz) { f.x = rw - sz; f.vx = -Math.abs(f.vx); }
    if (f.y <= 0)       { f.y = 0;        f.vy =  Math.abs(f.vy); }
    else if (f.y >= rh - sz) { f.y = rh - sz; f.vy = -Math.abs(f.vy); }

    f.el.style.left = `${f.x}px`;
    f.el.style.top  = `${f.y}px`;
  });

  gameState.animFrameId = requestAnimationFrame(gameLoop);
}

function startGameLoop() {
  gameState.lastFrameTime = 0;
  gameState.animFrameId = requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
  cancelAnimationFrame(gameState.animFrameId);
  gameState.animFrameId = null;
}

// ─── 15. GAME OVER ────────────────────────────────────────────
function endGame() {
  gameState.phase = 'gameover';
  stopTimer();
  stopGameLoop();
  cancelAnimationFrame(speedBarFrameId);
  playSound('gameover');

  const totalAttempts = gameState.solved + gameState.wrongAnswers;
  const accuracy = totalAttempts > 0 ? Math.round(gameState.solved / totalAttempts * 100) : 0;

  dom.finalScore.textContent    = gameState.score;
  dom.finalSolved.textContent   = gameState.solved;
  dom.finalAccuracy.textContent = `${accuracy}%`;
  dom.finalCombo.textContent    = gameState.bestCombo;
  dom.finalSpeed.textContent    = `+${gameState.bestSpeedBonus}`;

  setTimeout(() => showScreen('gameover'), 500);
}

// ─── 16. AUDIO ────────────────────────────────────────────────
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  if (gameState.isMuted) return;
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime;

    switch (type) {
      case 'correct':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, t);
        osc.frequency.setValueAtTime(659, t + .08);
        osc.frequency.setValueAtTime(784, t + .16);
        gain.gain.setValueAtTime(.14, t);
        gain.gain.exponentialRampToValueAtTime(.001, t + .38);
        osc.start(t); osc.stop(t + .38);
        break;

      case 'wrong':
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.setValueAtTime(120, t + .1);
        gain.gain.setValueAtTime(.07, t);
        gain.gain.exponentialRampToValueAtTime(.001, t + .28);
        osc.start(t); osc.stop(t + .28);
        break;

      case 'click':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        gain.gain.setValueAtTime(.05, t);
        gain.gain.exponentialRampToValueAtTime(.001, t + .04);
        osc.start(t); osc.stop(t + .04);
        break;

      case 'gameover':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(220, t + .55);
        gain.gain.setValueAtTime(.12, t);
        gain.gain.exponentialRampToValueAtTime(.001, t + .65);
        osc.start(t); osc.stop(t + .65);
        break;

      case 'speedbonus':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.setValueAtTime(1200, t + .06);
        gain.gain.setValueAtTime(.08, t);
        gain.gain.exponentialRampToValueAtTime(.001, t + .18);
        osc.start(t); osc.stop(t + .18);
        break;
    }
  } catch (_) { /* fail silently */ }
}

// ─── 17. SCORE POPUP & PARTICLES (JS / CSS1 & CSS2) ──────────
function showScorePopup(text, refEl, type) {
  const popup = document.createElement('div');
  popup.className = `score-popup popup-${type}`;
  popup.textContent = text;

  const rect = refEl.getBoundingClientRect();
  const rRect = dom.river.getBoundingClientRect();
  let topPos = rect.top - rRect.top;
  popup.style.left = `${rect.left - rRect.left + rect.width / 2}px`;
  popup.style.top  = `${topPos}px`;

  dom.river.appendChild(popup);

  let step = 0;
  const interval = setInterval(() => {
    step++;
    topPos -= 2;
    popup.style.top = `${topPos}px`;
    if (step >= 15) {
      clearInterval(interval);
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }
  }, 30);
}

function spawnParticles(refEl) {
  const rect  = refEl.getBoundingClientRect();
  const rRect = dom.river.getBoundingClientRect();
  const cx = rect.left - rRect.left + rect.width  / 2;
  const cy = rect.top  - rRect.top  + rect.height / 2;
  const colors = ['#34d399', '#38bdf8', '#fbbf24', '#818cf8'];

  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.backgroundColor = colors[i % colors.length];
    p.style.left = `${cx}px`;
    p.style.top  = `${cy}px`;
    dom.river.appendChild(p);

    const angle = (Math.PI * 2 / 8) * i;
    const dist  = 25 + Math.random() * 25;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;

    let step = 0;
    const interval = setInterval(() => {
      step++;
      p.style.left = `${cx + (tx * step / 10)}px`;
      p.style.top  = `${cy + (ty * step / 10)}px`;
      if (step >= 10) {
        clearInterval(interval);
        if (p.parentNode) p.parentNode.removeChild(p);
      }
    }, 30);
  }
}

// ─── 18. GAME START / RESET ───────────────────────────────────
function startGame() {
  resetState();
  gameState.phase = 'playing';
  dom.river.innerHTML = '';
  dom.timerDisplay.classList.remove('timer-low');
  dom.hudCombo.classList.remove('on-fire');
  showScreen('game');
  updateHUD();
  generateQuestion();
  startTimer();
  startGameLoop();
}

function resetState() {
  gameState.phase           = 'menu';
  gameState.score           = 0;
  gameState.timeLeft        = CONFIG.GAME_DURATION;
  gameState.combo           = 0;
  gameState.bestCombo       = 0;
  gameState.solved          = 0;
  gameState.wrongAnswers    = 0;
  gameState.target          = 0;
  gameState.currentCheck    = null;
  gameState.selected        = [];
  gameState.floaters        = [];
  gameState.nextId          = 0;
  gameState.animFrameId     = null;
  gameState.timerIntervalId = null;
  gameState.lastFrameTime   = 0;
  gameState.difficultyLevel = 0;
  gameState.questionStartMs = 0;
  gameState.bestSpeedBonus  = 0;
}

// ─── UTILITY ──────────────────────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── EVENT LISTENERS ──────────────────────────────────────────

// Mode selector cards
dom.modeGrid.addEventListener('click', e => {
  const card = e.target.closest('.mode-card');
  if (!card) return;
  dom.modeGrid.querySelectorAll('.mode-card').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-pressed', 'false');
  });
  card.classList.add('active');
  card.setAttribute('aria-pressed', 'true');
  gameState.mode = card.dataset.mode;
});

dom.startBtn.addEventListener('click', startGame);
dom.playAgainBtn.addEventListener('click', startGame);

dom.menuBtn.addEventListener('click', () => {
  resetState();
  dom.river.innerHTML = '';
  cancelAnimationFrame(speedBarFrameId);
  showScreen('start');
});

dom.soundToggle.addEventListener('click', () => {
  gameState.isMuted = !gameState.isMuted;
  dom.soundToggle.textContent = gameState.isMuted ? '🔇' : '🔊';
  dom.soundToggle.setAttribute('aria-label', gameState.isMuted ? 'Unmute' : 'Mute');
});

// Keyboard accessibility
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && document.activeElement.classList.contains('btn')) {
    document.activeElement.click();
  }
});

// Prevent double-tap zoom on river
dom.river.addEventListener('touchend', e => e.preventDefault(), { passive: false });

// ─── INIT ─────────────────────────────────────────────────────
showScreen('start');
