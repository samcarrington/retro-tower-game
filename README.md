# Skyline Bomber

A small retro browser game built with PixiJS 8 and a deterministic TypeScript simulation. Fly automatically across a growing city, launch one momentum-carrying bomb at a time, and keep the skyline below the danger line.

## Requirements

- Node.js 24.20.0
- pnpm 11.25.0
- A current desktop browser with WebGL enabled

## Run

```sh
pnpm install
pnpm run dev
```

Open the local URL printed by Vite. Press **Start patrol**, then use **Space** to drop a bomb. Bombs continue moving forwards as they fall. The ship flies and descends automatically, while towers grow at independently changing rates. Tower and player destruction use generated pixel-particle bursts and synthesized browser audio. After a game over, choose **Fly again** for a fresh run.

Sound begins only after a Start, Restart, or Space gesture because browsers block automatic audio. If Web Audio is unavailable, the game remains playable and shows a small status message.

The entire game field is rendered through a subtle CRT effect with curved glass,
scanlines, animated analogue noise, and edge darkening.

## Checks

```sh
pnpm test
pnpm run lint
pnpm run build
pnpm run preview
```

The simulation is independent of PixiJS and the DOM, and runs in deterministic 60Hz fixed steps. The browser shell discards elapsed time after focus or visibility changes, so returning to the game never causes catch-up.

## Limitations

- Desktop keyboard controls only; there are no mobile controls.
- Sound balance, particle feel, and the `2..10 px/sec` tower-growth range still require human playtesting.
- Browser-specific renderer failure presentation is covered by shell tests, but unsupported GPU behaviour varies by browser and driver.
