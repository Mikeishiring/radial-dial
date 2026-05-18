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
