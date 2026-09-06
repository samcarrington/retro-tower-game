import {
  BOMB_HEIGHT,
  BOMB_SPEED,
  BOMB_WIDTH,
  DANGER_Y,
  GROUND_Y,
  SHIP_DESCENT_PER_LAP,
  SHIP_HEIGHT,
  SHIP_SPEED,
  SHIP_START_X,
  SHIP_START_Y,
  SHIP_WIDTH,
  TOWER_COUNT,
  TOWER_FIRST_X,
  TOWER_HEIGHT_CAP,
  TOWER_MAX_GROWTH,
  TOWER_MAX_HEIGHT,
  TOWER_MIN_GROWTH,
  TOWER_MIN_HEIGHT,
  TOWER_RESPAWN_SECONDS,
  TOWER_SCORE,
  TOWER_SPACING,
  TOWER_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./config";
import type { GameOverReason, GameState, RandomSource, Rect, TowerState } from "./types";

function randomBetween(random: RandomSource, minimum: number, maximum: number): number {
  const value = Math.min(1, Math.max(0, random()));
  return minimum + (maximum - minimum) * value;
}

function createTower(index: number, random: RandomSource): TowerState {
  const height = randomBetween(random, TOWER_MIN_HEIGHT, TOWER_MAX_HEIGHT);
  return {
    rect: {
      x: TOWER_FIRST_X + TOWER_SPACING * index,
      y: GROUND_Y - height,
      width: TOWER_WIDTH,
      height,
    },
    height,
    growthRate: randomBetween(random, TOWER_MIN_GROWTH, TOWER_MAX_GROWTH),
    respawnRemaining: 0,
  };
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    ship: { rect: { ...state.ship.rect }, laps: state.ship.laps },
    bomb: state.bomb ? { ...state.bomb } : null,
    towers: state.towers.map((tower) => ({ ...tower, rect: { ...tower.rect } })),
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

function bombSweepsTower(previous: Rect, next: Rect, tower: Rect): boolean {
  const horizontalContact =
    previous.x <= tower.x + tower.width && previous.x + previous.width >= tower.x;
  return (
    horizontalContact &&
    previous.y <= tower.y + tower.height &&
    next.y + next.height >= tower.y
  );
}

function finish(state: GameState, reason: Exclude<GameOverReason, null>): GameState {
  state.status = "gameover";
  state.reason = reason;
  return state;
}

export function createGame(random: RandomSource = Math.random): GameState {
  return {
    status: "ready",
    score: 0,
    ship: {
      rect: {
        x: SHIP_START_X,
        y: SHIP_START_Y,
        width: SHIP_WIDTH,
        height: SHIP_HEIGHT,
      },
      laps: 0,
    },
    bomb: null,
    towers: Array.from({ length: TOWER_COUNT }, (_, index) => createTower(index, random)),
    reason: null,
  };
}

export function startGame(_state: GameState, random: RandomSource = Math.random): GameState {
  return { ...createGame(random), status: "playing" };
}

export function dropBomb(state: GameState): GameState {
  if (state.status !== "playing" || state.bomb) {
    return state;
  }

  const next = cloneState(state);
  next.bomb = {
    x: next.ship.rect.x + (next.ship.rect.width - BOMB_WIDTH) / 2,
    y: next.ship.rect.y + next.ship.rect.height,
    width: BOMB_WIDTH,
    height: BOMB_HEIGHT,
  };
  return next;
}

export function stepGame(
  state: GameState,
  dtSeconds: number,
  random: RandomSource = Math.random,
): GameState {
  if (
    state.status !== "playing" ||
    !Number.isFinite(dtSeconds) ||
    dtSeconds <= 0
  ) {
    return state;
  }

  const next = cloneState(state);

  for (let index = 0; index < next.towers.length; index += 1) {
    const tower = next.towers[index];
    if (!tower) continue;

    if (tower.respawnRemaining > 0) {
      tower.respawnRemaining = Math.max(0, tower.respawnRemaining - dtSeconds);
      if (tower.respawnRemaining === 0) {
        next.towers[index] = createTower(index, random);
      }
      continue;
    }

    tower.height += tower.growthRate * dtSeconds;
    tower.rect.height = tower.height;
    tower.rect.y = GROUND_Y - tower.height;
  }

  next.ship.rect.x += SHIP_SPEED * dtSeconds;
  if (next.ship.rect.x >= WORLD_WIDTH) {
    next.ship.rect.x = -SHIP_WIDTH;
    next.ship.rect.y += SHIP_DESCENT_PER_LAP;
    next.ship.laps += 1;
  }

  if (next.towers.some((tower) => tower.respawnRemaining === 0 && tower.height >= TOWER_HEIGHT_CAP)) {
    return finish(next, "tower-limit");
  }
  if (next.ship.rect.y + next.ship.rect.height >= GROUND_Y) {
    return finish(next, "ground");
  }
  if (
    next.towers.some(
      (tower) => tower.respawnRemaining === 0 && overlaps(next.ship.rect, tower.rect),
    )
  ) {
    return finish(next, "ship-collision");
  }

  if (next.bomb) {
    const previousBomb = { ...next.bomb };
    next.bomb.y += BOMB_SPEED * dtSeconds;
    const hitIndex = next.towers.findIndex(
      (tower) =>
        tower.respawnRemaining === 0 &&
        next.bomb !== null &&
        bombSweepsTower(previousBomb, next.bomb, tower.rect),
    );

    if (hitIndex >= 0) {
      const tower = next.towers[hitIndex];
      if (tower) {
        tower.height = 0;
        tower.rect.height = 0;
        tower.rect.y = GROUND_Y;
        tower.respawnRemaining = TOWER_RESPAWN_SECONDS;
      }
      next.bomb = null;
      next.score += TOWER_SCORE;
    } else if (next.bomb.y >= WORLD_HEIGHT) {
      next.bomb = null;
    }
  }

  return next;
}

export { DANGER_Y };
