import type { InkPoint, Vec } from './types';

/**
 * Ink — math for capturing, smoothing, and rendering hand-drawn paths.
 * Pure functions; no React, no DOM.
 */

/**
 * Geometry constant — ink point captures sparser than this distance get
 * merged. Larger values produce smoother curves at the cost of slight lag.
 * 9 px gives a noticeable, intentional paintbrush lag that reads as
 * deliberate ink flow rather than a stretched mouse cursor.
 */
export const MIN_POINT_DISTANCE = 9;

/** Hard cap on points per stroke to keep SVG cheap on long gestures. */
export const MAX_TRAIL_POINTS = 240;

/** Velocity (px/ms) above which we treat motion as "fast". */
export const FAST_VELOCITY = 1.4;

/** Velocity below which we treat motion as "slow / deliberate". */
export const SLOW_VELOCITY = 0.15;

/**
 * Exponential smoothing factor — 0 = raw cursor (jagged), 1 = no movement
 * (frozen). 0.55 produces a wet-paintbrush trail: the rendered ink
 * visibly lags behind the cursor by ~30-40ms, smoothing high-frequency
 * hand jitter and giving the gesture a deliberate, calibrated feel.
 */
const SMOOTH_FACTOR = 0.55;

/**
 * Append a raw point to a stroke, computing its velocity and exponentially
 * smoothing position vs. the previous point. Returns the unchanged stroke
 * if the smoothed point is too close to the last.
 *
 * The smoothed coordinates are what we render; the raw cursor is still used
 * by the engine for hit-testing so the user's actual control is unchanged.
 */
export function appendPoint(stroke: InkPoint[], rawP: Vec, t: number): InkPoint[] {
  const last = stroke[stroke.length - 1];
  if (!last) return [{ ...rawP, t, v: 0 }];
  // EMA: blend raw cursor with previous smoothed position.
  const sx = last.x + (rawP.x - last.x) * (1 - SMOOTH_FACTOR);
  const sy = last.y + (rawP.y - last.y) * (1 - SMOOTH_FACTOR);
  const dx = sx - last.x;
  const dy = sy - last.y;
  const dist = Math.hypot(dx, dy);
  if (dist < MIN_POINT_DISTANCE) return stroke;
  const dt = Math.max(1, t - last.t);
  const v = dist / dt;
  const next = { x: sx, y: sy, t, v };
  if (stroke.length >= MAX_TRAIL_POINTS) {
    return [...stroke.slice(-(MAX_TRAIL_POINTS - 1)), next];
  }
  return [...stroke, next];
}

/**
 * Concatenate a stroke into one continuous Catmull-Rom-smoothed path string.
 * Used for the "living flow" overlay — a single path that animates
 * stroke-dashoffset as a moving pulse.
 */
