/* ========================================================
   Number Surge — Arcade Master Game Engine
   Full interactive game juice: slot docking, synth sound scales,
   screen shake, combo fire, high-score tracking, and ambient particles.
   ======================================================== */

'use strict';

// ─── 1. GAME CONFIGURATION ───────────────────────────────────
const CONFIG = Object.freeze({
  GAME_DURATION:        60,     // Total base round time (seconds)
  POINTS_CORRECT:       10,     // Base points
  POINTS_WRONG:         -3,     // Penalty on wrong guess
  COMBO_BONUS:          5,      // Bonus per combo multiplier level
  SPEED_MAX_BONUS:      20,     // Max speed reward
  SPEED_WINDOW:         7.5,    // Base seconds before speed bonus runs out
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
  POWERUP_CHANCE:       0.18,   // Chance for a powerup orb to spawn
  ORB_THEMES: ['orb-amber', 'orb-emerald', 'orb-violet', 'orb-coral'],
});

// ─── 2. GAME MODES ───────────────────────────────────────────
const MODES = {
  addition: {
    badge:  'ADD',
    symbol: '+',
    generateQ(diff) {
      const max = gameState.theme === 'robotics' ? getMaxNumber(diff) * 5 : getMaxNumber(diff);
      const target = gameState.theme === 'robotics' ? randInt(10, Math.min(Math.floor(max * 1.8), 500)) : randInt(6, Math.min(Math.floor(max * 1.8), 99));
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
      const max = gameState.theme === 'robotics' ? getMaxNumber(diff) * 5 : getMaxNumber(diff);
      const target = gameState.theme === 'robotics' ? randInt(10, Math.min(max - 2, 250)) : randInt(2, Math.min(max - 2, 45));
      const b = randInt(1, Math.min(max - target, max - 1));
      const a = target + b;
      return { target, pairA: a, pairB: b, check: (x, y) => Math.abs(x - y) === target };
    },
  },

  multiplication: {
    badge:  'MUL',
    symbol: '×',
    generateQ(diff) {
      const maxFactor = gameState.theme === 'robotics' ? Math.min(5 + diff * 2, 25) : Math.min(3 + diff, 12);
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
      const maxFactor = gameState.theme === 'robotics' ? Math.min(5 + diff * 2, 25) : Math.min(3 + diff, 12);
      const b = randInt(2, maxFactor);
      const target = randInt(2, maxFactor);
      const a = target * b;
      return { target, pairA: a, pairB: b, check: (x, y) => {
        const big = Math.max(x, y), small = Math.min(x, y);
        return small !== 0 && big % small === 0 && big / small === target;
      }};
    },
  },

  powers: {
    badge:  'POW',
    symbol: '^',
    generateQ(diff) {
      const bases = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
      const a = bases[randInt(0, Math.min(bases.length - 1, 3 + diff))];
      let maxExp = 2;
      if (a === 2) maxExp = 6;
      else if (a === 3) maxExp = 4;
      else if (a <= 5) maxExp = 3;
      
      const b = randInt(2, maxExp);
      const target = Math.pow(a, b);
      return { target, pairA: a, pairB: b, check: (x, y) => Math.pow(x, y) === target || Math.pow(y, x) === target };
    },
  },

  mixed: {
    badge:  'MIX',
    symbol: '?',
    generateQ(diff) {
      const pool = ['addition', 'subtraction', 'multiplication', 'division'];
      if (gameState.theme === 'robotics') pool.push('powers');
      const chosen = pool[randInt(0, pool.length - 1)];
      const q = MODES[chosen].generateQ(diff);
      q.chosenMode = chosen;
      return q;
    },
  },
};

// ─── 3. STATE MANAGEMENT ─────────────────────────────────────
const gameState = {
  theme:           localStorage.getItem('number_surge_theme') || 'kids',
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
  floaters:        [],           // { id, value, el, x, y, vx, vy, isPowerUp, powerUpType }
  nextId:          0,
  animFrameId:     null,
  timerIntervalId: null,
  lastFrameTime:   0,
  startingDifficulty: 0,
  difficultyLevel: 0,
  isMuted:         false,
  questionStartMs: 0,
  bestSpeedBonus:  0,
  highScore:       0,
  isPaused:        false,
  duration:        60,
  shieldCharges:   0,
  isFrozen:        false,
  freezeTimeoutId: null,
  coinsEarnedThisRound: 0,
};

// ─── 4. ECONOMY & UPGRADES SYSTEM ────────────────────────────
const UPGRADES_CONFIG = {
  timeBoost:   { max: 5, costs: [50, 100, 200, 350, 500], bonus: 5 },
  comboShield: { max: 1, costs: [120],                    bonus: 1 },
  speedBoost:  { max: 4, costs: [75, 150, 250, 400],      bonus: 1.5 },
  coinMult:    { max: 4, costs: [100, 200, 350, 500],     bonus: 0.25 },
};

const SKINS_CONFIG = {
  candy:  { name: 'CANDY BUBBLE', cost: 0 },
  cyber:  { name: 'CYBER NEON',   cost: 100 },
  magma:  { name: 'MAGMA SURGE',  cost: 200 },
  frost:  { name: 'GLACIAL FROST',cost: 300 },
  gold:   { name: 'GOLDEN ROYALE',cost: 500 },
  galaxy: { name: 'GALAXY NEBULA',cost: 750 },
};

const economy = {
  coins: parseInt(localStorage.getItem('number_surge_coins') || '0', 10),
  upgrades: JSON.parse(localStorage.getItem('number_surge_upgrades') || '{"timeBoost":0,"comboShield":0,"speedBoost":0,"coinMult":0}'),
  ownedSkins: JSON.parse(localStorage.getItem('number_surge_owned_skins') || '["candy"]'),
  activeSkin: localStorage.getItem('number_surge_active_skin') || 'candy',
};

// ─── 5. CRAZYGAMES SDK V3 MANAGER ────────────────────────────
let crazySDK = null;
let isCrazySDKInitialized = false;

async function initCrazySDK() {
  try {
    if (window.CrazyGames && window.CrazyGames.SDK) {
      crazySDK = window.CrazyGames.SDK;
      await crazySDK.init();
      isCrazySDKInitialized = true;
      if (crazySDK.game?.loadingStop) crazySDK.game.loadingStop();
    }
  } catch (err) {
    console.warn('CrazyGames SDK init fallback (offline/standalone mode):', err);
  }
}

function triggerCrazyGameplayStart() {
  try {
    if (isCrazySDKInitialized && crazySDK?.game?.gameplayStart) {
      crazySDK.game.gameplayStart();
    }
  } catch (_) {}
}

function triggerCrazyGameplayStop() {
  try {
    if (isCrazySDKInitialized && crazySDK?.game?.gameplayStop) {
      crazySDK.game.gameplayStop();
    }
  } catch (_) {}
}

function triggerCrazyHappyTime() {
  try {
    if (isCrazySDKInitialized && crazySDK?.game?.happytime) {
      crazySDK.game.happytime();
    }
  } catch (_) {}
}

