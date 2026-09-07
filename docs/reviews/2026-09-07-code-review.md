# Skyline Bomber — Code Review

**Date:** 7 September 2026
**Reviewer:** AI-assisted review (frog code review skill)
**Mode:** Review only. No code was changed as part of this review.

## 1. Review scope

Whole-project review of the current working tree:

- Simulation: `src/game/{config,types,simulation}.ts`
- Browser shell: `src/browser/{clock,input,session,audio,high-scores}.ts`, `src/main.ts`
- Rendering: `src/render/{pixi-renderer,particle-system,crt-filter}.ts`
- Shell markup/styles: `index.html`, `src/style.css`
- Tooling: `package.json`, `tsconfig.json`, `eslint.config.js`, `vite.config.ts`
- Tests: all eight files under `tests/`
- Documentation: `README.md`, `docs/retro-game-spec.md`,
  `docs/superpowers/specs/2026-09-06-retro-tower-design.md`,
  `docs/plans/2026-09-06-retro-tower-game.md`

Not reviewed: commit history or PR hygiene — the project is not yet a Git
repository, so there is no diff or commit series to assess.

## 2. Context used

**Intent.** A retro browser game (PixiJS 8, strict TypeScript, Vite) with a
deterministic fixed-step simulation kept free of PixiJS/DOM imports, and
browser/session, rendering, particles and audio behind narrow interfaces.
The design spec and implementation plan in `docs/` are the intent SSOT; they
were used to judge whether the code does what was agreed.

**Repository-specific review guidance.** None found. There is no
`CONTRIBUTING.md`, `AGENTS.md`, `.github/`, or `docs/engineering/`
directory, and no coverage policy is defined. The bundled shared checklist
(PR hygiene, correctness, tests, security, performance/reliability,
maintainability, architecture, docs/ops, UX/a11y) is therefore the baseline,
with the project's own specs acting as the local standard for behaviour.

**Verification performed for this review.** `pnpm test` (45 tests, 8 files)
and `pnpm run lint` both pass on the current tree. A coverage run was
attempted but `@vitest/coverage-v8` is not installed, so no coverage figures
are available (see §6). Earlier browser smoke runs of the production build at
1280×800 and 640×800 showed no console or shader errors.

## 3. Overall assessment

**Merge-ready with recommended follow-ups. Low risk.**

The core is sound: the simulation is pure, deterministic and well tested; the
boundaries the design spec asks for are respected in practice, not just on
paper; resource lifecycles (clock, input, renderer, audio, filter) are
disposed cleanly. Nothing found rises to *blocking*. The recommended items
below are about robustness at the edges (audio failure handling, input
modifiers, accessibility of the game-over flow), a handful of test gaps, and
tooling hygiene (formatter, coverage, engines/CI).

## 4. What works well

- **Clean layering.** `src/game/simulation.ts` imports only `config` and
  `types`; no PixiJS or DOM. The renderer reads state and effect events and
  makes no gameplay decisions. This is exactly the architecture the design
  spec commits to, and it is what makes the test suite fast and deterministic.
- **Effect events as the seam.** Gameplay authors `GameEffect`s with monotonic
  ids; particles and audio each deduplicate by `(runId, id)`. It is a simple,
  robust way to drive presentation without coupling, and the 32-event cap
  bounds memory.
- **Analytical bomb integration.** Using the closed-form displacement for
  exponential horizontal drag (`v·(1−e^(−k·dt))/k`) and constant-acceleration
  vertical motion, combined with a swept segment-vs-AABB test, avoids both
  integration drift and tunnelling. The exact-value tests lock this in.
- **Fixed-step clock with pause-safe semantics.** `FixedStepClock` caps a live
  frame at 100 ms, discards the first delta after pause/reset, and never
  catches up after focus loss. The tests cover each of those behaviours.
- **Bounded, pooled particles** with an oldest-eviction fallback and a
  Node-testable core; the CRT filter's time logic is likewise extracted
  (`advanceCrtTime`) so it can be unit tested without WebGL.
- **Strict compiler settings** (`strict`, `noUncheckedIndexedAccess`,
  `noUnusedLocals/Parameters`, `verbatimModuleSyntax`) and exactly pinned
  dependencies with a lockfile.
- **Documentation discipline.** Each feature landed with spec, design, plan
  and README updates, and the plan records superseded requirements rather
  than silently rewriting them.

## 5. Findings by severity

### Blocking

None.

### Recommended

**R1. A single failed `audio.play` permanently disables sound.**
`src/browser/session.ts` → `routeAudio`: any exception from `audio.play`
calls `reportAudioFailure`, which sets `audioUnavailable = true` for the rest
of the session and shows "Sound unavailable". A transient failure (e.g. a
Web Audio node limit hit during a burst) therefore mutes the game for good,
even though the context is still running. Consider treating `play` failures
as per-effect (log, skip that effect, continue) and reserving the permanent
flag for `resume()` failures.

