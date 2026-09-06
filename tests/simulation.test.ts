import { describe, expect, it } from "vitest";
import {
  BOMB_HEIGHT,
  BOMB_WIDTH,
  GROUND_Y,
  SHIP_HEIGHT,
  SHIP_WIDTH,
  TOWER_HEIGHT_CAP,
  TOWER_RESPAWN_SECONDS,
  WORLD_HEIGHT,
} from "../src/game/config";
import { createGame, dropBomb, startGame, stepGame } from "../src/game/simulation";
import type { GameState } from "../src/game/types";

const fixedRandom = (value: number) => () => value;

function playing(random = fixedRandom(0)): GameState {
  return startGame(createGame(random), random);
}

describe("simulation", () => {
  it("creates a ready game with deterministic randomized towers", () => {
    const state = createGame(fixedRandom(0.5));
    expect(state.status).toBe("ready");
    expect(state.towers).toHaveLength(9);
    expect(state.towers[0]?.height).toBe(75);
    expect(state.towers[0]?.growthRate).toBe(5);
    expect(state.towers[8]?.rect.x).toBe(848);
  });

  it("starts a fresh game rather than carrying terminal state", () => {
    const old = playing();
    old.score = 900;
    old.reason = "ground";
    old.bomb = { x: 1, y: 2, width: 6, height: 12 };
    const restarted = startGame(old, fixedRandom(1));
    expect(restarted).toMatchObject({ status: "playing", score: 0, reason: null, bomb: null });
    expect(restarted.towers[0]?.height).toBe(110);
  });

  it("moves, wraps and descends the ship", () => {
    const state = playing();
    state.ship.rect.x = 959;
    const next = stepGame(state, 1 / 60);
    expect(next.ship.rect).toMatchObject({ x: -40, y: 88 });
    expect(next.ship.laps).toBe(1);
  });

  it("drops only one centred bomb while playing", () => {
    const state = playing();
    const dropped = dropBomb(state);
    expect(dropped.bomb).toEqual({
      x: (SHIP_WIDTH - BOMB_WIDTH) / 2,
      y: state.ship.rect.y + SHIP_HEIGHT,
      width: BOMB_WIDTH,
      height: BOMB_HEIGHT,
    });
    expect(dropBomb(dropped)).toBe(dropped);
    const ready = createGame(fixedRandom(0));
    expect(dropBomb(ready)).toBe(ready);
  });

  it("grows active towers independently and respawns at the same position", () => {
    const state = playing();
    const tower = state.towers[0]!;
    tower.height = 0;
    tower.rect.height = 0;
    tower.rect.y = GROUND_Y;
    tower.respawnRemaining = TOWER_RESPAWN_SECONDS;

    const waiting = stepGame(state, 1, fixedRandom(1));
    expect(waiting.towers[0]).toMatchObject({ height: 0, respawnRemaining: 1 });
    const respawned = stepGame(waiting, 1, fixedRandom(1));
    expect(respawned.towers[0]).toMatchObject({
      height: 110,
      growthRate: 7,
      respawnRemaining: 0,
    });
    expect(respawned.towers[0]?.rect.x).toBe(48);
  });

  it("uses swept bomb collision and starts a full respawn delay on the hit frame", () => {
    const state = playing();
    const tower = state.towers[0]!;
    tower.height = 40;
    tower.rect.y = GROUND_Y - 40;
    tower.rect.height = 40;
    state.bomb = { x: tower.rect.x + 4, y: tower.rect.y - 80, width: 6, height: 12 };
    const next = stepGame(state, 0.2);
    expect(next.score).toBe(100);
    expect(next.bomb).toBeNull();
    expect(next.towers[0]).toMatchObject({
      height: 0,
      respawnRemaining: TOWER_RESPAWN_SECONDS,
    });
  });

  it("does not hit through a horizontal gap and clears bombs at the bottom", () => {
    const state = playing();
    state.bomb = { x: 10, y: WORLD_HEIGHT - 1, width: 6, height: 12 };
    const next = stepGame(state, 1 / 60);
    expect(next.score).toBe(0);
    expect(next.bomb).toBeNull();
  });

  it.each([
    ["tower-limit", (state: GameState) => {
      const tower = state.towers[0]!;
      tower.height = TOWER_HEIGHT_CAP;
      tower.rect.height = tower.height;
      tower.rect.y = GROUND_Y - tower.height;
    }],
    ["ground", (state: GameState) => {
      state.ship.rect.y = GROUND_Y - SHIP_HEIGHT;
    }],
    ["ship-collision", (state: GameState) => {
      state.ship.rect = { ...state.towers[0]!.rect, width: SHIP_WIDTH, height: SHIP_HEIGHT };
    }],
  ] as const)("ends with %s and freezes terminal state", (reason, arrange) => {
    const state = playing();
    arrange(state);
    const ended = stepGame(state, 1 / 60);
    expect(ended).toMatchObject({ status: "gameover", reason });
    expect(stepGame(ended, 1)).toBe(ended);
  });

  it("prioritises a loss over a simultaneous bomb hit", () => {
    const state = playing();
    const tower = state.towers[0]!;
    tower.height = TOWER_HEIGHT_CAP;
    tower.rect.y = GROUND_Y - tower.height;
    tower.rect.height = tower.height;
    state.bomb = { x: tower.rect.x, y: tower.rect.y, width: 6, height: 12 };
    const next = stepGame(state, 1 / 60);
    expect(next.reason).toBe("tower-limit");
    expect(next.score).toBe(0);
    expect(next.bomb).not.toBeNull();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "treats invalid delta %s as a no-op",
    (delta) => {
      const state = playing();
      expect(stepGame(state, delta)).toBe(state);
    },
  );
});