function showCrazyMidroll(callback) {
  if (isCrazySDKInitialized && crazySDK?.ad?.requestAd) {
    crazySDK.ad.requestAd('midroll', {
      adStarted: () => {
        if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
      },
      adFinished: () => {
        if (audioCtx && audioCtx.state === 'suspended' && !gameState.isMuted) audioCtx.resume();
        if (typeof callback === 'function') callback();
      },
      adError: (error) => {
        console.warn('Midroll ad error:', error);
        if (audioCtx && audioCtx.state === 'suspended' && !gameState.isMuted) audioCtx.resume();
        if (typeof callback === 'function') callback();
      }
    });
  } else {
    if (typeof callback === 'function') callback();
  }
}

function showCrazyRewarded(rewardType, rewardCallback) {
  if (isCrazySDKInitialized && crazySDK?.ad?.requestAd) {
    crazySDK.ad.requestAd('rewarded', {
      adStarted: () => {
        if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
      },
      adFinished: () => {
        if (audioCtx && audioCtx.state === 'suspended' && !gameState.isMuted) audioCtx.resume();
        if (typeof rewardCallback === 'function') rewardCallback();
      },
      adError: (error) => {
        console.warn('Rewarded ad error:', error);
        if (audioCtx && audioCtx.state === 'suspended' && !gameState.isMuted) audioCtx.resume();
        if (typeof rewardCallback === 'function') rewardCallback();
      }
    });
  } else {
    if (typeof rewardCallback === 'function') rewardCallback();
  }
}

// ─── 6. DOM ELEMENT CACHE ────────────────────────────────────
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
  diffGrid:        document.getElementById('diff-grid'),

  coinsDisplay:    document.getElementById('coins-display'),
  shopBtn:         document.getElementById('shop-btn'),
  shopModal:       document.getElementById('shop-modal'),
  closeShopBtn:    document.getElementById('close-shop-btn'),
  shopCoinsVal:    document.getElementById('shop-coins-val'),

  scoreDisplay:    document.getElementById('score-display'),
  hudScoreBox:     document.getElementById('hud-score-box'),
  timerDisplay:    document.getElementById('timer-display'),
  timerBadge:      document.getElementById('timer-badge'),
  comboDisplay:    document.getElementById('combo-display'),
  hudComboBox:     document.getElementById('hud-combo-box'),
  comboNum:        document.getElementById('combo-num'),
  speedMeterBar:   document.getElementById('speed-meter-bar'),
  speedToast:      document.getElementById('speed-toast'),
  hudShieldIndicator: document.getElementById('hud-shield-indicator'),
  shieldCount:     document.getElementById('shield-count'),
  freezeOverlay:   document.getElementById('freeze-overlay'),

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

  howToPlayBtn:      document.getElementById('how-to-play-btn'),
  howToPlayModal:    document.getElementById('how-to-play-modal'),
  closeHowToPlayBtn: document.getElementById('close-how-to-play-btn'),

  finalScore:      document.getElementById('final-score'),
  finalSolved:     document.getElementById('final-solved'),
  finalAccuracy:   document.getElementById('final-accuracy'),
  finalCombo:      document.getElementById('final-combo'),
  finalCoins:      document.getElementById('final-coins'),
  doubleCoinsBtn:  document.getElementById('double-coins-btn'),
  reviveBtn:       document.getElementById('revive-btn'),
  rankBadge:       document.getElementById('rank-badge'),
  newRecordBadge:  document.getElementById('new-record-badge'),
};

// ─── 5. AMBIENT BACKGROUND PARTICLES & MATRIX CANVAS ──────────
const ambientCanvas = document.getElementById('ambient-canvas');
const ambientCtx = ambientCanvas ? ambientCanvas.getContext('2d') : null;
let ambientParticles = [];
let matrixDrops = [];
const MATRIX_CHARS = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ+-*/=><^$#%@&';
const MATRIX_FONT_SIZE = 14;

function initAmbientCanvas() {
  if (!ambientCanvas) return;
  ambientCanvas.width = window.innerWidth;
  ambientCanvas.height = window.innerHeight;
  
  const colors = [
    'rgba(255, 107, 138, 0.45)', // Pink
    'rgba(255, 159, 67, 0.45)',  // Orange
    'rgba(69, 170, 242, 0.45)',  // Sky Blue
    'rgba(46, 213, 115, 0.45)',  // Mint Green
    'rgba(165, 94, 234, 0.45)',  // Lavender
    'rgba(254, 211, 48, 0.45)',  // Sunny Yellow
  ];

  ambientParticles = [];
  for (let i = 0; i < 30; i++) {
    ambientParticles.push({
      x: Math.random() * ambientCanvas.width,
      y: Math.random() * ambientCanvas.height,
      radius: Math.random() * 12 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(Math.random() * 0.45 + 0.15),
      alpha: Math.random() * 0.5 + 0.3,
    });
  }

  // Initialize Matrix columns
  const columns = Math.ceil(ambientCanvas.width / MATRIX_FONT_SIZE);
  matrixDrops = [];
  for (let i = 0; i < columns; i++) {
    matrixDrops[i] = Math.floor(Math.random() * -60);
  }
}

let lastMatrixFrame = 0;

function renderAmbientParticles(timestamp = 0) {
  if (!ambientCtx || !ambientCanvas) return;

  if (gameState.theme === 'robotics') {
    if (gameState.phase === 'playing') {
      // MATRIX DIGITAL RAIN (Active Gameplay Arena)
      if (!lastMatrixFrame) lastMatrixFrame = timestamp;
      const elapsed = timestamp - lastMatrixFrame;
      
      if (elapsed > 35) {
        lastMatrixFrame = timestamp;
        ambientCtx.fillStyle = 'rgba(10, 14, 23, 0.14)';
        ambientCtx.fillRect(0, 0, ambientCanvas.width, ambientCanvas.height);

        ambientCtx.font = `bold ${MATRIX_FONT_SIZE}px monospace`;

        for (let i = 0; i < matrixDrops.length; i++) {
          const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
          const x = i * MATRIX_FONT_SIZE;
          const y = matrixDrops[i] * MATRIX_FONT_SIZE;

          if (y > 0 && y < ambientCanvas.height + MATRIX_FONT_SIZE) {
            // Leading glyph is bright glowing white/cyan, body is matrix neon green
            const isLead = Math.random() > 0.88;
            ambientCtx.fillStyle = isLead ? '#ffffff' : (i % 4 === 0 ? '#00f2fe' : '#00ff88');
            ambientCtx.shadowColor = isLead ? '#00f2fe' : '#00ff88';
            ambientCtx.shadowBlur = isLead ? 6 : 3;
            ambientCtx.fillText(char, x, y);
            ambientCtx.shadowBlur = 0;
          }

          if (y > ambientCanvas.height && Math.random() > 0.975) {
            matrixDrops[i] = 0;
          }
          matrixDrops[i]++;
        }
      }
    } else {
      // On menu / setup screens, clear canvas so home menu remains clean and uncluttered
      ambientCtx.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);
    }
  } else {
    // PASTEL FLOATING BUBBLES (Kids Candy Theme)
    ambientCtx.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);

    ambientParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y + p.radius < 0) { p.y = ambientCanvas.height + p.radius; p.x = Math.random() * ambientCanvas.width; }
      if (p.x + p.radius < 0) p.x = ambientCanvas.width + p.radius;
      if (p.x - p.radius > ambientCanvas.width) p.x = -p.radius;

      // Pastel Bubble
      ambientCtx.beginPath();
      ambientCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ambientCtx.fillStyle = p.color;
      ambientCtx.fill();

      // Bubble shine
      ambientCtx.beginPath();
      ambientCtx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.28, 0, Math.PI * 2);
      ambientCtx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ambientCtx.fill();
    });
  }

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
    dom.startHighScore.textContent = `${gameState.highScore}`;
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

