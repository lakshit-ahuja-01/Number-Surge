/* ========================================================
   Number Surge — Arcade Master Game Engine
   Full interactive game juice: slot docking, synth sound scales,
   screen shake, combo fire, high-score tracking, and ambient particles.
   ======================================================== */

'use strict';

// ─── 1. GAME CONFIGURATION ───────────────────────────────────
const CONFIG = Object.freeze({
  GAME_DURATION:        60,     // Total round time (seconds)
  POINTS_CORRECT:       10,     // Base points
  POINTS_WRONG:         -3,     // Penalty on wrong guess
  COMBO_BONUS:          5,      // Bonus per combo multiplier level
  SPEED_MAX_BONUS:      20,     // Max speed reward
  SPEED_WINDOW:         7.5,    // Seconds before speed bonus runs out
  INITIAL_SPEED:        0.65,   // Floater speed px/frame
  MAX_SPEED:            2.8,    // Max speed cap
  INITIAL_NUM_COUNT:    12,     // Starting floating orbs
  MAX_NUM_COUNT:        20,     // Maximum floating orbs
  MIN_NUMBER:           1,
  MAX_NUMBER_START:     20,
  MAX_NUMBER_CAP:       99,
  ORB_SIZE:             62,     // Diameter px
  SPAWN_MARGIN:         40,
  DIFFICULTY_INTERVAL:  3,      // Solved questions per difficulty level
  ORB_THEMES: ['orb-amber', 'orb-emerald', 'orb-violet', 'orb-coral'],
});

// ─── 2. GAME MODES ───────────────────────────────────────────
const MODES = {
  addition: {
    badge:  'ADD',
    symbol: '+',
    generateQ(diff) {
      const max = getMaxNumber(diff);
      const target = randInt(6, Math.min(Math.floor(max * 1.8), 99));
      const minA = Math.max(CONFIG.MIN_NUMBER, target - max);
      const maxA = Math.min(max, target - CONFIG.MIN_NUMBER);
      const a = minA > maxA ? Math.floor(target / 2) : randInt(minA, maxA);
      const b = target - a;
      return { target, pairA: a, pairB: b, check: (x, y) => x + y === target };
    },
  },

  subtraction: {
    badge:  'SUB',
    symbol: '−',
    generateQ(diff) {
      const max = getMaxNumber(diff);
      const target = randInt(2, Math.min(max - 2, 45));
      const b = randInt(1, Math.min(max - target, max - 1));
      const a = target + b;
      return { target, pairA: a, pairB: b, check: (x, y) => Math.abs(x - y) === target };
    },
  },

  multiplication: {
    badge:  'MUL',
    symbol: '×',
    generateQ(diff) {
      const maxFactor = Math.min(3 + diff, 12);
      const a = randInt(2, maxFactor);
      const b = randInt(2, maxFactor);
      const target = a * b;
      return { target, pairA: a, pairB: b, check: (x, y) => x * y === target };
    },
  },

  division: {
    badge:  'DIV',
    symbol: '÷',
    generateQ(diff) {
      const maxFactor = Math.min(3 + diff, 12);
      const b = randInt(2, maxFactor);
      const target = randInt(2, maxFactor);
      const a = target * b;
      return { target, pairA: a, pairB: b, check: (x, y) => {
        const big = Math.max(x, y), small = Math.min(x, y);
        return small !== 0 && big % small === 0 && big / small === target;
      }};
    },
  },

  mixed: {
    badge:  'MIX',
    symbol: '?',
    generateQ(diff) {
      const pool = ['addition', 'subtraction', 'multiplication', 'division'];
      const chosen = pool[randInt(0, pool.length - 1)];
      const q = MODES[chosen].generateQ(diff);
      q.chosenMode = chosen;
      return q;
    },
  },
};

// ─── 3. STATE MANAGEMENT ─────────────────────────────────────
const gameState = {
  phase:           'menu',       // 'menu' | 'playing' | 'gameover'
  mode:            'addition',
  score:           0,
  timeLeft:        CONFIG.GAME_DURATION,
  combo:           0,
  bestCombo:       0,
  solved:          0,
  wrongAnswers:    0,
  target:          0,
  currentCheck:    null,
  currentSymbol:   '+',
  selected:        [],           // [floaterId1, floaterId2]
  floaters:        [],           // { id, value, el, x, y, vx, vy }
  nextId:          0,
  animFrameId:     null,
  timerIntervalId: null,
  lastFrameTime:   0,
  difficultyLevel: 0,
  isMuted:         false,
  questionStartMs: 0,
  bestSpeedBonus:  0,
  highScore:       0,
  isPaused:        false,
  duration:        60,
};

