import "./style.css";
import { createGameSession, type GameElements } from "./browser/session";
import { createPixiRenderer } from "./render/pixi-renderer";

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as T;
}

const elements: GameElements = {
  region: requireElement("game-region"),
  canvasHost: requireElement("canvas-host"),
  score: requireElement("score"),
  boostCount: requireElement("boost-count"),
  highScoreList: requireElement<HTMLOListElement>("high-score-list"),
  startOverlay: requireElement("start-overlay"),
  startButton: requireElement<HTMLButtonElement>("start-button"),
  gameoverOverlay: requireElement("gameover-overlay"),
  gameoverReason: requireElement("gameover-reason"),
  restartButton: requireElement<HTMLButtonElement>("restart-button"),
  pausedIndicator: requireElement("paused-indicator"),
  audioStatus: requireElement("audio-status"),
  errorOverlay: requireElement("error-overlay"),
};

const session = await createGameSession(elements, {
  createRenderer: createPixiRenderer,
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    session.dispose();
  });
}