// ─── 7. ECONOMY & SHOP LOGIC ─────────────────────────────────
function saveEconomy() {
  localStorage.setItem('number_surge_coins', economy.coins.toString());
  localStorage.setItem('number_surge_upgrades', JSON.stringify(economy.upgrades));
  localStorage.setItem('number_surge_owned_skins', JSON.stringify(economy.ownedSkins));
  localStorage.setItem('number_surge_active_skin', economy.activeSkin);
  updateCoinsDisplay();
  renderShopUI();
}

function updateCoinsDisplay() {
  if (dom.coinsDisplay) dom.coinsDisplay.textContent = economy.coins.toLocaleString();
  if (dom.shopCoinsVal) dom.shopCoinsVal.textContent = economy.coins.toLocaleString();
}

function addCoins(amount) {
  economy.coins += amount;
  gameState.coinsEarnedThisRound += amount;
  saveEconomy();
  updateCoinsDisplay();
}

function applyEquippedSkin(skinId) {
  if (!economy.ownedSkins.includes(skinId)) return;
  economy.activeSkin = skinId;
  saveEconomy();

  const skinClasses = ['skin-applied-candy', 'skin-applied-cyber', 'skin-applied-magma', 'skin-applied-frost', 'skin-applied-gold', 'skin-applied-galaxy'];
  skinClasses.forEach(cls => dom.river && dom.river.classList.remove(cls));
  if (dom.river) dom.river.classList.add(`skin-applied-${skinId}`);
}

function renderShopUI() {
  // 1. Render Upgrades
  for (const key in UPGRADES_CONFIG) {
    const config = UPGRADES_CONFIG[key];
    const currentLvl = economy.upgrades[key] || 0;
    const lvlEl = document.getElementById(`u-${key}-level`);
    const costEl = document.getElementById(`u-${key}-cost`);
    const btn = document.querySelector(`.u-buy-btn[data-upgrade="${key}"]`);

    if (lvlEl) lvlEl.textContent = `Level ${currentLvl}/${config.max}`;
    if (currentLvl >= config.max) {
      if (btn) {
        btn.classList.add('maxed');
        btn.innerHTML = '<span>MAXED</span>';
      }
    } else {
      const cost = config.costs[currentLvl];
      if (costEl) costEl.textContent = cost;
      if (btn) {
        btn.classList.remove('maxed');
        btn.innerHTML = `<span class="u-cost-icon">🪙</span><span class="u-cost-val">${cost}</span>`;
      }
    }
  }

  // 2. Render Skins
  document.querySelectorAll('.skin-item').forEach(item => {
    const skinId = item.dataset.skin;
    const btn = item.querySelector('.skin-action-btn');
    const isOwned = economy.ownedSkins.includes(skinId);
    const isActive = economy.activeSkin === skinId;

    item.classList.toggle('active', isActive);

    if (isActive) {
      btn.textContent = 'EQUIPPED';
      btn.className = 'skin-action-btn';
    } else if (isOwned) {
      btn.textContent = 'EQUIP';
      btn.className = 'skin-action-btn btn-equip';
    } else {
      const cost = SKINS_CONFIG[skinId]?.cost || 100;
      btn.textContent = `🪙 ${cost}`;
      btn.className = 'skin-action-btn btn-buy';
    }
  });
}

function buyUpgrade(key) {
  const config = UPGRADES_CONFIG[key];
  if (!config) return;
  const currentLvl = economy.upgrades[key] || 0;
  if (currentLvl >= config.max) return;

  const cost = config.costs[currentLvl];
  if (economy.coins >= cost) {
    economy.coins -= cost;
    economy.upgrades[key] = currentLvl + 1;
    saveEconomy();
    playArcadeSound('correct');
    showSpeedToast(10);
  } else {
    playArcadeSound('wrong');
  }
}

function buyOrEquipSkin(skinId) {
  const config = SKINS_CONFIG[skinId];
  if (!config) return;

  if (economy.ownedSkins.includes(skinId)) {
    applyEquippedSkin(skinId);
    playArcadeSound('select');
  } else {
    if (economy.coins >= config.cost) {
      economy.coins -= config.cost;
      economy.ownedSkins.push(skinId);
      applyEquippedSkin(skinId);
      playArcadeSound('correct');
      showSpeedToast(15);
    } else {
      playArcadeSound('wrong');
    }
  }
}

// ─── 8. SCREEN MANAGEMENT ────────────────────────────────────
function showScreen(name) {
  [dom.startScreen, dom.gameScreen, dom.gameoverScreen].forEach(s => s.classList.remove('active'));
  if (name === 'start') dom.startScreen.classList.add('active');
  if (name === 'game')  dom.gameScreen.classList.add('active');
  if (name === 'gameover') dom.gameoverScreen.classList.add('active');
}

function getEffectiveSpeedWindow() {
  return CONFIG.SPEED_WINDOW + ((economy.upgrades.speedBoost || 0) * 1.5);
}

function getBaseDuration() {
  return (gameState.duration || CONFIG.GAME_DURATION) + ((economy.upgrades.timeBoost || 0) * 5);
}

// ─── 9. QUESTION & FLOATER GENERATION ────────────────────────
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

  // Powerup Spawning (approx ~18% chance)
  if (Math.random() < CONFIG.POWERUP_CHANCE) {
    const powerUps = ['bomb', 'freeze', 'hint', 'shield', 'coin'];
    const chosenP = powerUps[randInt(0, powerUps.length - 1)];
    createOrbFloater(0, true, chosenP);
  }
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

