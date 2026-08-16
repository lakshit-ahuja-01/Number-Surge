/* ========================================================
   Math River — Complete Game Logic
   ========================================================
   
   Architecture
   ---------------------
   1. CONSTANTS      – Tunable values (duration, scoring, speeds)
   2. GAME STATE     – Single state object tracking everything
   3. DOM REFS       – Cached references to HTML elements
   4. SCREEN MGMT    – Switch between start / game / gameover
   5. QUESTION GEN   – Generate target + guaranteed-solvable numbers
   6. FLOATER SYSTEM – Create, render, and animate floating numbers
   7. SELECTION      – Handle player clicks on numbers
   8. VALIDATION     – Check if selected pair satisfies the target
   9. SCORING        – Points, combos, penalties
  10. TIMER          – 60-second countdown
  11. DIFFICULTY     – Progressive speed / range / count scaling
  12. GAME LOOP      – requestAnimationFrame main loop
  13. GAME OVER      – End state, stats display
  14. AUDIO          – Web Audio API sound effects
  15. INIT           – Wire up events, show start screen
   ======================================================== */

// ─── 1. CONSTANTS ──────────────────────────────────────────
const CONFIG = Object.freeze({
  GAME_DURATION:     60,       // seconds
  POINTS_CORRECT:    10,       // base points per correct answer
  POINTS_WRONG:      -3,       // penalty per wrong answer
  COMBO_BONUS:       5,        // extra points per combo level
  INITIAL_SPEED:     0.6,      // starting float speed (px per frame at 60fps)
  MAX_SPEED:         2.5,      // cap on float speed
  INITIAL_NUM_COUNT: 8,        // starting number of floaters
  MAX_NUM_COUNT:     16,       // cap on floater count
  MIN_NUMBER:        1,        // smallest generated number
  MAX_NUMBER_START:  20,       // largest number at game start
  MAX_NUMBER_CAP:    99,       // difficulty cap
  FLOATER_SIZE:      56,       // base size of number bubbles (px)
  SPAWN_MARGIN:      40,       // px margin from edges when spawning
  DIFFICULTY_INTERVAL: 3,      // increase difficulty every N solved questions
});

// ─── 2. GAME STATE ─────────────────────────────────────────
/**
 * Central source of truth.
 * Reset at the start of every new game.
 */
const gameState = {
  phase:           'menu',     // 'menu' | 'playing' | 'gameover'
  score:           0,
  timeLeft:        CONFIG.GAME_DURATION,
  combo:           0,
  bestCombo:       0,
  solved:          0,
  wrongAnswers:    0,
  target:          0,          // current target sum
  operation:       '+',        // current operation (addition for now)
  selected:        [],         // DOM elements currently selected (max 2)
  floaters:        [],         // { id, value, el, x, y, vx, vy }
  nextId:          0,          // auto-increment ID for floaters
  animFrameId:     null,       // rAF handle
  timerIntervalId: null,       // setInterval handle
  lastFrameTime:   0,          // for delta-time movement
  difficultyLevel: 0,          // increases over time
};

// ─── 3. DOM REFERENCES ─────────────────────────────────────
const dom = {
  startScreen:    document.getElementById('start-screen'),
  gameScreen:     document.getElementById('game-screen'),
  gameoverScreen: document.getElementById('gameover-screen'),

  startBtn:       document.getElementById('start-btn'),
  playAgainBtn:   document.getElementById('play-again-btn'),
  menuBtn:        document.getElementById('menu-btn'),

  scoreDisplay:   document.getElementById('score-display'),
  timerDisplay:   document.getElementById('timer-display'),
  comboDisplay:   document.getElementById('combo-display'),

  equationText:   document.getElementById('equation-text'),
  river:          document.getElementById('river'),

  finalScore:     document.getElementById('final-score'),
  finalSolved:    document.getElementById('final-solved'),
  finalAccuracy:  document.getElementById('final-accuracy'),
  finalCombo:     document.getElementById('final-combo'),
};

// ─── 4. SCREEN MANAGEMENT ──────────────────────────────────
function showScreen(screenName) {
  dom.startScreen.classList.remove('active');
  dom.gameScreen.classList.remove('active');
  dom.gameoverScreen.classList.remove('active');

  switch (screenName) {
    case 'start':    dom.startScreen.classList.add('active');    break;
    case 'game':     dom.gameScreen.classList.add('active');     break;
    case 'gameover': dom.gameoverScreen.classList.add('active'); break;
  }
}

