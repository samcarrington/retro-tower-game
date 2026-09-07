import type { GameEffectType } from "../game/types";

export interface GameAudio {
	resume(): Promise<void>;
	play(effect: GameEffectType): void;
	destroy(): Promise<void>;
}

export type AudioContextFactory = () => AudioContext;

function defaultAudioContextFactory(): AudioContext {
	if (typeof AudioContext === "undefined") {
		throw new Error("Web Audio is unavailable in this browser.");
	}
	return new AudioContext();
}

function shapeGain(
	gain: AudioParam,
	now: number,
	peak: number,
	duration: number,
): void {
	gain.setValueAtTime(0.0001, now);
	gain.exponentialRampToValueAtTime(peak, now + 0.01);
	gain.exponentialRampToValueAtTime(0.0001, now + duration);
}

function playBombDrop(context: AudioContext): void {
	const now = context.currentTime;
	const oscillator = context.createOscillator();
	const gain = context.createGain();
	oscillator.type = "square";
	oscillator.frequency.setValueAtTime(620, now);
	oscillator.frequency.exponentialRampToValueAtTime(180, now + 0.16);
	shapeGain(gain.gain, now, 0.08, 0.16);
	oscillator.connect(gain).connect(context.destination);
	oscillator.start(now);
	oscillator.stop(now + 0.17);
}

function playExplosion(context: AudioContext, player: boolean): void {
	const now = context.currentTime;
	const duration = player ? 0.65 : 0.28;
	const frameCount = Math.ceil(context.sampleRate * duration);
	const buffer = context.createBuffer(1, frameCount, context.sampleRate);
	const samples = buffer.getChannelData(0);
	for (let index = 0; index < samples.length; index += 1) {
		const decay = 1 - index / samples.length;
		samples[index] = (Math.random() * 2 - 1) * decay;
	}

	const source = context.createBufferSource();
	const gain = context.createGain();
	source.buffer = buffer;
	shapeGain(gain.gain, now, player ? 0.22 : 0.14, duration);
	source.connect(gain).connect(context.destination);
	source.start(now);
	source.stop(now + duration);

	if (player) {
		const oscillator = context.createOscillator();
		const lowGain = context.createGain();
		oscillator.type = "sawtooth";
		oscillator.frequency.setValueAtTime(150, now);
		oscillator.frequency.exponentialRampToValueAtTime(45, now + duration);
		shapeGain(lowGain.gain, now, 0.1, duration);
		oscillator.connect(lowGain).connect(context.destination);
		oscillator.start(now);
		oscillator.stop(now + duration);
	}
}

function playAllTowersBonus(context: AudioContext): void {
	const now = context.currentTime;
	for (const [index, frequency] of [660, 880, 1320].entries()) {
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		const start = now + index * 0.08;
		oscillator.type = "square";
		oscillator.frequency.setValueAtTime(frequency, start);
		shapeGain(gain.gain, start, 0.07, 0.12);
		oscillator.connect(gain).connect(context.destination);
		oscillator.start(start);
		oscillator.stop(start + 0.13);
	}
}

function playBoostJet(context: AudioContext): void {
	const now = context.currentTime;
	const oscillator = context.createOscillator();
	const gain = context.createGain();
	oscillator.type = "sawtooth";
	oscillator.frequency.setValueAtTime(90, now);
	oscillator.frequency.exponentialRampToValueAtTime(260, now + 0.3);
	shapeGain(gain.gain, now, 0.1, 0.32);
	oscillator.connect(gain).connect(context.destination);
	oscillator.start(now);
	oscillator.stop(now + 0.33);
}

export function createBrowserAudio(
	factory: AudioContextFactory = defaultAudioContextFactory,
): GameAudio {
	let context: AudioContext | null = null;

	return {
		resume: async () => {
			context ??= factory();
			if (context.state !== "running") {
				await context.resume();
			}
		},
		play: (effect) => {
			if (context?.state !== "running") return;
			if (effect === "bomb-drop") {
				playBombDrop(context);
			} else if (
				effect === "tower-explosion" ||
				effect === "player-explosion"
			) {
				playExplosion(context, effect === "player-explosion");
			} else if (effect === "all-towers-bonus") {
				playAllTowersBonus(context);
			} else {
				playBoostJet(context);
			}
		},
		destroy: async () => {
			if (!context || context.state === "closed") return;
			await context.close();
			context = null;
		},
	};
}
