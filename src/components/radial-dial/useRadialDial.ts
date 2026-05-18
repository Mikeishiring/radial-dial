import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { appendPoint } from './ink';
import type {
  DialNode,
  DialPathEntry,
  DialPathPayload,
  DialPhase,
  FrozenStroke,
  InkPoint,
  Vec,
} from './types';

/**
 * useRadialDial — gesture engine.
 *
 * Owns: path, ink strokes, hysteresis state, pointer handlers.
 * Returns: everything a presentational component needs to render the dial.
 *
 * Hysteresis is the key concept here. After any commit or undo, neither will
 * fire again until the cursor escapes `settleRadius`. This prevents the
 * oscillation where the cursor sits inside undo-radius of a freshly committed
 * active node and flips between commit ↔ undo on every pointermove.
 */

type Options = {
  tree: DialNode;
  /** Px the cursor must travel from active before the closest child commits. */
  commitDistance?: number;
  /** Hysteresis re-arm threshold (must escape this radius). */
  settleRadius?: number;
  /** Pull cursor inside this radius to pop the most recent commit. */
  undoRadius?: number;
  /** Half-cone in radians within which a child counts as "homed". */
  angularTolerance?: number;
  /** Children fan radius from active. */
  fanRadius?: number;
  /** Fired every commit (path lengthens) or undo (path shortens). */
  onChange?: (payload: DialPathPayload) => void;
  /** Fired on release if the path has any commits. */
  onComplete?: (payload: DialPathPayload) => void;
};

const DEFAULTS = {
  commitDistance: 158,
  settleRadius: 108,
  undoRadius: 44,
  angularTolerance: Math.PI / 4.5,
  fanRadius: 196,
};

/**
 * Minimum net outward speed (px/point) required to fire a commit.
 * Below this the cursor is orbiting at constant radius — the user is
 * exploring/dwelling, not deciding. Set above pointer-jitter noise.
 */
const MIN_OUTWARD_PROGRESS = 1.6;
/** Number of recent points used for the outward-progress estimate. */
const OUTWARD_WINDOW = 4;