// ─── 10. 3D FLOATING ORB SYSTEM & POWER-UPS ──────────────────
function createOrbFloater(value, isPowerUp = false, powerUpType = null) {
  const rw = dom.river.clientWidth;
  const rh = dom.river.clientHeight;
  const sz = CONFIG.ORB_SIZE;
  const m = Math.min(CONFIG.SPAWN_MARGIN, Math.floor(rw / 4), Math.floor(rh / 4));

  const x = randInt(m, Math.max(m + 1, rw - sz - m));
  const y = randInt(m, Math.max(m + 1, rh - sz - m));

  const speed = getCurrentSpeed();
  const angle = Math.random() * Math.PI * 2;
  const minV = speed * 0.35;
  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;
  if (Math.abs(vx) < minV) vx = (vx >= 0 ? 1 : -1) * minV;
  if (Math.abs(vy) < minV) vy = (vy >= 0 ? 1 : -1) * minV;
  vx *= (0.6 + Math.random() * 0.6);
  vy *= (0.6 + Math.random() * 0.6);

  const el = document.createElement('div');
  const id = gameState.nextId++;

  if (isPowerUp) {
    el.className = `orb-floater orb-powerup orb-${powerUpType}`;
    const icons = { bomb: '💣', freeze: '❄️', hint: '💡', shield: '🛡️', coin: '🪙' };
    el.innerHTML = `<span class="bubble-num">${icons[powerUpType] || '⚡'}</span>`;
    el.setAttribute('aria-label', `Powerup ${powerUpType}`);
  } else {
    const theme = CONFIG.ORB_THEMES[randInt(0, CONFIG.ORB_THEMES.length - 1)];
    el.className = `orb-floater ${theme}`;
    el.innerHTML = `
      <div class="bubble-shine"></div>
      <span class="bubble-num">${value}</span>
    `;
    el.setAttribute('aria-label', `Number ${value}`);
  }

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.dataset.floaterId = id;
  el.addEventListener('click', () => onFloaterClick(id));

  dom.river.appendChild(el);
  const floater = { id, value, el, x, y, vx, vy, isPowerUp, powerUpType };
  gameState.floaters.push(floater);
  return floater;
}

function clearAllFloaters() {
  document.querySelectorAll('.orb-floater').forEach(el => el.remove());
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

// ─── 11. POWER-UP ACTIVATIONS ────────────────────────────────
function triggerPowerUp(type, refEl) {
  spawnEnergyParticles(refEl);

  if (type === 'bomb') {
    playArcadeSound('powerup_bomb');
    showFloatingScore('💥 BLAST!', refEl, 'plus');
    triggerScreenShake();
    showSpeedToast(25);
    
    // Auto solve with active equation pair
    let pairFound = [];
    for (let i = 0; i < gameState.floaters.length; i++) {
      for (let j = i + 1; j < gameState.floaters.length; j++) {
        const a = gameState.floaters[i], b = gameState.floaters[j];
        if (!a.isPowerUp && !b.isPowerUp && gameState.currentCheck && gameState.currentCheck(a.value, b.value)) {
          pairFound = [a, b];
          break;
        }
      }
      if (pairFound.length === 2) break;
    }
    if (pairFound.length === 2) {
      handleCorrect(pairFound[0], pairFound[1], true);
    }
  }
  else if (type === 'freeze') {
    playArcadeSound('powerup_freeze');
    gameState.isFrozen = true;
    if (dom.freezeOverlay) dom.freezeOverlay.style.display = 'flex';
    showFloatingScore('❄️ FROZEN!', refEl, 'plus');
    showSpeedToast(15);
    
    if (gameState.freezeTimeoutId) clearTimeout(gameState.freezeTimeoutId);
    gameState.freezeTimeoutId = setTimeout(() => {
      gameState.isFrozen = false;
      if (dom.freezeOverlay) dom.freezeOverlay.style.display = 'none';
    }, 5000);
  }
  else if (type === 'hint') {
    playArcadeSound('select');
    showFloatingScore('💡 RADAR!', refEl, 'plus');
    showSpeedToast(10);
    
    let pairFound = [];
    for (let i = 0; i < gameState.floaters.length; i++) {
      for (let j = i + 1; j < gameState.floaters.length; j++) {
        const a = gameState.floaters[i], b = gameState.floaters[j];
        if (!a.isPowerUp && !b.isPowerUp && gameState.currentCheck && gameState.currentCheck(a.value, b.value)) {
          pairFound = [a, b];
          break;
        }
      }
      if (pairFound.length === 2) break;
    }
    pairFound.forEach(f => {
      f.el.classList.add('orb-hint-glow');
      setTimeout(() => f.el && f.el.classList.remove('orb-hint-glow'), 3500);
    });
  }
  else if (type === 'shield') {
    playArcadeSound('powerup_shield');
    gameState.shieldCharges++;
    if (dom.hudShieldIndicator) {
      dom.hudShieldIndicator.style.display = 'flex';
      if (dom.shieldCount) dom.shieldCount.textContent = gameState.shieldCharges;
    }
    showFloatingScore('🛡️ SHIELD!', refEl, 'plus');
    showSpeedToast(10);
  }
  else if (type === 'coin') {
    playArcadeSound('powerup_coin');
    addCoins(15);
    showFloatingScore('+15 🪙', refEl, 'plus');
    showSpeedToast(15);
  }
}

// ─── 12. SELECTION & EQUATION DOCK LOGIC ──────────────────────
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

  // Handle Power-Up Orbs
  if (floater.isPowerUp) {
    triggerPowerUp(floater.powerUpType, floater.el);
    removeFloater(floater.id, true);
    return;
  }

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

// ─── 13. ANSWER VALIDATION & SCORING ─────────────────────────
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
  const speedWindow = getEffectiveSpeedWindow();
  if (elapsed >= speedWindow) return 0;
  const factor = 1 - (elapsed / speedWindow);
  return Math.round(CONFIG.SPEED_MAX_BONUS * factor);
}

