# Roadmap

This is the expansion track for making `@mikeishiring/radial-dial` a durable
standalone project rather than a one-off extraction from Web3 Jobs.

## Current State

- Standalone public GitHub repo: `https://github.com/Mikeishiring/radial-dial`
- Package name: `@mikeishiring/radial-dial`
- Library build: Vite, TypeScript, ESM, CJS, declaration output
- Example app: Vite React demo under `example/`, including flow-mode test bench
- Active GitHub charter: Water UI/UX issue set

## Expansion Priorities

### 1. Stabilize The Project Surface

Make the repo easy to work on repeatedly.

- Keep `npm run verify` green on every branch.
- Use the GitHub PR template for manual interaction notes.
- Keep docs aligned with the actual public API.
- Avoid committing `dist/` except for release preparation.

### 2. Make The Gesture Engine Trustworthy

The engine is the product core. This is the highest leverage technical work.

- Add focused tests for `placeChildren`, count projection, path commit, undo, and
  reroute behavior.
- Keep layout-mode tests for radial, left-to-right, right-to-left, and downward
  option flow.
- Split pure geometry/state transitions out of React hook plumbing where it
  materially improves testability.
- Resolve the existing `bumpRender` refactor issue after tests protect the
  current behavior.

### 3. Turn The Example Into A Product Lab

The example should prove adoption scenarios, not just decorate the package.

- Add compact, realistic recipes: filters, command palette, media controls, and
  mobile one-hand selection.
- Keep the main demo dense enough to inspect real gesture behavior.
- Record manual QA notes for desktop pointer, touch, keyboard, and reduced
  motion.

### 4. Package For Adoption

Make it clear how another app should depend on this package.

- Document browser and React peer dependency assumptions.
- Add API examples for controlled completion flows and custom rendering with
  `useRadialDial`.
- Decide whether CSS should remain opt-in through `styles.css` or be bundled by
  default in a later minor version.

### 5. Prepare A 1.0 Line

Do this only after the engine and example have carried a few real use cases.

- Freeze the public type names.
- Publish a migration note from `0.x` to `1.0`.
- Cut a short screen capture that demonstrates the gesture without narration.

## Non-Goals

- Rebuilding Web3 Jobs inside this repo.
- Expanding the taxonomy of a host app.
- Adding broad UI-kit primitives that are not part of the dial.
- Chasing visual effects that do not improve selection speed, confidence, or
  composure.
