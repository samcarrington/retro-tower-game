import { describe, expect, it, vi } from "vitest";
import { FixedStepClock } from "../src/browser/clock";

describe("FixedStepClock", () => {
	it("advances at fixed 60Hz steps and caps a live frame at 100ms", () => {
		const step = vi.fn();
		const render = vi.fn();
		const clock = new FixedStepClock({ step, render });
		clock.setActive(true);
		clock.advance(0);
		clock.advance(100);
		expect(step).toHaveBeenCalledTimes(6);
		expect(step).toHaveBeenLastCalledWith(1 / 60);
		expect(render).toHaveBeenCalledTimes(2);
	});

	it("discards the first delta after pause and reset", () => {
		const step = vi.fn();
		const clock = new FixedStepClock({ step, render: vi.fn() });
		clock.setActive(true);
		clock.advance(0);
		clock.advance(17);
		expect(step).toHaveBeenCalledTimes(1);

		clock.setActive(false);
		clock.advance(10_000);
		clock.setActive(true);
		clock.advance(20_000);
		expect(step).toHaveBeenCalledTimes(1);
		clock.advance(20_017);
		expect(step).toHaveBeenCalledTimes(2);

		clock.reset();
		clock.advance(30_000);
		expect(step).toHaveBeenCalledTimes(2);
	});

	it("cancels its scheduled frame when disposed", () => {
		const callbacks: FrameRequestCallback[] = [];
		const cancel = vi.fn();
		const clock = new FixedStepClock({
			step: vi.fn(),
			render: vi.fn(),
			driver: {
				request: (callback) => {
					callbacks.push(callback);
					return 7;
				},
				cancel,
			},
		});
		clock.start();
		expect(callbacks).toHaveLength(1);
		clock.dispose();
		expect(cancel).toHaveBeenCalledWith(7);
	});
});
