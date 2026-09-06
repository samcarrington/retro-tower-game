import { COLOURS } from "../game/config";
import type { GameEffect } from "../game/types";

export interface ParticleState {
  active: boolean;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  age: number;
  lifetime: number;
  colour: number;
  size: number;
}

interface BurstStyle {
  count: number;
  lifetime: number;
  minimumSpeed: number;
  maximumSpeed: number;
  colours: readonly number[];
}

const TOWER_BURST: BurstStyle = {
  count: 32,
  lifetime: 0.45,
  minimumSpeed: 70,
  maximumSpeed: 190,
  colours: [COLOURS.amber, COLOURS.cream, COLOURS.red],
};

const PLAYER_BURST: BurstStyle = {
  count: 64,
  lifetime: 0.9,
  minimumSpeed: 110,
  maximumSpeed: 280,
  colours: [COLOURS.cream, COLOURS.red],
};

const GRAVITY = 180;

export class ParticleSystem {
  public readonly particles: ParticleState[];
  private readonly random: () => number;
  private runId = -1;
  private lastEffectId = 0;

  public constructor(capacity = 128, random: () => number = Math.random) {
    this.random = random;
    this.particles = Array.from({ length: capacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      age: 0,
      lifetime: 0,
      colour: COLOURS.cream,
      size: 4,
    }));
  }

  public sync(runId: number, deltaSeconds: number, effects: readonly GameEffect[]): void {
    if (runId !== this.runId) {
      this.reset(runId);
    }

    if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
      this.advance(deltaSeconds);
    }

    for (const effect of effects) {
      if (effect.id <= this.lastEffectId) continue;
      if (effect.type === "tower-explosion") {
        this.spawn(effect.x, effect.y, TOWER_BURST);
      } else if (effect.type === "player-explosion") {
        this.spawn(effect.x, effect.y, PLAYER_BURST);
      }
      this.lastEffectId = effect.id;
    }
  }

  public reset(runId = this.runId): void {
    this.runId = runId;
    this.lastEffectId = 0;
    for (const particle of this.particles) {
      particle.active = false;
    }
  }

  private advance(deltaSeconds: number): void {
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.age += deltaSeconds;
      if (particle.age >= particle.lifetime) {
        particle.active = false;
        continue;
      }
      particle.velocityY += GRAVITY * deltaSeconds;
      particle.x += particle.velocityX * deltaSeconds;
      particle.y += particle.velocityY * deltaSeconds;
    }
  }

  private spawn(x: number, y: number, style: BurstStyle): void {
    for (let index = 0; index < style.count; index += 1) {
      const particle = this.acquireParticle();
      const angle = this.random() * Math.PI * 2;
      const speed =
        style.minimumSpeed + this.random() * (style.maximumSpeed - style.minimumSpeed);
      const colourIndex = Math.min(
        style.colours.length - 1,
        Math.floor(this.random() * style.colours.length),
      );

      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.velocityX = Math.cos(angle) * speed;
      particle.velocityY = Math.sin(angle) * speed;
      particle.age = 0;
      particle.lifetime = style.lifetime;
      particle.colour = style.colours[colourIndex] ?? COLOURS.cream;
      particle.size = 3 + Math.floor(this.random() * 4);
    }
  }

  private acquireParticle(): ParticleState {
    const inactive = this.particles.find((particle) => !particle.active);
    if (inactive) return inactive;

    return this.particles.reduce((oldest, particle) =>
      particle.age / particle.lifetime > oldest.age / oldest.lifetime ? particle : oldest,
    );
  }
}