**R2. Effects emitted before audio finishes resuming are replayed in a burst.**
`routeAudio` only advances `lastAudioEffectId` once `audioReady` is true. On
the first Start the context resumes asynchronously; any effects emitted in
the interim are all played on the same tick when `resume()` settles. In
practice this is one or two sounds, but it is worth either discarding effects
older than the activation moment or capping the catch-up to the most recent
effect per type.

**R3. Keyboard shortcuts with modifiers are hijacked during play.**
`src/browser/input.ts` intercepts `Space` and `KeyB` whenever `isPlaying()`
is true and calls `preventDefault()` regardless of modifier keys. `Cmd/Ctrl+B`
(browser bookmarks bar) and `Ctrl/Alt+Space` will be swallowed mid-game.
Suggest early-return when `event.metaKey || event.ctrlKey || event.altKey`.

**R4. Game-over flow is not keyboard-first / screen-reader announced.**
`index.html` / `session.ts`: on game over, focus stays wherever it was (the
region), the restart button is not focused, and the overlay has no
`role="dialog"`/`aria-live`. A keyboard user must Tab to "Fly again"; a
screen-reader user gets no announcement of the reason. Suggest focusing
`restartButton` when status transitions to `gameover` and giving the overlay
`role="alertdialog" aria-labelledby=... aria-describedby="gameover-reason"`.
Optionally accept `Space`/`Enter` on the game-over screen to restart.

**R5. High-score recording lives inside `updatePresentation`.**
`session.ts` records a completed run as a side effect of rendering and relies
on reference identity (`updatedScores !== highScores`) to decide whether to
touch the DOM. It works today, but a presentation function that mutates
session state is a boundary smell and the identity check is fragile (a sixth
non-qualifying run still produces a new array and a redundant DOM rebuild).
Suggest recording in the `step` callback when `status` becomes `gameover`
and keeping `updatePresentation` read-only.

**R6. Formatting is inconsistent and unenforced.**
All `src/**/*.ts` files are tab-indented; all `tests/**/*.ts`, `src/main.ts`,
`index.html` and `src/style.css` are space-indented; `src/render/crt-filter.ts`
mixes both (tabs for code, spaces inside shader template literals). There is
no `.editorconfig` or Prettier config, so editor format-on-save will keep
churning files. Add a formatter config (Prettier or Biome) plus
`.editorconfig`, run it once, and add a `format:check` script.

**R7. No coverage measurement or policy.**
`@vitest/coverage-v8` is not installed and no coverage thresholds exist. The
shared checklist expects hot/error paths to be measured. Add the coverage
provider, a `test:coverage` script, and a modest threshold in
`vite.config.ts` (the pure modules should already be near 100%).

**R8. Project metadata and CI.**
`package.json` has `packageManager` but no `engines.node`, despite the README
requiring Node 24.20.0; there is no `.nvmrc`/`.node-version` and no CI
workflow running `test`, `lint`, `build`. Initialise the Git repository and
add a minimal workflow so the existing checks actually gate changes.

**R9. Session module is carrying several responsibilities.**
`src/browser/session.ts` (~240 lines) orchestrates state, clock, input, audio
activation/routing, high scores, overlays and focus/visibility. The audio
router (`reportAudioFailure`/`routeAudio`/`enableAudio`) is a natural
extraction that would be independently testable and would shrink the
hardest-to-test file.

**R10. Explosion audio allocates a fresh noise buffer per hit.**
`src/browser/audio.ts` → `playExplosion` creates a new `AudioBuffer` and
fills it with `Math.random()` on every tower destruction (≈13k samples at
48 kHz). Under rapid hits this is avoidable GC churn. Pre-generate one or two
noise buffers at `resume()` time and reuse them.

**R11. ESLint is not type-aware.**
`eslint.config.js` uses `tseslint.configs.recommended`. Switching to
`recommendedTypeChecked` (with `parserOptions.projectService`) would catch
floating promises and unsafe `any` flows; the codebase already uses `void`
deliberately so the migration cost is low.

### Nit

**N1. Dead branch in the CRT fragment shader.** After the corner
normalisation (`cornerScale`), `curvedUv` can never leave `[0,1]`, so the
`finalColor = black; return;` branch is unreachable. Either remove it or keep
it with a comment stating it is defensive.

**N2. Shader hardcodes `960.0`/`540.0`.** `crt-filter.ts` duplicates
`WORLD_WIDTH`/`WORLD_HEIGHT` as literals. Pass them as a `vec2` uniform or
interpolate the constants into the template so the two cannot drift.

**N3. `timeUniforms` is misnamed** — it also holds curvature, scanline and
noise strength. `crtUniforms` would match the resource key already used.

**N4. `export { DANGER_Y }` at the bottom of `simulation.ts`** re-exports a
config constant that nothing imports from the simulation module
(`pixi-renderer.ts` imports it from `config`). Remove.

**N5. `aria-hidden="true"` on `#canvas-host` makes the canvas
`aria-label` inert.** Either drop the label or move the accessible name to
the region. Harmless, but contradictory.

**N6. `aria-live="polite"` on the score** will announce every 100-point
change to screen-reader users. Consider `aria-live="off"` on the live score
and announce only the final score on game over (see R4).