// ─── 4. DOM ELEMENT CACHE ────────────────────────────────────
const dom = {
  wrapper:         document.getElementById('game-wrapper'),
  startScreen:     document.getElementById('start-screen'),
  gameScreen:      document.getElementById('game-screen'),
  gameoverScreen:  document.getElementById('gameover-screen'),

  startBtn:        document.getElementById('start-btn'),
  playBtnLabel:    document.getElementById('play-btn-label'),
  playAgainBtn:    document.getElementById('play-again-btn'),
  menuBtn:         document.getElementById('menu-btn'),
  soundToggle:     document.getElementById('sound-toggle'),
  soundIcon:       document.getElementById('sound-icon'),
  modeGrid:        document.getElementById('mode-grid'),
  timeGrid:        document.getElementById('time-grid'),

  scoreDisplay:    document.getElementById('score-display'),
  hudScoreBox:     document.getElementById('hud-score-box'),
  timerDisplay:    document.getElementById('timer-display'),
  timerBadge:      document.getElementById('timer-badge'),
  comboDisplay:    document.getElementById('combo-display'),
  hudComboBox:     document.getElementById('hud-combo-box'),
  comboNum:        document.getElementById('combo-num'),
  speedMeterBar:   document.getElementById('speed-meter-bar'),
  speedToast:      document.getElementById('speed-toast'),

  modeBadge:       document.getElementById('mode-badge'),
  slotA:           document.getElementById('slot-a'),
  slotB:           document.getElementById('slot-b'),
  slotTarget:      document.getElementById('slot-target'),
  opSymbol:        document.getElementById('op-symbol'),
  river:           document.getElementById('river'),

  startHighScore:  document.getElementById('start-highscore'),
  levelIndicator:  document.getElementById('level-indicator'),
  pauseBtn:        document.getElementById('pause-btn'),
  resumeBtn:       document.getElementById('resume-btn'),
  pauseMenuBtn:    document.getElementById('pause-menu-btn'),
  pauseModal:      document.getElementById('pause-modal'),

  finalScore:      document.getElementById('final-score'),
  finalSolved:     document.getElementById('final-solved'),
  finalAccuracy:   document.getElementById('final-accuracy'),
  finalCombo:      document.getElementById('final-combo'),
  finalSpeed:      document.getElementById('final-speed'),
  rankBadge:       document.getElementById('rank-badge'),
  newRecordBadge:  document.getElementById('new-record-badge'),
};

// ─── 5. AMBIENT BACKGROUND PARTICLES CANVAS ──────────────────
const ambientCanvas = document.getElementById('ambient-canvas');
const ambientCtx = ambientCanvas ? ambientCanvas.getContext('2d') : null;
let ambientParticles = [];

function initAmbientCanvas() {
  if (!ambientCanvas) return;
  ambientCanvas.width = window.innerWidth;
  ambientCanvas.height = window.innerHeight;
  ambientParticles = [];
  for (let i = 0; i < 45; i++) {
    ambientParticles.push({
      x: Math.random() * ambientCanvas.width,
      y: Math.random() * ambientCanvas.height,
      radius: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -Math.random() * 0.5 - 0.2,
      alpha: Math.random() * 0.6 + 0.2,
    });
  }
}

function renderAmbientParticles() {
  if (!ambientCtx) return;
  ambientCtx.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);
  ambientCtx.fillStyle = '#f59e0b';

  ambientParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.y < 0) { p.y = ambientCanvas.height; p.x = Math.random() * ambientCanvas.width; }
    if (p.x < 0) p.x = ambientCanvas.width;
    if (p.x > ambientCanvas.width) p.x = 0;

    ambientCtx.globalAlpha = p.alpha;
    ambientCtx.beginPath();
    ambientCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ambientCtx.fill();
  });
  ambientCtx.globalAlpha = 1;
  requestAnimationFrame(renderAmbientParticles);
}

