import { describe, expect, it, vi } from "vitest";
import { createBrowserAudio } from "../src/browser/audio";

function createFakeContext() {
  const frequency = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  const gainParam = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  const connect = vi.fn(function connectNode() {
    return { connect };
  });
  const oscillator = {
    type: "sine",
    frequency,
    connect,
    start: vi.fn(),
    stop: vi.fn(),
  };
  const source = {
    buffer: null,
    connect,
    start: vi.fn(),
    stop: vi.fn(),
  };
  const context = {
    state: "suspended",
    currentTime: 1,
    sampleRate: 100,
    destination: {},
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    close: vi.fn(async () => {
      context.state = "closed";
    }),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => ({ gain: gainParam, connect })),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(100) })),
    createBufferSource: vi.fn(() => source),
  };
  return { context, oscillator, source };
}

describe("browser audio", () => {
  it("resumes lazily and synthesizes distinct effects", async () => {
    const fake = createFakeContext();
    const audio = createBrowserAudio(() => fake.context as unknown as AudioContext);

    audio.play("bomb-drop");
    expect(fake.context.createOscillator).not.toHaveBeenCalled();

    await audio.resume();
    audio.play("bomb-drop");
    expect(fake.context.createOscillator).toHaveBeenCalledTimes(1);
    expect(fake.context.createBufferSource).not.toHaveBeenCalled();

    audio.play("tower-explosion");
    expect(fake.context.createBufferSource).toHaveBeenCalledTimes(1);

    audio.play("player-explosion");
    expect(fake.context.createBufferSource).toHaveBeenCalledTimes(2);
    expect(fake.context.createOscillator).toHaveBeenCalledTimes(2);

    audio.play("all-towers-bonus");
    expect(fake.context.createOscillator).toHaveBeenCalledTimes(5);

    audio.play("boost-jet");
    expect(fake.context.createOscillator).toHaveBeenCalledTimes(6);

    await audio.destroy();
    expect(fake.context.close).toHaveBeenCalledOnce();
  });

  it("surfaces unsupported Web Audio from resume", async () => {
    const audio = createBrowserAudio(() => {
      throw new Error("unsupported");
    });
    await expect(audio.resume()).rejects.toThrow("unsupported");
  });
});
