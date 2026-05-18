import { useEffect, useMemo, useState } from 'react';
import { m } from 'framer-motion';
import {
  inkFullPath,
  inkSegments,
  strokeConfidence,
  trimStrokeAtAnchor,
} from './ink';
import {
  ACTIVE_TRIM_RADIUS,
  EXPO_OUT,
  INK_BASE_WIDTH,
  OVERSHOOT,
  SETTLE_DURATION_MS,
  SETTLED_TRIM_RADIUS,
  SMOOTH_OUT,
  eased,
} from './geometry';
import type { FrozenStroke, InkPoint, RadialDialTheme, Vec } from './types';

/**
 * Ink layers — React components that render the dial's ink trail.
 *
 *   FrozenStrokeLayer  → committed path strokes (with settle, age fade, lift)
 *   StrokeDrawIn       → draw-in animation overlay on freshly frozen strokes
 *   InkDropPool        → small accent dot at each stroke's destination
 *   TravelingPulse     → single moving dash flowing across whole path
 *   LiveStrokeLayer    → the in-progress stroke during a drag gesture
 *   StrokeSegments    → triple-pass ink rendering (halo + mid + sharp top)
 *
 * Pure rendering — all geometry is read from the shared geometry module;
 * all path math from `ink.ts`. No engine state coupling.
 */

// =============================================================================
// FrozenStrokeLayer — a single committed stroke. Combines settle animation,
// age-fade through path order, draw-in overlay, and ink-drop pool at end.
// =============================================================================
export function FrozenStrokeLayer({
  stroke,
  fromPos,
  toPos,
  toIsActive,
  index = 0,
  total = 1,
  theme,
}: {
  stroke: FrozenStroke;
  fromPos?: Vec;
  toPos?: Vec;
  /** True if this stroke ends at the current active node (uses larger trim). */
  toIsActive: boolean;
  /** Stroke's position in the path (0 = oldest committed). */
  index?: number;
  /** Total committed strokes — drives age fade. */
  total?: number;
  theme: RadialDialTheme;
}) {
  // Age fade: oldest stroke at 0.78 opacity, newest at 1.0. Linear gradient
  // through the path so the trail acquires a sense of time depth — recent
  // commits read vivid, older ones recede.
  const ageRatio = total > 1 ? (total - 1 - index) / (total - 1) : 0;
  const ageFade = 1 - ageRatio * 0.22;
  const [settleProgress, setSettleProgress] = useState(0);
  // "Ink settling" — freshly frozen strokes thicken briefly then settle.
  useEffect(() => {
    const elapsed = performance.now() - stroke.frozenAt;
    if (elapsed >= SETTLE_DURATION_MS) {
      setSettleProgress(1);
      return;
    }
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - stroke.frozenAt) / SETTLE_DURATION_MS;
      if (t >= 1) {
        setSettleProgress(1);
        return;
      }
      setSettleProgress(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stroke.frozenAt]);
  const settleScale = 1 + (1 - eased(settleProgress)) * 0.3;
  // Trim ink to bubble perimeters at both ends so the line connects edges,
  // not centres — gives the committed path a flowchart-edge feel.
  const trimmed = useMemo(() => {
    let pts = stroke.points;
    if (fromPos) pts = trimStrokeAtAnchor(pts, fromPos, SETTLED_TRIM_RADIUS, 'start');
    if (toPos) {
      pts = trimStrokeAtAnchor(pts, toPos, toIsActive ? ACTIVE_TRIM_RADIUS : SETTLED_TRIM_RADIUS, 'end');
    }
    return pts;
  }, [stroke.points, fromPos, toPos, toIsActive]);
  if (trimmed.length < 2) return null;
  // Trail lift on commit: stroke arrives from below by 4px and rises into
  // place with overshoot — the page acknowledges the path arriving.
  // On reset/undo (exit), drifts upward 20px and fades — like wisps lifting.
  return (
    <m.g
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: ageFade, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: OVERSHOOT }}
    >
      <StrokeSegments points={trimmed} theme={theme} widthMultiplier={settleScale} />
      <StrokeDrawIn points={trimmed} theme={theme} />
      {toPos && <InkDropPool pos={toPos} bornAt={stroke.frozenAt} theme={theme} />}
    </m.g>
  );
}

/**
 * StrokeDrawIn — overlays the same stroke path with a draw-in animation
 * (dasharray 1→0 from end to start) on first mount, so newly-frozen strokes
 * appear to be laid down rather than popping into existence. Runs once.
 */
function StrokeDrawIn({ points, theme }: { points: InkPoint[]; theme: RadialDialTheme }) {
  const fullPath = useMemo(() => inkFullPath(points), [points]);
  if (!fullPath) return null;
  return (
    <m.path
      d={fullPath}
      pathLength={1}
      fill="none"
      stroke={theme.ink}
      strokeWidth={INK_BASE_WIDTH * 1.4}
      strokeOpacity={0.28}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="1 1"
      initial={{ strokeDashoffset: 1 }}
      animate={{ strokeDashoffset: 0 }}
      transition={{ duration: 0.28, ease: SMOOTH_OUT }}
    />
  );
}

/**
 * InkMeniscus — surface-tension highlight at the live tip of the ink.
 *
 * Real ink pools microscopically at the tip of a freshly-laid line. This
 * component renders a faint radial gradient at the stroke's terminus while
 * the stroke is still active (during drawing) or has just settled (≤200ms
 * after freeze). Only the MOST recent stroke gets a meniscus — older strokes
 * look stale with it. Issue #313.
 *
 * Implementation: SVG <radialGradient> wrapped in <circle>. Sized 1.5× stroke
 * width, 30% accent alpha at center, 0 at edge. Pure transform+opacity —
 * no animated layout properties.
 */