export function inkFullPath(points: InkPoint[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
  }
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Trim a stroke at one end so it doesn't pass through a bubble's interior.
 * Drops leading or trailing points within `radius` of the anchor — the
 * remaining stroke begins (or ends) at the bubble's perimeter, like a
 * hand-drawn flowchart edge connecting two circles.
 */
export function trimStrokeAtAnchor(
  points: InkPoint[],
  anchor: Vec,
  radius: number,
  side: 'start' | 'end',
): InkPoint[] {
  if (points.length < 2) return points;
  if (side === 'start') {
    let i = 0;
    while (i < points.length - 1 && Math.hypot(points[i].x - anchor.x, points[i].y - anchor.y) < radius) {
      i++;
    }
    return points.slice(i);
  }
  let i = points.length - 1;
  while (i > 0 && Math.hypot(points[i].x - anchor.x, points[i].y - anchor.y) < radius) {
    i--;
  }
  return points.slice(0, i + 1);
}

/**
 * Confidence score for a live stroke — combines velocity and straightness.
 *   - Velocity component: faster motion = more confident.
 *   - Straightness component: aligned consecutive velocity vectors = more
 *     confident. Wobbling/orbital motion drops alignment.
 *
 * Returns 0..1 where 0.5 is neutral. Use as a multiplier on stroke width
 * so the LINE ITSELF reflects the user's decisiveness in real time.
 */
export function strokeConfidence(points: InkPoint[]): number {
  if (points.length < 4) return 0.5;
  const recent = points.slice(-6);
  // Mean velocity (px/ms) — saturates at 0.6 for the velocity factor.
  let sumV = 0;
  for (const p of recent) sumV += p.v;
  const meanV = sumV / recent.length;
  const velocityFactor = Math.min(1, meanV / 0.6);
  // Straightness via dot product of consecutive velocity vectors.
  let alignSum = 0;
  let alignCount = 0;
  for (let i = 1; i < recent.length - 1; i++) {
    const v1x = recent[i].x - recent[i - 1].x;
    const v1y = recent[i].y - recent[i - 1].y;
    const v2x = recent[i + 1].x - recent[i].x;
    const v2y = recent[i + 1].y - recent[i].y;
    const m1 = Math.hypot(v1x, v1y);
    const m2 = Math.hypot(v2x, v2y);
    if (m1 < 0.5 || m2 < 0.5) continue;
    const dot = (v1x * v2x + v1y * v2y) / (m1 * m2);
    alignSum += Math.max(0, dot);
    alignCount++;
  }
  const straightness = alignCount > 0 ? alignSum / alignCount : 0.5;
  return Math.max(0, Math.min(1, 0.5 * velocityFactor + 0.5 * straightness));
}

/**
 * Apply a soft magnetic pull on the rendered ink endpoint toward the homed
 * child as the cursor approaches commit threshold. Subtle: max 14% pull.
 *
 * IMPORTANT: this only changes the *rendered* line, never the cursor position
 * used for hit-testing. The user's actual control is unchanged.
 */
export function applyMagneticPull(
  rawPoint: Vec,
  activePos: Vec,
  homedTarget: Vec | null,
  commitDistance: number,
): Vec {
  if (!homedTarget) return rawPoint;
  const dist = Math.hypot(rawPoint.x - activePos.x, rawPoint.y - activePos.y);
  // Pull only kicks in past 50% of the threshold and grows linearly to 100%.
  if (dist < commitDistance * 0.5) return rawPoint;
  const t = Math.min(1, (dist - commitDistance * 0.5) / (commitDistance * 0.5));
  const pull = t * 0.14;
  return {
    x: rawPoint.x + (homedTarget.x - rawPoint.x) * pull,
    y: rawPoint.y + (homedTarget.y - rawPoint.y) * pull,
  };
}

/**
 * Render a stroke as a series of cubic-Bézier segments via Catmull-Rom
 * conversion. Each segment carries its own width (from velocity) and
 * opacity. Caller draws them as N short SVG paths.
 *
 * Returns segments in the order they should be painted (older → newer).
 */
export type InkSegment = { d: string; width: number; opacity: number };

export function inkSegments(
  points: InkPoint[],
  baseWidth: number,
): InkSegment[] {
  if (points.length < 2) return [];
  const segments: InkSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    // Catmull-Rom → cubic Bézier control points
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    const d = `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;

    // Use the *target* point's velocity (it represents the segment's motion).
    const v = p2.v;
    const width = velocityToStrokeWidth(v, baseWidth);
    // Opacity dips slightly on very fast strokes — visual analogue of a pen
    // skipping over paper. Slow points stay full opacity.
    const opacity = v > FAST_VELOCITY ? 0.78 : 1;
    segments.push({ d, width, opacity });
  }
  return segments;
}

/**
 * Convert pointer velocity (px/ms) to stroke width (px).
 * Cubic ease-out between SLOW_VELOCITY and FAST_VELOCITY produces an organic
 * "real ink" feel — slow strokes pool ~1.55× thick, fast strokes thin to ~0.62×.
 */
export function velocityToStrokeWidth(v: number, baseWidth: number): number {
  const t = Math.max(0, Math.min(1, (v - SLOW_VELOCITY) / (FAST_VELOCITY - SLOW_VELOCITY)));
  const eased = 1 - Math.pow(1 - t, 3);
  const MIN_SCALE = 0.62;
  const MAX_SCALE = 1.55;
  return baseWidth * (MAX_SCALE - eased * (MAX_SCALE - MIN_SCALE));
}
