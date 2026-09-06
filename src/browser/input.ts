export interface GameInputOptions {
  document: Document;
  window: Window;
  isPlaying: () => boolean;
  dropBomb: () => void;
  useBoost: () => void;
}

export interface GameInput {
  reset(): void;
  dispose(): void;
}

export function bindGameInput(options: GameInputOptions): GameInput {
  let spaceHeld = false;
  let boostHeld = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== "Space" && event.code !== "KeyB") return;
    if (event.target instanceof HTMLButtonElement) return;
    if (!options.isPlaying()) return;

    event.preventDefault();
    if (event.repeat) return;
    if (event.code === "Space") {
      if (spaceHeld) return;
      spaceHeld = true;
      options.dropBomb();
    } else {
      if (boostHeld) return;
      boostHeld = true;
      options.useBoost();
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      spaceHeld = false;
    } else if (event.code === "KeyB") {
      boostHeld = false;
    }
  };

  const reset = (): void => {
    spaceHeld = false;
    boostHeld = false;
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
