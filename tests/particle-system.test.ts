import { describe, expect, it } from "vitest";
import type { GameEffect } from "../src/game/types";
import { ParticleSystem } from "../src/render/particle-system";

const towerEffect: GameEffect = {
	id: 1,
	type: "tower-explosion",
	x: 100,
	y: 200,
};

describe("ParticleSystem", () => {
	it("spawns tower and player bursts once per effect id", () => {
		const particles = new ParticleSystem(128, () => 0.25);
		particles.sync(1, 0, [towerEffect]);
		expect(
			particles.particles.filter((particle) => particle.active),
		).toHaveLength(32);
		expect(particles.particles[0]).toMatchObject({
			x: 100,
			y: 200,
			lifetime: 0.45,
		});

		particles.sync(1, 0, [towerEffect]);
		expect(
			particles.particles.filter((particle) => particle.active),
		).toHaveLength(32);

		particles.sync(1, 0, [
			towerEffect,
			{ id: 2, type: "player-explosion", x: 300, y: 80 },
		]);
		expect(
			particles.particles.filter((particle) => particle.active),
		).toHaveLength(96);
	});

	it("advances, expires, and reuses the bounded pool", () => {
		const particles = new ParticleSystem(64, () => 0);
		particles.sync(1, 0, [towerEffect]);
		const first = particles.particles[0]!;
		particles.sync(1, 0.2, [towerEffect]);
		expect(first.x).toBeGreaterThan(100);
		expect(first.age).toBe(0.2);

		particles.sync(1, 0.3, [towerEffect]);
		expect(particles.particles.every((particle) => !particle.active)).toBe(
			true,
		);

		particles.sync(1, 0, [{ ...towerEffect, id: 2 }]);
		expect(particles.particles[0]).toBe(first);
		expect(particles.particles).toHaveLength(64);
	});

	it("clears particles and consumed ids for a fresh run", () => {
		const particles = new ParticleSystem(64, () => 0.5);
		particles.sync(1, 0, [towerEffect]);
		particles.sync(2, 0, [towerEffect]);
		expect(
			particles.particles.filter((particle) => particle.active),
		).toHaveLength(32);
	});

	it("spawns bounded directional exhaust for a boost jet", () => {
		const particles = new ParticleSystem(128, () => 0.5);
		particles.sync(1, 0, [{ id: 1, type: "boost-jet", x: 80, y: 60 }]);
		const active = particles.particles.filter((particle) => particle.active);
		expect(active).toHaveLength(24);
		expect(active[0]).toMatchObject({ x: 80, y: 60, lifetime: 0.5 });
		expect(active[0]?.velocityX).toBeLessThan(0);
		expect(active[0]?.velocityY).toBeGreaterThan(0);
	});
});
