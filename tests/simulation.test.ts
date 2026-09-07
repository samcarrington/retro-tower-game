import { describe, expect, it } from "vitest";
import {
	BOMB_FORWARD_SPEED,
	BOMB_GRAVITY,
	BOMB_HEIGHT,
	BOMB_HORIZONTAL_DRAG,
	BOMB_SPEED,
	BOMB_WIDTH,
	GROUND_Y,
	MAX_BOOST_CHARGES,
	SHIP_BOOST_CLIMB,
	SHIP_BOOST_SPEED,
	SHIP_CLEAR_BONUS_CLIMB,
	SHIP_HEIGHT,
	SHIP_MIN_Y,
	SHIP_WIDTH,
	TOWER_HEIGHT_CAP,
	TOWER_RESPAWN_SECONDS,
	WORLD_HEIGHT,
} from "../src/game/config";
import {
	createGame,
	dropBomb,
	startGame,
	stepGame,
	useBoost,
} from "../src/game/simulation";
import type { GameState } from "../src/game/types";

const fixedRandom = (value: number) => () => value;

function playing(random = fixedRandom(0)): GameState {
	return startGame(createGame(fixedRandom(0)), random);
}

function towerAt(state: GameState, index: number) {
	const tower = state.towers[index];
	if (!tower) throw new Error(`Missing tower ${index}`);
	return tower;
}

function hitTower(state: GameState, index: number): GameState {
	const tower = towerAt(state, index);
	tower.height = 40;
	tower.rect.height = 40;
	tower.rect.y = GROUND_Y - 40;
	tower.respawnRemaining = 0;
	state.bomb = {
		rect: {
			x: tower.rect.x,
			y: tower.rect.y - BOMB_HEIGHT,
			width: 6,
			height: 12,
		},
		velocityX: 0,
		velocityY: BOMB_SPEED,
	};
	return stepGame(state, 0.001);
}