function handleCorrect(f1, f2, isBomb = false) {
  gameState.combo++;
  if (gameState.combo > gameState.bestCombo) gameState.bestCombo = gameState.combo;

  const speedBonus = isBomb ? CONFIG.SPEED_MAX_BONUS : calcSpeedBonus();
  if (speedBonus > gameState.bestSpeedBonus) gameState.bestSpeedBonus = speedBonus;

  const comboBonus = Math.max(0, gameState.combo - 1) * CONFIG.COMBO_BONUS;
  dom.comboNum.textContent = `${gameState.combo}x`;
  
  gameState.solved++;
  gameState.difficultyLevel = gameState.startingDifficulty + Math.floor(gameState.solved / CONFIG.DIFFICULTY_INTERVAL);

  const points = CONFIG.POINTS_CORRECT + comboBonus + speedBonus;
  gameState.score += points;

  // Add Coins for this solve
  const baseCoins = 1;
  const coinMultBonus = (economy.upgrades.coinMult || 0) * 0.25;
  let earnedCoins = Math.round(baseCoins * (1 + coinMultBonus));
  if (gameState.combo >= 5) earnedCoins += 1;
  if (speedBonus >= 12) earnedCoins += 1;
  addCoins(earnedCoins);

  // Trigger CrazyGames happytime on milestone streaks
  if (gameState.combo === 5 || gameState.combo === 10 || gameState.combo === 15) {
    triggerCrazyHappyTime();
  }

  // Visual slot feedback
  dom.slotA.className = 'slot slot-operand success-flash';
  dom.slotB.className = 'slot slot-operand success-flash';

  showFloatingScore(`+${points}`, f1.el, 'plus');
  if (speedBonus >= 8 && !isBomb) showSpeedToast(speedBonus);

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
  if (gameState.shieldCharges > 0) {
    gameState.shieldCharges--;
    if (gameState.shieldCharges <= 0) {
      if (dom.hudShieldIndicator) dom.hudShieldIndicator.style.display = 'none';
    } else {
      if (dom.shieldCount) dom.shieldCount.textContent = gameState.shieldCharges;
    }
    showFloatingScore('🛡️ SHIELD SAVED!', f1.el, 'plus');
    playArcadeSound('powerup_shield');

    f1.el.classList.remove('orb-selected');
    f2.el.classList.remove('orb-selected');
    resetEquationSlots();
    gameState.selected = [];
    return;
  }

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

// ─── 14. SPEED METER GAUGE ───────────────────────────────────
let speedMeterLoopId = null;

function resetSpeedMeter() {
  dom.speedMeterBar.style.width = '100%';
  cancelAnimationFrame(speedMeterLoopId);
  updateSpeedMeter();
}

function updateSpeedMeter() {
  const elapsed = (Date.now() - gameState.questionStartMs) / 1000;
  const speedWindow = getEffectiveSpeedWindow();
  const pct = Math.max(0, 1 - elapsed / speedWindow) * 100;
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

// ─── 15. HUD & SCREEN FX ─────────────────────────────────────
function updateHUD() {
  if (dom.scoreDisplay) {
    dom.scoreDisplay.textContent = `${gameState.score} PTS`;
  }
  if (dom.levelIndicator) {
    dom.levelIndicator.textContent = `LVL ${gameState.difficultyLevel + 1}`;
  }
  if (dom.timerDisplay) {
    dom.timerDisplay.textContent = gameState.timeLeft;
  }
  if (dom.comboNum) {
    dom.comboNum.textContent = `${gameState.combo}x`;
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

// ─── 16. COUNTDOWN TIMER ─────────────────────────────────────
function startTimer() {
  stopTimer();
  gameState.timeLeft = getBaseDuration();
  updateHUD();

  gameState.timerIntervalId = setInterval(() => {
    if (gameState.phase !== 'playing' || gameState.isPaused || gameState.isFrozen) return;
    gameState.timeLeft--;
    updateHUD();

    if (gameState.timeLeft <= 10) {
      dom.timerBadge.classList.add('timer-low');
      playArcadeSound('tick_urgent');
    }

    if (gameState.timeLeft <= 0) {
      stopTimer();
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

// ─── 17. MAIN PHYSICS GAME LOOP (rAF) ────────────────────────
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
  stopGameLoop();
  gameState.lastFrameTime = 0;
  gameState.animFrameId = requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
  if (gameState.animFrameId) {
    cancelAnimationFrame(gameState.animFrameId);
    gameState.animFrameId = null;
  }
}

// ─── 18. GAME OVER & RANKING ─────────────────────────────────
function calculateRank(score, accuracy) {
  if (gameState.theme === 'robotics') {
    if (score >= 400 && accuracy >= 90) return { rank: '🌌 CYBER GOD 🦾', color: '#ff007f' };
    if (score >= 250 && accuracy >= 80) return { rank: '⚡ SYSTEM ADMIN 🔧',    color: '#00f2fe' };
    if (score >= 120 && accuracy >= 60) return { rank: '🔋 ELITE HACKER 💻',      color: '#00ff88' };
    if (score >= 50)                    return { rank: '⚙️ APPRENTICE 🤖',       color: '#b000ff' };
    return { rank: '🔌 NEED REBOOT 🔋', color: '#ff003c' };
  } else {
    if (score >= 400 && accuracy >= 90) return { rank: '🌟 MATH LEGEND ⭐⭐⭐', color: '#ff9f43' };
    if (score >= 250 && accuracy >= 80) return { rank: '🏆 SUPERSTAR ⭐⭐',    color: '#2ed573' };
    if (score >= 120 && accuracy >= 60) return { rank: '🎉 GREAT JOB! ⭐',      color: '#45aaf2' };
    if (score >= 50)                    return { rank: '🎈 GOOD EFFORT!',       color: '#a55eea' };
    return { rank: '🌱 KEEP PRACTICING!', color: '#ff6b8a' };
  }
}

function stopAllAudio() {
  if (audioCtx && masterGainNode) {
    try {
      masterGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      setTimeout(() => {
        if (masterGainNode && audioCtx && !gameState.isMuted) {
          masterGainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        }
      }, 80);
    } catch (_) {}
  }
}

function triggerCMGEvent(eventType) {
  try {
    if (window.parent && typeof window.parent.cmg_game_event === 'function') {
      window.parent.cmg_game_event(eventType);
    } else if (typeof window.cmg_game_event === 'function') {
      window.cmg_game_event(eventType);
    }
  } catch (_) {}
}

function endGame() {
  if (gameState.phase !== 'playing') return;
  gameState.phase = 'gameover';
  stopTimer();
  stopGameLoop();
  cancelAnimationFrame(speedMeterLoopId);
  clearAllFloaters();
  stopAllAudio();
  triggerCMGEvent('gameover');
  triggerCrazyGameplayStop();

  const totalAttempts = gameState.solved + gameState.wrongAnswers;
  const accuracy = totalAttempts > 0 ? Math.round(gameState.solved / totalAttempts * 100) : 0;
  const isNewRecord = saveHighScoreIfRecord(gameState.score);

  const rankInfo = calculateRank(gameState.score, accuracy);
  dom.rankBadge.textContent = rankInfo.rank;
  dom.rankBadge.style.background = rankInfo.color;

  dom.finalScore.textContent    = `${gameState.score} PTS`;
  dom.finalSolved.textContent   = gameState.solved;
  dom.finalAccuracy.textContent = `${accuracy}%`;
  dom.finalCombo.textContent    = `${gameState.bestCombo}x`;
  dom.finalCoins.textContent    = `+${gameState.coinsEarnedThisRound}`;

  if (dom.doubleCoinsBtn) dom.doubleCoinsBtn.style.display = 'flex';
  if (dom.reviveBtn) dom.reviveBtn.style.display = 'flex';

  if (isNewRecord && gameState.score > 0) {
    dom.newRecordBadge.classList.add('show');
  } else {
    dom.newRecordBadge.classList.remove('show');
  }

  setTimeout(() => showScreen('gameover'), 350);
}

function reviveRound(extraSeconds = 30) {
  gameState.phase = 'playing';
  gameState.timeLeft = extraSeconds;
  if (dom.reviveBtn) dom.reviveBtn.style.display = 'none';

  showScreen('game');
  updateHUD();
  generateQuestion();
  startTimer();
  startGameLoop();
  triggerCrazyGameplayStart();
}

// ─── 19. SYNTHESIZED PROCEDURAL WEB AUDIO ────────────────────
let audioCtx = null;
let masterGainNode = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGainNode = audioCtx.createGain();
    masterGainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    masterGainNode.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (masterGainNode) masterGainNode.gain.setValueAtTime(1, audioCtx.currentTime);
  return audioCtx;
}

function playArcadeSound(type, comboLevel = 1) {
  if (gameState.isMuted) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const isRobotics = gameState.theme === 'robotics';

    if (type === 'select' || type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isRobotics ? 'square' : 'sine';
      osc.frequency.setValueAtTime(type === 'select' ? (isRobotics ? 600 : 980) : (isRobotics ? 400 : 700), now);
      if (isRobotics && type === 'select') osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
      gain.gain.setValueAtTime(isRobotics ? 0.04 : 0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(masterGainNode);
      osc.start(now);
      osc.stop(now + 0.05);
    }
    else if (type === 'correct') {
      const semitone = Math.min(comboLevel - 1, 12);
      const baseFreq = (isRobotics ? 440 : 523.25) * Math.pow(2, semitone / 12);
      
      const chord = isRobotics ? [baseFreq, baseFreq * 1.5, baseFreq * 2] : [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isRobotics ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.035);
        gain.gain.setValueAtTime(isRobotics ? 0.06 : 0.12, now + i * 0.035);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isRobotics ? 0.2 : 0.3) + i * 0.035);
        
        if (isRobotics) {
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2000, now);
          filter.frequency.exponentialRampToValueAtTime(400, now + 0.2);
          osc.connect(filter);
          filter.connect(gain);
        } else {
          osc.connect(gain);
        }
        
        gain.connect(masterGainNode);
        osc.start(now + i * 0.035);
        osc.stop(now + 0.32 + i * 0.035);
      });
    }
    else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isRobotics ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(isRobotics ? 150 : 260, now);
      osc.frequency.linearRampToValueAtTime(isRobotics ? 50 : 180, now + 0.15);
      gain.gain.setValueAtTime(isRobotics ? 0.05 : 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isRobotics ? 0.25 : 0.18));
      osc.connect(gain);
      gain.connect(masterGainNode);
      osc.start(now);
      osc.stop(now + 0.3);
    }
    else if (type === 'tick_urgent') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isRobotics ? 'square' : 'sine';
      osc.frequency.setValueAtTime(isRobotics ? 600 : 880, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(masterGainNode);
      osc.start(now);
      osc.stop(now + 0.03);
    }
    else if (type === 'powerup_bomb') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(masterGainNode);
      osc.start(now);
      osc.stop(now + 0.35);
    }
    else if (type === 'powerup_freeze') {
      [900, 1200, 1600].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.08, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
        osc.connect(gain);
        gain.connect(masterGainNode);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.25);
      });
    }
    else if (type === 'powerup_coin') {
      [987.77, 1318.51].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.08, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(masterGainNode);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.2);
      });
    }
    else if (type === 'powerup_shield') {
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        gain.gain.setValueAtTime(0.08, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.3);
        osc.connect(gain);
        gain.connect(masterGainNode);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.3);
      });
    }
    else if (type === 'gameover' || type === 'gameover_record') {
      const notes = type === 'gameover_record' 
        ? [523.25, 659.25, 783.99, 1046.50, 1318.51] 
        : [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isRobotics ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(isRobotics ? f * 0.5 : f, now + idx * 0.08);
        gain.gain.setValueAtTime(isRobotics ? 0.06 : 0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + (isRobotics ? 0.4 : 0.25));
        
        if (isRobotics) {
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1000, now);
          osc.connect(filter);
          filter.connect(gain);
        } else {
          osc.connect(gain);
        }

        gain.connect(masterGainNode);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.5);
      });
    }
  } catch (_) {}
}

