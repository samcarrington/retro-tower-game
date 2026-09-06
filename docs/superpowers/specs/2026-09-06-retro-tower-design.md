# Retro Tower Game Design

## Approved requirements

- Build with PixiJS and TypeScript.
- Keep pure game simulation separate from rendering.
- Use nine stationary towers with independent randomized growth speeds.
- Ship moves automatically from left to right. On leaving the right edge, it
  wraps to the left and descends slightly each lap.
- Space keydown drops one bomb carrying the ship's forward velocity. Horizontal
  drag reduces that momentum while downward acceleration increases its falling
  speed, producing a curved trajectory. Ignore key repeat while Space is held.
  Allow at most one airborne bomb until the current bomb hits or leaves the screen.
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
- Emit short pixel-particle explosions when a tower is destroyed and a larger,
  visually distinct explosion when the player ship is destroyed.
- Play generated browser sound effects for bomb drop, tower destruction, and
  player destruction. Audio must not require external assets.
- Give towers independently randomized growth rates on initial creation and
  reroll the rate after each respawn.
- Secretly track distinct tower positions destroyed during a run. Destroying
  all nine positions at least once awards one immediate upward ship movement;
  the bonus can occur only once per run.

## Approach/architecture

- The simulation owns state, entity rules, collision outcomes, score, run
  lifecycle, fixed-step progression, bomb velocity, and gameplay effect events.
- Rendering reads simulation state and reflects it only; it does not own game
  rules or mutate simulation decisions. It may consume simulation-authored
  effect events to animate pooled particles.
- The browser shell owns keyboard input, focus/visibility handling, screens,
  responsive resize, asynchronous initialization errors, and audio lifecycle.
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
  allowance. Its horizontal velocity is captured from the ship when dropped and
  decays during flight while its vertical velocity accelerates downwards.
- Direct tower destruction awards one score event and starts its two-second
  same-position regrowth.
- Tower-clear progress is based on unique tower positions, persists through
  their respawns, and resets only on a fresh run. Repeatedly destroying the
  same position does not advance the unique-clear count.
- The ninth distinct destruction applies the climb in the same simulation
  transition as the hit, after the normal score award. It does not cancel an
  already determined terminal loss.
- Game over records and displays its reason: tower reached line, ship touched
  tower, or ship reached ground.
- Restart creates a fresh run and resets score and entities.
- Losing tab focus freezes the simulation. Returning focus resumes from the
  frozen state with no elapsed-time catch-up.
- Renderer initialization is asynchronous; failure presents a clear user-facing
  error instead of a broken game screen.
- Audio is initialized or resumed only after a user gesture to satisfy browser
  autoplay policies. Audio unavailability must not prevent gameplay.

## Visuals/layout

- Render a single logical 960x540 landscape field and scale it responsively to
  the browser viewport.
- Keep gameplay positions and collision coordinates in the logical field.
- Place nine stationary towers across the field; each tower grows independently.
- Show the ship, bomb, towers, maximum-height line, score HUD, start screen,
  game-over reason, and restart control.
- Use generated pixel shapes in style A: navy sky, amber towers, cream ship,
  and red danger line. No external artwork.
- Tower explosions use brief amber, cream, and red square particles centred on
  the bomb impact. Player explosions use a larger cream and red burst centred
  on the ship.
- Particle systems are bounded and pooled; they must not allocate an unbounded
  number of display objects during a long run.
- Apply one custom WebGL filter to the complete 960x540 Pixi stage. It provides
  subtle convex barrel distortion, scanlines, animated fine-grain noise, and a
  mild vignette. The navy field must be stage geometry so the effect covers
  background pixels as well as entities.
- Set the known logical field as `filterArea` to avoid recursive bounds
  measurement. The shader is presentation-only and must not alter logical
  positions, collision coordinates, input, or simulation timing.

## Verification

- Use a deterministic random source for repeatable growth tests.
- Test tower growth, ship movement, right-to-left wrapping, and per-lap descent.
- Test one-bomb limit and Space repeat suppression.
- Test that a bomb inherits forward velocity, loses horizontal speed, gains
  downward speed, follows a curved path, and still uses swept collision across
  each movement segment.
- Test direct-hit full destruction and single score award.
- Test deterministic tower and player effect events, including loss priority
  over a simultaneous tower hit.
- Test two-second same-position respawn.
- Test independent growth-rate assignment and fresh rate randomization on
  respawn using a deterministic random sequence.
- Test unique tower-clear tracking, duplicate-position suppression, one-time
  activation on the ninth distinct tower, climb bounds, terminal-loss priority,
  and reset on restart.
- Test maximum-height, ship/tower, and ship/ground loss conditions.
- Test restart resets score and entities.
- Test focus loss freezes and focus return resumes without catch-up.
- Test responsive visuals and browser keyboard smoke behavior.
- Test audio event routing without creating a real AudioContext in jsdom.
- Browser-smoke the three sound effects and both particle bursts, and verify
  particle pools return to an inactive state after their lifetimes.
- Browser-smoke the full-scene CRT filter at both responsive viewport sizes,
  checking subtle curvature, visible scanlines/noise, stable edges, and no
  shader compilation or console errors.

## Exclusions/tuning

Excluded from approved scope:

- Mobile controls
- Power-ups
- Online scores
- Framework wrapper
- External artwork

The original straight-down bomb requirement and audio exclusion are superseded
by the feature addendum approved on 6 September 2026.

The tower-clear climb is intentionally undisclosed in player-facing
instructions and documentation. Its exact climb distance is a playtest tuning
constant defined in the implementation plan.

Initial playtest tuning belongs in the implementation plan. It must define and
validate numeric speed, height, size, drop, and related timing defaults without
presenting them as user decisions here.
