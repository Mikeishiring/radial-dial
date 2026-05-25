# Contributing

`radial-dial` is a small React component library. The project values gesture
quality, a narrow API, and production usability over broad feature count.

## Local Development

```bash
npm install
npm run example
```

The example app is the primary place to validate interaction feel. Library code
lives under `src/components/radial-dial`.

## Verification

Run this before opening a pull request:

```bash
npm run verify
```

`verify` typechecks and builds the package. If a change affects gesture logic,
also test press, drag, commit, undo, reroute, tap selection, keyboard focus, and
small viewport behavior in the example app.

## Pull Request Shape

- State the user-facing change first.
- Call out any public API changes.
- Include manual interaction notes for gesture or visual changes.
- Link the issue when the work maps to an existing Water UI/UX task.
- Keep generated output out of the PR unless preparing a release.

## Public API Bias

Prefer improving the internals or existing extension points before adding props.
When a new prop is needed, document it in `README.md`, export any new public
types from `src/index.ts`, and update the example app so the behavior is visible.