// ─── 5. QUESTION GENERATION ────────────────────────────────
/**
 * Returns the current max number based on difficulty.
 * Difficulty increases every DIFFICULTY_INTERVAL solved questions.
 */
function getMaxNumber() {
  const maxNum = CONFIG.MAX_NUMBER_START + gameState.difficultyLevel * 8;
  return Math.min(maxNum, CONFIG.MAX_NUMBER_CAP);
}

/**
 * Get current speed multiplier based on difficulty.
 */
function getCurrentSpeed() {
  const speed = CONFIG.INITIAL_SPEED + gameState.difficultyLevel * 0.15;
  return Math.min(speed, CONFIG.MAX_SPEED);
}

/**
 * Get current number of floaters based on difficulty.
 */
function getCurrentNumCount() {
  const count = CONFIG.INITIAL_NUM_COUNT + Math.floor(gameState.difficultyLevel * 0.8);
  return Math.min(count, CONFIG.MAX_NUM_COUNT);
}

/**
 * Generate a new target sum and ensure at least one valid pair
 * exists among the floaters.
 */
function generateQuestion() {
  const maxNum = getMaxNumber();

  // Pick a target between 5 and maxNum * 1.5
  const minTarget = 5;
  const maxTarget = Math.floor(maxNum * 1.5);
  const target = randInt(minTarget, maxTarget);
  gameState.target = target;

  // Update equation display
  dom.equationText.textContent = `_ + _ = ${target}`;

  // Clear existing floaters
  clearAllFloaters();

  // Generate numbers with guaranteed valid pair(s)
  const numbers = generateNumbersForTarget(target, maxNum);

  // Create floater objects and DOM elements
  numbers.forEach(value => createFloater(value));
}

/**
 * Generate an array of numbers that includes at least one valid pair
 * summing to the target.
 * @param {number} target - The target sum
 * @param {number} maxNum - Max individual number
 * @returns {number[]}
 */
function generateNumbersForTarget(target, maxNum) {
  const count = getCurrentNumCount();
  const numbers = [];

  // Guarantee at least one valid pair
  // Pick a random split of the target
  const minA = Math.max(CONFIG.MIN_NUMBER, target - maxNum);
  const maxA = Math.min(maxNum, target - CONFIG.MIN_NUMBER);

  if (minA > maxA) {
    // Edge case: target too large for current max,
    // so clamp and create a valid pair anyway
    const a = Math.floor(target / 2);
    const b = target - a;
    numbers.push(a, b);
  } else {
    const a = randInt(minA, maxA);
    const b = target - a;
    numbers.push(a, b);
  }

  // Fill the rest with random numbers
  // Sprinkle in a second valid pair sometimes (50% chance)
  if (count >= 6 && Math.random() > 0.5) {
    const a2 = randInt(minA > maxA ? 1 : minA, minA > maxA ? Math.floor(target / 2) : maxA);
    const b2 = target - a2;
    // Avoid duplicating the first pair
    if (!(numbers.includes(a2) && numbers.includes(b2))) {
      numbers.push(a2, b2);
    }
  }

  // Fill remaining slots with random distractors
  while (numbers.length < count) {
    numbers.push(randInt(CONFIG.MIN_NUMBER, maxNum));
  }

  // Shuffle using Fisher-Yates
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }

  return numbers;
}

// ─── 6. FLOATER SYSTEM ─────────────────────────────────────
/**
 * Create a single floating number object and its DOM element.
 * @param {number} value - The number to display
 */