describe("simulation", () => {
	it("creates a ready game with deterministic randomized towers", () => {
		const state = createGame(fixedRandom(0.5));
		expect(state.status).toBe("ready");
		expect(state.towers).toHaveLength(9);
		expect(state.towers[0]?.height).toBe(75);
		expect(state.towers[0]?.growthRate).toBe(6);
		expect(state.towers[8]?.rect.x).toBe(848);
	});

	it("starts a fresh game rather than carrying terminal state", () => {
		const old = playing();
		old.score = 900;
		old.reason = "ground";
		old.destroyedTowerMask = 0b111111111;
		old.towerClearBonusAwarded = true;
		old.bomb = {
			rect: { x: 1, y: 2, width: 6, height: 12 },
			velocityX: BOMB_FORWARD_SPEED,
			velocityY: BOMB_SPEED,
		};
		const restarted = startGame(old, fixedRandom(1));
		expect(restarted).toMatchObject({
			status: "playing",
			score: 0,
			reason: null,
			bomb: null,
			destroyedTowerMask: 0,
			destroyedTowerCount: 0,
			towerClearBonusAwarded: false,
			boostCharges: 0,
			effects: [],
			nextEffectId: 1,
		});
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
			rect: {
				x: (SHIP_WIDTH - BOMB_WIDTH) / 2,
				y: state.ship.rect.y + SHIP_HEIGHT,
				width: BOMB_WIDTH,
				height: BOMB_HEIGHT,
			},
			velocityX: BOMB_FORWARD_SPEED,
			velocityY: BOMB_SPEED,
		});
		expect(dropped.effects.at(-1)).toMatchObject({ id: 1, type: "bomb-drop" });
		expect(dropBomb(dropped)).toBe(dropped);
		const ready = createGame(fixedRandom(0));
		expect(dropBomb(ready)).toBe(ready);
	});

	it("grows active towers independently and respawns at the same position", () => {
		const state = playing();
		const tower = towerAt(state, 0);
		tower.height = 0;
		tower.rect.height = 0;
		tower.rect.y = GROUND_Y;
		tower.respawnRemaining = TOWER_RESPAWN_SECONDS;

		const waiting = stepGame(state, 1, fixedRandom(1));
		expect(waiting.towers[0]).toMatchObject({ height: 0, respawnRemaining: 1 });
		const respawned = stepGame(waiting, 1, fixedRandom(1));
		expect(respawned.towers[0]).toMatchObject({
			height: 110,
			growthRate: 10,
			respawnRemaining: 0,
		});
		expect(respawned.towers[0]?.rect.x).toBe(48);
	});

	it("uses swept bomb collision and starts a full respawn delay on the hit frame", () => {
		const state = playing();
		const tower = towerAt(state, 0);
		tower.height = 40;
		tower.rect.y = GROUND_Y - 40;
		tower.rect.height = 40;
		state.bomb = {
			rect: {
				x: tower.rect.x - 32,
				y: tower.rect.y - 80,
				width: 6,
				height: 12,
			},
			velocityX: BOMB_FORWARD_SPEED,
			velocityY: BOMB_SPEED,
		};
		const next = stepGame(state, 0.2);
		expect(next.score).toBe(100);
		expect(next.bomb).toBeNull();
		expect(next.towers[0]).toMatchObject({
			height: 0,
			respawnRemaining: TOWER_RESPAWN_SECONDS,
		});
		expect(next.effects.at(-1)).toMatchObject({ type: "tower-explosion" });
	});

	it("does not hit through a horizontal gap and clears bombs at the bottom", () => {
		const state = playing();
		state.bomb = {
			rect: { x: 10, y: WORLD_HEIGHT - 1, width: 6, height: 12 },
			velocityX: BOMB_FORWARD_SPEED,
			velocityY: BOMB_SPEED,
		};
		const next = stepGame(state, 1 / 60);
		expect(next.score).toBe(0);
		expect(next.bomb).toBeNull();
	});

	it.each([
		[
			"tower-limit",
			(state: GameState) => {
				const tower = towerAt(state, 0);
				tower.height = TOWER_HEIGHT_CAP;
				tower.rect.height = tower.height;
				tower.rect.y = GROUND_Y - tower.height;
			},
		],
		[
			"ground",
			(state: GameState) => {
				state.ship.rect.y = GROUND_Y - SHIP_HEIGHT;
			},
		],
		[
			"ship-collision",
			(state: GameState) => {
				state.ship.rect = {
					...towerAt(state, 0).rect,
					width: SHIP_WIDTH,
					height: SHIP_HEIGHT,
				};
			},
		],
	] as const)("ends with %s and freezes terminal state", (reason, arrange) => {
		const state = playing();
		arrange(state);
		const ended = stepGame(state, 1 / 60);
		expect(ended).toMatchObject({ status: "gameover", reason });
		expect(stepGame(ended, 1)).toBe(ended);
	});

	it("prioritises a loss over a simultaneous bomb hit", () => {
		const state = playing();
		const tower = towerAt(state, 0);
		tower.height = TOWER_HEIGHT_CAP;
		tower.rect.y = GROUND_Y - tower.height;
		tower.rect.height = tower.height;
		state.bomb = {
			rect: { x: tower.rect.x, y: tower.rect.y, width: 6, height: 12 },
			velocityX: BOMB_FORWARD_SPEED,
			velocityY: BOMB_SPEED,
		};
		const next = stepGame(state, 1 / 60);
		expect(next.reason).toBe("tower-limit");
		expect(next.score).toBe(0);
		expect(next.bomb).not.toBeNull();
		expect(next.effects).toHaveLength(1);
		expect(next.effects[0]?.type).toBe("player-explosion");
	});

	it("curves a bomb with decaying forward momentum and downward acceleration", () => {
		const dropped = dropBomb(playing());
		const before = dropped.bomb?.rect;
		if (!before) throw new Error("Expected an airborne bomb");
		const next = stepGame(dropped, 0.1);
		const horizontalDecay = Math.exp(-BOMB_HORIZONTAL_DRAG * 0.1);
		const expectedX =
			before.x +
			(BOMB_FORWARD_SPEED * (1 - horizontalDecay)) / BOMB_HORIZONTAL_DRAG;
		const expectedY =
			before.y + BOMB_SPEED * 0.1 + 0.5 * BOMB_GRAVITY * 0.1 ** 2;
		expect(next.bomb?.rect.x).toBeCloseTo(expectedX);
		expect(next.bomb?.rect.y).toBeCloseTo(expectedY);
		expect(next.bomb?.velocityX).toBeCloseTo(
			BOMB_FORWARD_SPEED * horizontalDecay,
		);
		expect(next.bomb?.velocityY).toBeCloseTo(BOMB_SPEED + BOMB_GRAVITY * 0.1);
	});

	it("travels less forwards and farther down in each successive interval", () => {
		const dropped = dropBomb(playing());
		const first = stepGame(dropped, 0.05);
		const second = stepGame(first, 0.05);
		if (!dropped.bomb || !first.bomb || !second.bomb) {
			throw new Error("Expected the bomb to remain airborne");
		}

		const firstDeltaX = first.bomb.rect.x - dropped.bomb.rect.x;
		const secondDeltaX = second.bomb.rect.x - first.bomb.rect.x;
		const firstDeltaY = first.bomb.rect.y - dropped.bomb.rect.y;
		const secondDeltaY = second.bomb.rect.y - first.bomb.rect.y;
		expect(secondDeltaX).toBeLessThan(firstDeltaX);
		expect(secondDeltaY).toBeGreaterThan(firstDeltaY);
	});

	it("assigns independent growth rates and rerolls only the respawned tower", () => {
		const values = [0, 0, 0, 0.25, 0, 0.5, 0, 0.75, ...Array(10).fill(0)];
		let index = 0;
		const state = playing(() => values[index++] ?? 0);
		expect(state.towers.slice(0, 4).map((tower) => tower.growthRate)).toEqual([
			2, 4, 6, 8,
		]);
		const unchangedRate = towerAt(state, 1).growthRate;
		const firstTower = towerAt(state, 0);
		firstTower.height = 0;
		firstTower.rect.height = 0;
		firstTower.respawnRemaining = 0.01;
		const respawned = stepGame(state, 0.01, fixedRandom(1));
		expect(respawned.towers[0]?.growthRate).toBe(10);
		expect(respawned.towers[1]?.growthRate).toBe(unchangedRate);
	});

	it("awards one secret climb after all nine distinct towers are destroyed", () => {
		let state = playing();
		state.ship.rect.y = 120;

		for (let towerIndex = 0; towerIndex < 9; towerIndex += 1) {
			state = hitTower(state, towerIndex);
		}

		expect(state.destroyedTowerMask).toBe(0b111111111);
		expect(state.towerClearBonusAwarded).toBe(true);
		expect(state.ship.rect.y).toBe(120);
		expect(state.ship.climbRemaining).toBe(SHIP_CLEAR_BONUS_CLIMB);
		expect(state.effects.at(-1)?.type).toBe("all-towers-bonus");

		state = stepGame(state, SHIP_CLEAR_BONUS_CLIMB / SHIP_BOOST_SPEED);
		expect(state.ship.rect.y).toBe(120 - SHIP_CLEAR_BONUS_CLIMB);
		expect(state.ship.climbRemaining).toBe(0);

		const repeated = hitTower(state, 0);
		expect(repeated.ship.rect.y).toBe(120 - SHIP_CLEAR_BONUS_CLIMB);
		expect(repeated.ship.climbRemaining).toBe(0);
	});

	it("clamps the secret climb to the minimum ship height", () => {
		const state = playing();
		state.ship.rect.y = SHIP_MIN_Y + 4;
		state.destroyedTowerMask = 0b011111111;
		const awarded = hitTower(state, 8);
		expect(awarded.ship.climbRemaining).toBe(4);
		expect(stepGame(awarded, 0.1).ship.rect.y).toBe(SHIP_MIN_Y);
	});

	it("requires all nine distinct tower positions within the same run", () => {
		let repeated = playing();
		for (let hit = 0; hit < 9; hit += 1) {
			repeated = hitTower(repeated, 0);
		}
		expect(repeated.destroyedTowerCount).toBe(9);
		expect(repeated.destroyedTowerMask).toBe(1);
		expect(repeated.towerClearBonusAwarded).toBe(false);
		expect(
			repeated.effects.some((effect) => effect.type === "all-towers-bonus"),
		).toBe(false);

		let splitAcrossRuns = playing();
		for (let towerIndex = 0; towerIndex < 8; towerIndex += 1) {
			splitAcrossRuns = hitTower(splitAcrossRuns, towerIndex);
		}
		splitAcrossRuns = startGame(splitAcrossRuns, fixedRandom(0));
		splitAcrossRuns = hitTower(splitAcrossRuns, 8);
		expect(splitAcrossRuns.destroyedTowerMask).toBe(1 << 8);
		expect(splitAcrossRuns.towerClearBonusAwarded).toBe(false);
	});

	it("earns a held boost every 25 towers and animates it only when fired", () => {
		let state = playing();
		state.ship.rect.y = 120;
		state.destroyedTowerCount = 24;
		state = hitTower(state, 0);
		expect(state.destroyedTowerCount).toBe(25);
		expect(state.boostCharges).toBe(1);
		expect(state.ship.rect.y).toBe(120);
		expect(state.ship.climbRemaining).toBe(0);

		const fired = useBoost(state);
		expect(fired.boostCharges).toBe(0);
		expect(fired.ship.rect.y).toBe(120);
		expect(fired.ship.climbRemaining).toBe(SHIP_BOOST_CLIMB);
		expect(fired.effects.at(-1)?.type).toBe("boost-jet");

		const animated = stepGame(fired, SHIP_BOOST_CLIMB / SHIP_BOOST_SPEED);
		expect(animated.ship.rect.y).toBe(120 - SHIP_BOOST_CLIMB);
		expect(animated.ship.climbRemaining).toBe(0);
	});

	it("caps held boosts at three and does not waste one at maximum altitude", () => {
		let state = playing();
		state.destroyedTowerCount = 74;
		state.boostCharges = MAX_BOOST_CHARGES;
		state = hitTower(state, 0);
		expect(state.destroyedTowerCount).toBe(75);
		expect(state.boostCharges).toBe(MAX_BOOST_CHARGES);

		state.ship.rect.y = SHIP_MIN_Y;
		expect(useBoost(state)).toBe(state);
	});

	it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
		"treats invalid delta %s as a no-op",
		(delta) => {
			const state = playing();
			expect(stepGame(state, delta)).toBe(state);
		},
	);
});
