import { describe, expect, it } from "vitest";
import {
	advanceCrtTime,
	CRT_CURVATURE,
	CRT_FRAGMENT_SHADER,
	CRT_NOISE_STRENGTH,
	CRT_SCANLINE_STRENGTH,
} from "../src/render/crt-filter";

describe("CRT scene filter", () => {
	it("includes curvature, scanline, noise, and vignette stages", () => {
		expect(CRT_CURVATURE).toBeGreaterThan(0);
		expect(CRT_SCANLINE_STRENGTH).toBeGreaterThan(0);
		expect(CRT_NOISE_STRENGTH).toBeGreaterThan(0);
		expect(CRT_FRAGMENT_SHADER).toContain("radiusSquared");
		expect(CRT_FRAGMENT_SHADER).toContain("cornerScale");
		expect(CRT_FRAGMENT_SHADER).toContain("scanline");
		expect(CRT_FRAGMENT_SHADER).toContain("randomNoise");
		expect(CRT_FRAGMENT_SHADER).toContain("vignette");
	});

	it("advances noise time only for valid active frame deltas", () => {
		expect(advanceCrtTime(0, 0.25)).toBe(0.25);
		expect(advanceCrtTime(0.25, 0)).toBe(0.25);
		expect(advanceCrtTime(0.25, Number.NaN)).toBe(0.25);
		expect(advanceCrtTime(999.9, 0.2)).toBeCloseTo(0.1);
	});
});
