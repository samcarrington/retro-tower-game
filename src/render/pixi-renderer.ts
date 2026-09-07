import { Application, Container, Graphics, Rectangle } from "pixi.js";
import type { GameRenderer } from "../browser/session";
import {
	COLOURS,
	DANGER_Y,
	GROUND_Y,
	TOWER_COUNT,
	TOWER_HEIGHT_CAP,
	TOWER_WIDTH,
	WORLD_HEIGHT,
	WORLD_WIDTH,
} from "../game/config";
import { CrtSceneFilter } from "./crt-filter";
import { ParticleSystem } from "./particle-system";

const PARTICLE_CAPACITY = 128;

interface TowerView {
	container: Container;
	body: Graphics;
	windows: Graphics[];
}

function createShipGraphic(): Graphics {
	return new Graphics()
		.rect(0, 4, 32, 8)
		.rect(8, 0, 20, 16)
		.rect(32, 7, 8, 4)
		.fill(COLOURS.cream)
		.rect(12, 4, 7, 4)
		.rect(21, 4, 5, 4)
		.fill(COLOURS.navy);
}

function createTowerView(): TowerView {
	const container = new Container();
	const body = new Graphics().rect(0, -1, TOWER_WIDTH, 1).fill(COLOURS.amber);
	const windows = Array.from({ length: 14 }, (_, index) => {
		const column = index % 2;
		const row = Math.floor(index / 2);
		const window = new Graphics().rect(0, 0, 8, 6).fill(COLOURS.navy);
		window.position.set(15 + column * 27, -18 - row * 30);
		container.addChild(window);
		return window;
	});
	container.addChildAt(body, 0);
	return { container, body, windows };
}

export async function createPixiRenderer(
	host: HTMLElement,
): Promise<GameRenderer> {
	const app = new Application();
	await app.init({
		width: WORLD_WIDTH,
		height: WORLD_HEIGHT,
		resolution: 1,
		antialias: false,
		autoStart: false,
		background: COLOURS.navy,
		preference: "webgl",
	});

	app.canvas.setAttribute("aria-label", "Skyline Bomber game field");
	host.replaceChildren(app.canvas);

	const scenery = new Graphics()
		.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
		.fill(COLOURS.navy);
	const stars = [
		[72, 42],
		[156, 108],
		[247, 52],
		[342, 116],
		[456, 38],
		[565, 92],
		[678, 50],
		[778, 111],
		[892, 35],
		[924, 86],
		[38, 168],
		[520, 164],
	] as const;
	for (const [x, y] of stars) {
		scenery.rect(x, y, 3, 3).fill(COLOURS.cream);
	}
	scenery
		.moveTo(0, DANGER_Y)
		.lineTo(WORLD_WIDTH, DANGER_Y)
		.stroke({ color: COLOURS.red, width: 2, pixelLine: true })
		.rect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y)
		.fill(COLOURS.red);

	const towerViews = Array.from({ length: TOWER_COUNT }, createTowerView);
	const ship = createShipGraphic();
	const bomb = new Graphics().rect(0, 0, 6, 12).fill(COLOURS.cream);
	const particleSystem = new ParticleSystem(PARTICLE_CAPACITY);
	const crtFilter = new CrtSceneFilter();
	const particleLayer = new Container();
	const particleViews = Array.from({ length: PARTICLE_CAPACITY }, () => {
		const particle = new Graphics().rect(-2, -2, 4, 4).fill(0xffffff);
		particle.visible = false;
		particleLayer.addChild(particle);
		return particle;
	});

	app.stage.addChild(scenery);
	for (const tower of towerViews) app.stage.addChild(tower.container);
	app.stage.addChild(ship, bomb, particleLayer);
	app.stage.filterArea = new Rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	app.stage.filters = [crtFilter.filter];

	return {
		render: (state, frameSeconds = 0) => {
			crtFilter.update(frameSeconds);
			ship.position.set(
				Math.round(state.ship.rect.x),
				Math.round(state.ship.rect.y),
			);
			bomb.visible = state.bomb !== null;
			if (state.bomb) {
				bomb.position.set(
					Math.round(state.bomb.rect.x),
					Math.round(state.bomb.rect.y),
				);
			}

			state.towers.forEach((tower, index) => {
				const view = towerViews[index];
				if (!view) return;
				view.container.visible = tower.respawnRemaining === 0;
				view.container.position.set(tower.rect.x, GROUND_Y);
				view.body.scale.y = Math.min(tower.height, TOWER_HEIGHT_CAP);
				for (const window of view.windows) {
					window.visible = -window.y + 8 < tower.height;
				}
			});

			particleSystem.sync(state.runId, frameSeconds, state.effects);
			particleSystem.particles.forEach((particle, index) => {
				const view = particleViews[index];
				if (!view) return;
				view.visible = particle.active;
				if (!particle.active) return;
				view.position.set(Math.round(particle.x), Math.round(particle.y));
				view.tint = particle.colour;
				view.alpha = Math.max(0, 1 - particle.age / particle.lifetime);
				view.scale.set(particle.size / 4);
			});

			app.renderer.render(app.stage);
		},
		destroy: () => {
			app.stage.filters = null;
			crtFilter.destroy();
			app.destroy({ removeView: true }, { children: true });
		},
	};
}
