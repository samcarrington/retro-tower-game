// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGameSession,
  type GameElements,
  type GameRenderer,
} from "../src/browser/session";
import type { GameState } from "../src/game/types";

function createElements(): GameElements {
  document.body.innerHTML = `
    <main id="region" tabindex="-1"></main><div id="host"></div><span id="score"></span>
    <div id="start"><button id="start-button"></button></div>
    <div id="gameover" hidden><span id="reason"></span><button id="restart"></button></div>
    <div id="paused" hidden></div><div id="error" hidden></div>
  `;
  return {
    region: document.querySelector("#region")!,
    canvasHost: document.querySelector("#host")!,
    score: document.querySelector("#score")!,
    startOverlay: document.querySelector("#start")!,
    startButton: document.querySelector("#start-button")!,
    gameoverOverlay: document.querySelector("#gameover")!,
    gameoverReason: document.querySelector("#reason")!,
    restartButton: document.querySelector("#restart")!,
    pausedIndicator: document.querySelector("#paused")!,
    errorOverlay: document.querySelector("#error")!,
  };
}

function createClockHarness() {
  let callbacks: { step: (dt: number) => void; render: () => void } | undefined;
  const clock = {
    start: vi.fn(),
    setActive: vi.fn(),
    reset: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    clock,
    factory: (value: { step: (dt: number) => void; render: () => void }) => {
      callbacks = value;
      return clock;
    },
    step: (dt: number) => callbacks?.step(dt),
    render: () => callbacks?.render(),
  };
}

describe("game session", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });

  it("presents renderer startup failure", async () => {
    const elements = createElements();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      createGameSession(elements, {
        createRenderer: () => Promise.reject(new Error("WebGL unavailable")),
      }),
    ).rejects.toThrow("WebGL unavailable");
    expect(elements.startOverlay.hidden).toBe(true);
    expect(elements.errorOverlay.hidden).toBe(false);
  });

  it("starts, drops a bomb, pauses, restarts fresh, and disposes resources", async () => {
    const elements = createElements();
    const rendered: GameState[] = [];
    const renderer: GameRenderer = {
      render: (state) => rendered.push(state),
      destroy: vi.fn(),
    };
    const harness = createClockHarness();
    const session = await createGameSession(elements, {
      createRenderer: () => Promise.resolve(renderer),
      createClock: harness.factory,
    });

    expect(session.getState().status).toBe("ready");
    elements.startButton.click();
    expect(session.getState().status).toBe("playing");
    expect(document.activeElement).toBe(elements.region);
    expect(harness.clock.reset).toHaveBeenCalledOnce();

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", cancelable: true }));
    expect(session.getState().bomb).not.toBeNull();

    window.dispatchEvent(new Event("blur"));
    expect(elements.pausedIndicator.hidden).toBe(false);
    expect(harness.clock.setActive).toHaveBeenLastCalledWith(false);

    elements.restartButton.click();
    expect(session.getState()).toMatchObject({ status: "playing", score: 0, bomb: null });
    expect(rendered.length).toBeGreaterThan(2);

    session.dispose();
    expect(harness.clock.dispose).toHaveBeenCalledOnce();
    expect(renderer.destroy).toHaveBeenCalledOnce();
  });

  it("freezes on visibility loss and resumes without changing game state", async () => {
    const elements = createElements();
    const harness = createClockHarness();
    const session = await createGameSession(elements, {
      createRenderer: () =>
        Promise.resolve({ render: vi.fn(), destroy: vi.fn() }),
      createClock: harness.factory,
    });
    elements.startButton.click();
    const before = session.getState();

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(harness.clock.setActive).toHaveBeenLastCalledWith(false);
    harness.render();
    expect(session.getState()).toBe(before);

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(harness.clock.setActive).toHaveBeenLastCalledWith(true);
    harness.step(1 / 60);
    expect(session.getState().ship.rect.x).toBeGreaterThan(before.ship.rect.x);
    session.dispose();
  });

  it("presents a natural game over and restarts with the same renderer", async () => {
    const elements = createElements();
    const harness = createClockHarness();
    const render = vi.fn();
    const session = await createGameSession(elements, {
      createRenderer: () => Promise.resolve({ render, destroy: vi.fn() }),
      createClock: harness.factory,
    });
    elements.startButton.click();

    for (let frame = 0; frame < 4_000 && session.getState().status === "playing"; frame += 1) {
      harness.step(1 / 60);
    }
    harness.render();

    expect(session.getState().status).toBe("gameover");
    expect(elements.gameoverOverlay.hidden).toBe(false);
    expect(elements.gameoverReason.textContent).not.toBe("");

    const renderCount = render.mock.calls.length;
    elements.restartButton.click();
    expect(session.getState()).toMatchObject({
      status: "playing",
      score: 0,
      reason: null,
      bomb: null,
    });
    expect(render.mock.calls.length).toBeGreaterThan(renderCount);
    session.dispose();
  });
});
