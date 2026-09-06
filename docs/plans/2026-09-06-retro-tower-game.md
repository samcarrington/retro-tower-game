# Retro Tower Game Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Build the approved playable browser game: an automatically flying ship, one-at-a-time bombs, growing towers, score chasing, and accessible start/game-over/restart flow.

**Architecture:** Keep all game rules in a pure deterministic fixed-step simulation with no PixiJS or DOM imports. A browser shell owns clock, focus/visibility, keyboard input, native controls, overlays, and renderer lifecycle; a narrow renderer reads state but does not make game decisions. Pixi renders one fixed 960x540 logical field responsively without changing world coordinates.

**Tech Stack:** pnpm, PixiJS 8, TypeScript strict, Vite, Vitest (Node default, jsdom only for browser-shell tests), ESLint with minimal typescript-eslint recommended rules. No framework, backend, debug globals, external artwork, mobile controls, Playwright, or coverage dependency.

---

## Compatibility gate

Run these separately before execution and recheck latest maintained versions against local Node. Do not silently change architecture or downgrade if incompatible.

Verified for this plan: Node `v24.20.0`, pnpm `11.25.0`.

Registry checks: `pixi.js@8.20.1` (PixiJS 8, no incompatible Node engine reported), `typescript@5.9.3` (Node `>=14.17`), `vite@8.2.2` (Node `^20.19.0 || >=22.12.0`), `vitest@5.0.0` (Node `^22.12.0 || ^24.0.0 || >=26.0.0`), `eslint@10.10.0` (Node `^20.19.0 || ^22.13.0 || >=24`), `typescript-eslint@8.69.0` (Node `^18.18.0 || ^20.9.0 || >=21.1.0`; peers ESLint `^8.57 || ^9 || ^10`, TypeScript `>=4.8.4 <6.1.0`), `jsdom@30.0.1` (Node `^22.22.2 || ^24.15.0 || >=26.0.0`), and `@types/node@24.13.3` (no incompatible peer reported). All selected versions are compatible with Node 24.20.0. If this changes, report incompatibility and stop for a decision.

## Task 1: Scaffold project and browser entry

**Files:** Create `package.json`, `pnpm-lock.yaml`, `.gitignore`, `index.html`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `src/main.ts`, `src/style.css`.

1. Write scripts: `dev`, `build` (`tsc --noEmit && vite build`), `test` (`vitest run`), `lint` (`eslint .`), `preview`. Pin compatible dependencies. Add `"packageManager": "pnpm@11.25.0"`. Vitest defaults to Node; browser-shell tests opt into jsdom.
2. Configure strict TypeScript, Vite, and flat ESLint with minimal typescript-eslint recommended rules. Add only `node_modules`, `dist`, `.superpowers`, `coverage`, and `logs` to gitignore; preserve skills/docs.
3. Create semantic HTML for game root, canvas host, score/instructions, start/restart native buttons, game-over reason, paused indication, and renderer-error screen. Add responsive centered 16:9 CSS, pixelated rendering, and arcade navy/cream/amber/red styling.
4. Keep `main.ts` as a compilable placeholder until the session and renderer exist; defer async session wiring and startup failures to Task 5. No production test hooks or globals.
5. TDD check: run `pnpm run lint` and `pnpm run build`; both must PASS. Defer `pnpm test` until the first test file exists. Do not enable `passWithNoTests`.

## Task 2: Define centralized simulation state

**Files:** Create `src/game/config.ts`, `src/game/types.ts`.

1. Export all sizes, speeds, colors, dimensions, and timing from config, labeling values as proposed starting tuning rather than requirements.
2. Use: W960 H540 groundY504 dangerY140; ship 40x16 at x0/y72, speed180, descent16/lap; nine tower width64 at x `48 + 100*i`; initial/respawn height random40..110 and growth random3..7 px/sec; destroyed height0/inactive2s; bomb6x12/speed420; score100.
3. Define top-left `Rect`; `GameState` with `status: ready|playing|gameover`, score, ship rect/laps, bomb Rect|null, nine towers with rect/height/growthRate/respawnRemaining, and reason `tower-limit|ship-collision|ground|null`.
4. Document inclusive AABB contact, tower cap `groundY-dangerY`, bomb clearing at screen bottom H540, and random source semantics.
5. TDD check: run `pnpm run build`; strict typecheck must PASS.

## Task 3: Pure simulation TDD

**Files:** Create `src/game/simulation.ts`, `tests/simulation.test.ts`.

