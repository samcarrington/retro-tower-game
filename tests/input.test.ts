// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindGameInput } from "../src/browser/input";

describe("game input", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("suppresses repeats and held Space until keyup", () => {
    const dropBomb = vi.fn();
    const useBoost = vi.fn();
    const input = bindGameInput({
      document,
      window,
      isPlaying: () => true,
      dropBomb,
      useBoost,
    });
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", cancelable: true }));
    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Space", repeat: true, cancelable: true }),
    );
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", cancelable: true }));
    expect(dropBomb).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", cancelable: true }));
    expect(dropBomb).toHaveBeenCalledTimes(2);
    input.dispose();
  });

  it("prevents Space only for active gameplay and clears the latch on blur", () => {
    let playing = false;
    const dropBomb = vi.fn();
    const useBoost = vi.fn();
    const input = bindGameInput({
      document,
      window,
      isPlaying: () => playing,
      dropBomb,
      useBoost,
    });
    const inactive = new KeyboardEvent("keydown", { code: "Space", cancelable: true });
    document.dispatchEvent(inactive);
    expect(inactive.defaultPrevented).toBe(false);
    playing = true;
    const active = new KeyboardEvent("keydown", { code: "Space", cancelable: true });
    document.dispatchEvent(active);
    expect(active.defaultPrevented).toBe(true);
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", cancelable: true }));
    expect(dropBomb).toHaveBeenCalledTimes(2);
    input.dispose();
  });

  it("leaves Space activation on a focused native button alone", () => {
    const button = document.createElement("button");
    document.body.append(button);
    const dropBomb = vi.fn();
    const input = bindGameInput({
      document,
      window,
      isPlaying: () => true,
      dropBomb,
      useBoost: vi.fn(),
    });
    button.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true }),
    );
    expect(dropBomb).not.toHaveBeenCalled();
    input.dispose();
  });

  it("routes B once per press and suppresses held repeats", () => {
    const useBoost = vi.fn();
    const input = bindGameInput({
      document,
      window,
      isPlaying: () => true,
      dropBomb: vi.fn(),
      useBoost,
    });
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyB", cancelable: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyB", cancelable: true }));
    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyB", repeat: true, cancelable: true }),
    );
    expect(useBoost).toHaveBeenCalledOnce();
    document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyB" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyB", cancelable: true }));
    expect(useBoost).toHaveBeenCalledTimes(2);
    input.dispose();
  });
});
