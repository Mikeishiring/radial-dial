// Public API of @mikeishiring/radial-dial.
//
// Surface kept intentionally small. Two ways to use this library:
//
//   1. <RadialDial tree={tree} theme={PAPER_THEME} onComplete={...} />
//      The default. One component, sensible defaults, drop in.
//
//   2. const dial = useRadialDial({ tree, ... })
//      The gesture engine alone — bring your own bubbles and ink.
//      For consumers who want to render the dial differently while
//      reusing the press/drag/commit/undo state machine.
//
// All numeric tokens (FAN_RADIUS, OPTION_DIAMETER, OVERSHOOT, etc.) are
// also exported in case you want to compose against the same grammar.

export { RadialDial } from './components/radial-dial/RadialDial';
export type { RadialDialProps } from './components/radial-dial/RadialDial';

export {
  useRadialDial,
  usePrefersReducedMotion,
  clampToStage,
  placeChildren,
} from './components/radial-dial/useRadialDial';

export type {
  DialNode,
  DialPathEntry,
  DialPathPayload,
  DialPhase,
  FrozenStroke,
  InkPoint,
  RadialDialTheme,
  Vec,
} from './components/radial-dial/types';

export {
  PAPER_THEME,
  BLUEPRINT_THEME,
  GRAPHITE_THEME,
  ALL_THEMES,
  mix,
  mixTwo,
  glassSurface,
} from './components/radial-dial/themes';

export {
  OPTION_DIAMETER,
  ACTIVE_DIAMETER,
  SETTLED_DIAMETER,
  FAN_RADIUS,
  COMMIT_DISTANCE,
  OVERSHOOT,
  SMOOTH_OUT,
  EXPO_OUT,
} from './components/radial-dial/geometry';