window.addEventListener('resize', () => {
  if (ambientCanvas) {
    ambientCanvas.width = window.innerWidth;
    ambientCanvas.height = window.innerHeight;
  }
});

// ─── 6. LOCAL STORAGE HIGH SCORE ─────────────────────────────
function loadHighScore() {
  const saved = localStorage.getItem('number_surge_high_score');
  gameState.highScore = saved ? parseInt(saved, 10) : 0;
  if (dom.startHighScore) {
    dom.startHighScore.textContent = `${gameState.highScore} PTS`;
  }
}

function saveHighScoreIfRecord(score) {
  if (score > gameState.highScore) {
    gameState.highScore = score;
    localStorage.setItem('number_surge_high_score', score.toString());
    return true;
  }
  return false;
}

// ─── 7. SCREEN MANAGEMENT ────────────────────────────────────
function showScreen(name) {
  [dom.startScreen, dom.gameScreen, dom.gameoverScreen].forEach(s => s.classList.remove('active'));
  if (name === 'start') dom.startScreen.classList.add('active');
  if (name === 'game')  dom.gameScreen.classList.add('active');
  if (name === 'gameover') dom.gameoverScreen.classList.add('active');
}

// ─── 8. QUESTION & FLOATER GENERATION ────────────────────────
function getMaxNumber(diff) {
  return Math.min(CONFIG.MAX_NUMBER_START + diff * 8, CONFIG.MAX_NUMBER_CAP);
}

function getCurrentSpeed() {
  return Math.min(CONFIG.INITIAL_SPEED + gameState.difficultyLevel * 0.16, CONFIG.MAX_SPEED);
}

function getCurrentNumCount() {
  return Math.min(CONFIG.INITIAL_NUM_COUNT + Math.floor(gameState.difficultyLevel * 1.2), CONFIG.MAX_NUM_COUNT);
}

function generateQuestion() {
  const modeDef = MODES[gameState.mode];
  const q = modeDef.generateQ(gameState.difficultyLevel);

  gameState.target = q.target;
  gameState.currentCheck = q.check;

  let symbol = modeDef.symbol;
  let badge = modeDef.badge;
  if (q.chosenMode) {
    symbol = MODES[q.chosenMode].symbol;
    badge = MODES[q.chosenMode].badge;
  }
  gameState.currentSymbol = symbol;

  // Reset interactive equation dock
  dom.modeBadge.textContent = badge;
  dom.opSymbol.textContent = symbol;
  dom.slotTarget.textContent = q.target;
  resetEquationSlots();

  gameState.questionStartMs = Date.now();
  resetSpeedMeter();

  clearAllFloaters();
  const pool = buildNumberPool(q, gameState.difficultyLevel);
  pool.forEach(val => createOrbFloater(val));
}

function buildNumberPool(q, diff) {
  const count = getCurrentNumCount();
  const max = getMaxNumber(diff);
  const numbers = [q.pairA, q.pairB];

  if (count >= 8 && Math.random() < 0.6) {
    const q2 = MODES[gameState.mode === 'mixed' ? (q.chosenMode || 'addition') : gameState.mode].generateQ(diff);
    if (q2.pairA !== q.pairA || q2.pairB !== q.pairB) {
      numbers.push(q2.pairA, q2.pairB);
    }
  }

  while (numbers.length < count) {
    numbers.push(randInt(CONFIG.MIN_NUMBER, max));
  }

  for (let i = numbers.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }

  return numbers;
}

// ─── 9. 3D FLOATING ORB SYSTEM ───────────────────────────────
function createOrbFloater(value) {
  const rw = dom.river.clientWidth;
  const rh = dom.river.clientHeight;
  const m = CONFIG.SPAWN_MARGIN;
  const sz = CONFIG.ORB_SIZE;

  const x = randInt(m, Math.max(m + 1, rw - sz - m));
  const y = randInt(m, Math.max(m + 1, rh - sz - m));

  const speed = getCurrentSpeed();
  const angle = Math.random() * Math.PI * 2;
  const vx = Math.cos(angle) * speed * (0.6 + Math.random() * 0.6);
  const vy = Math.sin(angle) * speed * (0.6 + Math.random() * 0.6);

  const el = document.createElement('div');
  const theme = CONFIG.ORB_THEMES[randInt(0, CONFIG.ORB_THEMES.length - 1)];
  el.className = `orb-floater ${theme}`;
  el.innerHTML = `
    <div class="bubble-shine"></div>
    <span class="bubble-num">${value}</span>
  `;
  el.setAttribute('aria-label', `Number ${value}`);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const id = gameState.nextId++;
  el.dataset.floaterId = id;
  el.addEventListener('click', () => onFloaterClick(id));

  dom.river.appendChild(el);

  const floater = { id, value, el, x, y, vx, vy };
  gameState.floaters.push(floater);
  return floater;
}

