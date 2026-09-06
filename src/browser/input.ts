export interface GameInputOptions {
  document: Document;
  window: Window;
  isPlaying: () => boolean;
  dropBomb: () => void;
}

export interface GameInput {
  reset(): void;
  dispose(): void;
}

export function bindGameInput(options: GameInputOptions): GameInput {
  let spaceHeld = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== "Space") return;
    if (event.target instanceof HTMLButtonElement) return;
    if (!options.isPlaying()) return;

    event.preventDefault();
    if (event.repeat || spaceHeld) return;
    spaceHeld = true;
    options.dropBomb();
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      spaceHeld = false;
    }
  };

  const reset = (): void => {
    spaceHeld = false;
  };

  options.document.addEventListener("keydown", onKeyDown);
  options.document.addEventListener("keyup", onKeyUp);
  options.window.addEventListener("blur", reset);

  return {
    reset,
    dispose: () => {
      options.document.removeEventListener("keydown", onKeyDown);
      options.document.removeEventListener("keyup", onKeyUp);
      options.window.removeEventListener("blur", reset);
    },
  };
}
