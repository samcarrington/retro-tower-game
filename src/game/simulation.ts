import {
  BOMB_HEIGHT,
  BOMB_FORWARD_SPEED,
  BOMB_GRAVITY,
  BOMB_HORIZONTAL_DRAG,
  BOMB_SPEED,
  BOMB_WIDTH,
  BOOST_EARN_INTERVAL,
  DANGER_Y,
  GROUND_Y,
  MAX_BOOST_CHARGES,
  MAX_EFFECT_EVENTS,
  SHIP_BOOST_CLIMB,
  SHIP_BOOST_SPEED,
  SHIP_CLEAR_BONUS_CLIMB,
  SHIP_DESCENT_PER_LAP,
  SHIP_HEIGHT,
  SHIP_SPEED,
  SHIP_START_X,
  SHIP_START_Y,
  SHIP_MIN_Y,
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
import type {
  GameEffectType,
  GameOverReason,
  GameState,
  RandomSource,
  Rect,
  TowerState,
} from "./types";

const ALL_TOWERS_MASK = (1 << TOWER_COUNT) - 1;

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
    ship: {
      rect: { ...state.ship.rect },
      laps: state.ship.laps,
      climbRemaining: state.ship.climbRemaining,
    },
    bomb: state.bomb
      ? { ...state.bomb, rect: { ...state.bomb.rect } }
      : null,
    towers: state.towers.map((tower) => ({ ...tower, rect: { ...tower.rect } })),
    effects: [...state.effects],
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

function segmentIntersectsRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  rect: Rect,
): boolean {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  let entry = 0;
  let exit = 1;

  const axes = [
    [startX, deltaX, rect.x, rect.x + rect.width],
    [startY, deltaY, rect.y, rect.y + rect.height],
  ] as const;

  for (const [start, delta, minimum, maximum] of axes) {
    if (delta === 0) {
      if (start < minimum || start > maximum) return false;
      continue;
    }

    const first = (minimum - start) / delta;
    const second = (maximum - start) / delta;
    entry = Math.max(entry, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (entry > exit) return false;
  }

  return true;
}

function bombSweepsTower(previous: Rect, next: Rect, tower: Rect): boolean {
  return segmentIntersectsRect(previous.x, previous.y, next.x, next.y, {
    x: tower.x - previous.width,
    y: tower.y - previous.height,
    width: tower.width + previous.width,
    height: tower.height + previous.height,
  });
}

function emitEffect(
  state: GameState,
  type: GameEffectType,
  x: number,
  y: number,
): void {
  state.effects = [
    ...state.effects.slice(-(MAX_EFFECT_EVENTS - 1)),
    { id: state.nextEffectId, type, x, y },
  ];
  state.nextEffectId += 1;
}

function finish(state: GameState, reason: Exclude<GameOverReason, null>): GameState {
  state.status = "gameover";
  state.reason = reason;
  emitEffect(
    state,
    "player-explosion",
    state.ship.rect.x + state.ship.rect.width / 2,
    state.ship.rect.y + state.ship.rect.height / 2,
  );
  return state;
}

export function createGame(random: RandomSource = Math.random): GameState {
  return {
    status: "ready",
    runId: 0,
    elapsedSeconds: 0,
    score: 0,
    ship: {
      rect: {
        x: SHIP_START_X,
        y: SHIP_START_Y,
        width: SHIP_WIDTH,
        height: SHIP_HEIGHT,
      },
      laps: 0,
      climbRemaining: 0,
    },
    bomb: null,
    towers: Array.from({ length: TOWER_COUNT }, (_, index) => createTower(index, random)),
    destroyedTowerMask: 0,
    destroyedTowerCount: 0,
    towerClearBonusAwarded: false,
    boostCharges: 0,
    effects: [],
    nextEffectId: 1,
    reason: null,
  };
}

export function startGame(state: GameState, random: RandomSource = Math.random): GameState {
  return { ...createGame(random), status: "playing", runId: state.runId + 1 };
}

export function dropBomb(state: GameState): GameState {
  if (state.status !== "playing" || state.bomb) {
    return state;
  }

  const next = cloneState(state);
  next.bomb = {
    rect: {
      x: next.ship.rect.x + (next.ship.rect.width - BOMB_WIDTH) / 2,
      y: next.ship.rect.y + next.ship.rect.height,
      width: BOMB_WIDTH,
      height: BOMB_HEIGHT,
    },
    velocityX: BOMB_FORWARD_SPEED,
    velocityY: BOMB_SPEED,
  };
  emitEffect(
    next,
    "bomb-drop",
    next.bomb.rect.x + next.bomb.rect.width / 2,
    next.bomb.rect.y + next.bomb.rect.height / 2,
  );
  return next;
}

export function useBoost(state: GameState): GameState {
  if (
    state.status !== "playing" ||
    state.boostCharges <= 0 ||
    state.ship.climbRemaining >= state.ship.rect.y - SHIP_MIN_Y
  ) {
    return state;
  }

  const next = cloneState(state);
  next.boostCharges -= 1;
  next.ship.climbRemaining = Math.min(
    next.ship.rect.y - SHIP_MIN_Y,
    next.ship.climbRemaining + SHIP_BOOST_CLIMB,
  );
  emitEffect(
    next,
    "boost-jet",
    next.ship.rect.x,
    next.ship.rect.y + next.ship.rect.height / 2,
  );
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
  next.elapsedSeconds += dtSeconds;

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
  if (next.ship.climbRemaining > 0 && next.ship.rect.y > SHIP_MIN_Y) {
    const climb = Math.min(
      next.ship.climbRemaining,
      SHIP_BOOST_SPEED * dtSeconds,
      next.ship.rect.y - SHIP_MIN_Y,
    );
    next.ship.rect.y -= climb;
    next.ship.climbRemaining -= climb;
    if (next.ship.rect.y <= SHIP_MIN_Y || next.ship.climbRemaining < 1e-9) {
      next.ship.rect.y = Math.max(SHIP_MIN_Y, next.ship.rect.y);
      next.ship.climbRemaining = 0;
    }
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
    const previousBomb = { ...next.bomb.rect };
    const horizontalDecay = Math.exp(-BOMB_HORIZONTAL_DRAG * dtSeconds);
    next.bomb.rect.x +=
      next.bomb.velocityX * (1 - horizontalDecay) / BOMB_HORIZONTAL_DRAG;
    next.bomb.rect.y +=
      next.bomb.velocityY * dtSeconds + 0.5 * BOMB_GRAVITY * dtSeconds ** 2;
    next.bomb.velocityX *= horizontalDecay;
    next.bomb.velocityY += BOMB_GRAVITY * dtSeconds;
    const hitIndex = next.towers.findIndex(
      (tower) =>
        tower.respawnRemaining === 0 &&
        next.bomb !== null &&
        bombSweepsTower(previousBomb, next.bomb.rect, tower.rect),
    );

    if (hitIndex >= 0) {
      const tower = next.towers[hitIndex];
      if (tower) {
        const impactX = Math.max(
          tower.rect.x,
          Math.min(next.bomb.rect.x + next.bomb.rect.width / 2, tower.rect.x + tower.rect.width),
        );
        const impactY = tower.rect.y;
        tower.height = 0;
        tower.rect.height = 0;
        tower.rect.y = GROUND_Y;
        tower.respawnRemaining = TOWER_RESPAWN_SECONDS;
        emitEffect(next, "tower-explosion", impactX, impactY);
      }
      next.bomb = null;
      next.score += TOWER_SCORE;
      next.destroyedTowerCount += 1;
      if (
        next.destroyedTowerCount % BOOST_EARN_INTERVAL === 0 &&
        next.boostCharges < MAX_BOOST_CHARGES
      ) {
        next.boostCharges += 1;
      }
      next.destroyedTowerMask |= 1 << hitIndex;
      if (
        !next.towerClearBonusAwarded &&
        next.destroyedTowerMask === ALL_TOWERS_MASK
      ) {
        next.ship.climbRemaining = Math.min(
          next.ship.rect.y - SHIP_MIN_Y,
          next.ship.climbRemaining + SHIP_CLEAR_BONUS_CLIMB,
        );
        next.towerClearBonusAwarded = true;
        emitEffect(
          next,
          "all-towers-bonus",
          next.ship.rect.x + next.ship.rect.width / 2,
          next.ship.rect.y + next.ship.rect.height / 2,
        );
      }
    } else if (
      next.bomb.rect.y >= WORLD_HEIGHT ||
      next.bomb.rect.x >= WORLD_WIDTH
    ) {
      next.bomb = null;
    }
  }

  return next;
}

export { DANGER_Y };