export function InkMeniscus({
  tip,
  strokeWidth = INK_BASE_WIDTH,
  intensity = 1,
  theme,
}: {
  tip: Vec | null;
  strokeWidth?: number;
  /** 0..1 — opacity multiplier. Use 1 while drawing, decay to 0 post-settle. */
  intensity?: number;
  theme: RadialDialTheme;
}) {
  // Stable gradient id per theme so multiple meniscus instances don't collide.
  // (Each mount gets its own id via the random suffix — cheap, safe.)
  const gradId = useMemo(
    () => `meniscus-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );
  if (!tip || intensity <= 0) return null;
  const radius = strokeWidth * 3;  // 1.5× stroke "diameter" feel via 3× width.
  return (
    <m.g
      style={{ pointerEvents: 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: intensity }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: SMOOTH_OUT }}
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={theme.accent} stopOpacity="0.30" />
          <stop offset="60%" stopColor={theme.accent} stopOpacity="0.12" />
          <stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={tip.x} cy={tip.y} r={radius} fill={`url(#${gradId})`} />
    </m.g>
  );
}

/**
 * InkDropPool — small accent dot that appears at a stroke's destination
 * for ~500ms after freeze and fades. "Ink pooled here on arrival."
 */
function InkDropPool({ pos, bornAt, theme }: { pos: Vec; bornAt: number; theme: RadialDialTheme }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const elapsed = performance.now() - bornAt;
    const remaining = Math.max(0, 600 - elapsed);
    const t = setTimeout(() => setVisible(false), remaining);
    return () => clearTimeout(t);
  }, [bornAt]);
  if (!visible) return null;
  return (
    <m.circle
      cx={pos.x}
      cy={pos.y}
      r={2.5}
      fill={theme.accent}
      initial={{ opacity: 0.85, r: 1 }}
      animate={{ opacity: 0, r: 5 }}
      transition={{ duration: 0.55, ease: EXPO_OUT }}
    />
  );
}

/**
 * TravelingPulse — ONE moving dash that walks the full concatenated path
 * (every frozen stroke + the live stroke) from origin to current position.
 * Directional, intentional energy flowing toward "where you are."
 *
 * Uses pathLength=1 normalization so the speed is constant regardless of
 * how long the path has grown.
 */
export function TravelingPulse({ d, theme }: { d: string; theme: RadialDialTheme }) {
  return (
    <m.path
      d={d}
      pathLength={1}
      fill="none"
      stroke={theme.accent}
      strokeWidth={2.2}
      strokeOpacity={0.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="0.035 1"
      initial={{ strokeDashoffset: 0 }}
      animate={{ strokeDashoffset: -1.04 }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
    />
  );
}

// =============================================================================
// LiveStrokeLayer — the in-progress stroke during a drag gesture.
// Width modulates with confidence (decisive motion = thicker, orbital = thin).
// =============================================================================
export function LiveStrokeLayer({
  points,
  activePos,
  theme,
}: {
  points: InkPoint[];
  activePos: Vec;
  theme: RadialDialTheme;
}) {
  // Trim leading points inside the active bubble — the line should leave
  // the perimeter, not start from the centre.
  const trimmed = useMemo(
    () => trimStrokeAtAnchor(points, activePos, ACTIVE_TRIM_RADIUS, 'start'),
    [points, activePos],
  );
  // Confidence drives line weight — decisive motion = thicker; orbital = thin.
  const confidence = useMemo(() => strokeConfidence(points), [points]);
  const widthMultiplier = 0.55 + confidence * 1.0;
  if (trimmed.length < 2) return null;
  return (
    <StrokeSegments
      points={trimmed}
      theme={theme}
      widthMultiplier={widthMultiplier}
      live
    />
  );
}

// =============================================================================
// StrokeSegments — triple-pass ink rendering: halo + mid + sharp-top.
// Each segment rendered three times at different widths/opacities builds
// up the ink-pooling effect cheaply (each path is a single bezier).
// =============================================================================
function StrokeSegments({
  points,
  theme,
  widthMultiplier,
  live = false,
}: {
  points: InkPoint[];
  theme: RadialDialTheme;
  widthMultiplier: number;
  live?: boolean;
}) {
  const segments = useMemo(
    () => inkSegments(points, INK_BASE_WIDTH * widthMultiplier),
    [points, widthMultiplier],
  );
  const baseOpacity = live ? 0.85 : 1;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {segments.map((seg, i) => (
        <path
          key={`halo-${i}`}
          d={seg.d}
          fill="none"
          stroke={theme.ink}
          strokeWidth={seg.width * 3.6}
          strokeOpacity={0.05 * baseOpacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {segments.map((seg, i) => (
        <path
          key={`mid-${i}`}
          d={seg.d}
          fill="none"
          stroke={theme.ink}
          strokeWidth={seg.width * 1.8}
          strokeOpacity={0.18 * baseOpacity * seg.opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {segments.map((seg, i) => (
        <path
          key={`top-${i}`}
          d={seg.d}
          fill="none"
          stroke={theme.ink}
          strokeWidth={seg.width}
          strokeOpacity={0.92 * baseOpacity * seg.opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}