function clearAllFloaters() {
  gameState.floaters.forEach(f => f.el.parentNode && f.el.parentNode.removeChild(f.el));
  gameState.floaters = [];
  gameState.selected = [];
}

function removeFloater(id, isCorrect) {
  const idx = gameState.floaters.findIndex(f => f.id === id);
  if (idx === -1) return;

  const { el } = gameState.floaters[idx];
  if (isCorrect) {
    el.classList.add('orb-correct');
    setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 280);
  } else {
    el.parentNode && el.parentNode.removeChild(el);
  }
  gameState.floaters.splice(idx, 1);
}

// ─── 10. SELECTION & EQUATION DOCK LOGIC ──────────────────────
function resetEquationSlots() {
  dom.slotA.textContent = '?';
  dom.slotB.textContent = '?';
  dom.slotA.className = 'slot slot-operand';
  dom.slotB.className = 'slot slot-operand';
}

function onFloaterClick(floaterId) {
  if (gameState.phase !== 'playing') return;

  const floater = gameState.floaters.find(f => f.id === floaterId);
  if (!floater) return;

  // Deselection
  const selIdx = gameState.selected.indexOf(floaterId);
  if (selIdx !== -1) {
    gameState.selected.splice(selIdx, 1);
    floater.el.classList.remove('orb-selected');
    playArcadeSound('click');
    updateEquationSlotsPreview();
    return;
  }

  // Maximum 2 selected
  if (gameState.selected.length >= 2) return;

  gameState.selected.push(floaterId);
  floater.el.classList.add('orb-selected');
  playArcadeSound('select');
  updateEquationSlotsPreview();

  if (gameState.selected.length === 2) {
    setTimeout(validateAnswer, 180);
  }
}

function updateEquationSlotsPreview() {
  if (gameState.selected.length === 0) {
    resetEquationSlots();
  } else if (gameState.selected.length === 1) {
    const f1 = gameState.floaters.find(f => f.id === gameState.selected[0]);
    if (f1) {
      dom.slotA.textContent = f1.value;
      dom.slotA.className = 'slot slot-operand locked';
    }
    dom.slotB.textContent = '?';
    dom.slotB.className = 'slot slot-operand';
  } else if (gameState.selected.length === 2) {
    const f1 = gameState.floaters.find(f => f.id === gameState.selected[0]);
    const f2 = gameState.floaters.find(f => f.id === gameState.selected[1]);
    if (f1) { dom.slotA.textContent = f1.value; dom.slotA.className = 'slot slot-operand locked'; }
    if (f2) { dom.slotB.textContent = f2.value; dom.slotB.className = 'slot slot-operand locked'; }
  }
}

// ─── 11. ANSWER VALIDATION & SCORING ─────────────────────────
function validateAnswer() {
  if (gameState.selected.length !== 2) return;

  const f1 = gameState.floaters.find(f => f.id === gameState.selected[0]);
  const f2 = gameState.floaters.find(f => f.id === gameState.selected[1]);

  if (!f1 || !f2) {
    gameState.selected = [];
    resetEquationSlots();
    return;
  }

  const isCorrect = gameState.currentCheck ? gameState.currentCheck(f1.value, f2.value) : false;

  if (isCorrect) {
    handleCorrect(f1, f2);
  } else {
    handleWrong(f1, f2);
  }
}

function calcSpeedBonus() {
  const elapsed = (Date.now() - gameState.questionStartMs) / 1000;
  if (elapsed >= CONFIG.SPEED_WINDOW) return 0;
  const factor = 1 - (elapsed / CONFIG.SPEED_WINDOW);
  return Math.round(CONFIG.SPEED_MAX_BONUS * factor);
}