1. Write failing deterministic tests for `createGame(random?)`, `startGame(state)`, `dropBomb(state)`, and `stepGame(state, dtSeconds, random?)`: ready initialization, fresh restart, randomized towers, and no Pixi/DOM dependency. Run the focused tests and confirm failure for missing or incorrect behavior.
2. Test ship movement, wrap when ship left >=960 to x=-40, lap descent, bomb spawn at ship center/ship bottom, one airborne bomb, rejection while a bomb is active, and rejection when not playing. Repeat suppression belongs to Task 4 input tests, not pure simulation.
3. Test independent growth, inactive towers not growing/colliding, destruction to zero, two-second same-position respawn, fresh respawn randomness, and no pre-destruction frame time consumed by countdown.
4. Test swept vertical bomb collision, full ship/tower collision, inclusive touching, bomb gap miss, tower-limit/ground/ship losses, simultaneous loss and bomb hit (loss wins), single recorded reason, terminal freeze, offscreen clearing at 540, and zero/negative/nonfinite deltas as no-ops.
5. Implement minimum pure transitions. Step order must be: active growth/respawn; ship movement/wrap; terminal checks priority tower limit then ground then ship contact (terminal freezes remaining frame); bomb movement/hit/offscreen. Keep helpers private where practical.
6. Use fixed-step-compatible calls from shell; simulation owns no clock/accumulator and imports no browser/rendering modules.
7. Implement the minimum behavior, rerun `pnpm test tests/simulation.test.ts` and expect PASS, then run `pnpm test` and expect PASS.

## Task 4: Clock, input, session TDD

**Files:** Create `src/browser/clock.ts`, `src/browser/input.ts`, `src/browser/session.ts`, `tests/clock.test.ts`, `tests/input.test.ts`, `tests/session.test.ts`.

1. Write clock tests using supplied timestamps for 60Hz fixed steps, active-frame accumulation cap at 100ms, first delta discard after focus/visibility loss/resume/restart, no catch-up, and advancement only while playing and focused plus visible. Run focused tests and confirm failure for missing or incorrect behavior.
2. Implement deterministic timestamp clock with injectable RAF/cancel functions as needed. It may use RAF directly with Pixi `autoStart:false`; render explicitly once per frame. Dispose cancels RAF/listeners.
3. Write input tests covering non-repeating Space, held latch until keyup, blur clearing, active-game-only `preventDefault`, and focused native button Space activation. Start/restart focus game region. Run focused tests and confirm failure for missing or incorrect behavior.
4. Implement no pause button. Blur/visibility loss freezes clock and shows paused indication; return resumes without catch-up.
5. Session tests inject fake renderer factory for startup rejection, error presentation, fresh start/restart, HUD/reason overlays, focus/visibility, and disposal. Never initialize WebGL in jsdom.
6. Implement narrow renderer interface (`render(state)`, `destroy()`), simulation authority, renderer reuse on restart, and clock/input reset.
7. Implement the minimum behavior, rerun each focused test and expect PASS, then run `pnpm test`, `pnpm run lint`, and `pnpm run build` and expect PASS.

## Task 5: Pixi renderer and shell

**Files:** Create `src/render/pixi-renderer.ts`; modify `src/main.ts`, `src/style.css`.

1. Implement `new Application()` then awaited `app.init({width:960,height:540,resolution:1,antialias:false,autoStart:false,background:navy,preference:'webgl'})`; use `app.canvas` only after init. Handle async startup errors.
2. Keep persistent Graphics entities. Use Pixi v8 shape-then-fill API; never allocate Graphics per frame or use external textures. Render navy `#101827`, cream ship, amber `#e8a443` towers, red danger line; add stepped pixel ship, window cutouts, and minimal static stars only.
3. Renderer exposes `render(state)` and `destroy()`. Session owns overlays, score, instructions, start/game-over/restart, paused state, and error screens.
4. Ensure fixed loop cancels listeners/RAF/resources on dispose/HMR; restart reuses renderer. No resizeTo or world-coordinate resizing.
5. TDD check: `pnpm test`, `pnpm run lint`, `pnpm run build`.

## Task 6: Final browser verification and documentation

**Files:** Create `README.md`.

1. Add README controls, requirements, `pnpm install`, `pnpm run dev`, `pnpm test`, `pnpm run lint`, `pnpm run build`, and `pnpm run preview`.
2. Run individually: `pnpm test` (Vitest run), `pnpm run lint` (eslint .), `pnpm run build` (tsc --noEmit and vite build), `pnpm run dev`, and `pnpm run preview` as applicable. Commands must be individually rtk-prefixed; no chained commands.
3. Browser smoke with local app: verify start/render/score, Space does not scroll, held Space ignored, wrap/bomb/tower score, blur freeze and return, natural game-over/restart, and no console errors.
4. Verify responsive views at 1280x800 and 640x800. Verify renderer unsupported/error screen if safely possible; otherwise disclose browser-specific path untested.
5. Tests must cover no catch-up, both focus and visibility, keyboard repeat, bomb reset/restart, init rejection, all approved state rules, and exact expected values. Deterministic fakes exist only in tests, never production globals.
6. Record limitations: visual feel requires human playtest; no mobile controls; tune constants only after smoke and report any tuning.

## Completion constraints

Do not add files outside the listed paths, install unrelated dependencies, initialize or commit git, or alter approved architecture. Refer to `executing-plans` when implementing. Preserve the approved design/spec docs and local skills.
