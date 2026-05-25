# radial-dial

> Press, draw a line, release. A hierarchical marking-menu component for React.

A radial dial is a fast, gestural way to navigate nested choices. Press the root, drag toward an option to commit it, then keep drawing to commit the next level — the path traces an ink line you can see, undo, and re-route. Tap also works. Drop the component in, give it a tree of options, and listen for `onChange` / `onComplete`.

```
press ▶ draw ▶ release
   │      │       │
   │      │       └─ onComplete fires with the full path
   │      └─ commits happen as you cross each option's threshold
   └─ root opens, fan appears
```

## Install

```bash
npm install @mikeishiring/radial-dial framer-motion
```

Peer deps: `react >= 18`, `react-dom >= 18`, `framer-motion >= 10`.

## Quick start

```tsx
import { RadialDial, PAPER_THEME, type DialNode } from '@mikeishiring/radial-dial';

const tree: DialNode = {
  id: 'root',
  label: 'jobs',
  children: [
    {
      id: 'role',
      label: 'role',
      children: [
        { id: 'eng', label: 'engineering', share: 0.4 },
        { id: 'pm', label: 'product', share: 0.18 },
        { id: 'des', label: 'design', share: 0.08 },
      ],
    },
    {
      id: 'salary',
      label: 'salary',
      children: [
        { id: 's1', label: '$60–100k', share: 0.35 },
        { id: 's2', label: '$100–150k', share: 0.32 },
        { id: 's3', label: '$150k+', share: 0.21 },
      ],
    },
  ],
};

export function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <RadialDial
        tree={tree}
        theme={PAPER_THEME}
        total={28_400}
        countLabel="jobs"
        onComplete={(payload) => console.log('chose:', payload)}
      />
    </div>
  );
}
```

## Themes

Three presets ship out of the box:

| Theme | Mode | Mood |
|---|---|---|
| `PAPER_THEME` | light | Editorial drafting table — cream + ink + terracotta |
| `BLUEPRINT_THEME` | dark | Bloomberg-terminal HUD — slate + cream + cyan |
| `GRAPHITE_THEME` | dark | Late-evening study — charcoal + bone + amber |

```tsx
import { BLUEPRINT_THEME } from '@mikeishiring/radial-dial';
<RadialDial tree={tree} theme={BLUEPRINT_THEME} />
```

Or write your own — a theme is one accent hex, one paper, one ink, and the typography stacks. Everything else derives from those via `color-mix()`.

## Props

```ts
type RadialDialProps = {
  tree: DialNode;
  theme?: RadialDialTheme;       // default: PAPER_THEME
  title?: string;                // optional top-left label
  hint?: string;                 // italic serif hint
  formatCount?: (n: number) => string;
  countLabel?: string;           // word after the count (e.g. "jobs")
  total?: number;                // if provided, computes a narrowing count
  toolbar?: React.ReactNode;     // slot for additional UI top-right
  flowMode?: DialFlowMode;       // 'radial' | 'right-flow' | 'left-flow' | 'down-flow'
  onChange?: (payload: DialPathPayload) => void;
  onComplete?: (payload: DialPathPayload) => void;
  onApply?: (payload: DialPathPayload) => void;
  applyLabel?: string;
};
```

`flowMode` changes the geometry without changing the gesture engine:

- `radial` — centered compass layout.
- `right-flow` — main anchor sits left; every level opens to the right.
- `left-flow` — main anchor sits right; every level opens to the left.
- `down-flow` — main anchor sits high; options stack downward.

Committed paths stay editable. Click a breadcrumb word or press `Escape` to
walk back one level, then choose another option. When `onApply` is provided,
the Apply CTA emits the current path without forcing consumers to treat every
intermediate refinement as final.

## What's special

- **Marking menu, not radial menu.** The path is the gesture. Drag traces an ink line you can see, undo (drag back), or re-route (commit, then redirect).
- **Three sacred easings** — overshoot, smooth-out, expo-out — applied consistently, asymmetric timing (entrance slower than exit). The dial feels like one thing because it moves like one thing.
- **Color via `color-mix()`** — one accent hex per theme generates all derivations (fills, hovers, glows, borders). No palette duplication.
- **Live count projection.** When `total` is set and `share` is on the children, the readout shows what the count would be on commit.
- **Honors `prefers-reduced-motion`** automatically.

## The gesture engine, standalone

If you want the press/drag/commit/undo state machine without the rendering, use `useRadialDial`:

```tsx
import { useRadialDial } from '@mikeishiring/radial-dial';

function MyOwnDial() {
  const dial = useRadialDial({
    tree,
    commitDistance: 158,
    fanRadius: 196,
  });
  // dial.path, dial.phase, dial.activeEntry, dial.homed
  // dial.onPointerDown, dial.onPointerMove, dial.onPointerUp
  // dial.selectChild, dial.popToLevel, dial.reset
  // ...
}
```

## Geometry tokens

For composing your own surface against the same grammar:

```ts
import {
  OPTION_DIAMETER,    // 112
  ACTIVE_DIAMETER,    // 68
  SETTLED_DIAMETER,   // 64
  FAN_RADIUS,         // 196
  COMMIT_DISTANCE,    // 158
  OVERSHOOT,          // [0.34, 1.56, 0.64, 1]
  SMOOTH_OUT,         // [0.22, 1, 0.36, 1]
  EXPO_OUT,           // [0.19, 1, 0.22, 1]
} from '@mikeishiring/radial-dial';
```

## Development

```bash
npm install
npm run example      # vite dev server at :5173 with the demo page
npm run test         # focused geometry tests
npm run typecheck    # tsc --noEmit
npm run build        # outputs dist/ with ESM + CJS + .d.ts
npm run verify       # test + typecheck + build, used by CI
```

## Project

The standalone project lives at
[github.com/Mikeishiring/radial-dial](https://github.com/Mikeishiring/radial-dial).

- [Roadmap](./docs/ROADMAP.md) — expansion path from extraction to durable package.
- [Contributing](./CONTRIBUTING.md) — local workflow, PR expectations, API bias.
- [Water UI/UX charter](https://github.com/Mikeishiring/radial-dial/issues/1) —
  active GitHub planning issue.

## Status & roadmap

`v0.1.0` — first public extraction from a host app. API stable enough to use, but not yet 1.0.

Active work tracked on the **Water UI/UX** milestone — improvements that make the gesture feel like water finding level. See [open issues](https://github.com/Mikeishiring/radial-dial/issues).

## License

MIT — see [LICENSE](./LICENSE).