function handleCorrect(f1, f2) {
  gameState.combo++;
  if (gameState.combo > gameState.bestCombo) gameState.bestCombo = gameState.combo;

  const speedBonus = calcSpeedBonus();
  if (speedBonus > gameState.bestSpeedBonus) gameState.bestSpeedBonus = speedBonus;

  const comboBonus = Math.max(0, gameState.combo - 1) * CONFIG.COMBO_BONUS;
  const points = CONFIG.POINTS_CORRECT + comboBonus + speedBonus;
  gameState.score += points;
  gameState.solved++;

  gameState.difficultyLevel = Math.floor(gameState.solved / CONFIG.DIFFICULTY_INTERVAL);

  // Visual slot feedback
  dom.slotA.className = 'slot slot-operand success-flash';
  dom.slotB.className = 'slot slot-operand success-flash';

  showFloatingScore(`+${points}`, f1.el, 'plus');
  if (speedBonus >= 8) showSpeedToast(speedBonus);

  removeFloater(f1.id, true);
  removeFloater(f2.id, true);
  gameState.selected = [];

  playArcadeSound('correct', gameState.combo);
  spawnEnergyParticles(f1.el);
  spawnEnergyParticles(f2.el);
  triggerScoreBump();
  updateHUD();

  setTimeout(() => {
    if (gameState.phase === 'playing') generateQuestion();
  }, 380);
}

function handleWrong(f1, f2) {
  gameState.combo = 0;
  gameState.score = Math.max(0, gameState.score + CONFIG.POINTS_WRONG);
  gameState.wrongAnswers++;

  dom.slotA.className = 'slot slot-operand wrong-flash';
  dom.slotB.className = 'slot slot-operand wrong-flash';

  showFloatingScore(`${CONFIG.POINTS_WRONG}`, f1.el, 'minus');
  triggerScreenShake();

  f1.el.classList.add('orb-wrong');
  f2.el.classList.add('orb-wrong');

  playArcadeSound('wrong');

  setTimeout(() => {
    f1.el.classList.remove('orb-wrong', 'orb-selected');
    f2.el.classList.remove('orb-wrong', 'orb-selected');
    resetEquationSlots();
  }, 450);

  gameState.selected = [];
  updateHUD();
}

// ─── 12. SPEED METER GAUGE ───────────────────────────────────
let speedMeterLoopId = null;

function resetSpeedMeter() {
  dom.speedMeterBar.style.width = '100%';
  cancelAnimationFrame(speedMeterLoopId);
  updateSpeedMeter();
}

function updateSpeedMeter() {
  const elapsed = (Date.now() - gameState.questionStartMs) / 1000;
  const pct = Math.max(0, 1 - elapsed / CONFIG.SPEED_WINDOW) * 100;
  dom.speedMeterBar.style.width = `${pct}%`;

  if (pct > 0 && gameState.phase === 'playing') {
    speedMeterLoopId = requestAnimationFrame(updateSpeedMeter);
  }
}

function showSpeedToast(val) {
  dom.speedToast.textContent = `⚡ SPEED +${val}`;
  dom.speedToast.classList.remove('pop');
  void dom.speedToast.offsetWidth;
  dom.speedToast.classList.add('pop');
  setTimeout(() => dom.speedToast.classList.remove('pop'), 850);
}

// ─── 13. HUD & SCREEN FX ─────────────────────────────────────
function updateHUD() {
  if (dom.scoreDisplay) {
    dom.scoreDisplay.textContent = String(gameState.score).padStart(6, '0');
  }
  if (dom.levelIndicator) {
    dom.levelIndicator.textContent = `LVL ${gameState.difficultyLevel + 1}`;
  }
  if (dom.timerDisplay) {
    dom.timerDisplay.textContent = gameState.timeLeft;
  }
  if (dom.comboNum) {
    dom.comboNum.textContent = `x${gameState.combo}`;
  }

  if (gameState.combo >= 3) {
    dom.hudComboBox.classList.add('combo-fire');
  } else {
    dom.hudComboBox.classList.remove('combo-fire');
  }
}

function triggerScoreBump() {
  dom.hudScoreBox.classList.remove('score-pop');
  void dom.hudScoreBox.offsetWidth;
  dom.hudScoreBox.classList.add('score-pop');
}

