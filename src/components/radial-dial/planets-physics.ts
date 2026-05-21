import type { DialNode, Vec } from './types';

/**
 * Planetary physics — the pure math behind PlanetaryTrail.
 *
 * Kept separate from the component (planets.tsx) so it can be tuned and
 * unit-tested in isolation, and so React Fast Refresh works cleanly on the
 * component (a module that mixes components + plain functions can't hot-reload).
 *
 * This file is the "personality" of the solar system: orbital shapes and the
 * gravitational vicinity response. Tune here.
 */

export type PlanetEntry = {
  node: DialNode;
  pos: Vec;
  isRoot: boolean;
};

/** The sunflower-seed spacing constant — keeps neighbours' phases out of sync. */
const GOLDEN_ANGLE = 2.399963; // radians

/** Max px a planet leans toward a neighbour at full field strength.
 *  Kept modest so the vicinity lean stays readable without pulling a planet
 *  off the ink line that connects to its anchor. */
export const MAX_LEAN = 6;

/**
 * Orbital parameters — deterministic per index, so a planet keeps the same
 * "year" across re-renders. The sun (i=0) barely drifts; outer planets swing
 * wider and faster.
 */
export function orbitParams(i: number): {
  radiusX: number;
  radiusY: number;
  period: number;
  phase: number;
} {
  // Amplitude is deliberately small: the ink trail connects to the planets'
  // ANCHOR positions, so a wide orbit would visibly detach a planet from its
  // ink. These radii keep each planet drifting *within* its own glow halo, so
  // the trail reads as "gently alive" without breaking the line connection.
  const base = i === 0 ? 1.5 : 3.5 + (i % 3) * 1.5; // px → sun ~1.5, planets 3.5/5/6.5
  const radiusX = base;
  const radiusY = base * (0.55 + (i % 2) * 0.3); // squashed ellipse
  const period = (i === 0 ? 16000 : 7000) + ((i * 1700) % 6000); // ms ("year")
  const phase = i * GOLDEN_ANGLE;
  return { radiusX, radiusY, period, phase };
}

/**
 * GRAVITATIONAL VICINITY — the personality knob.
 *
 * Given the LIVE distance between two adjacent planets and their REST distance
 * (their anchor spacing), return a 0..1 "field strength". High strength →
 * brighter glow between them AND a stronger lean toward each other.
 *
 * Default is an inverse-square-ish falloff (real-gravity feel): the field
 * swells as planets approach, fades as they part. Shape this to taste:
 *   - Linear  `Math.max(0, 1 - distance / restDistance)` → gentle, even.
 *   - Inverse-square (default) → dramatic near-field, quiet far-field.
 *   - Threshold `distance < restDistance * 0.7 ? 1 : 0` → snappy "lock" when close.
 * Keep the result in [0, 1].
 */
export function vicinity(distance: number, restDistance: number): number {
  const falloff = restDistance * 0.6;
  const v = 1 / (1 + (distance / falloff) ** 2);
  return Math.max(0, Math.min(1, v));
}
