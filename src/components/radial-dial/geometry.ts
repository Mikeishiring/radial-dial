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
//
// SIZE RELATIONSHIPS (intentional, do not break casually):
//   - OPTION_DIAMETER (112) > ACTIVE_DIAMETER (68) > SETTLED_DIAMETER (64)
//   - The 4px gap between active and settled is visually subtle — settled
//     nodes read as "active, but quieter" rather than as a different shape
//   - Option diameter is ~1.65× active so the destination feels meaningfully
//     bigger than the current position (the user is moving toward something)
// =============================================================================

/**
 * Diameter of the always-visible option bubbles (largest size in the dial).
 * Drives: bubble hit-testing, IdleGhost/OptionBubble layout, perimeter dots.
 * Changing this: also requires re-checking FAN_RADIUS so options don't overlap
 * each other on the fan circumference.
 */
export const OPTION_DIAMETER = 112;

/**
 * Diameter of the active "you are here" bubble.
 * Drives: ActiveBubble layout, ink trim radius at the active end.
 * Changing this: ACTIVE_TRIM_RADIUS auto-derives, but visual hierarchy with
 * options (currently 1.65× larger) will shift.
 */
export const ACTIVE_DIAMETER = 68;

/**
 * Diameter of past-path settled bubbles (smallest, quiet markers).
 * Drives: SettledNode layout, ink trim radius at settled ends.
 * Changing this: smaller values make the trail recede further; larger
 * values make settled nodes compete with the active bubble for attention.
 */
export const SETTLED_DIAMETER = 64;

/**
 * Distance from active to options around the fan, in stage pixels.
 * Drives: placeChildren math, idle option layout, sub-menu preview spacing.
 * Changing this: tightening below ~150 causes bubbles to crowd; widening
 * past ~240 makes drag gestures feel unnaturally long.
 *
 * Note: RadialDial.tsx scales this by a `stageScale` factor on small
 * viewports — see computeStageScale() there. Issue #291.
 */
export const FAN_RADIUS = 196;

/**
 * How far the cursor must travel from active before the closest child commits.
 * Drives: useRadialDial hysteresis math, magnetic pull threshold.
 * Changing this: should stay below FAN_RADIUS (currently 80% of it) so
 * commits fire BEFORE the cursor reaches the bubble — gives the "magnetic"
 * pull feel where the option seems to grab the cursor.
 *
 * The ratio COMMIT_DISTANCE / FAN_RADIUS ≈ 0.8 is the magnetic-grab window;
 * adjusting it changes how confident vs hesitant the dial feels.
 */
export const COMMIT_DISTANCE = 158;

// =============================================================================
// INK GEOMETRY
//
// The ink trail traces the cursor's path between commits. Width modulates
// with velocity (decisive motion = thicker, orbital exploration = thinner).
// Trim radii clip the ink at bubble perimeters so the line connects edges,
// not centres — gives a flowchart-edge feel.
// =============================================================================

/**
 * Base stroke width of ink, in pixels. Each rendered segment multiplies
 * this by a velocity-confidence curve (0.55× at orbital speeds to ~1.55×
 * at decisive speeds).
 */
export const INK_BASE_WIDTH = 1.6;

/**
 * How long ink "settling" (initial thicken-then-relax) lasts after a freeze.
 * Lower = snappier ink lay-down; higher = more ceremonial. Pairs with
 * eased() below to produce a cubic ease-out interpolation.
 */
export const SETTLE_DURATION_MS = 320;

/**
 * Trim radii — clip leading/trailing ink so the line touches each bubble's
 * PERIMETER cleanly (not centre, not floating outside). The −2 lets the ink
 * overlap the bubble outline by a hair so the connection visually completes
 * without a gap.
 * Derived from DIAMETER constants so they stay in sync if those change.
 */
export const ACTIVE_TRIM_RADIUS = ACTIVE_DIAMETER / 2 - 2;
export const SETTLED_TRIM_RADIUS = SETTLED_DIAMETER / 2 - 2;

// =============================================================================
// MOTION GRAMMAR — the three sacred easings.
//
// Reuse exactly these tokens for ALL transitions. Don't introduce new easing
// curves locally; if the dial needs a new feel, name a fourth here and use it
// uniformly. Consistency of motion is what makes the page feel like one thing.
//
// PICK BY INTENT:
//   - Things ARRIVING that should feel alive   → OVERSHOOT
//   - Things SETTLING into place                → SMOOTH_OUT
//   - Things SHOOTING and then trailing        → EXPO_OUT
//
// Asymmetric timing rule: entrances slower than exits (e.g. 300ms in,
// 200ms out). The asymmetry makes the dial feel deliberate on appear,
// crisp on dismiss.
// =============================================================================

/**
 * OVERSHOOT — snappy entrance with a touch of overshoot.
 * Used for: popups, bubbles arriving, badges, the Apply CTA entrance.
 * Cubic-bezier [0.34, 1.56, 0.64, 1] — second control point past 1 creates
 * the overshoot/bounce-back feel without being aggressive.
 */
export const OVERSHOOT = [0.34, 1.56, 0.64, 1] as const;

/**
 * SMOOTH_OUT — smooth glide-out, never overshoots.
 * Used for: position changes, calm transitions, hover/focus rings, exits.
 * Cubic-bezier [0.22, 1, 0.36, 1] — classic ease-out shape.
 */
export const SMOOTH_OUT = [0.22, 1, 0.36, 1] as const;

/**
 * EXPO_OUT — fast initial drop, gentle tail.
 * Used for: particle bursts, ink draw-in, ripples, ApplyButton entrance.
 * Cubic-bezier [0.19, 1, 0.22, 1] — steeper initial slope than SMOOTH_OUT,
 * giving things a "rocket out then coast" quality.
 */
export const EXPO_OUT = [0.19, 1, 0.22, 1] as const;

/**
 * Per-bubble bloom stagger (ms) — bigger gap between siblings = unfurling feel.
 * Used by OptionBubble entry animations. Multiplied by index.
 */
export const BLOOM_STAGGER_MS = 70;

/**
 * Magnetic option pull strength — how much a homed option reaches toward
 * the cursor. 0 = no pull (options stay rigid on the fan); 1 = option
 * fully tracks cursor (too aggressive, breaks radial geometry).
 * 0.32 is the sweet spot — feels alive without distorting layout.
 */
export const MAX_OPTION_PULL = 0.32;

/**
 * Tiny easing helper — cubic ease-out, matches SMOOTH_OUT's cubic curve.
 * Used for non-Framer interpolation (e.g. ink settling animation, where
 * we control the animation frame loop directly).
 */
export function eased(t: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}
