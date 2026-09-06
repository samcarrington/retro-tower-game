# Retro Tower Game Design

## Approved requirements

- Build with PixiJS and TypeScript.
- Keep pure game simulation separate from rendering.
- Use nine stationary towers with independent randomized growth speeds.
- Ship moves automatically from left to right. On leaving the right edge, it
  wraps to the left and descends slightly each lap.
- Space keydown drops one straight-down bomb. Ignore key repeat while Space is
  held. Allow at most one airborne bomb until the current bomb hits or leaves
  the screen.
- A direct hit destroys a full tower for 100 points, once per destruction.
  The tower regrows at the same position after 2 seconds.
- The game is a score-chasing run with no win condition.
- Show a visible maximum-height line.
- End the run when a tower reaches the line, the ship touches a tower, or the
  ship reaches the ground.
- Provide a start screen, score HUD, game-over reason, and restart button.
- Freeze simulation on tab loss of focus and resume without catch-up.
- Show a clear error if the renderer cannot start.
- Use generated pixel shapes, style A: navy sky, amber towers, cream ship,
  and red danger line.

## Approach/architecture

- The simulation owns state, entity rules, collision outcomes, score, run
  lifecycle, and fixed-step progression.
- Rendering reads simulation state and reflects it only; it does not own game
  rules or mutate simulation decisions.
- The browser shell owns keyboard input, focus/visibility handling, screens,
  responsive resize, and asynchronous initialization errors.
- Use logical landscape coordinates at 960x540. Scale that field to the
  browser without changing gameplay coordinates.
- Keep gameplay constants tunable. Numeric speed, height, size, and drop
  defaults are initial playtest tuning to specify in the implementation plan,
  not user-approved decisions in this document.
- Logical-coordinate collision rules and fixed-step timing are implementation
  details to finalize in the implementation plan.

## Lifecycle/input

- Start screen transitions into a new score-chasing run.
- During a run, only a non-repeating Space keydown controls bombing; ship
  movement is automatic.
- Bomb state permits one airborne bomb. A hit or off-screen exit clears that
  allowance.
- Direct tower destruction awards one score event and starts its two-second
  same-position regrowth.
- Game over records and displays its reason: tower reached line, ship touched
  tower, or ship reached ground.
- Restart creates a fresh run and resets score and entities.
- Losing tab focus freezes the simulation. Returning focus resumes from the
  frozen state with no elapsed-time catch-up.
- Renderer initialization is asynchronous; failure presents a clear user-facing
  error instead of a broken game screen.

## Visuals/layout

- Render a single logical 960x540 landscape field and scale it responsively to
  the browser viewport.
- Keep gameplay positions and collision coordinates in the logical field.
- Place nine stationary towers across the field; each tower grows independently.
- Show the ship, bomb, towers, maximum-height line, score HUD, start screen,
  game-over reason, and restart control.
- Use generated pixel shapes in style A: navy sky, amber towers, cream ship,
  and red danger line. No external artwork.

## Verification

- Use a deterministic random source for repeatable growth tests.
- Test tower growth, ship movement, right-to-left wrapping, and per-lap descent.
- Test one-bomb limit and Space repeat suppression.
- Test direct-hit full destruction and single score award.
- Test two-second same-position respawn.
- Test maximum-height, ship/tower, and ship/ground loss conditions.
- Test restart resets score and entities.
- Test focus loss freezes and focus return resumes without catch-up.
- Test responsive visuals and browser keyboard smoke behavior.

## Exclusions/tuning

Excluded from approved scope:

- Audio
- Mobile controls
- Power-ups
- Online scores
- Framework wrapper
- External artwork

Initial playtest tuning belongs in the implementation plan. It must define and
validate numeric speed, height, size, drop, and related timing defaults without
presenting them as user decisions here.
