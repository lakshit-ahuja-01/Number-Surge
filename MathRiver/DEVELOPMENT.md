# Math River — Development Log

## Current Milestone

**Milestones 1–11 Complete** ✅

## Completed Features

### Milestone 1 — Project Setup
- [x] Basic HTML5 page structure with semantic elements
- [x] Three-screen layout: Start → Game → Game Over
- [x] CSS design system with custom properties (dark theme)

### Milestone 2 — Basic Game UI
- [x] HUD layout (score, timer, combo)
- [x] Target equation display area
- [x] River/game area container
- [x] Start button and game flow

### Milestone 3 — Floating Numbers
- [x] Dynamic number generation via JavaScript
- [x] Numbers float and bounce within the river
- [x] requestAnimationFrame for smooth 60fps movement
- [x] Animated wave background in the river

### Milestone 4 — Number Selection
- [x] Click to select/deselect numbers
- [x] Visual highlight on selected numbers
- [x] Maximum two selections at a time
- [x] Prevents selecting same number twice

### Milestone 5 — Math Validation
- [x] Checks if selected pair sums to target
- [x] Correct: remove numbers, generate new question
- [x] Incorrect: shake animation, reset selection
- [x] Guaranteed-solvable question generation

### Milestone 6 — Scoring & Combos
- [x] +10 points for correct answers
- [x] -3 penalty for wrong answers (floor at 0)
- [x] Combo counter with bonus points per level
- [x] Best combo tracking

### Milestone 7 — 60-Second Timer
- [x] Countdown from 60
- [x] Timer flashes red below 10 seconds
- [x] Game stops at zero

### Milestone 8 — Game Over Screen
- [x] Final score display
- [x] Questions solved count
- [x] Accuracy percentage
- [x] Best combo display
- [x] Play Again and Main Menu buttons

### Milestone 9 — Difficulty Progression
- [x] Speed increases with questions solved
- [x] Number count increases
- [x] Target number range increases
- [x] Scales every 3 correct answers

### Milestone 10 — Visual Polish
- [x] Glassmorphism floating number bubbles
- [x] Particle burst on correct answers
- [x] Floating score popup (+/- indicators)
- [x] Shake animation on wrong answers
- [x] Scale-in entrance animation for new numbers
- [x] Wave overlay animation in river
- [x] Gradient title with pulse animation
- [x] Google Fonts (Inter)

### Milestone 11 — Sound Effects
- [x] Web Audio API (no external files)
- [x] Rising tone for correct answers
- [x] Low buzz for wrong answers
- [x] Click tick for selections
- [x] Descending tone for game over

## Next Milestone

**Milestone 12 — Mobile Support**
- Improve touch interaction
- Test different screen sizes

## Known Bugs

- None discovered yet — testing in progress

## Future Ideas

- Subtraction, multiplication, division modes
- Leaderboard / high score (localStorage)
- Difficulty selector on start screen
- Sound toggle button