function triggerScreenShake() {
  dom.wrapper.classList.remove('screen-shake');
  void dom.wrapper.offsetWidth;
  dom.wrapper.classList.add('screen-shake');
  setTimeout(() => dom.wrapper.classList.remove('screen-shake'), 400);
}

function showFloatingScore(text, refEl, type) {
  const popup = document.createElement('div');
  popup.className = `score-floating-text score-${type}`;
  popup.textContent = text;

  const rect = refEl.getBoundingClientRect();
  const rRect = dom.river.getBoundingClientRect();
  popup.style.left = `${rect.left - rRect.left + rect.width / 2}px`;
  popup.style.top  = `${rect.top  - rRect.top}px`;

  dom.river.appendChild(popup);
  setTimeout(() => popup.parentNode && popup.parentNode.removeChild(popup), 750);
}

function spawnEnergyParticles(refEl) {
  const rect = refEl.getBoundingClientRect();
  const rRect = dom.river.getBoundingClientRect();
  const cx = rect.left - rRect.left + rect.width / 2;
  const cy = rect.top - rRect.top + rect.height / 2;
  const colors = ['#f59e0b', '#10b981', '#a855f7', '#f43f5e', '#ffffff'];

  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.style.position = 'absolute';
    p.style.width = `${randInt(4, 8)}px`;
    p.style.height = p.style.width;
    p.style.borderRadius = '50%';
    p.style.backgroundColor = colors[i % colors.length];
    p.style.boxShadow = `0 0 10px ${colors[i % colors.length]}`;
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.pointerEvents = 'none';
    p.style.zIndex = '25';
    dom.river.appendChild(p);

    const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.3;
    const dist = randInt(35, 75);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;

    p.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
    ], {
      duration: 550,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'forwards'
    });

    setTimeout(() => p.parentNode && p.parentNode.removeChild(p), 560);
  }
}

// ─── 14. COUNTDOWN TIMER ─────────────────────────────────────
function startTimer() {
  gameState.timeLeft = gameState.duration || CONFIG.GAME_DURATION;
  updateHUD();

  gameState.timerIntervalId = setInterval(() => {
    if (gameState.isPaused) return;
    gameState.timeLeft--;
    updateHUD();

    if (gameState.timeLeft <= 10) {
      dom.timerBadge.classList.add('timer-low');
      playArcadeSound('tick_urgent');
    }

    if (gameState.timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(gameState.timerIntervalId);
  gameState.timerIntervalId = null;
}

// ─── 15. MAIN PHYSICS GAME LOOP (rAF) ────────────────────────
function gameLoop(timestamp) {
  if (gameState.phase !== 'playing') return;

  if (gameState.isPaused) {
    gameState.lastFrameTime = timestamp;
    gameState.animFrameId = requestAnimationFrame(gameLoop);
    return;
  }

  if (!gameState.lastFrameTime) gameState.lastFrameTime = timestamp;
  const dt = Math.min((timestamp - gameState.lastFrameTime) / 16.67, 3);
  gameState.lastFrameTime = timestamp;

  const rw = dom.river.clientWidth;
  const rh = dom.river.clientHeight;
  const sz = CONFIG.ORB_SIZE;

  gameState.floaters.forEach(f => {
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    if (f.x <= 0)            { f.x = 0;            f.vx = Math.abs(f.vx); }
    else if (f.x >= rw - sz) { f.x = rw - sz;     f.vx = -Math.abs(f.vx); }
    if (f.y <= 0)            { f.y = 0;            f.vy = Math.abs(f.vy); }
    else if (f.y >= rh - sz) { f.y = rh - sz;     f.vy = -Math.abs(f.vy); }

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

// ─── 16. GAME OVER & RANKING ─────────────────────────────────
function calculateRank(score, accuracy) {
  if (score >= 400 && accuracy >= 90) return { rank: 'RANK S+', color: '#fbbf24' };
  if (score >= 300 && accuracy >= 80) return { rank: 'RANK S',  color: '#38bdf8' };
  if (score >= 200 && accuracy >= 70) return { rank: 'RANK A',  color: '#10b981' };
  if (score >= 100) return { rank: 'RANK B', color: '#a855f7' };
  return { rank: 'RANK C', color: '#94a3b8' };
}

function endGame() {
  gameState.phase = 'gameover';
  stopTimer();
  stopGameLoop();
  cancelAnimationFrame(speedMeterLoopId);

  const totalAttempts = gameState.solved + gameState.wrongAnswers;
  const accuracy = totalAttempts > 0 ? Math.round(gameState.solved / totalAttempts * 100) : 0;
  const isNewRecord = saveHighScoreIfRecord(gameState.score);

  const rankInfo = calculateRank(gameState.score, accuracy);
  dom.rankBadge.textContent = rankInfo.rank;
  dom.rankBadge.style.background = rankInfo.color;

  dom.finalScore.textContent    = gameState.score;
  dom.finalSolved.textContent   = gameState.solved;
  dom.finalAccuracy.textContent = `${accuracy}%`;
  dom.finalCombo.textContent    = `x${gameState.bestCombo}`;
  dom.finalSpeed.textContent    = `+${gameState.bestSpeedBonus}`;

  if (isNewRecord && gameState.score > 0) {
    dom.newRecordBadge.classList.add('show');
    playArcadeSound('gameover_record');
  } else {
    dom.newRecordBadge.classList.remove('show');
    playArcadeSound('gameover');
  }

  setTimeout(() => showScreen('gameover'), 450);
}

// ─── 17. SYNTHESIZED PROCEDURAL WEB AUDIO ────────────────────
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playArcadeSound(type, comboLevel = 1) {
  if (gameState.isMuted) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    if (type === 'select' || type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'select' ? 980 : 700, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }
    else if (type === 'correct') {
      // Dynamic musical scale based on combo level!
      const semitone = Math.min(comboLevel - 1, 14);
      const baseFreq = 440 * Math.pow(2, semitone / 12); // Rising pitch

      const chord = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);
        gain.gain.setValueAtTime(0.12, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + i * 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + 0.38 + i * 0.04);
      });
    }
    else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.22);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
    else if (type === 'tick_urgent') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1100, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    }
    else if (type === 'gameover' || type === 'gameover_record') {
      const notes = type === 'gameover_record' ? [523, 659, 784, 1046] : [440, 392, 349, 293];
      notes.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.12);
        gain.gain.setValueAtTime(0.14, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (idx + 1) * 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + (idx + 1) * 0.22);
      });
    }
  } catch (_) {}
}