export function useRadialDial({
  tree,
  commitDistance = DEFAULTS.commitDistance,
  settleRadius = DEFAULTS.settleRadius,
  undoRadius = DEFAULTS.undoRadius,
  angularTolerance = DEFAULTS.angularTolerance,
  fanRadius = DEFAULTS.fanRadius,
  onChange,
  onComplete,
}: Options) {
  // --- State ----------------------------------------------------------------
  const [path, setPath] = useState<DialPathEntry[]>([]);
  const [pointer, setPointer] = useState<Vec | null>(null);
  const [phase, setPhase] = useState<DialPhase>('idle');
  const [committed, setCommitted] = useState<DialNode[] | null>(null);
  const [frozenStrokes, setFrozenStrokes] = useState<FrozenStroke[]>([]);

  // --- Refs (do not trigger renders) ---------------------------------------
  const liveStrokeRef = useRef<InkPoint[]>([]);
  // Raw cursor history (no smoothing) — used for engine coherence checks so
  // they reflect the user's actual hand motion, not the rendered ink lag.
  const rawHistoryRef = useRef<Vec[]>([]);
  const armedRef = useRef(true);
  // Synchronous mirrors of state read by handlers. Writes happen alongside
  // the React setState so handlers always see the latest values, even when
  // multiple pointer events fire faster than React re-renders the closure.
  const pathRef = useRef<DialPathEntry[]>([]);
  const phaseRef = useRef<DialPhase>('idle');
  const fanRadiusRef = useRef(fanRadius);
  fanRadiusRef.current = fanRadius;
  // Force re-render when liveStroke ref changes; avoids state churn at 120Hz.
  const [, bumpRender] = useReducer((n: number) => n + 1, 0);

  // --- Derived ---------------------------------------------------------------
  const activeEntry = path[path.length - 1];
  const grandparentPos = path.length >= 2 ? path[path.length - 2].pos : null;

  const visibleChildren: DialPathEntry[] = useMemo(() => {
    if (!activeEntry?.node.children) return [];
    const positions = placeChildren(
      activeEntry.pos,
      grandparentPos,
      activeEntry.node.children.length,
      fanRadius,
    );
    return activeEntry.node.children.map((node, i) => ({ node, pos: positions[i] }));
  }, [activeEntry, grandparentPos, fanRadius]);

  const homed: { id: string; strength: number; targetPos: Vec } | null = useMemo(() => {
    if (phase !== 'drawing' || !pointer || !activeEntry || visibleChildren.length === 0) return null;
    const dx = pointer.x - activeEntry.pos.x;
    const dy = pointer.y - activeEntry.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < undoRadius) return null;
    const pa = Math.atan2(dy, dx);
    let bestId = '';
    let bestDelta = Infinity;
    let bestPos: Vec = activeEntry.pos;
    for (const c of visibleChildren) {
      const ca = Math.atan2(c.pos.y - activeEntry.pos.y, c.pos.x - activeEntry.pos.x);
      const d = angleDiff(pa, ca);
      if (d < bestDelta) {
        bestDelta = d;
        bestId = c.node.id;
        bestPos = c.pos;
      }
    }
    if (bestDelta > angularTolerance) return null;
    return { id: bestId, strength: 1 - bestDelta / angularTolerance, targetPos: bestPos };
  }, [phase, pointer, activeEntry, visibleChildren, undoRadius, angularTolerance]);

  /** Live counter — multiplies share down the path. */
  const computeCount = useCallback(
    (basis: number) => {
      let n = basis;
      for (const entry of path.slice(1)) n *= entry.node.share ?? 1;
      return n;
    },
    [path],
  );

  // --- Pointer handlers ------------------------------------------------------
  const onPointerDown = useCallback(
    (e: React.PointerEvent, stage: HTMLElement) => {
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointers can't be captured */
      }
      const rect = stage.getBoundingClientRect();
      const press = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      phaseRef.current = 'drawing';
      setPhase('drawing');
      setCommitted(null);
      const initialPath = [{ node: tree, pos: press }];
      pathRef.current = initialPath;
      setPath(initialPath);
      setPointer(press);
      setFrozenStrokes([]);
      liveStrokeRef.current = [{ ...press, t: performance.now(), v: 0 }];
      rawHistoryRef.current = [press];
      armedRef.current = true;
      bumpRender();
    },
    [tree],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent, stage: HTMLElement) => {
      if (phaseRef.current !== 'drawing') return;
      const rect = stage.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setPointer(p);

      // Append to live stroke ref (smoothed) for rendering.
      const next = appendPoint(liveStrokeRef.current, p, performance.now());
      if (next !== liveStrokeRef.current) {
        liveStrokeRef.current = next;
        bumpRender();
      }

      // Track raw cursor for engine coherence checks (separate from ink).
      rawHistoryRef.current.push(p);
      if (rawHistoryRef.current.length > 12) rawHistoryRef.current.shift();

      // Read latest path from the synchronous mirror ref — closure-state
      // would be stale if multiple events fire between React renders.
      const livePath = pathRef.current;
      const liveActive = livePath[livePath.length - 1];
      if (!liveActive) return;

      const dx = p.x - liveActive.pos.x;
      const dy = p.y - liveActive.pos.y;
      const dist = Math.hypot(dx, dy);

      // Hysteresis: must demonstrably escape settle radius before next transition.
      if (!armedRef.current) {
        if (dist > settleRadius) armedRef.current = true;
        return;
      }

      // Reverse-drag undo.
      if (dist < undoRadius && livePath.length > 1) {
        const newPath = livePath.slice(0, -1);
        pathRef.current = newPath;
        setPath(newPath);
        setFrozenStrokes(prev => prev.slice(0, -1));
        liveStrokeRef.current = [{ ...p, t: performance.now(), v: 0 }];
        rawHistoryRef.current = [p];
        armedRef.current = false;
        onChange?.({ nodes: newPath.slice(1).map(e => e.node) });
        bumpRender();
        return;
      }

      // Forward commit.
      const children = liveActive.node.children;
      if (!children?.length) return;

      // Velocity-aware commit threshold — fast flicks commit at a shorter
      // distance (Kurtenbach's expert-mode insight). Slow ceremonial drags
      // require the full distance; quick decisive flicks need only ~55%.
      // Velocity is read from the smoothed live stroke (px/ms).
      const recentInk = liveStrokeRef.current.slice(-4);
      const avgV = recentInk.length > 0
        ? recentInk.reduce((s, p) => s + p.v, 0) / recentInk.length
        : 0;
      // Map velocity 0.2–1.0 px/ms → factor 1.0–0.55 (linear, clamped).
      const velocityFactor = Math.max(0.55, Math.min(1.0, 1.0 - (avgV - 0.2) * 0.563));
      const effectiveCommit = commitDistance * velocityFactor;
      if (dist < effectiveCommit) return;

      // Radial coherence — only commit when MOST recent pointer transitions
      // moved outward. A circle starting from the press point looks like a
      // single big outward jump followed by constant-radius motion; a
      // decisive drag is many consecutive outward steps. Counting the
      // fraction of outward transitions distinguishes the two cleanly.
      const recent = rawHistoryRef.current.slice(-OUTWARD_WINDOW);
      if (recent.length < 3) return; // need a minimum sample to judge
      let outwardSegments = 0;
      for (let i = 1; i < recent.length; i++) {
        const dPrev = Math.hypot(recent[i - 1].x - liveActive.pos.x, recent[i - 1].y - liveActive.pos.y);
        const dCurr = Math.hypot(recent[i].x - liveActive.pos.x, recent[i].y - liveActive.pos.y);
        if (dCurr - dPrev > MIN_OUTWARD_PROGRESS) outwardSegments++;
      }
      const outwardFraction = outwardSegments / (recent.length - 1);
      if (outwardFraction < 0.6) return;

      // Compute children of the live active inline — visibleChildren state
      // is also subject to the same render lag.
      const liveGrandparent = livePath.length >= 2 ? livePath[livePath.length - 2].pos : null;
      const liveChildPositions = placeChildren(liveActive.pos, liveGrandparent, children.length, fanRadiusRef.current);
      const liveChildren = children.map((node, i) => ({ node, pos: liveChildPositions[i] }));

      const pa = Math.atan2(dy, dx);
      let bestIdx = -1;
      let bestDelta = Infinity;
      for (let i = 0; i < liveChildren.length; i++) {
        const c = liveChildren[i];
        const a = Math.atan2(c.pos.y - liveActive.pos.y, c.pos.x - liveActive.pos.x);
        const d = angleDiff(pa, a);
        if (d < bestDelta) {
          bestDelta = d;
          bestIdx = i;
        }
      }
      if (bestIdx < 0 || bestDelta >= angularTolerance) return;

      const chosen = liveChildren[bestIdx];
      const newEntry = { node: chosen.node, pos: p };
      const frozen: FrozenStroke = {
        id: `${chosen.node.id}-${performance.now()}`,
        points: [...liveStrokeRef.current, { ...p, t: performance.now(), v: 0 }],
        frozenAt: performance.now(),
      };
      const newPath = [...livePath, newEntry];
      pathRef.current = newPath;
      setPath(newPath);
      setFrozenStrokes(prev => [...prev, frozen]);
      liveStrokeRef.current = [{ ...p, t: performance.now(), v: 0 }];
      rawHistoryRef.current = [p];
      armedRef.current = false;
      onChange?.({ nodes: newPath.slice(1).map(e => e.node) });
      bumpRender();
    },
    // `phase` intentionally omitted — handler reads phaseRef.current to avoid
    // stale-closure issues during rapid pointer events.
    [commitDistance, settleRadius, undoRadius, angularTolerance, onChange],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent, stage: HTMLElement) => {
      try {
        if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      phaseRef.current = 'committed';
      setPhase('committed');
      setPointer(null);
      const livePath = pathRef.current;
      if (livePath.length > 1) {
        const nodes = livePath.slice(1).map(p => p.node);
        setCommitted(nodes);
        onComplete?.({ nodes });
      } else {
        phaseRef.current = 'idle';
        setPhase('idle');
      }
      liveStrokeRef.current = [];
      bumpRender();
    },
    [onComplete],
  );

  const reset = useCallback(() => {
    pathRef.current = [];
    phaseRef.current = 'idle';
    setPath([]);
    setCommitted(null);
    setPointer(null);
    setFrozenStrokes([]);
    setPhase('idle');
    liveStrokeRef.current = [];
    rawHistoryRef.current = [];
    armedRef.current = true;
    bumpRender();
  }, []);

  /**
   * Direct selection — commit a child WITHOUT a drag gesture.
   *
   * Used when an option is clicked rather than dragged-into. Produces the
   * same path/state result as a drag commit, plus a synthesized straight-
   * line ink stroke connecting the previous active to the new one — so the
   * visual record is indistinguishable from a drag.
   *
   * If `fromAnchor` is provided, treats it as the press position (used when
   * clicking a level-1 option from the idle state — there's no path yet, so
   * we synthesise the press-then-commit transition).
   */
  const selectChild = useCallback(
    (childNode: DialNode, fromAnchor?: Vec) => {
      let livePath = pathRef.current;
      const now = performance.now();

      // If no path yet (idle → click level-1), synthesize a press at the anchor.
      if (livePath.length === 0) {
        if (!fromAnchor) return;
        livePath = [{ node: tree, pos: fromAnchor }];
        pathRef.current = livePath;
      }

      const liveActive = livePath[livePath.length - 1];
      if (!liveActive) return;

      // Verify the node is actually a child of the current active — guards
      // against stale clicks after the path changed.
      const children = liveActive.node.children;
      if (!children?.length) return;
      const childIdx = children.findIndex(c => c.id === childNode.id);
      if (childIdx < 0) return;

      // Compute where the new active should sit — use the same fan layout
      // the visible options use, so the click commit lands exactly where
      // the user saw the option.
      const liveGrandparent = livePath.length >= 2 ? livePath[livePath.length - 2].pos : null;
      const positions = placeChildren(
        liveActive.pos,
        liveGrandparent,
        children.length,
        fanRadiusRef.current,
      );
      const newPos = positions[childIdx];

      // Synthesize a straight-line stroke between previous active and new
      // active so the visual path looks coherent (no jump between bubbles).
      const N = 8;
      const synthesizedPoints: InkPoint[] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        synthesizedPoints.push({
          x: liveActive.pos.x + (newPos.x - liveActive.pos.x) * t,
          y: liveActive.pos.y + (newPos.y - liveActive.pos.y) * t,
          t: now + i,
          v: 0.3,
        });
      }

      const newEntry = { node: childNode, pos: newPos };
      const frozen: FrozenStroke = {
        id: `${childNode.id}-${now}`,
        points: synthesizedPoints,
        frozenAt: now,
      };
      const newPath = [...livePath, newEntry];
      pathRef.current = newPath;
      setPath(newPath);
      setFrozenStrokes(prev => [...prev, frozen]);
      const newCommitted = newPath.slice(1).map(e => e.node);
      setCommitted(newCommitted);
      phaseRef.current = 'committed';
      setPhase('committed');
      onChange?.({ nodes: newCommitted });
      bumpRender();
    },
    [tree, onChange],
  );

  /**
   * Navigate the path back to a specific breadcrumb (0-based, where
   * breadcrumb[0] is path[1]). Clicking breadcrumb[i] *keeps* that node and
   * drops everything after — semantics matching breadcrumb conventions in
   * file managers and search filters.
   *
   * Clicking the last breadcrumb is a no-op (you're already there).
   */
  const popToLevel = useCallback(
    (breadcrumbIndex: number) => {
      if (breadcrumbIndex < 0) {
        reset();
        return;
      }
      const prev = pathRef.current;
      const next = prev.slice(0, breadcrumbIndex + 2);
      if (next.length === prev.length) return; // no-op (clicked last)
      pathRef.current = next;
      setPath(next);
      const newCommitted = next.slice(1).map(e => e.node);
      setCommitted(newCommitted.length > 0 ? newCommitted : null);
      onChange?.({ nodes: newCommitted });
      setFrozenStrokes(prevStrokes => prevStrokes.slice(0, breadcrumbIndex + 1));
      phaseRef.current = 'committed';
      setPhase('committed');
    },
    [reset, onChange],
  );

  // Esc resets — keyboard accessibility for committed state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reset]);

  return {
    // state
    path,
    pointer,
    phase,
    committed,
    frozenStrokes,
    liveStroke: liveStrokeRef.current,
    activeEntry,
    visibleChildren,
    homed,
    // helpers
    computeCount,
    // handlers
    onPointerDown,
    onPointerMove,
    onPointerUp,
    reset,
    popToLevel,
    selectChild,
  };
}