function createFloater(value) {
  const river = dom.river;
  const rw = river.clientWidth;
  const rh = river.clientHeight;
  const margin = CONFIG.SPAWN_MARGIN;
  const size = CONFIG.FLOATER_SIZE;

  // Random position within the river
  const x = randInt(margin, Math.max(margin + 1, rw - size - margin));
  const y = randInt(margin, Math.max(margin + 1, rh - size - margin));

  // Random velocity — direction varies, magnitude based on difficulty
  const speed = getCurrentSpeed();
  const angle = Math.random() * Math.PI * 2;
  const vx = Math.cos(angle) * speed * (0.5 + Math.random() * 0.5);
  const vy = Math.sin(angle) * speed * (0.5 + Math.random() * 0.5);

  // Create DOM element
  const el = document.createElement('button');
  el.className = 'floater';
  el.textContent = value;
  el.setAttribute('aria-label', `Number ${value}`);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const id = gameState.nextId++;

  el.dataset.floaterId = id;

  // Click handler
  el.addEventListener('click', () => onFloaterClick(id));

  river.appendChild(el);

  const floater = { id, value, el, x, y, vx, vy };
  gameState.floaters.push(floater);

  // Entrance animation
  el.style.transform = 'scale(0)';
  el.style.opacity = '0';
  requestAnimationFrame(() => {
    el.style.transform = 'scale(1)';
    el.style.opacity = '1';
  });

  return floater;
}

/**
 * Remove all floaters from the river and clear the array.
 */
function clearAllFloaters() {
  gameState.floaters.forEach(f => {
    if (f.el && f.el.parentNode) {
      f.el.parentNode.removeChild(f.el);
    }
  });
  gameState.floaters = [];
  gameState.selected = [];
}

/**
 * Remove a specific floater by ID with an animation.
 * @param {number} id
 * @param {'correct' | 'remove'} reason
 */
function removeFloater(id, reason = 'remove') {
  const idx = gameState.floaters.findIndex(f => f.id === id);
  if (idx === -1) return;

  const floater = gameState.floaters[idx];
  const el = floater.el;

  if (reason === 'correct') {
    el.classList.add('floater-correct');
  }

  el.style.transform = 'scale(0)';
  el.style.opacity = '0';

  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 300);

  gameState.floaters.splice(idx, 1);
}

// ─── 7. SELECTION ──────────────────────────────────────────
/**
 * Handle a click on a floating number.
 * @param {number} floaterId
 */
function onFloaterClick(floaterId) {
  if (gameState.phase !== 'playing') return;

  const floater = gameState.floaters.find(f => f.id === floaterId);
  if (!floater) return;

  // Check if already selected — deselect it
  const selIdx = gameState.selected.indexOf(floaterId);
  if (selIdx !== -1) {
    gameState.selected.splice(selIdx, 1);
    floater.el.classList.remove('floater-selected');
    playSound('click');
    return;
  }

  // If already 2 selected, ignore
  if (gameState.selected.length >= 2) return;

  // Select this floater
  gameState.selected.push(floaterId);
  floater.el.classList.add('floater-selected');
  playSound('click');

  // If we now have 2 selected, validate
  if (gameState.selected.length === 2) {
    // Small delay so the player sees both highlights
    setTimeout(() => validateSelection(), 150);
  }
}

// ─── 8. VALIDATION ─────────────────────────────────────────
/**
 * Check whether the two selected numbers satisfy the target equation.
 */
function validateSelection() {
  if (gameState.selected.length !== 2) return;

  const f1 = gameState.floaters.find(f => f.id === gameState.selected[0]);
  const f2 = gameState.floaters.find(f => f.id === gameState.selected[1]);

  if (!f1 || !f2) {
    gameState.selected = [];
    return;
  }

  const sum = f1.value + f2.value;

  if (sum === gameState.target) {
    // ✅ CORRECT
    onCorrectAnswer(f1, f2);
  } else {
    // ❌ WRONG
    onWrongAnswer(f1, f2);
  }
}

// ─── 9. SCORING ────────────────────────────────────────────
/**
 * Handle a correct answer: score, combo, remove numbers, new question.
 */
function onCorrectAnswer(f1, f2) {
  // Increment combo
  gameState.combo++;
  if (gameState.combo > gameState.bestCombo) {
    gameState.bestCombo = gameState.combo;
  }

  // Calculate points: base + combo bonus
  const comboBonus = Math.max(0, (gameState.combo - 1)) * CONFIG.COMBO_BONUS;
  const points = CONFIG.POINTS_CORRECT + comboBonus;
  gameState.score += points;

  gameState.solved++;

  // Update difficulty
  gameState.difficultyLevel = Math.floor(gameState.solved / CONFIG.DIFFICULTY_INTERVAL);

  // Show floating score indicator
  showScorePopup(`+${points}`, f1.el, true);

  // Animate and remove selected floaters
  removeFloater(f1.id, 'correct');
  removeFloater(f2.id, 'correct');

  // Clear selection
  gameState.selected = [];

  // Play sound
  playSound('correct');

  // Spawn particles
  spawnParticles(f1.el);

  // Update HUD
  updateHUD();

  // Generate next question after a brief pause
  setTimeout(() => {
    if (gameState.phase === 'playing') {
      generateQuestion();
    }
  }, 400);
}

