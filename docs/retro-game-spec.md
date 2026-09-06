# Retro Tower Game Specification

side scrolling single screen game. Player controls a flying ship which continuously moves from left to right. The player can press a button to drop a bomb.

The ship flies above a cityscape of towers. These towers grow in height over time, at random speeds. The player must drop bombs to destroy the towers before they reach a certain height. If a tower reaches the maximum height, the game is over. If the player's ship collides with a tower, the game is also over. The player earns points for each tower destroyed.

If the ship leaves the right side of the screen, it wraps around to the left side. When it wraps, the ship reappears slightly lower than it was before, making it more difficult to avoid the towers.

Simple controls, drop bombs with space bar. The ship moves automatically, the player only controls the dropping of bombs.

## Game engine

Built using Pixi JS.
