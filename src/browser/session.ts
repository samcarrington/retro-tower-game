import { FixedStepClock } from "./clock";
import { bindGameInput } from "./input";
import { createGame, dropBomb, startGame, stepGame } from "../game/simulation";
import type { GameOverReason, GameState } from "../game/types";

export interface GameRenderer {
  render(state: GameState): void;
  destroy(): void;
}

export interface GameElements {
  region: HTMLElement;
  canvasHost: HTMLElement;
  score: HTMLElement;
  startOverlay: HTMLElement;
  startButton: HTMLButtonElement;
  gameoverOverlay: HTMLElement;
  gameoverReason: HTMLElement;
  restartButton: HTMLButtonElement;
  pausedIndicator: HTMLElement;
  errorOverlay: HTMLElement;
}

export interface GameSession {
  getState(): GameState;
  dispose(): void;
}

export interface GameSessionDependencies {
  createRenderer: (host: HTMLElement) => Promise<GameRenderer>;
  document?: Document;
  window?: Window;
  createClock?: (options: {
    step: (dtSeconds: number) => void;
    render: () => void;
  }) => Pick<FixedStepClock, "start" | "setActive" | "reset" | "dispose">;
}

const reasonMessages: Record<Exclude<GameOverReason, null>, string> = {
  "tower-limit": "A tower breached the danger line.",
  "ship-collision": "Your ship struck the skyline.",
  ground: "Your ship descended into the ground.",
};

export async function createGameSession(
  elements: GameElements,
  dependencies: GameSessionDependencies,
): Promise<GameSession> {
  const doc = dependencies.document ?? document;
  const win = dependencies.window ?? window;
  let state = createGame();
  let disposed = false;
  let focused = doc.hasFocus();
  let visible = !doc.hidden;
  let renderer: GameRenderer;

  try {
    renderer = await dependencies.createRenderer(elements.canvasHost);
  } catch (error) {
    elements.startOverlay.hidden = true;
    elements.errorOverlay.hidden = false;
    console.error("Unable to initialise the game renderer.", error);
    throw error;
  }

  const updatePresentation = (): void => {
    renderer.render(state);
    elements.score.textContent = state.score.toString().padStart(6, "0");
    elements.startOverlay.hidden = state.status !== "ready";
    elements.gameoverOverlay.hidden = state.status !== "gameover";
    elements.gameoverReason.textContent =
      state.reason === null ? "" : reasonMessages[state.reason];
    elements.pausedIndicator.hidden = state.status !== "playing" || (focused && visible);
  };

  const clockFactory =
    dependencies.createClock ??
    ((options: { step: (dtSeconds: number) => void; render: () => void }) =>
      new FixedStepClock(options));

  const clock = clockFactory({
    step: (dtSeconds) => {
      state = stepGame(state, dtSeconds);
      clock.setActive(state.status === "playing" && focused && visible);
    },
    render: updatePresentation,
  });

  const input = bindGameInput({
    document: doc,
    window: win,
    isPlaying: () => state.status === "playing",
    dropBomb: () => {
      state = dropBomb(state);
      updatePresentation();
    },
  });

  const syncActivity = (): void => {
    focused = doc.hasFocus();
    visible = !doc.hidden;
    clock.setActive(state.status === "playing" && focused && visible);
    input.reset();
    updatePresentation();
  };

  const begin = (): void => {
    state = startGame(state);
    clock.reset();
    clock.setActive(focused && visible);
    input.reset();
    updatePresentation();
    elements.region.focus();
  };

  const onBlur = (): void => {
    focused = false;
    clock.setActive(false);
    input.reset();
    updatePresentation();
  };

  const onFocus = (): void => {
    focused = true;
    syncActivity();
  };

  elements.startButton.addEventListener("click", begin);
  elements.restartButton.addEventListener("click", begin);
  win.addEventListener("blur", onBlur);
  win.addEventListener("focus", onFocus);
  doc.addEventListener("visibilitychange", syncActivity);

  updatePresentation();
  clock.start();

  return {
    getState: () => state,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      elements.startButton.removeEventListener("click", begin);
      elements.restartButton.removeEventListener("click", begin);
      win.removeEventListener("blur", onBlur);
      win.removeEventListener("focus", onFocus);
      doc.removeEventListener("visibilitychange", syncActivity);
      input.dispose();
      clock.dispose();
      renderer.destroy();
    },
  };
}