/**
 * Handle a wrong answer: penalty, shake, reset selection.
 */
function onWrongAnswer(f1, f2) {
  // Reset combo
  gameState.combo = 0;

  // Apply penalty (don't go below 0)
  gameState.score = Math.max(0, gameState.score + CONFIG.POINTS_WRONG);
  gameState.wrongAnswers++;

  // Show floating penalty indicator
  showScorePopup(`${CONFIG.POINTS_WRONG}`, f1.el, false);

  // Shake animation
  f1.el.classList.add('floater-wrong');
  f2.el.classList.add('floater-wrong');

  setTimeout(() => {
    f1.el.classList.remove('floater-wrong', 'floater-selected');
    f2.el.classList.remove('floater-wrong', 'floater-selected');
  }, 500);

  // Clear selection
  gameState.selected = [];

  // Play sound
  playSound('wrong');

  // Update HUD
  updateHUD();
}

/**
 * Show a floating +/- score indicator near a floater.
 */
function showScorePopup(text, refEl, isPositive) {
  const popup = document.createElement('div');
  popup.className = `score-popup ${isPositive ? 'popup-positive' : 'popup-negative'}`;
  popup.textContent = text;

  // Position near the reference element
  const rect = refEl.getBoundingClientRect();
  const riverRect = dom.river.getBoundingClientRect();
  popup.style.left = `${rect.left - riverRect.left + rect.width / 2}px`;
  popup.style.top = `${rect.top - riverRect.top}px`;

  dom.river.appendChild(popup);

  // Remove after animation
  setTimeout(() => {
    if (popup.parentNode) popup.parentNode.removeChild(popup);
  }, 800);
}

/**
 * Spawn burst particles at a floater's position.
 */
function spawnParticles(refEl) {
  const rect = refEl.getBoundingClientRect();
  const riverRect = dom.river.getBoundingClientRect();
  const cx = rect.left - riverRect.left + rect.width / 2;
  const cy = rect.top - riverRect.top + rect.height / 2;

  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (Math.PI * 2 / 8) * i;
    const dist = 30 + Math.random() * 30;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.setProperty('--tx', `${tx}px`);
    p.style.setProperty('--ty', `${ty}px`);
    dom.river.appendChild(p);

    setTimeout(() => {
      if (p.parentNode) p.parentNode.removeChild(p);
    }, 600);
  }
}