// ─── 20. GAME CONTROLS & FLOW ────────────────────────────────
function startGame() {
  resetState();
  gameState.phase = 'playing';
  gameState.coinsEarnedThisRound = 0;
  gameState.shieldCharges = economy.upgrades.comboShield > 0 ? 1 : 0;
  if (dom.hudShieldIndicator) {
    dom.hudShieldIndicator.style.display = gameState.shieldCharges > 0 ? 'flex' : 'none';
    if (dom.shieldCount) dom.shieldCount.textContent = gameState.shieldCharges;
  }
  if (dom.freezeOverlay) dom.freezeOverlay.style.display = 'none';

  clearAllFloaters();
  if (dom.timerBadge) dom.timerBadge.classList.remove('timer-low');
  if (dom.hudComboBox) dom.hudComboBox.classList.remove('combo-fire');
  if (dom.howToPlayModal) dom.howToPlayModal.classList.remove('active');
  if (dom.shopModal) dom.shopModal.classList.remove('active');

  applyEquippedSkin(economy.activeSkin);
  showScreen('game');
  updateHUD();
  generateQuestion();
  startTimer();
  startGameLoop();
  playArcadeSound('select');
  triggerCMGEvent('start');
  triggerCrazyGameplayStart();
}

function resetState() {
  stopTimer();
  stopGameLoop();
  if (typeof cancelAnimationFrame === 'function' && speedMeterLoopId) {
    cancelAnimationFrame(speedMeterLoopId);
    speedMeterLoopId = null;
  }
  clearAllFloaters();

  gameState.phase           = 'menu';
  gameState.isPaused        = false;
  gameState.isFrozen        = false;
  if (gameState.freezeTimeoutId) clearTimeout(gameState.freezeTimeoutId);
  gameState.score           = 0;
  gameState.timeLeft        = getBaseDuration();
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
  gameState.difficultyLevel = gameState.startingDifficulty;
  gameState.questionStartMs = 0;
  gameState.bestSpeedBonus  = 0;
  
  if (dom.pauseModal) dom.pauseModal.classList.remove('active');
  if (dom.howToPlayModal) dom.howToPlayModal.classList.remove('active');
  if (dom.shopModal) dom.shopModal.classList.remove('active');
  if (dom.timerBadge) dom.timerBadge.classList.remove('timer-low');
  if (dom.hudComboBox) dom.hudComboBox.classList.remove('combo-fire');
}

function togglePause() {
  if (gameState.phase !== 'playing') return;
  gameState.isPaused = !gameState.isPaused;
  if (gameState.isPaused) {
    if (dom.pauseModal) dom.pauseModal.classList.add('active');
    playArcadeSound('click');
    triggerCMGEvent('pause');
    triggerCrazyGameplayStop();
  } else {
    if (dom.pauseModal) dom.pauseModal.classList.remove('active');
    playArcadeSound('select');
    triggerCMGEvent('resume');
    triggerCrazyGameplayStart();
  }
}

