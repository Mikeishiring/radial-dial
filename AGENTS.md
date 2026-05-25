# AGENTS.md

This repository is a design/interaction primitive, not an application product.

`@mikeishiring/radial-dial` is a reusable React component and gesture engine for hierarchical marking-menu interactions: press, drag, commit, undo, re-route. Keep the repo focused on the primitive, the demo surface, API ergonomics, accessibility, motion, and packaging.

Do not merge product-specific concepts into this repo. Sorting Hat, Shape Onboarding, candidate search, routing marks, cohort profiles, and onboarding exports should consume or learn from this primitive rather than live here.

When changing the component:

- Preserve the public API unless there is a clear primitive-level reason to change it.
- Keep labels generic and tool-oriented.
- Verify `npm run typecheck` and `npm run build`.
- Use the example app only to demonstrate the primitive.
