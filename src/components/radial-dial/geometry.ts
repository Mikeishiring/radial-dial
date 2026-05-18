/**
 * Geometry — the dial's physical dimensions and motion grammar.
 *
 * Single source of truth for sizes, radii, distances, and easings used
 * across the radial dial modules. If a number is named here, every module
 * imports it from here. If a number is private to one module (e.g. a
 * bubble's internal padding), it stays inline.
 *
 * Why a shared file: extracted modules (atmosphere, chrome, ink-layers)
 * would otherwise duplicate the easing tokens and trim radii. One file,
 * one source of truth, one place to retune the whole feel.
 */

// =============================================================================
// PHYSICAL DIMENSIONS
//
// Inverted size hierarchy: options (the destinations) are big and inviting;
// the active node (current "you are here") shrinks to a smaller, calmer size;
// settled past nodes are smaller still, marking the trail without competing.
// The chosen option *becomes* the active by springing DOWN from option-size.
// =============================================================================

/** Diameter of the always-visible option bubbles (largest). */
export const OPTION_DIAMETER = 112;
/** Diameter of the active "you are here" bubble. */
export const ACTIVE_DIAMETER = 68;
/** Diameter of past-path settled bubbles (smallest, quiet markers). */
export const SETTLED_DIAMETER = 64;
/** Distance from active to options around the fan. */
export const FAN_RADIUS = 196;
/** How far the cursor must travel from active before the closest child commits. */
export const COMMIT_DISTANCE = 158;

// =============================================================================
// INK GEOMETRY
// =============================================================================

/** Base stroke width of ink (multiplied per segment by velocity curve). */
export const INK_BASE_WIDTH = 1.6;
/** How long ink "settling" (initial thicken-then-relax) lasts after a freeze. */
export const SETTLE_DURATION_MS = 320;
/**
 * Trim radii — clip leading/trailing ink so the line touches each bubble's
 * PERIMETER cleanly (not centre, not floating outside). The −2 lets the ink
 * overlap the bubble outline by a hair so the connection visually completes.
 */
export const ACTIVE_TRIM_RADIUS = ACTIVE_DIAMETER / 2 - 2;
export const SETTLED_TRIM_RADIUS = SETTLED_DIAMETER / 2 - 2;

// =============================================================================
// MOTION GRAMMAR — the three sacred easings.
//
// Reuse exactly these tokens for ALL transitions. Don't introduce new easing
// curves locally; if the dial needs a new feel, name a fourth here and use it
// uniformly. Consistency of motion is what makes the page feel like one thing.
// =============================================================================

/** Snappy entrance with overshoot — popups, bubbles arriving, badges. */
export const OVERSHOOT = [0.34, 1.56, 0.64, 1] as const;
/** Smooth glide-out — position changes, calm transitions. */
export const SMOOTH_OUT = [0.22, 1, 0.36, 1] as const;
/** Fast initial drop, gentle tail — particle bursts, ink draw-in. */
export const EXPO_OUT = [0.19, 1, 0.22, 1] as const;

/** Per-bubble bloom stagger (ms) — bigger gap between siblings = unfurling feel. */
export const BLOOM_STAGGER_MS = 70;
/** Magnetic option pull strength — how much a homed option reaches toward cursor. */
export const MAX_OPTION_PULL = 0.32;

/**
 * Tiny easing helper — cubic ease-out, matches SMOOTH_OUT cubic curve.
 * Used for non-Framer interpolation (e.g. ink settling animation).
 */
export function eased(t: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}