// ─── 21. EVENT LISTENERS ─────────────────────────────────────
// Shop Controls & Tabs
if (dom.shopBtn) {
  dom.shopBtn.addEventListener('click', () => {
    if (dom.shopModal) {
      renderShopUI();
      dom.shopModal.classList.add('active');
    }
    playArcadeSound('click');
  });
}
if (dom.closeShopBtn) {
  dom.closeShopBtn.addEventListener('click', () => {
    if (dom.shopModal) dom.shopModal.classList.remove('active');
    playArcadeSound('select');
  });
}
if (dom.shopModal) {
  dom.shopModal.addEventListener('click', e => {
    if (e.target === dom.shopModal) {
      dom.shopModal.classList.remove('active');
      playArcadeSound('click');
    }
  });

  // Shop Tabs
  dom.shopModal.querySelectorAll('.shop-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      dom.shopModal.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
      dom.shopModal.querySelectorAll('.shop-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const targetTab = document.getElementById(`shop-tab-${tab.dataset.tab}`);
      if (targetTab) targetTab.classList.add('active');
      playArcadeSound('click');
    });
  });

  // Buy Upgrades
  dom.shopModal.addEventListener('click', e => {
    const buyBtn = e.target.closest('.u-buy-btn');
    if (buyBtn && !buyBtn.classList.contains('maxed')) {
      buyUpgrade(buyBtn.dataset.upgrade);
    }
    const skinBtn = e.target.closest('.skin-action-btn');
    if (skinBtn) {
      const skinItem = skinBtn.closest('.skin-item');
      if (skinItem) buyOrEquipSkin(skinItem.dataset.skin);
    }
  });
}

// Rewarded Video Bonus Buttons
if (dom.doubleCoinsBtn) {
  dom.doubleCoinsBtn.addEventListener('click', () => {
    showCrazyRewarded('double_coins', () => {
      addCoins(gameState.coinsEarnedThisRound);
      gameState.coinsEarnedThisRound *= 2;
      dom.finalCoins.textContent = `+${gameState.coinsEarnedThisRound} (2x!)`;
      dom.doubleCoinsBtn.style.display = 'none';
      playArcadeSound('powerup_coin');
      showSpeedToast(25);
    });
  });
}

if (dom.reviveBtn) {
  dom.reviveBtn.addEventListener('click', () => {
    showCrazyRewarded('revive', () => {
      reviveRound(30);
    });
  });
}

// How to Play Controls
if (dom.howToPlayBtn) {
  dom.howToPlayBtn.addEventListener('click', () => {
    if (dom.howToPlayModal) dom.howToPlayModal.classList.add('active');
    playArcadeSound('click');
  });
}
if (dom.closeHowToPlayBtn) {
  dom.closeHowToPlayBtn.addEventListener('click', () => {
    if (dom.howToPlayModal) dom.howToPlayModal.classList.remove('active');
    playArcadeSound('select');
  });
}
if (dom.howToPlayModal) {
  dom.howToPlayModal.addEventListener('click', e => {
    if (e.target === dom.howToPlayModal) {
      dom.howToPlayModal.classList.remove('active');
      playArcadeSound('click');
    }
  });
}

if (dom.pauseBtn) dom.pauseBtn.addEventListener('click', togglePause);
if (dom.resumeBtn) dom.resumeBtn.addEventListener('click', togglePause);
if (dom.pauseMenuBtn) dom.pauseMenuBtn.addEventListener('click', () => {
  if (dom.pauseModal) dom.pauseModal.classList.remove('active');
  gameState.isPaused = false;
  resetState();
  loadHighScore();
  updateCoinsDisplay();
  clearAllFloaters();
  cancelAnimationFrame(speedMeterLoopId);
  showScreen('start');
});

// Theme Switcher
const themeBtns = document.querySelectorAll('.theme-btn');
const powModeBtn = document.querySelector('.mode-pow');

const themeTranslations = {
  kids: {
    '.logo-deco-left': '🌟', '.logo-deco-right': '🌟', '.logo-subline': '🍭 FUN MATH FOR KIDS! 🍭', '.logo-emoji-row': '🌈 ➕ ➖ ✖️ ➗ 🌈',
    '#how-to-play-btn': '❓ HOW TO PLAY', '#how-to-play-title': 'HOW TO PLAY',
    '#close-how-to-play-btn .play-btn-content': '🚀 GOT IT, LET\'S PLAY!',
    '#shop-btn': '🛒 SHOP', '#shop-title': 'SURGE SHOP',
    '#close-shop-btn .play-btn-content': '🚀 BACK TO GAME',
    '.mode-add .card-pill': '🍏 PLUS!', '.mode-add .card-tagline': '🤝 Add Together!',
    '.mode-sub .card-pill': '🍊 MINUS!', '.mode-sub .card-tagline': '✂️ Take Away!',
    '.mode-mult .card-pill': '🍇 TIMES!', '.mode-mult .card-tagline': '🚀 Power Up!',
    '.mode-div .card-pill': '🍓 SHARE!', '.mode-div .card-tagline': '🍕 Share It!',
    '.mode-mix .card-pill': '🎉 ALL MIX!', '.mode-mix .card-tagline': '🌈 Wild Surprise!',
    '.card-check-tag': '⭐ LET\'S GO!',
    '[data-time="30"] .time-chip-icon': '⚡', '[data-time="30"] .time-chip-label': '⚡ SPEEDY!',
    '[data-time="60"] .time-chip-icon': '⏰', '[data-time="60"] .time-chip-label': '🌟 CLASSIC!',
    '[data-time="90"] .time-chip-icon': '⏳', '[data-time="90"] .time-chip-label': '🏃 LONG GO!',
    '[data-time="120"] .time-chip-icon': '🦸', '[data-time="120"] .time-chip-label': '🦸 HERO!',
    '[data-diff="0"] .time-chip-icon': '🌱', '[data-diff="0"] .time-chip-label': 'RELAXED',
    '[data-diff="3"] .time-chip-icon': '🌟', '[data-diff="3"] .time-chip-label': 'CLASSIC',
    '[data-diff="6"] .time-chip-icon': '🔥', '[data-diff="6"] .time-chip-label': 'FAST!',
    '.pause-icon': '⏸️ 🍦', '.pause-title': 'TAKING A BREAK! 😊', '.pause-desc': 'Game is resting! 💤 Come back soon!',
    '#resume-btn .play-btn-content': '🚀 KEEP PLAYING!', '#pause-menu-btn span': '🏠 GO HOME',
    '.gameover-banner': '🎊 ROUND COMPLETE! 🎊', '.gameover-title': 'YOU DID IT! 🎉', '.gameover-stars': '⭐ ⭐ ⭐',
    '#play-again-btn .play-btn-content span': '🚀 PLAY AGAIN!', '#menu-btn span': '🏠 HOME MENU',
    '.press-space-prompt': '<span class="blink-dot">🎯</span> PRESS <kbd>SPACEBAR</kbd> TO START!',
    '.play-arrow': '🚀',
    '.timer-dial-icon': '⏰'
  },
  robotics: {
    '.logo-deco-left': '⚙️', '.logo-deco-right': '⚙️', '.logo-subline': '🦾 SYSTEM OVERRIDE 🦾', '.logo-emoji-row': '⚡ 0 1 1 0 1 ⚡',
    '#how-to-play-btn': '⚡ PROTOCOL', '#how-to-play-title': 'SYSTEM PROTOCOL 📋',
    '#close-how-to-play-btn .play-btn-content': '⚡ PROTOCOL ACKNOWLEDGED',
    '#shop-btn': '⚙️ UPGRADES', '#shop-title': 'SYSTEM UPGRADES',
    '#close-shop-btn .play-btn-content': '⚡ RETURN TO CONSOLE',
    '.mode-add .card-pill': '➕ ADD', '.mode-add .card-tagline': '🔋 System Sum',
    '.mode-sub .card-pill': '➖ SUB', '.mode-sub .card-tagline': '🔧 Drain Core',
    '.mode-mult .card-pill': '✖️ MULT', '.mode-mult .card-tagline': '🚀 Overclock',
    '.mode-div .card-pill': '➗ DIV', '.mode-div .card-tagline': '📡 Split Signal',
    '.mode-mix .card-pill': '🎲 MIX', '.mode-mix .card-tagline': '⚠️ Chaos Mode',
    '.card-check-tag': '⚡ ENGAGE',
    '[data-time="30"] .time-chip-icon': '⏱️', '[data-time="30"] .time-chip-label': 'BLITZ',
    '[data-time="60"] .time-chip-icon': '⏲️', '[data-time="60"] .time-chip-label': 'STANDARD',
    '[data-time="90"] .time-chip-icon': '⌛', '[data-time="90"] .time-chip-label': 'EXTENDED',
    '[data-time="120"] .time-chip-icon': '🔋', '[data-time="120"] .time-chip-label': 'ENDURANCE',
    '[data-diff="0"] .time-chip-icon': '🟢', '[data-diff="0"] .time-chip-label': 'ROOKIE',
    '[data-diff="3"] .time-chip-icon': '🟡', '[data-diff="3"] .time-chip-label': 'VETERAN',
    '[data-diff="6"] .time-chip-icon': '🔴', '[data-diff="6"] .time-chip-label': 'NIGHTMARE',
    '.pause-icon': '⏸️ 🔋', '.pause-title': 'SYSTEM PAUSED 🛑', '.pause-desc': 'Awaiting command input... ⏳',
    '#resume-btn .play-btn-content': '⚡ RESUME SYSTEM', '#pause-menu-btn span': '🔌 ABORT',
    '.gameover-banner': '⚠️ SIMULATION ENDED ⚠️', '.gameover-title': 'MISSION LOGGED', '.gameover-stars': '⚡ ⚡ ⚡',
    '#play-again-btn .play-btn-content span': '⚡ REBOOT SYS!', '#menu-btn span': '🔌 MAIN MENU',
    '.press-space-prompt': '<span class="blink-dot">⚠️</span> PRESS <kbd>SPACEBAR</kbd> TO INITIATE!',
    '.play-arrow': '⚡',
    '.timer-dial-icon': '⏲️'
  }
};

