# Math River --- Game Development Prompt

Create a polished, addictive browser-based math game called **"Math
River"**.

## Core Idea

Numbers continuously float through a river-like game area. At the top of
the screen, the player is given a target equation such as:

`_ + _ = 40`

The player must click two floating numbers whose sum equals the target.
For example, clicking `30` and `10` is correct.

## Gameplay

-   Each game lasts exactly 60 seconds.
-   Display a target equation prominently at the top.
-   Multiple numbers continuously float/move through the river.
-   The player clicks two numbers to select them.
-   When two numbers are selected:
    -   If they satisfy the equation, show a satisfying success
        animation, add points, remove those numbers, and immediately
        generate the next question.
    -   If they are incorrect, briefly indicate the mistake and reset
        the selection.
-   The game should feel fast, responsive, and arcade-like.
-   The player should solve as many questions as possible within 60
    seconds.

## Scoring

-   Correct answer: +10 points.
-   Add a combo system:
    -   Consecutive correct answers increase the combo.
    -   Give bonus points for higher combos.
-   Wrong answer: -3 points.
-   Track:
    -   Score
    -   Questions solved
    -   Wrong answers
    -   Accuracy
    -   Current combo
    -   Best combo

## Difficulty

Start easy and progressively become harder.

Increase difficulty by: - Increasing number movement speed. - Increasing
the number of floating objects. - Using larger target values. -
Eventually introducing harder equations.

## Game Modes

Design the architecture so additional modes can easily be added later.

Start with:

1.  Addition Mode
    -   `_ + _ = 40`

Later support:

2.  Subtraction
    -   `_ - _ = 17`
3.  Multiplication
    -   `_ × _ = 36`
4.  Division
    -   `_ ÷ _ = 8`
5.  Mixed Mode

## Visual Design

Make the game visually impressive and modern rather than looking like a
basic school project.

### Theme

-   A flowing river.
-   Numbers should look like objects, bubbles, or cards floating on the
    water.
-   Subtle animated water waves.
-   Numbers should move smoothly.
-   Add particles or small water effects when an answer is correct.
-   Correct answers should have a satisfying pop/burst animation.
-   Wrong selections should have a small shake animation.
-   Use smooth transitions throughout.

### UI

Top area: - Game title: **Math River** - Score - Timer - Combo

Center: - Large target equation: `_ + _ = 40`

Main game area: - Animated river - Floating number objects

Do not make the UI cluttered.

Make the target equation extremely easy to read because it is the most
important element.

## Game Start

Before the game begins, show:

**MATH RIVER**

"How many can you solve in 60 seconds?"

`[ START GAME ]`

## Game Over

When the timer reaches zero, stop all movement and display:

**GAME OVER**

Score: 240\
Questions Solved: 24\
Accuracy: 92%\
Best Combo: 8

`[ PLAY AGAIN ]`

Also provide a small button for returning to the main menu.

## Responsiveness

The game must work well on: - Desktop - Laptop - Tablet - Mobile

On mobile: - Make number objects large enough to tap comfortably. -
Avoid accidental double selection. - Keep the target equation visible.

## Technology

Use: - HTML5 - CSS3 - Vanilla JavaScript

Do **not** use React, Phaser, Three.js, or other frameworks for the
first version.

Keep the project simple and understandable.

## Project Structure

``` text
MathRiver/
├── index.html
├── style.css
└── script.js
```

## Code Quality

-   Write clean, modular JavaScript.
-   Use meaningful variable and function names.
-   Avoid putting all logic into one giant function.
-   Separate game state, number generation, movement, scoring, timer,
    and UI updates.
-   Use constants for configurable values such as game duration,
    starting speed, and scoring values.
-   Add comments for important logic.
-   Avoid unnecessary libraries.

## Important Game Logic

The generated numbers must always provide at least one valid solution
for the current target.

For example, if the target is 40, the game might generate:

`10, 17, 23, 30, 7, 35`

because:

`10 + 30 = 40`\
`17 + 23 = 40`

Do not generate impossible questions.

Prevent the player from selecting the same number twice.

After a correct answer:

1.  Remove both selected numbers.
2.  Increase score.
3.  Update combo.
4.  Generate a new target.
5.  Add new numbers.
6.  Continue the game without stopping the timer.

After a wrong answer:

1.  Apply penalty.
2.  Reset selected numbers.
3.  Continue the game.

## Performance

Use `requestAnimationFrame` for smooth number movement.

Avoid creating unnecessary DOM elements every frame.

Clean up numbers that leave the game area.

Make sure the game remains smooth even when many numbers are visible.

## Audio

Add optional sound effects using the Web Audio API: - Correct answer -
Wrong answer - Button click - Game over

Do not require external audio files.

## Accessibility

-   Buttons should be keyboard accessible.
-   Provide visible focus states.
-   Use semantic HTML where appropriate.
-   Maintain sufficient contrast.
-   Do not rely only on color to indicate correct/incorrect answers.

## Final Requirement

Build the complete working game, not just a mockup.

The game should be immediately playable by opening `index.html` in a
browser.

Before writing the code, briefly explain the architecture and game state
you are going to use.

Then provide the complete contents of: 1. `index.html` 2. `style.css` 3.
`script.js`

Make sure the three files work together without requiring any build
tools or installation.