// ─── 18. GAME CONTROLS & FLOW ────────────────────────────────
function startGame() {
  resetState();
  gameState.phase = 'playing';
  dom.river.innerHTML = '<div class="river-stream-overlay"></div>';
  dom.timerBadge.classList.remove('timer-low');
  dom.hudComboBox.classList.remove('combo-fire');
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

function togglePause() {
  if (gameState.phase !== 'playing') return;
  gameState.isPaused = !gameState.isPaused;
  if (gameState.isPaused) {
    if (dom.pauseModal) dom.pauseModal.classList.add('active');
    playArcadeSound('click');
  } else {
    if (dom.pauseModal) dom.pauseModal.classList.remove('active');
    playArcadeSound('select');
  }
}

// ─── 19. EVENT LISTENERS ─────────────────────────────────────
// Pause Controls
if (dom.pauseBtn) dom.pauseBtn.addEventListener('click', togglePause);
if (dom.resumeBtn) dom.resumeBtn.addEventListener('click', togglePause);
if (dom.pauseMenuBtn) dom.pauseMenuBtn.addEventListener('click', () => {
  if (dom.pauseModal) dom.pauseModal.classList.remove('active');
  gameState.isPaused = false;
  resetState();
  loadHighScore();
  dom.river.innerHTML = '<div class="river-stream-overlay"></div>';
  cancelAnimationFrame(speedMeterLoopId);
  showScreen('start');
});

// Mode Cards
dom.modeGrid.addEventListener('click', e => {
  const card = e.target.closest('.arcade-card, .arcade-cartridge, .mode-card');
  if (!card) return;
  dom.modeGrid.querySelectorAll('.arcade-card, .arcade-cartridge, .mode-card').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-pressed', 'false');
  });
  card.classList.add('active');
  card.setAttribute('aria-pressed', 'true');
  gameState.mode = card.dataset.mode;
  playArcadeSound('click');
});

