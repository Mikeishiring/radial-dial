# Agent Instructions

Choose quality over speed. Choose meaningful product progression over testing,
vanity metrics, or theatre work.

This repository is the canonical standalone home for `@mikeishiring/radial-dial`.
Do not move the project back into a host app unless the user explicitly asks.

## Product Direction

- Treat the dial as a reusable React component library first, and the example app
  as the place to prove feel, ergonomics, and API clarity.
- Favor changes that make the gesture engine more reliable, composable, and easy
  to adopt in real products.
- Keep the public API small. Add props only when they unlock a real consumer use
  case that cannot be handled with the current tree, theme, callback, or toolbar
  extension points.
- Protect the gesture feel: press, draw, commit, undo, and reroute should read as
  one continuous interaction.

## Engineering Rules

- Keep edits scoped to the library, example, docs, or project setup needed for
  the ask.
- Preserve user edits in the working tree. If local changes already exist, read
  them before modifying the same files.
- Run `npm run verify` before considering a change ready when package files or
  source files are touched.
- Do not commit generated `dist/` files unless the user asks for a release or
  package-publish preparation.
- Use the GitHub issue labels already present in the repo when creating or
  organizing work.

## Useful Commands

```bash
npm install
npm run example
npm run typecheck
npm run build
npm run verify
```