// =============================================================================
// Geometry — pure helpers, exported for the presentational component.
// =============================================================================

/**
 * Place children radially around their parent.
 * - Root level (no grandparent): top / right / bottom / left for 4 children;
 *   evenly distributed for other counts. Up-first so the eye lands on Role.
 * - Deeper levels: 153° forward fan away from the grandparent direction.
 */
export function placeChildren(
  parent: Vec,
  grandparent: Vec | null,
  count: number,
  radius: number,
): Vec[] {
  if (count === 0) return [];
  if (!grandparent) {
    const start = -Math.PI / 2;
    const step = (Math.PI * 2) / count;
    return Array.from({ length: count }, (_, i) => {
      const a = start + i * step;
      return { x: parent.x + Math.cos(a) * radius, y: parent.y + Math.sin(a) * radius };
    });
  }
  const baseAngle = Math.atan2(parent.y - grandparent.y, parent.x - grandparent.x);
  const spread = Math.PI * 0.85;
  const start = count === 1 ? baseAngle : baseAngle - spread / 2;
  const step = count === 1 ? 0 : spread / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const a = start + i * step;
    return { x: parent.x + Math.cos(a) * radius, y: parent.y + Math.sin(a) * radius };
  });
}

/** Smallest non-negative angle between two angles (in radians). */
export function angleDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** Clamp a position to within `margin` px of stage bounds. */
export function clampToStage(pos: Vec, stageSize: { w: number; h: number }, margin = 64): Vec {
  return {
    x: Math.max(margin, Math.min(stageSize.w - margin, pos.x)),
    y: Math.max(margin, Math.min(stageSize.h - margin, pos.y)),
  };
}

/** Detect prefers-reduced-motion (one-shot at mount). */
export function usePrefersReducedMotion() {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
}
