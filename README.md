# ⚡ Number Surge — Ultimate Math Blitz & Arcade Adventure

> A fast-paced, vibrant, arcade-style browser math blitz game! Match floating orb pairs to solve target equations, unleash dynamic power-ups, build high-speed combo streaks, and upgrade your skills in the Surge Shop.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![CrazyGames SDK v3](https://img.shields.io/badge/CrazyGames_SDK-v3-blueviolet?style=flat)
![Coolmath Games Ready](https://img.shields.io/badge/Coolmath_Games-Compatible-brightgreen?style=flat)

---

## 🌟 Overview

**Number Surge** transforms mental math practice into an adrenaline-filled arcade experience. Players race against the clock to find and click pairs of floating number orbs that complete the displayed equation dock. Featuring dual visual themes, real-time power-ups, procedural audio synthesis, and a persistent upgrade economy, it is designed for both casual web players and gaming platforms like **CrazyGames** and **Coolmath Games**.

---

## 🎨 Dual Visual Theme Engine

Switch instantly between two completely custom visual modes with zero reload:

- 🍭 **Kids Candy Adventure:**
  - Cheerful pastel color palettes, bouncy bubble floater physics, playful candy branding, and friendly typography (`Fredoka`, `Outfit`).
  - Warm particle bubbles drifting in the ambient background.
- 🤖 **Cyber Robotics System:**
  - High-tech sci-fi terminal interface, neon cyan (`#00f2fe`) & magenta (`#ff007f`) HUD, and monospace digital fonts (`Orbitron`, `Rajdhani`).
  - Real-time animated **Matrix Digital Rain** canvas and exclusive **POWERS (Exponents)** mode!

---

## 🎮 Game Modes & Custom Setup

### 🧮 6 Distinct Math Modes
1. ➕ **Addition:** `_ + _ = Target` (Sum up floating numbers)
2. ➖ **Subtraction:** `_ − _ = Target` (Find number pairs with the target difference)
3. ✖️ **Multiplication:** `_ × _ = Target` (Quick mental factor matching)
4. ➗ **Division:** `_ ÷ _ = Target` (Quotient and divisor pairing)
5. ⚡ **Powers / Exponents:** `A^B = Target` (*Cyber Robotics Exclusive* — Base & exponent matching)
6. 🎲 **Surge Mix:** Dynamic multi-operation rotation that keeps players on their toes

### ⏱️ Flexible Round Lengths & Difficulties
- **Round Timers:** `30s`, `60s`, `90s`, and `120s` sprint modes
- **Difficulty Tiers:** `EASY`, `NORMAL`, and `HARD` (with progressive in-game difficulty scaling)

---

## ⚡ Dynamic In-Game Power-Ups

During gameplay, rare power-up orbs spawn into the river arena:

| Power-Up | Icon | Effect |
| :--- | :---: | :--- |
| **Bomb** | 💣 | Instantly clears and solves the current target equation with a burst effect. |
| **Freeze** | ❄️ | Freezes the round timer countdown for 5 seconds with an icy frost overlay. |
| **Hint / Radar** | 💡 | Highlights the exact matching answer pair with high-visibility glowing beacon pulses. |
| **Combo Shield** | 🛡️ | Shields your streak multiplier against accidental wrong clicks. |
| **Coin Surge** | 🪙 | Awards an instant +15 coins directly to your economy wallet. |

---

## 🛒 Surge Shop & Economy System

Earn coins by solving equations quickly, maintaining high combo streaks, and clearing rounds. Spend your earnings in the **Surge Shop**:

### 🛠️ Permanent Upgrades
- ⏱️ **Time Boost:** Adds bonus starting seconds to every game round.
- 🛡️ **Combo Shield:** Starts each round pre-equipped with an active streak protector.
- ⚡ **Speed Surge Boost:** Extends the high-multiplier speed bonus reaction window.
- 🪙 **Coin Multiplier:** Permanently increases bonus coins earned per correct equation.

### 🎨 Collectible Orb Skins
- 🫧 **Classic Bubble** (Default)
- 🍭 **Candy Swirl**
- ⚡ **Cyber Neon**
- 🔥 **Magma Surge**
- ❄️ **Glacial Frost**
- 👑 **Golden Royale**
- 🌌 **Galaxy Nebula**

---

## 🔊 Procedural Web Audio Engine

- **100% Synthesized Audio:** Built entirely with the **Web Audio API** — requires zero external `.mp3`/`.wav` assets, guaranteeing zero latency and instant loading.
- **Adaptive Chords:** Pitch-shifting dynamic chord feedback that scales higher as your combo streak grows.
- **Theme-Tailored Soundscapes:** Warm triangle/sine waves in Kids Candy; filtered sawtooth/square synth waves in Cyber Robotics.
- **Mute Control:** Integrated one-touch HUD audio mute toggle with persistent memory.

---

## 🌐 Platform Integration & SDK Features

- **CrazyGames HTML5 SDK v3:**
  - Automated `gameplayStart()` and `gameplayStop()` session tracking.
  - Rewarded Video Ad buttons (Double Round Coins `2x` & Emergency Revive `+30s`).
  - `happytime()` celebration triggers on new records and high combo milestones.
- **Coolmath Games (CMG) Events:** Native `cmg-game-event` integration for start, replay, and level tracking.
- **3-Tier Fail-Safe Storage Adapter:**
  1. `crazySDK.data` (CrazyGames Cloud Save)
  2. `localStorage` (Browser Persistence)
  3. `memStorage` (In-Memory Fallback to prevent sandbox iframe `SecurityError` loops)

---

## 📱 Responsive & Display Scaling

- **Proportional Fullscreen (F11):** Scaled typography and UI components while preserving exact card aspect ratios and spacing.
- **Sandboxed Embed Window Optimization:** Custom styling for `800x600` and `600px` height compact iframe players.
- **Dynamic Floater Redistribution:** Floaters automatically rescale and re-center smoothly on window resize or orientation change without resetting gameplay.

---

## 🚀 Getting Started

### Play Locally
1. Clone this repository:
   ```bash
   git clone https://github.com/lakshit-ahuja-01/Number-Surge.git
   ```
2. Open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari).
3. Select your mode, difficulty, and duration, then press **LET'S PLAY** (or tap `SPACEBAR`)!

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, Modern Vanilla CSS (Flexbox, CSS Grid, Glassmorphism, CSS Custom Properties), Vanilla JavaScript (ES6+).
- **Rendering & Animation:** HTML5 `<canvas>` (Ambient particles & Matrix rain), `requestAnimationFrame` 60 FPS physics loop.
- **Audio:** Web Audio API (`AudioContext`, `OscillatorNode`, `BiquadFilterNode`, `GainNode`).
- **Platform SDKs:** CrazyGames SDK v3, Coolmath Games Events API.

---

## 📄 License

MIT License — Feel free to use, modify, and distribute for educational and commercial web game platforms!
