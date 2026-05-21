import type { RadialDialTheme } from './types';

/**
 * Theme presets. Each defines paper / ink / accent and the typographic
 * voice. Everything else in the dial derives from these via color-mix().
 *
 * To add a theme, follow the rule: ONE accent hex, three roles
 * (paper background, ink foreground, accent for state/glow). Keep the mood
 * intentional — the dial inherits its personality from the theme.
 */

const SERIF_STACK =
  '"Iowan Old Style", "Apple Garamond", "Hoefler Text", Garamond, Georgia, serif';
const MONO_STACK =
  '"SF Mono", "SFMono-Regular", Menlo, Monaco, "Cascadia Code", ui-monospace, Consolas, monospace';

/** Subtle paper grain (4% darken) — applied as a background-image. */
const PAPER_NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0.12 0 0 0 0 0.10 0 0 0 0 0.08 0 0 0 0.05 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

/** Subtle dark-mode grain (8% lighten). */
const BLUEPRINT_NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.5 0 0 0 0 0.7 0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

/**
 * PAPER — warm cream + ink + terracotta. Editorial drafting table.
 * Mood: deliberate, ceremonial, hand-drawn.
 */
export const PAPER_THEME: RadialDialTheme = {
  name: 'paper',
  paper: '#F2EAD9',
  ink: '#1F1B17',
  accent: '#B5573A',
  serif: SERIF_STACK,
  mono: MONO_STACK,
  noise: PAPER_NOISE,
  mode: 'light',
};

/**
 * BLUEPRINT — deep slate + warm cream + cyan-blue accent. HUD / drafting.
 * Mood: technical, precise, like a Bloomberg terminal.
 */
export const BLUEPRINT_THEME: RadialDialTheme = {
  name: 'blueprint',
  paper: '#0B0E14',
  ink: '#E8E2D4',
  accent: '#5EC4D9',
  serif: SERIF_STACK,
  mono: MONO_STACK,
  noise: BLUEPRINT_NOISE,
  mode: 'dark',
};

/**
 * GRAPHITE — neutral charcoal + bone + amber accent. Contemplative.
 * Mood: heavy paper, pencil sketch, late-evening study.
 */
export const GRAPHITE_THEME: RadialDialTheme = {
  name: 'graphite',
  paper: '#2A2622',
  ink: '#E5DCC9',
  accent: '#E8B96A',
  serif: SERIF_STACK,
  mono: MONO_STACK,
  noise: BLUEPRINT_NOISE,
  mode: 'dark',
};

export const ALL_THEMES = [PAPER_THEME, BLUEPRINT_THEME, GRAPHITE_THEME];

/**
 * Helper: build a `color-mix(in srgb, ${color} ${percent}%, transparent)` string.
 * Used everywhere we need an alpha-blended derivation of a theme color.
 */
export function mix(color: string, percent: number, base: 'transparent' | string = 'transparent') {
  return `color-mix(in srgb, ${color} ${percent}%, ${base})`;
}

/**
 * Helper: build a derived surface color by mixing two theme tokens.
 * E.g. "paper with 6% accent tint" = mixTwo(theme.paper, 94, theme.accent, 6).
 */
export function mixTwo(a: string, aPct: number, b: string, bPct: number) {
  // color-mix only takes two colors; we approximate with nested mix.
  // Result: a at aPct%, blended with (b at bPct% in a) — gives correct tint.
  return `color-mix(in srgb, ${a} ${aPct}%, ${b} ${bPct}%)`;
}

/**
 * Frosted-glass surface — the iOS "things floating above the page" look.
 *
 * Returns the four CSS pieces that, together, read as glass:
 *   1. `background` — a translucent fill so the blurred backdrop shows through
 *   2. `backdropFilter` — blur + saturate(180%) so colours behind stay vivid
 *   3. `border` — a faint bright edge (glass rim)
 *   4. `glassShadow` — soft drop shadow + an inset top-edge specular highlight
 *      (the bit that makes it look like it's catching light). Compose it with
 *      any accent glow you want: `boxShadow: [g.glassShadow, myGlow].join(',')`.
 *
 * `fill` defaults to the theme's paper; pass `theme.accent` (with a lower
 * `alpha`) for an accent-tinted glass (e.g. a homed/selected option).
 */
export function glassSurface(
  theme: RadialDialTheme,
  opts: { fill?: string; alpha?: number; blur?: number } = {},
): {
  background: string;
  backdropFilter: string;
  WebkitBackdropFilter: string;
  border: string;
  glassShadow: string;
} {
  const isLight = theme.mode === 'light';
  const fill = opts.fill ?? theme.paper;
  const alpha = opts.alpha ?? (isLight ? 55 : 36); // % opacity of the fill
  const blur = opts.blur ?? 14;
  // Specular rim + soft drop. Light themes catch a white top edge; dark
  // themes use a softer white highlight + deeper drop for depth.
  const glassShadow = isLight
    ? `0 8px 26px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.65)`
    : `0 10px 30px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.12)`;
  // Light-catch — a soft bright sheen painted ON TOP of the translucent fill
  // (backdrop blur sits behind both). The gradient ORIGIN tracks the cursor
  // via the --rd-sheen-x/y custom properties (set on the dial root), so the
  // highlight slides across every pane like a single directional light source
  // moving with the pointer. Falls back to a fixed top-left catch (28% 4%)
  // before the first pointer move / under reduced motion. This is the detail
  // that makes a pane read as "glass catching light" rather than "blurred div".
  const sheen = isLight ? 0.4 : 0.13;
  return {
    background: `radial-gradient(135% 95% at var(--rd-sheen-x, 28%) var(--rd-sheen-y, 4%), rgba(255,255,255,${sheen}) 0%, rgba(255,255,255,0) 46%), color-mix(in srgb, ${fill} ${alpha}%, transparent)`,
    backdropFilter: `blur(${blur}px) saturate(180%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(180%)`,
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)'}`,
    glassShadow,
  };
}
