# Math River --- GitHub Development Workflow Prompt

I want to develop the **Math River** game gradually and commit
meaningful progress to GitHub as I build it.

Do **not** generate the entire project as one huge implementation.

Instead, divide development into realistic milestones. Each milestone
should result in a working improvement to the game.

After completing each milestone:

1.  Explain what was added.
2.  Tell me which files changed.
3.  Give me the exact Git commands to commit the work.
4.  Suggest a concise, natural commit message.
5.  Explain the important code I should understand.
6.  Stop and wait for me to confirm before moving to the next milestone.

Do not create fake commits, fake timestamps, or fake development
history.

The GitHub history should reflect genuine incremental development.

## Suggested Development Progression

### Commit 1 --- Project Setup

-   Create `index.html`
-   Create `style.css`
-   Create `script.js`
-   Add basic page structure
-   Add game title
-   Add initial layout

Suggested commit:

``` bash
chore: initialize Math River game
```

### Commit 2 --- Basic Game UI

-   Add score display
-   Add timer display
-   Add target equation
-   Add start button
-   Create basic game area

Suggested commit:

``` bash
feat: add basic game interface
```

### Commit 3 --- Floating Numbers

-   Generate numbers using JavaScript
-   Display numbers dynamically
-   Make numbers move through the game area
-   Add basic river background

Suggested commit:

``` bash
feat: add floating number system
```

### Commit 4 --- Number Selection

-   Allow the player to click numbers
-   Highlight selected numbers
-   Allow maximum two selections
-   Prevent selecting the same number twice

Suggested commit:

``` bash
feat: add number selection
```

### Commit 5 --- Math Validation

-   Check whether the selected numbers produce the target
-   Handle correct answers
-   Handle incorrect answers
-   Remove correct numbers
-   Generate the next question

Suggested commit:

``` bash
feat: implement answer validation
```

### Commit 6 --- Scoring

-   Add points for correct answers
-   Add penalty for incorrect answers
-   Add combo counter
-   Add best combo tracking

Suggested commit:

``` bash
feat: add scoring and combo system
```

### Commit 7 --- 60 Second Timer

-   Implement countdown timer
-   Stop gameplay at zero
-   Prevent further selections after game over

Suggested commit:

``` bash
feat: add 60 second game timer
```

### Commit 8 --- Game Over Screen

-   Show final score
-   Show questions solved
-   Show accuracy
-   Show best combo
-   Add Play Again button

Suggested commit:

``` bash
feat: add game over screen
```

### Commit 9 --- Difficulty Progression

-   Gradually increase number movement speed
-   Increase number of objects
-   Increase target difficulty
-   Make gameplay progressively harder

Suggested commit:

``` bash
feat: add progressive difficulty
```

### Commit 10 --- Visual Polish

-   Improve river animation
-   Add floating/bubble effects
-   Add correct-answer animation
-   Add wrong-answer shake
-   Improve typography and spacing
-   Improve responsive design

Suggested commit:

``` bash
style: polish Math River game
```

### Commit 11 --- Sound Effects

-   Add Web Audio API sounds
-   Correct answer sound
-   Wrong answer sound
-   Button click sound
-   Game over sound
-   Add sound toggle

Suggested commit:

``` bash
feat: add game sound effects
```

### Commit 12 --- Mobile Support

-   Improve touch interaction
-   Make numbers comfortable to tap
-   Optimize layout for mobile screens
-   Test different screen sizes

Suggested commit:

``` bash
feat: improve mobile responsiveness
```

### Commit 13 --- Code Refactoring

-   Clean up JavaScript
-   Separate game state from UI logic
-   Remove duplicate code
-   Improve function names
-   Add useful comments
-   Improve maintainability

Suggested commit:

``` bash
refactor: improve game architecture
```

### Commit 14 --- Final Testing

-   Test timer
-   Test scoring
-   Test wrong answers
-   Test multiple correct pairs
-   Test game restart
-   Test mobile interaction
-   Fix discovered bugs

Suggested commit:

``` bash
fix: resolve gameplay and interaction issues
```

## Important Workflow Rule

Do not make all these commits automatically.

Work on **ONE milestone at a time**.

For each milestone:

-   Implement only the functionality required for that milestone.
-   Keep the project working.
-   Explain the code I need to understand.
-   Give me the Git commands.
-   Wait for my confirmation before continuing.

## Git Commands

Git commands should generally look like:

``` bash
git status
git add .
git commit -m "feat: add number selection"
git push origin main
```

If the repository has not been initialized yet, first explain:

``` bash
git init
git branch -M main
git remote add origin <MY_GITHUB_REPOSITORY_URL>
git push -u origin main
```

Do not assume my GitHub repository URL.

Ask me for it only when it is actually needed.

## DEVELOPMENT.md

Maintain a simple `DEVELOPMENT.md` file containing:

-   Current milestone
-   Completed features
-   Upcoming milestone
-   Known bugs
-   Future ideas

Update `DEVELOPMENT.md` only when a milestone is completed.

## Learning Requirement

I am using this project to improve my JavaScript and frontend skills.

Do not just give me code.

For each milestone, explain:

-   What the code does
-   Why it is needed
-   Important JavaScript concepts involved
-   How the different files communicate
-   What I should understand before moving to the next milestone

If there is a simpler way to implement something, explain the tradeoff
instead of automatically choosing the most complex approach.

## Final Goal

By the end of the project, I should have:

1.  A polished playable Math River game.
2.  A clean GitHub repository.
3.  A genuine history of incremental development.
4.  An understandable codebase.
5.  A good frontend/JavaScript project that I can confidently explain in
    an interview or portfolio.
