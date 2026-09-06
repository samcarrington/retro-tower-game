# Retro Tower Game Specification

side scrolling single screen game. Player controls a flying ship which continuously moves from left to right. The player can press a button to drop a bomb.

The ship flies above a cityscape of towers. These towers grow in height over time, at random speeds. The player must drop bombs to destroy the towers before they reach a certain height. If a tower reaches the maximum height, the game is over. If the player's ship collides with a tower, the game is also over. The player earns points for each tower destroyed.

If the ship leaves the right side of the screen, it wraps around to the left side. When it wraps, the ship reappears slightly lower than it was before, making it more difficult to avoid the towers.

Simple controls, drop bombs with space bar. The ship moves automatically, the player only controls the dropping of bombs.

## Game engine

Built using Pixi JS.

## Feature addendum — 6 September 2026

The following features extend the original game:

- Bombs retain the ship's forward momentum when dropped. They travel diagonally
  down and to the right rather than falling on a fixed x-axis.
- Destroying a building produces a short pixel-particle explosion at the point
  of impact.
- A ship collision or ground impact produces a distinct, larger pixel-particle
  explosion before the game-over presentation settles.
- Sound effects accompany bomb drops, building explosions, and player
  explosions. Sounds are generated in the browser and require no external
  audio assets.
- Buildings have visibly different, independently assigned growth rates.
  Growth is rerolled when a destroyed building respawns so the skyline's threat
  pattern changes during a run.

These additions must preserve the one-airborne-bomb rule, deterministic
gameplay tests, fixed-step simulation, responsive 960x540 logical field, and
keyboard-only control scheme.