// ─── 10. TIMER ─────────────────────────────────────────────
function startTimer() {
  gameState.timeLeft = CONFIG.GAME_DURATION;
  updateHUD();

  gameState.timerIntervalId = setInterval(() => {
    gameState.timeLeft--;
    updateHUD();

    // Flash timer when low
    if (gameState.timeLeft <= 10) {
      dom.timerDisplay.classList.add('timer-low');
    }

    if (gameState.timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function stopTimer() {
  if (gameState.timerIntervalId) {
    clearInterval(gameState.timerIntervalId);
    gameState.timerIntervalId = null;
  }
}

// ─── 11. HUD UPDATE ────────────────────────────────────────
function updateHUD() {
  dom.scoreDisplay.textContent = gameState.score;
  dom.timerDisplay.textContent = gameState.timeLeft;
  dom.comboDisplay.textContent = gameState.combo > 0 ? `x${gameState.combo}` : '0';
}

// ─── 12. GAME LOOP (requestAnimationFrame) ─────────────────
function gameLoop(timestamp) {
  if (gameState.phase !== 'playing') return;

  // Delta time for frame-rate independent movement
  if (!gameState.lastFrameTime) gameState.lastFrameTime = timestamp;
  const dt = Math.min((timestamp - gameState.lastFrameTime) / 16.67, 3); // normalize to ~60fps, cap at 3x
  gameState.lastFrameTime = timestamp;

  const river = dom.river;
  const rw = river.clientWidth;
  const rh = river.clientHeight;
  const size = CONFIG.FLOATER_SIZE;

  // Move each floater
  gameState.floaters.forEach(f => {
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    // Bounce off walls
    if (f.x <= 0) {
      f.x = 0;
      f.vx = Math.abs(f.vx);
    } else if (f.x >= rw - size) {
      f.x = rw - size;
      f.vx = -Math.abs(f.vx);
    }

    if (f.y <= 0) {
      f.y = 0;
      f.vy = Math.abs(f.vy);
    } else if (f.y >= rh - size) {
      f.y = rh - size;
      f.vy = -Math.abs(f.vy);
    }

    // Apply position to DOM
    f.el.style.left = `${f.x}px`;
    f.el.style.top = `${f.y}px`;
  });

  gameState.animFrameId = requestAnimationFrame(gameLoop);
}

function startGameLoop() {
  gameState.lastFrameTime = 0;
  gameState.animFrameId = requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
  if (gameState.animFrameId) {
    cancelAnimationFrame(gameState.animFrameId);
    gameState.animFrameId = null;
  }
}

// ─── 13. GAME OVER ────────────────────────────────────────
function endGame() {
  gameState.phase = 'gameover';
  stopTimer();
  stopGameLoop();

  playSound('gameover');

  // Calculate accuracy
  const totalAttempts = gameState.solved + gameState.wrongAnswers;
  const accuracy = totalAttempts > 0
    ? Math.round((gameState.solved / totalAttempts) * 100)
    : 0;

  // Populate final stats
  dom.finalScore.textContent    = gameState.score;
  dom.finalSolved.textContent   = gameState.solved;
  dom.finalAccuracy.textContent = `${accuracy}%`;
  dom.finalCombo.textContent    = gameState.bestCombo;

  // Small delay before showing game over screen for dramatic effect
  setTimeout(() => {
    showScreen('gameover');
  }, 500);
}

// ─── 14. AUDIO (Web Audio API) ─────────────────────────────
let audioCtx = null;

/**
 * Lazily initialize the audio context.
 * Browsers require user gesture to create AudioContext.
 */
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Play a synthesized sound effect.
 * No external audio files needed.
 * @param {'correct' | 'wrong' | 'click' | 'gameover'} type
 */
function playSound(type) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case 'correct':
        // Rising major chord feel
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, now);        // C5
        osc.frequency.setValueAtTime(659, now + 0.08); // E5
        osc.frequency.setValueAtTime(784, now + 0.16); // G5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
        break;

      case 'wrong':
        // Low buzz
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.setValueAtTime(120, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
        break;

      case 'click':
        // Short tick
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        break;

      case 'gameover':
        // Descending tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.5);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
        break;
    }
  } catch (e) {
    // Audio not supported — fail silently
  }
}

// ─── 15. GAME START / RESTART ──────────────────────────────
function startGame() {
  // Reset state
  resetState();
  gameState.phase = 'playing';

  // Clear any leftover DOM
  dom.river.innerHTML = '';
  dom.timerDisplay.classList.remove('timer-low');

  // Switch screen
  showScreen('game');

  // Update HUD
  updateHUD();

  // Generate first question
  generateQuestion();

  // Start systems
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
  gameState.selected        = [];
  gameState.floaters        = [];
  gameState.nextId          = 0;
  gameState.animFrameId     = null;
  gameState.timerIntervalId = null;
  gameState.lastFrameTime   = 0;
  gameState.difficultyLevel = 0;
}

// ─── UTILITY ───────────────────────────────────────────────
/**
 * Random integer between min and max (inclusive).
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── EVENT LISTENERS ───────────────────────────────────────
dom.startBtn.addEventListener('click', () => startGame());
dom.playAgainBtn.addEventListener('click', () => startGame());
dom.menuBtn.addEventListener('click', () => {
  resetState();
  dom.river.innerHTML = '';
  showScreen('start');
});

// Keyboard accessibility: Enter/Space trigger buttons
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const focused = document.activeElement;
    if (focused && focused.classList.contains('btn')) {
      focused.click();
    }
  }
});

// ─── INIT ──────────────────────────────────────────────────
showScreen('start');