// Duration Chips
if (dom.timeGrid) {
  dom.timeGrid.addEventListener('click', e => {
    const chip = e.target.closest('.time-chip');
    if (!chip) return;
    dom.timeGrid.querySelectorAll('.time-chip').forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-pressed', 'false');
    });
    chip.classList.add('active');
    chip.setAttribute('aria-pressed', 'true');
    gameState.duration = parseInt(chip.dataset.time, 10);
    if (dom.playBtnLabel) {
      dom.playBtnLabel.textContent = `START SURGE (${gameState.duration}s)`;
    }
    playArcadeSound('click');
  });
}

dom.startBtn.addEventListener('click', startGame);
dom.playAgainBtn.addEventListener('click', startGame);

dom.menuBtn.addEventListener('click', () => {
  resetState();
  loadHighScore();
  dom.river.innerHTML = '<div class="river-stream-overlay"></div>';
  cancelAnimationFrame(speedMeterLoopId);
  showScreen('start');
});

dom.soundToggle.addEventListener('click', () => {
  gameState.isMuted = !gameState.isMuted;
  dom.soundIcon.textContent = gameState.isMuted ? '🔇' : '🔊';
  dom.soundToggle.setAttribute('aria-label', gameState.isMuted ? 'Unmute sound' : 'Mute sound');
});

// Keyboard Hotkeys
document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (gameState.phase === 'playing') {
      e.preventDefault();
      togglePause();
    }
  } else if (e.code === 'Space' || e.code === 'Enter') {
    if (gameState.phase === 'menu') {
      e.preventDefault();
      startGame();
    } else if (gameState.phase === 'gameover') {
      e.preventDefault();
      startGame();
    }
  }
});

// ─── AMBIENT BACKGROUND CANVAS ───────────────────────────────
const ambientCanvas = document.getElementById('ambient-canvas');
let ambientCtx = null;
let ambientParticles = [];

function initAmbientCanvas() {
  if (!ambientCanvas) return;
  ambientCtx = ambientCanvas.getContext('2d');
  resizeAmbientCanvas();
  window.addEventListener('resize', resizeAmbientCanvas);

  const colors = [
    'rgba(255, 107, 138, 0.45)', // Pink
    'rgba(255, 159, 67, 0.45)',  // Orange
    'rgba(69, 170, 242, 0.45)',  // Sky Blue
    'rgba(46, 213, 115, 0.45)',  // Mint Green
    'rgba(165, 94, 234, 0.45)',  // Lavender
    'rgba(254, 211, 48, 0.45)',  // Sunny Yellow
  ];

  ambientParticles = Array.from({ length: 30 }, () => ({
    x: Math.random() * (ambientCanvas.width || window.innerWidth),
    y: Math.random() * (ambientCanvas.height || window.innerHeight),
    r: Math.random() * 16 + 8,
    color: colors[Math.floor(Math.random() * colors.length)],
    speedY: -(Math.random() * 0.45 + 0.15),
    speedX: (Math.random() - 0.5) * 0.3,
    pulseSpeed: Math.random() * 0.02 + 0.01,
  }));
}

function resizeAmbientCanvas() {
  if (!ambientCanvas) return;
  ambientCanvas.width = window.innerWidth;
  ambientCanvas.height = window.innerHeight;
}

function renderAmbientParticles() {
  if (!ambientCtx || !ambientCanvas) return;
  ambientCtx.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);

  ambientParticles.forEach(p => {
    p.y += p.speedY;
    p.x += p.speedX;

    if (p.y + p.r < 0) {
      p.y = ambientCanvas.height + p.r;
      p.x = Math.random() * ambientCanvas.width;
    }
    if (p.x - p.r > ambientCanvas.width) p.x = -p.r;
    if (p.x + p.r < 0) p.x = ambientCanvas.width + p.r;

    // Outer gentle bubble
    ambientCtx.beginPath();
    ambientCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ambientCtx.fillStyle = p.color;
    ambientCtx.fill();

    // Bubble highlight shine
    ambientCtx.beginPath();
    ambientCtx.arc(p.x - p.r * 0.32, p.y - p.r * 0.32, p.r * 0.28, 0, Math.PI * 2);
    ambientCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ambientCtx.fill();
  });

  requestAnimationFrame(renderAmbientParticles);
}

// ─── INITIALIZATION ──────────────────────────────────────────
initAmbientCanvas();
renderAmbientParticles();
loadHighScore();
showScreen('start');