function applyTheme(theme) {
  gameState.theme = theme;
  localStorage.setItem('number_surge_theme', theme);
  
  if (theme === 'robotics') {
    document.body.classList.add('theme-robotics');
    if (powModeBtn) powModeBtn.style.display = 'flex';
  } else {
    document.body.classList.remove('theme-robotics');
    if (powModeBtn) powModeBtn.style.display = 'none';
    if (gameState.mode === 'powers') {
      gameState.mode = 'addition';
      document.querySelector('.mode-add').click();
    }
  }

  const trans = themeTranslations[theme];
  if (trans) {
    for (const selector in trans) {
      document.querySelectorAll(selector).forEach(el => {
        if (selector === '.press-space-prompt') {
          el.innerHTML = trans[selector];
        } else {
          el.textContent = trans[selector];
        }
      });
    }
  }
  
  if (dom.playBtnLabel) {
    dom.playBtnLabel.textContent = theme === 'robotics' ? `SYSTEM START (${gameState.duration || 60}s)` : `LET'S PLAY! (${gameState.duration || 60}s)`;
  }

  themeBtns.forEach(btn => {
    if (btn.dataset.theme === theme) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

themeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme);
    playArcadeSound('click');
  });
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
      dom.playBtnLabel.textContent = gameState.theme === 'robotics' ? `SYSTEM START (${gameState.duration}s)` : `LET'S PLAY! (${gameState.duration}s)`;
    }
    playArcadeSound('click');
  });
}

// Difficulty Chips
if (dom.diffGrid) {
  dom.diffGrid.addEventListener('click', e => {
    const chip = e.target.closest('.time-chip');
    if (!chip) return;
    dom.diffGrid.querySelectorAll('.time-chip').forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-pressed', 'false');
    });
    chip.classList.add('active');
    chip.setAttribute('aria-pressed', 'true');
    gameState.startingDifficulty = parseInt(chip.dataset.diff, 10);
    playArcadeSound('click');
  });
}

dom.startBtn.addEventListener('click', startGame);
dom.playAgainBtn.addEventListener('click', () => {
  triggerCMGEvent('replay');
  showCrazyMidroll(() => {
    startGame();
  });
});

dom.menuBtn.addEventListener('click', () => {
  resetState();
  loadHighScore();
  updateCoinsDisplay();
  clearAllFloaters();
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
  if (e.code === 'Escape') {
    if (dom.shopModal && dom.shopModal.classList.contains('active')) {
      e.preventDefault();
      dom.shopModal.classList.remove('active');
      playArcadeSound('click');
      return;
    }
    if (dom.howToPlayModal && dom.howToPlayModal.classList.contains('active')) {
      e.preventDefault();
      dom.howToPlayModal.classList.remove('active');
      playArcadeSound('click');
      return;
    }
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (gameState.phase === 'playing') {
      e.preventDefault();
      togglePause();
    }
  } else if (e.code === 'Space' || e.code === 'Enter') {
    if (dom.shopModal && dom.shopModal.classList.contains('active')) {
      e.preventDefault();
      dom.shopModal.classList.remove('active');
      playArcadeSound('select');
      return;
    }
    if (dom.howToPlayModal && dom.howToPlayModal.classList.contains('active')) {
      e.preventDefault();
      dom.howToPlayModal.classList.remove('active');
      playArcadeSound('select');
      return;
    }
    if (gameState.phase === 'menu') {
      e.preventDefault();
      startGame();
    } else if (gameState.phase === 'gameover') {
      e.preventDefault();
      triggerCMGEvent('replay');
      showCrazyMidroll(() => {
        startGame();
      });
    }
  }
});

// Utility
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── INITIALIZATION ──────────────────────────────────────────
initCrazySDK();
initAmbientCanvas();
renderAmbientParticles();
loadHighScore();
updateCoinsDisplay();
applyEquippedSkin(economy.activeSkin);
applyTheme(gameState.theme);
showScreen('start');