**N7. CRT test asserts on shader source substrings** (`toContain("scanline")`
etc.). This tests the text of the implementation rather than behaviour and
will break on harmless renames. Keep the `advanceCrtTime` tests; consider
dropping the string assertions or replacing them with a compile smoke test
in a browser job.

**N8. Per-particle `Graphics` instances.** `pixi-renderer.ts` creates 128
separate `Graphics` for particles. Sharing one `GraphicsContext` (or using
`Sprite`s from a single 4×4 texture) would guarantee batching and reduce
memory. Only worth doing if profiling shows draw-call pressure.

**N9. Start screen CRT noise is frozen.** The clock is inactive on the
`ready` screen so `frameSeconds` is 0 and `uTime` never advances until Start.
Cosmetic; if the static image looks odd, advance CRT time from wall-clock
delta rather than active-frame delta.

**N10. `recordHighScore` parameter type.** The `scores` parameter is
`HighScoreEntry[]` so the same reference can be returned; `readonly` in and
`readonly` out would express intent without changing behaviour.

## 6. Testing and validation gaps

The suite is strong on the simulation and shell lifecycle. Gaps observed:

| Area | Gap | Suggested test |
|---|---|---|
| `useBoost` | Status guard untested (`ready`/`gameover` should be no-ops); only the altitude guard is covered | `expect(useBoost(readyState)).toBe(readyState)` and same for `gameover` |
| `useBoost` | Spec says consecutive boosts may queue additional distance; no test fires two boosts before the first climb completes | Fire twice, assert `climbRemaining === 2 × SHIP_BOOST_CLIMB` (or clamped), then step and assert final `y` |
| Climb × wrap | No test for a lap wrap occurring mid-climb (descent 16 and climb 96 px/s interact) | Place ship at `x = 959` with `climbRemaining > 0`, step, assert `y` reflects both |
| Session | `B` key path not exercised through `createGameSession`; `#boost-count` DOM never asserted | Set `boostCharges` via a scripted run or expose a hook; press `KeyB`; assert charge decrement and DOM text |
| Session | High-score table: only a single zero-score run is asserted. No test for a second run adding a second entry, ordering, or the five-entry cap at the DOM level | Drive two natural game-overs with different scores (or inject state) and assert list order/length |
| Session | Audio `play` throwing (R1) is untested | Mock `play` to throw once; assert current behaviour, then the desired behaviour |
| Simulation | `MAX_EFFECT_EVENTS` truncation never exercised | Emit 33+ effects, assert length 32 and that ids remain monotonic |
| Renderer | `pixi-renderer.ts` has no automated coverage (requires WebGL) | Acceptable, but record the manual browser smoke steps as a checklist, or add a Playwright smoke job that asserts no console errors and canvas 960×540 |
| Coverage | No coverage provider or threshold (R7) | Add `@vitest/coverage-v8`, set a floor |

None of these gaps hides a known defect; they are places where a regression
would currently go unnoticed.

## 7. Suggested next actions

In rough priority order:

1. **Harden audio failure handling** (R1, R2) — small change in `session.ts`,
   add the throwing-`play` test.
2. **Ignore modifier-key combinations in input** (R3) — one-line guard plus a
   test.
3. **Make game over keyboard/AT friendly** (R4, N5, N6) — focus the restart
   button, add dialog semantics, tone down the live region.
4. **Lock formatting and add coverage/CI** (R6, R7, R8) — initialise Git, add
   `.editorconfig` + Prettier/Biome, install `@vitest/coverage-v8`, add
   `engines.node`, add a workflow running `test`/`lint`/`build`/`format:check`.
5. **Fill the test gaps in §6** — the `useBoost` and session-level boost/high-
   score tests are the highest value.
6. **Refactor opportunistically** (R5, R9, R10, R11) — extract the audio
   router, move high-score recording out of presentation, pre-generate noise
   buffers, enable type-aware lint.
7. **Tidy nits** (N1–N4, N7, N10) whenever the files are next touched.

## Appendix — checklist coverage

| Checklist area | Assessment |
|---|---|
| PR hygiene and scope | Not assessable (no Git history). Docs are updated alongside features — good. |
| Correctness and behaviour | Sound. Guards for NaN/≤0 deltas, terminal-state priority, clamped climbs, one-bomb rule all present and tested. |
| Tests and coverage | Good breadth on pure modules; gaps listed in §6; no coverage measurement. |
| Security | Low surface. DOM writes use `textContent` only; no secrets; deps pinned with lockfile. No concerns. |
| Performance and reliability | Bounded pools and event history; per-frame allocations acceptable; audio buffer churn (R10) minor. Clean disposal everywhere. |
| Maintainability and readability | Clear naming and small functions; `session.ts` is the one large module (R9); formatting inconsistent (R6). |
| Architecture and boundaries | Matches the design spec; simulation is genuinely pure. |
| Documentation and ops | Specs/plan/README thorough; missing `engines`, CI, formatter, LICENSE. |
| UX/UI and accessibility | Responsive layout verified; keyboard-only by design; game-over focus/announcement gap (R4). |
