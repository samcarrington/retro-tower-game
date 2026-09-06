import { FixedStepClock } from "./clock";
import { createBrowserAudio, type GameAudio } from "./audio";
import { bindGameInput } from "./input";
import { createGame, dropBomb, startGame, stepGame } from "../game/simulation";
import type { GameOverReason, GameState } from "../game/types";

export interface GameRenderer {
  render(state: GameState, frameSeconds?: number): void;
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
  audioStatus: HTMLElement;
  errorOverlay: HTMLElement;
}

export interface GameSession {
  getState(): GameState;
  dispose(): void;
}

export interface GameSessionDependencies {
  createRenderer: (host: HTMLElement) => Promise<GameRenderer>;
  createAudio?: () => GameAudio;
  document?: Document;
  window?: Window;
  createClock?: (options: {
    step: (dtSeconds: number) => void;
    render: (frameSeconds: number) => void;
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
  const audio = (dependencies.createAudio ?? createBrowserAudio)();
  let audioReady = false;
  let audioUnavailable = false;
  let audioActivation: Promise<void> | null = null;
  let audioRunId = state.runId;
  let lastAudioEffectId = 0;

  try {
    renderer = await dependencies.createRenderer(elements.canvasHost);
  } catch (error) {
    elements.startOverlay.hidden = true;
    elements.errorOverlay.hidden = false;
    console.error("Unable to initialise the game renderer.", error);
    throw error;
  }

  const reportAudioFailure = (error: unknown): void => {
    if (audioUnavailable) return;
    audioUnavailable = true;
    elements.audioStatus.hidden = false;
    elements.audioStatus.textContent = "Sound unavailable";
    console.warn("Game audio is unavailable.", error);
  };

  const routeAudio = (): void => {
    if (!audioReady || audioUnavailable) return;
    if (state.runId !== audioRunId) {
      audioRunId = state.runId;
      lastAudioEffectId = 0;
    }
    for (const effect of state.effects) {
      if (effect.id <= lastAudioEffectId) continue;
      try {
        audio.play(effect.type);
        lastAudioEffectId = effect.id;
      } catch (error) {
        reportAudioFailure(error);
        return;
      }
    }
  };

  const enableAudio = (): Promise<void> => {
    if (audioReady || audioUnavailable) return Promise.resolve();
    audioActivation ??= audio
      .resume()
      .then(() => {
        audioReady = true;
        elements.audioStatus.hidden = true;
        routeAudio();
      })
      .catch(reportAudioFailure)
      .finally(() => {
        audioActivation = null;
      });
    return audioActivation;
  };

  const updatePresentation = (frameSeconds = 0): void => {
    renderer.render(state, frameSeconds);
    routeAudio();
    elements.score.textContent = state.score.toString().padStart(6, "0");
    elements.startOverlay.hidden = state.status !== "ready";
    elements.gameoverOverlay.hidden = state.status !== "gameover";
    elements.gameoverReason.textContent =
      state.reason === null ? "" : reasonMessages[state.reason];
    elements.pausedIndicator.hidden = state.status !== "playing" || (focused && visible);
  };

  const clockFactory =
    dependencies.createClock ??
    ((options: { step: (dtSeconds: number) => void; render: (frameSeconds: number) => void }) =>
      new FixedStepClock(options));

  const clock = clockFactory({
    step: (dtSeconds) => {
      state = stepGame(state, dtSeconds);
      clock.setActive(state.status !== "ready" && focused && visible);
    },
    render: updatePresentation,
  });

  const input = bindGameInput({
    document: doc,
    window: win,
    isPlaying: () => state.status === "playing",
    dropBomb: () => {
      void enableAudio();
      state = dropBomb(state);
      updatePresentation();
    },
  });

  const syncActivity = (): void => {
    focused = doc.hasFocus();
    visible = !doc.hidden;
    clock.setActive(state.status !== "ready" && focused && visible);
    input.reset();
    updatePresentation();
  };

  const begin = (): void => {
    void enableAudio();
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
      void audio.destroy().catch((error: unknown) => {
        console.error("Unable to dispose game audio.", error);
      });
    },
  };
}
