import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LazyMotion, domMax, m } from 'framer-motion';
import {
  applyMagneticPull,
  inkFullPath,
  trimStrokeAtAnchor,
} from './ink';
import {
  AmbientRipple,
  CommitParticles,
  CommitWave,
  FirstRunHint,
  IdleMotes,
  PaperWarp,
  SettleRipples,
} from './atmosphere';
import { ApplyButton, PathLine, ResetButton } from './chrome';
import {
  ACTIVE_TRIM_RADIUS,
  COMMIT_DISTANCE,
  EXPO_OUT,
  FAN_RADIUS,
  MAX_OPTION_PULL,
  OPTION_DIAMETER,
  SETTLED_TRIM_RADIUS,
} from './geometry';

/**
 * Compute the dial's stage-fit scale from the current stage size.
 *
 * The desktop dial wants FAN_RADIUS (196) + OPTION_DIAMETER/2 (56) ≈ 252px
 * of clear space in each direction from the active node. On viewports
 * narrower than ~520px wide that doesn't fit, and clampToStage starts
 * distorting the radial geometry (options bunch toward the bottom-right).
 *
 * This function decides HOW the dial degrades on small screens. The
 * returned value is a uniform scale factor applied to FAN_RADIUS and
 * COMMIT_DISTANCE (and to the clamp padding). A return of 1 means
 * "no scaling" — full desktop size.
 *
 * TRADE-OFFS to consider:
 *   - A floor too low (< 0.5) makes the dial feel cramped and toy-like.
 *   - A floor too high (> 0.75) means options still clip on phones.
 *   - Scaling linearly with viewport width feels natural; scaling with
 *     min(width, height) handles short landscape phones too.
 *   - Adding a "dead zone" margin (e.g. 24px) prevents bubbles from
 *     touching the screen edge — purely aesthetic but matters.
 *
 * Constraint: result must be in (0, 1]. Stage will be 0×0 on first paint
 * — return 1 in that case so the engine has sensible defaults.
 */
function computeStageScale(stageSize: { w: number; h: number }): number {
  // Smooth-ramp scaling. We need (FAN_RADIUS + OPTION_DIAMETER/2) = 252px
  // of clear space from centre in each direction. SAFE_MARGIN keeps bubbles
  // off the screen edge for visual breathing room. The 0.55 floor stops the
  // dial from becoming a toy on phantom-tiny viewports — below that, hit
  // targets get unusably small.
  if (stageSize.w === 0 || stageSize.h === 0) return 1;
  const SAFE_MARGIN = 16;
  const MIN_SCALE = 0.55;
  const halfMin = Math.min(stageSize.w, stageSize.h) / 2 - SAFE_MARGIN;
  const target = FAN_RADIUS + OPTION_DIAMETER / 2;
  const raw = halfMin / target;
  return Math.max(MIN_SCALE, Math.min(1, raw));
}

/**
 * Depth-parallax layer style. Fills the stage and translates by the cursor
 * offset (--rd-parallax-x/y, -1..1) scaled by `depth` px — bigger depth =
 * moves more = reads as closer to the viewer. The transition adds a gentle
 * trailing inertia so layers feel like they have mass at distance.
 *
 * pointer-events:none so the layer never blocks the stage's drag gesture;
 * interactive children inside (option/planet buttons) re-enable pointer
 * events on themselves with pointerEvents:'auto'.
 *
 * IMPORTANT: a `transform` makes this element a new stacking context, so the
 * z-index of children no longer competes globally — the LAYER's own z-index
 * decides where the whole group paints. We pass it explicitly to preserve the
 * original paint order (planets below options, both below the active bubble).
 */
/** Diameter of the accent vignette glow that follows the active node. */
const VIGNETTE_SIZE = 760;

function parallaxLayer(depth: number, zIndex: number): React.CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    zIndex,
    pointerEvents: 'none',
    transform: `translate3d(calc(var(--rd-parallax-x, 0) * ${depth}px), calc(var(--rd-parallax-y, 0) * ${depth}px), 0)`,
    transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
    willChange: 'transform',
  };
}

function firstRunHintTarget(
  anchor: Vec,
  radius: number,
  flowMode: DialFlowMode,
): Vec {
  if (flowMode === 'right-flow') return { x: anchor.x + radius * 0.7, y: anchor.y };
  if (flowMode === 'left-flow') return { x: anchor.x - radius * 0.7, y: anchor.y };
  if (flowMode === 'down-flow') return { x: anchor.x, y: anchor.y + radius * 0.7 };
  return { x: anchor.x, y: anchor.y - radius * 0.7 };
}

function fitPositionsToStage(
  positions: Vec[],
  stageSize: { w: number; h: number },
  margin: number,
): Vec[] {
  if (positions.length === 0 || stageSize.w === 0 || stageSize.h === 0) return positions;
  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let dx = 0;
  let dy = 0;
  if (minX < margin) dx = margin - minX;
  else if (maxX > stageSize.w - margin) dx = stageSize.w - margin - maxX;
  if (minY < margin) dy = margin - minY;
  else if (maxY > stageSize.h - margin) dy = stageSize.h - margin - maxY;
  return positions.map(p => ({ x: p.x + dx, y: p.y + dy }));
}

function pointFromPointer(e: React.PointerEvent, stage: HTMLElement): Vec {
  const rect = stage.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function isNearPoint(point: Vec, target: Vec, radius: number) {
  return Math.hypot(point.x - target.x, point.y - target.y) <= radius;
}

function polylinePoints(points: Vec[]) {
  return points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function gestureLabel(command: DialGestureCommand) {
  if (command === 'reset') return 'reset';
  if (command === 'next-flow') return 'next layout';
  return 'previous layout';
}
import {
  ActiveBubble,
  CursorHalo,
  IdleGhost,
  IdleRoot,
  OptionBubble,
  SubMenuGhost,
} from './bubbles';
import { PlanetaryTrail } from './planets';
import {
  FrozenStrokeLayer,
  InkMeniscus,
  LiveStrokeLayer,
  TravelingPulse,
} from './ink-layers';
import { PAPER_THEME, mix } from './themes';
import {
  clampToStage,
  placeChildren,
  useRadialDial,
  usePrefersReducedMotion,
} from './useRadialDial';
import { classifyGestureCommand } from './gesture-commands';
import type {
  DialNode,
  DialBacktrackMode,
  DialFlowMode,
  DialGestureCommand,
  DialInteractionPayload,
  DialPathPayload,
  RadialDialTheme,
  Vec,
} from './types';

// =============================================================================
// RadialDial — the template component.
//
// Drop in:
//   <RadialDial tree={tree} theme={PAPER_THEME} onComplete={...} />
//
// All feel knobs are props with sensible defaults. Theme is a single object
// of paper / ink / accent + typography stacks; everything else derives via
// color-mix(). State and pointer logic live in useRadialDial; this file is
// purely how the dial *looks*.
// =============================================================================

export type RadialDialProps = {
  tree: DialNode;
  theme?: RadialDialTheme;
  /** Title shown top-left. */
  title?: string;
  /** Italic serif hint shown beneath the title. */
  hint?: string;
  /** Function mapping current count → display string. Default formats as integer. */
  formatCount?: (n: number) => string;
  /** Word(s) shown after the count (e.g. "jobs", "items"). */
  countLabel?: string;
  /** Total to multiply down the path. Set undefined to hide the counter. */
  total?: number;
  /** Render-prop slot for additional UI in the top-right toolbar area. */
  toolbar?: React.ReactNode;
  /**
   * Child placement strategy. `right-flow` anchors the root left and lets each
   * level open to the right; useful for test benches and left-to-right tools.
   */
  flowMode?: DialFlowMode;
  /** How removed committed ink exits when the user backs out. */
  backtrackMode?: DialBacktrackMode;
  /** Fired on every commit/undo. */
  onChange?: (payload: DialPathPayload) => void;
  /** Fired on release if any commits exist. */
  onComplete?: (payload: DialPathPayload) => void;
  /**
   * Fired when the user explicitly applies the selection (Apply CTA click
   * or Enter key while in 'committed' phase). When provided, an Apply
   * pill slides in below the path on terminal commits. Issue #12.
   */
  onApply?: (payload: DialPathPayload) => void;
  /** Text on the Apply CTA. Default: "Apply" + count suffix. */
  applyLabel?: string;
  /** Fired when the user draws a recognized command on empty paper. */
  onGestureCommand?: (command: DialGestureCommand) => void;
  /** Fired as the radial control changes option-level interaction state. */
  onInteractionChange?: (payload: DialInteractionPayload) => void;
};

export function RadialDial({
  tree,
  theme = PAPER_THEME,
  title,
  hint = 'press, draw a line, release.',
  formatCount = n => Math.max(0, Math.round(n)).toLocaleString('en-US'),
  countLabel = 'jobs',
  total,
  toolbar,
  flowMode = 'radial',
  backtrackMode = 'lift',
  onChange,
  onComplete,
  onApply,
  applyLabel = 'Apply',
  onGestureCommand,
  onInteractionChange,
}: RadialDialProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const reduceMotion = usePrefersReducedMotion();

  // Cursor → CSS-variable bridge. A single RAF-throttled pointer listener on
  // the root writes the cursor's position as custom properties:
  //   --rd-sheen-x / --rd-sheen-y   → directional light source for the glass
  //   --rd-parallax-x / --rd-parallax-y → -1..1 offset for depth parallax
  // Writing CSS vars (not React state) means zero re-renders per mouse move —
  // every glass pane + parallax layer reacts purely in CSS/compositor.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || reduceMotion) return;
    let raf = 0;
    let pending: { x: number; y: number } | null = null;
    const flush = () => {
      raf = 0;
      if (!pending) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const fx = (pending.x - r.left) / r.width; // 0..1
      const fy = (pending.y - r.top) / r.height; // 0..1
      // Sheen: light source follows cursor X fully; Y stays in the upper band
      // (0–45%) so glass reads as lit from above-ish, never from below.
      el.style.setProperty('--rd-sheen-x', `${(fx * 100).toFixed(1)}%`);
      el.style.setProperty('--rd-sheen-y', `${(fy * 45).toFixed(1)}%`);
      // Parallax: signed offset from centre, -1..1.
      el.style.setProperty('--rd-parallax-x', (fx * 2 - 1).toFixed(3));
      el.style.setProperty('--rd-parallax-y', (fy * 2 - 1).toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(flush);
    };
    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduceMotion]);

  // Stage-fit scale — uniformly shrinks fan radius + commit distance on
  // narrow viewports so the dial never falls off the edge. See
  // computeStageScale() above for the design call. (Issue #291)
  const stageScale = useMemo(() => computeStageScale(stageSize), [stageSize]);
  const fanRadius = FAN_RADIUS * stageScale;
  const commitDistance = COMMIT_DISTANCE * stageScale;
  // Padding used by clampToStage so children don't overflow the edge.
  // Stays proportional to the visible bubble. (Bubble diameter itself
  // is unscaled for now — it's a leaf-component import, not a prop.)
  const edgePadding = (OPTION_DIAMETER / 2) * Math.max(stageScale, 0.7) + 8;
  const restingOptionPadding = stageSize.w >= 700 ? edgePadding + 118 : edgePadding + 44;

  const dial = useRadialDial({
    tree,
    commitDistance,
    fanRadius,
    flowMode,
    backtrackMode,
    onChange,
    onComplete,
  });
  const persistentOptionsRef = useRef<Array<{ node: DialNode; pos: Vec }> | null>(null);
  const commandRef = useRef<{ pointerId: number; points: Vec[] } | null>(null);
  const [commandStroke, setCommandStroke] = useState<Vec[]>([]);
  const [commandFlash, setCommandFlash] = useState<{
    id: number;
    command: DialGestureCommand;
    pos: Vec;
  } | null>(null);

  // ===========================================================================
  // IDLE ATMOSPHERE STATE — small things that happen when nothing else is.
  // ===========================================================================
  // First-visit recognition: when the cursor first enters the page after
  // a fresh load, the root does an enhanced single pulse. "Hello."
  const [hasGreeted, setHasGreeted] = useState(false);
  // Counter pulse trigger — bumped on tab-return so the count flashes "still here".
  const [tabReturnTick, setTabReturnTick] = useState(0);
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) setTabReturnTick(t => t + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  // (Hint phrase rotation removed — the dial communicates itself; rotating
  // copy was a delight move that diluted attention. Subtraction.)

  // Stage size for idle anchor + edge clamp.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setStageSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Idle root sits slightly above centre on tall screens, in thumb zone on mobile.
  const idleAnchor: Vec = useMemo(() => {
    const isMobile = stageSize.w < 640;
    if (flowMode === 'right-flow') {
      return {
        x: isMobile ? stageSize.w * 0.34 : Math.max(stageSize.w * 0.34, 384),
        y: stageSize.h * 0.5,
      };
    }
    if (flowMode === 'left-flow') {
      return { x: isMobile ? stageSize.w * 0.66 : stageSize.w * 0.72, y: stageSize.h * 0.5 };
    }
    if (flowMode === 'down-flow') {
      return { x: stageSize.w / 2, y: isMobile ? stageSize.h * 0.32 : stageSize.h * 0.28 };
    }
    return { x: stageSize.w / 2, y: isMobile ? stageSize.h * 0.62 : stageSize.h * 0.5 };
  }, [stageSize, flowMode]);

  // Cursor anchor for the radial vignette — follows active or sits on idle.
  const anchor = dial.activeEntry?.pos ?? idleAnchor;

  // Visible children clamped to stage edges so deeply nested fans don't run off.
  const clampedChildren = useMemo(
    () =>
      dial.visibleChildren.map(c => ({
        ...c,
        pos: clampToStage(c.pos, stageSize, edgePadding),
      })),
    [dial.visibleChildren, stageSize, edgePadding],
  );

  // Magnetic-pulled live stroke — rendered cursor end leans toward homed child.
  const renderedLive = useMemo(() => {
    if (!dial.activeEntry || !dial.homed || dial.liveStroke.length < 2) return dial.liveStroke;
    const last = dial.liveStroke[dial.liveStroke.length - 1];
    const pulled = applyMagneticPull(
      last,
      dial.activeEntry.pos,
      dial.homed.targetPos,
      commitDistance,
    );
    return [...dial.liveStroke.slice(0, -1), { ...last, x: pulled.x, y: pulled.y }];
  }, [dial.liveStroke, dial.activeEntry, dial.homed, commitDistance]);

  // Pointer event adapters — pass the stage element through.
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const point = pointFromPointer(e, stage);
      const activePoint = dial.activeEntry?.pos ?? idleAnchor;
      const targetZones = [
        activePoint,
        ...(persistentOptionsRef.current ?? []).map(option => option.pos),
      ];
      const nearDialTarget = targetZones.some(target =>
        isNearPoint(point, target, OPTION_DIAMETER * 0.9),
      );

      if (nearDialTarget) {
        dial.onPointerDown(e, stage, dial.phase === 'idle' ? idleAnchor : activePoint);
        return;
      }

      commandRef.current = { pointerId: e.pointerId, points: [point] };
      setCommandStroke([point]);
      setCommandFlash(null);
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      e.preventDefault();
    },
    [dial, idleAnchor],
  );
  // Idle-state hover tracking — drives the sneak-peek ghost preview of
  // level-1 children when the cursor approaches the root.
  const [idleHover, setIdleHover] = useState<Vec | null>(null);
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const command = commandRef.current;
      if (command && command.pointerId === e.pointerId) {
        const point = pointFromPointer(e, stage);
        const last = command.points[command.points.length - 1];
        if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 3) {
          command.points = [...command.points.slice(-180), point];
          setCommandStroke(command.points);
        }
        return;
      }
      // Always pass through to the engine; it self-gates on phase.
      dial.onPointerMove(e, stage);
      // For resting hover, capture pointer relative to stage when not drawing.
      if (dial.phase === 'idle' || dial.phase === 'committed') {
        const rect = stage.getBoundingClientRect();
        setIdleHover({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        // First-visit recognition — fires once per session.
        if (!hasGreeted) setHasGreeted(true);
      } else if (idleHover !== null) {
        setIdleHover(null);
      }
    },
    [dial, idleHover, hasGreeted],
  );
  const onPointerLeave = useCallback(() => {
    if (idleHover !== null) setIdleHover(null);
  }, [idleHover]);
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const command = commandRef.current;
      if (command && command.pointerId === e.pointerId) {
        const point = pointFromPointer(e, stage);
        const points = [...command.points, point];
        const recognized = classifyGestureCommand(points);
        commandRef.current = null;
        setCommandStroke([]);
        try {
          if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        if (recognized) {
          if (recognized === 'reset') dial.reset();
          setCommandFlash({ id: Date.now(), command: recognized, pos: point });
          onGestureCommand?.(recognized);
        }
        return;
      }
      dial.onPointerUp(e, stage);
    },
    [dial, onGestureCommand],
  );
  // Live count for the counter readout — declared here (early) because
  // applyCurrent depends on it. Also consumed by PathLine / Apply CTA below.
  const count = total !== undefined ? dial.computeCount(total) : null;
  // Apply current selection — fired by the Apply pill or Enter key when
  // phase === 'committed'. Constructs a fresh payload from the path so
  // consumers don't need to track committed state separately. Issue #12.
  const applyCurrent = useCallback(() => {
    if (!onApply || dial.path.length <= 1) return;
    const nodes = dial.path.slice(1).map(p => p.node);
    onApply({ nodes, count: count ?? undefined });
  }, [onApply, dial.path, count]);

  // Keyboard-focused option index for arrow-key navigation. Null = no
  // keyboard focus; first arrow press sets to 0. Resets on phase change
  // or path change because the option set changes. Issue #26.
  const [focusedOptionIndex, setFocusedOptionIndex] = useState<number | null>(
    null,
  );
  useEffect(() => {
    setFocusedOptionIndex(null);
  }, [dial.phase, dial.path.length]);

  // Resting options — at idle, show level-1 choices around the root. After a
  // commit, show the current node's children so click/tap users can refine
  // multiple levels without needing an expert drag-through gesture.
  const persistentOptions = useMemo(() => {
    if (dial.phase !== 'idle' && dial.phase !== 'committed') return null;
    const anchorForOptions = dial.phase === 'idle' ? idleAnchor : dial.activeEntry?.pos;
    const children = dial.phase === 'idle'
      ? tree.children
      : dial.activeEntry?.node.children;
    const grandparentForOptions = dial.phase === 'idle'
      ? null
      : dial.path.length >= 2
        ? dial.path[dial.path.length - 2].pos
        : null;
    if (!anchorForOptions) return null;
    if (!children?.length) return null;
    const positions = placeChildren(
      anchorForOptions,
      grandparentForOptions,
      children.length,
      fanRadius,
      flowMode,
    );
    const fittedPositions = fitPositionsToStage(positions, stageSize, restingOptionPadding);
    return children.map((node, i) => ({ node, pos: fittedPositions[i] }));
  }, [
    dial.phase,
    dial.activeEntry,
    dial.path,
    tree,
    idleAnchor,
    fanRadius,
    flowMode,
    stageSize,
    restingOptionPadding,
  ]);
  useEffect(() => {
    persistentOptionsRef.current = persistentOptions;
  }, [persistentOptions]);
  useEffect(() => {
    if (!commandFlash) return;
    const timeout = window.setTimeout(() => setCommandFlash(null), 900);
    return () => window.clearTimeout(timeout);
  }, [commandFlash]);
  // Keyboard handler — Enter applies (committed) OR commits focused option.
  // ArrowLeft/Right cycle the focused option clockwise/counter-clockwise.
  // ArrowUp focuses the option closest to 12 o'clock.
  // ArrowDown commits the focused option.
  // NOTE: Escape is handled by a single global listener in useRadialDial
  // (pop one level); we deliberately do NOT handle it here to avoid a
  // double-pop. Issues #11, #12, #26.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't capture arrow keys / enter mid-drag — drag owns input.
      if (dial.phase === 'drawing') return;

      const options = persistentOptions ?? [];
      const len = options.length;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (len === 0) return;
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        setFocusedOptionIndex(prev => {
          if (prev === null) return dir === 1 ? 0 : len - 1;
          return (prev + dir + len) % len;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        if (len === 0) return;
        e.preventDefault();
        // Pick the option whose position is closest to the 12 o'clock
        // direction (i.e. smallest |x - anchor.x| with y < anchor.y).
        const anchor = dial.activeEntry?.pos ?? idleAnchor;
        let best = 0;
        let bestScore = Infinity;
        options.forEach((opt, i) => {
          const dx = Math.abs(opt.pos.x - anchor.x);
          const dy = opt.pos.y - anchor.y;
          // Score: horizontal distance + heavy penalty for being below.
          const score = dx + (dy > 0 ? 1000 + dy : dy * -0.5);
          if (score < bestScore) {
            bestScore = score;
            best = i;
          }
        });
        setFocusedOptionIndex(best);
        return;
      }

      // Anchor for committing — the dial's current centre (active node when
      // drilling, idle centre otherwise). Must match the mouse path, which
      // passes idleAnchor, NOT the option's off-centre fan position; passing
      // the latter would plant the root off-centre on the first commit.
      const commitAnchor = dial.activeEntry?.pos ?? idleAnchor;

      if (e.key === 'ArrowDown') {
        if (focusedOptionIndex === null || len === 0) return;
        e.preventDefault();
        const opt = options[focusedOptionIndex];
        if (opt) dial.selectChild(opt.node, commitAnchor);
        setFocusedOptionIndex(null);
        return;
      }

      if (e.key === 'Enter') {
        // Priority 1: if a keyboard-focused option exists, commit it.
        if (focusedOptionIndex !== null && len > 0) {
          e.preventDefault();
          const opt = options[focusedOptionIndex];
          if (opt) dial.selectChild(opt.node, commitAnchor);
          setFocusedOptionIndex(null);
          return;
        }
        // Priority 2: if committed and consumer wired Apply, fire it.
        if (dial.phase === 'committed' && onApply) {
          e.preventDefault();
          applyCurrent();
        }
      }
    },
    [
      dial,
      onApply,
      applyCurrent,
      persistentOptions,
      idleAnchor,
      focusedOptionIndex,
    ],
  );

  // Idle-hover proximity: 1.0 when cursor is on the root, 0 at 200px+ away.
  // Drives the sneak-peek ghost fan + the idle hint fade.
  const idleHoverProximity = useMemo(() => {
    if (!idleHover || dial.phase !== 'idle') return 0;
    const dist = Math.hypot(idleHover.x - idleAnchor.x, idleHover.y - idleAnchor.y);
    return Math.max(0, 1 - dist / 200);
  }, [idleHover, idleAnchor, dial.phase]);

  // Concatenate every frozen stroke + the live stroke into one SVG path
  // string, used by TravelingPulse to flow a single directional dash
  // from origin to the user's current position.
  const fullConcatenatedPath = useMemo(() => {
    let d = '';
    for (let i = 0; i < dial.frozenStrokes.length; i++) {
      const fromPos = dial.path[i]?.pos;
      const toPos = dial.path[i + 1]?.pos;
      const isLastFrozen = i === dial.frozenStrokes.length - 1;
      const toIsActive = isLastFrozen && dial.phase !== 'drawing';
      let pts = dial.frozenStrokes[i].points;
      if (fromPos) pts = trimStrokeAtAnchor(pts, fromPos, SETTLED_TRIM_RADIUS, 'start');
      if (toPos) {
        pts = trimStrokeAtAnchor(pts, toPos, toIsActive ? ACTIVE_TRIM_RADIUS : SETTLED_TRIM_RADIUS, 'end');
      }
      if (pts.length >= 2) d += (d ? ' ' : '') + inkFullPath(pts);
    }
    if (dial.phase === 'drawing' && renderedLive.length >= 2 && dial.activeEntry) {
      const trimmedLive = trimStrokeAtAnchor(renderedLive, dial.activeEntry.pos, ACTIVE_TRIM_RADIUS, 'start');
      if (trimmedLive.length >= 2) d += (d ? ' ' : '') + inkFullPath(trimmedLive);
    }
    return d;
  }, [dial.frozenStrokes, dial.path, dial.phase, renderedLive, dial.activeEntry]);

  const isLight = theme.mode === 'light';

  // Recent cursor velocity (px/ms, smoothed by EMA at capture). Single
  // scalar that drives FOUR coordinated effects:
  //   1. Engine: shorter commit threshold for fast flicks (in useRadialDial).
  //   2. Expert-mode fan fade: fast users get faded options (less visual noise).
  //   3. Time dilation: ambient idle motion slows during attentive drawing.
  //   4. Sub-menu pre-extension gate: only render preview when user is slow
  //      enough to be "deliberating", not when they're flicking through.
  const recentVelocity = useMemo(() => {
    const recent = dial.liveStroke.slice(-4);
    if (recent.length === 0) return 0;
    return recent.reduce((s, p) => s + p.v, 0) / recent.length;
  }, [dial.liveStroke]);

  // Expert-mode fan opacity — fast (>0.9 px/ms) → 0.3 opacity, slow → 1.0.
  // The fan still EXISTS for hit-testing; it just visually steps back when
  // the user is moving with confidence (Kurtenbach's expert-vs-novice mode).
  const fanOpacityMultiplier = useMemo(() => {
    if (dial.phase !== 'drawing') return 1;
    const v = recentVelocity;
    return Math.max(0.3, Math.min(1.0, 1.0 - (v - 0.3) * 1.0));
  }, [recentVelocity, dial.phase]);

  // Time dilation — ambient motion slows when user is attentive.
  // Drawing → 2.5x slower. Idle → normal. Smooth interpolation via React
  // re-render on phase change (the dilated transition restarts cleanly).
  const ambientDilation = dial.phase === 'drawing' ? 2.5 : 1;

  // Acceleration — second derivative of velocity (positive = speeding up,
  // negative = slowing down). Computed from the recent live-stroke window.
  // Used to modulate sub-preview opacity: deceleration brightens the preview
  // (system "leans in" when the user is hesitating); acceleration dims it.
  const recentAccel = useMemo(() => {
    const recent = dial.liveStroke.slice(-6);
    if (recent.length < 4) return 0;
    const earlyV = (recent[0].v + recent[1].v) / 2;
    const lateV = (recent[recent.length - 2].v + recent[recent.length - 1].v) / 2;
    return lateV - earlyV; // positive = speeding up
  }, [dial.liveStroke]);

  // Anticipatory previews — when the pointer nears a child with its own
  // children, reveal a tight secondary cluster that blooms from behind that
  // option. This is intentionally closer than the real next commit radius:
  // it previews information without asking the user to travel there yet.
  const proximityPreviews = useMemo(() => {
    const previewPointer = dial.phase === 'drawing' ? dial.pointer : idleHover;
    const activePos = dial.phase === 'drawing' || dial.phase === 'committed'
      ? dial.activeEntry?.pos
      : idleAnchor;
    const previewChildren = dial.phase === 'drawing' ? clampedChildren : persistentOptions ?? [];
    if (!previewPointer || !activePos) return [];
    if (dial.phase === 'drawing' && recentVelocity > 1.15) return []; // hide only on decisive expert flicks
    const trajectoryBoost = Math.max(-0.25, Math.min(0.25, -recentAccel * 0.5));
    const previews: Array<{
      id: string;
      label: string;
      origin: Vec;
      strength: number;
      children: Array<{ node: DialNode; pos: Vec }>;
    }> = [];
    for (const c of previewChildren) {
      if (!c.node.children?.length) continue;
      const dist = Math.hypot(previewPointer.x - c.pos.x, previewPointer.y - c.pos.y);
      // Proximity ramps from 0 at 170px out to 1 at the bubble's edge.
      const REVEAL_RANGE = 170;
      const edgeDist = Math.max(0, dist - OPTION_DIAMETER / 2);
      const proximity = Math.max(0, 1 - edgeDist / REVEAL_RANGE);
      if (proximity < 0.08) continue;
      // Combined strength: proximity (always present) + homed boost (only
      // for the option the user is actively committing toward).
      const isHomed = dial.phase === 'drawing' && dial.homed?.id === c.node.id;
      const homedBoost = isHomed ? dial.homed!.strength * 0.55 : 0;
      const strength = Math.max(0, Math.min(1, proximity * 0.82 + homedBoost + (isHomed ? trajectoryBoost : 0)));
      const dx = c.pos.x - activePos.x;
      const dy = c.pos.y - activePos.y;
      const baseAngle =
        flowMode === 'right-flow'
          ? 0
          : flowMode === 'left-flow'
            ? Math.PI
            : flowMode === 'down-flow'
              ? Math.PI / 2
              : Math.atan2(dy, dx);
      const count = c.node.children.length;
      const previewRadius = OPTION_DIAMETER * (0.82 + strength * 0.5);
      const previewSpacing = Math.min(OPTION_DIAMETER * 0.9, 84);
      const rawPositions = c.node.children.map((_, i) => {
        const offset = (i - (count - 1) / 2) * previewSpacing;
        if (flowMode === 'right-flow') {
          return { x: c.pos.x + previewRadius, y: c.pos.y + offset };
        }
        if (flowMode === 'left-flow') {
          return { x: c.pos.x - previewRadius, y: c.pos.y + offset };
        }
        if (flowMode === 'down-flow') {
          return { x: c.pos.x + offset, y: c.pos.y + previewRadius };
        }
        const spread = Math.min(Math.PI * 0.92, Math.max(0, (count - 1) * Math.PI * 0.3));
        const start = count === 1 ? baseAngle : baseAngle - spread / 2;
        const step = count === 1 ? 0 : spread / (count - 1);
        const a = start + step * i;
        return {
          x: c.pos.x + Math.cos(a) * previewRadius,
          y: c.pos.y + Math.sin(a) * previewRadius,
        };
      });
      const positions = fitPositionsToStage(
        rawPositions,
        stageSize,
        edgePadding + OPTION_DIAMETER * 0.54,
      );
      previews.push({
        id: c.node.id,
        label: c.node.label,
        origin: c.pos,
        strength,
        children: c.node.children.map((node, i) => ({ node, pos: positions[i] })),
      });
    }
    return previews
      .sort((a, b) => b.strength - a.strength)
      .slice(0, dial.phase === 'drawing' ? 2 : 1);
  }, [
    dial.phase,
    dial.pointer,
    dial.activeEntry,
    idleHover,
    idleAnchor,
    clampedChildren,
    persistentOptions,
    dial.homed,
    recentVelocity,
    recentAccel,
    stageSize,
    edgePadding,
    flowMode,
  ]);

  // Counter projection — when homed on an option whose share narrows count,
  // compute what the count WOULD become on commit. Shown inline next to
  // the live count: "≈ 28,400 → 9,088 jobs". Anticipates consequence.
  const projectedCount = useMemo(() => {
    if (count === null || !dial.homed) return null;
    const homedNode = dial.visibleChildren.find(c => c.node.id === dial.homed!.id)?.node;
    if (!homedNode || homedNode.share === undefined || homedNode.share === 1) return null;
    return count * homedNode.share;
  }, [count, dial.homed, dial.visibleChildren]);

  const interactionPayload = useMemo<DialInteractionPayload>(() => {
    const options = dial.phase === 'drawing'
      ? clampedChildren
      : persistentOptions ?? [];
    const strongestPreview = proximityPreviews[0];
    const homedLabel = dial.homed
      ? options.find(option => option.node.id === dial.homed?.id)?.node.label
      : undefined;
    const mode =
      dial.phase === 'drawing' && homedLabel
        ? 'homing'
        : strongestPreview
          ? 'previewing'
          : dial.phase === 'drawing'
            ? 'drawing'
            : dial.phase === 'committed'
              ? 'committed-options'
              : 'idle-options';
    return {
      mode,
      phase: dial.phase,
      depth: Math.max(0, dial.path.length - 1),
      activeLabel: dial.activeEntry?.node.label ?? tree.label,
      optionLabels: options.map(option => option.node.label),
      homedLabel,
      preview: strongestPreview
        ? {
            parentLabel: strongestPreview.label,
            childLabels: strongestPreview.children.map(child => child.node.label),
            strength: strongestPreview.strength,
          }
        : undefined,
    };
  }, [
    clampedChildren,
    dial.activeEntry,
    dial.homed,
    dial.path.length,
    dial.phase,
    persistentOptions,
    proximityPreviews,
    tree.label,
  ]);

  useEffect(() => {
    onInteractionChange?.(interactionPayload);
  }, [interactionPayload, onInteractionChange]);

  return (
    // LazyMotion loads the `domMax` feature bundle so the lightweight `m`
    // components actually animate. WITHOUT this, every `m.*` element renders
    // frozen at its `initial` state — options stuck at opacity:0 (invisible),
    // nothing transitions (janky snaps). domMax (not domAnimation) because the
    // dial uses `layout` (PathLine FLIP), `whileTap`, and AnimatePresence exits.
    <LazyMotion features={domMax}>
    <m.div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden select-none"
      style={{
        backgroundColor: theme.paper,
        color: theme.ink,
        fontFamily: 'Inter, system-ui, sans-serif',
        // Cursor signals interaction state: drawing → grabbing, idle/committed → grab.
        // Affordance hint: the whole surface can be grabbed for a drag gesture.
        // (Buttons override to 'pointer' via their own style.)
        cursor: dial.phase === 'drawing' ? 'grabbing' : 'grab',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        // Seed defaults for the cursor-driven custom props so glass + parallax
        // render sensibly before the first pointer move. (CSS var fallbacks in
        // the consumers also cover this, but seeding keeps SSR/first-paint clean.)
        ['--rd-sheen-x' as string]: '28%',
        ['--rd-sheen-y' as string]: '4%',
        ['--rd-parallax-x' as string]: '0',
        ['--rd-parallax-y' as string]: '0',
      }}
      // Subtle stage parallax — entire page floats Y by 1.5px on a 14s sine.
      // Time dilates 2.5x when user is drawing — the page "settles" to listen.
      animate={reduceMotion ? {} : { y: [0, -1.5, 0, 1.5, 0] }}
      transition={{ duration: 14 * ambientDilation, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Vignette glow — a fixed-size accent radial that FOLLOWS the active
          node via transform (not an animated background-image, which would
          repaint the whole layer every move). The gradient is centred on its
          own box; we translate the box to the anchor. GPU-only. */}
      <m.div
        className="pointer-events-none absolute"
        style={{
          left: 0,
          top: 0,
          width: VIGNETTE_SIZE,
          height: VIGNETTE_SIZE,
          borderRadius: '50%',
          background: `radial-gradient(circle at center, ${mix(theme.accent, 9)} 0%, transparent 58%)`,
          willChange: 'transform',
        }}
        // x/y track the anchor (active node or idle centre); the spring gives
        // the glow a gentle lag so it "settles" toward where you are.
        animate={{
          x: anchor.x - VIGNETTE_SIZE / 2,
          y: anchor.y - VIGNETTE_SIZE / 2,
          opacity: reduceMotion ? 0.7 : [0.5, 0.85, 0.5],
        }}
        transition={{
          x: { type: 'spring', stiffness: 90, damping: 26, mass: 1 },
          y: { type: 'spring', stiffness: 90, damping: 26, mass: 1 },
          opacity: { duration: 6 * ambientDilation, repeat: Infinity, ease: 'easeInOut' },
        }}
      />
      {/* Paper noise overlay — drifts slowly via TRANSFORM (not background-
          position, which repaints). Over-sized by 16px on every edge so the
          ±8px drift never reveals a gap. */}
      {theme.noise && (
        <m.div
          className="pointer-events-none absolute"
          style={{
            top: -16,
            left: -16,
            right: -16,
            bottom: -16,
            backgroundImage: theme.noise,
            backgroundRepeat: 'repeat',
            willChange: reduceMotion ? undefined : 'transform',
          }}
          animate={reduceMotion ? {} : { x: [0, 8, 0], y: [0, 6, 0] }}
          transition={{ duration: 60 * ambientDilation, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {/* Top-left header */}
      {(title || hint) && (
        <div className="pointer-events-none absolute z-30" style={{ left: 32, top: 32 }}>
          {title && (
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: mix(theme.ink, isLight ? 45 : 55),
                fontFamily: theme.mono,
                fontFeatureSettings: '"tnum" 1',
              }}
            >
              {title}
            </div>
          )}
          {hint && (
            <div
              className="mt-1.5"
              style={{
                fontSize: 13,
                fontStyle: 'italic',
                color: mix(theme.ink, isLight ? 55 : 65),
                fontFamily: theme.serif,
                letterSpacing: '-0.005em',
              }}
            >
              {hint}
            </div>
          )}
        </div>
      )}

      {/* Top-right toolbar slot */}
      {(toolbar || dial.committed) && (
        <div className="absolute z-30 flex items-center" style={{ right: 32, top: 32, gap: 10 }}>
          {toolbar}
          <ResetButton theme={theme} onClick={dial.reset} />
        </div>
      )}
      {!toolbar && !dial.committed && (
        <div className="absolute z-30" style={{ right: 32, top: 32 }}>
          <ResetButton theme={theme} onClick={dial.reset} />
        </div>
      )}

      {/* One composed prose line — count + path read as a single sentence.
          When homed on a narrowing option, also shows projected count after
          commit (e.g., "≈ 28,400 → 9,088 jobs") — anticipating consequence. */}
      <PathLine
        theme={theme}
        count={count}
        projectedCount={projectedCount}
        label={countLabel}
        format={formatCount}
        path={dial.path.slice(1).map(p => p.node)}
        onPopTo={dial.phase !== 'drawing' ? dial.popToLevel : undefined}
        pulseKey={dial.path.length}
        reduceMotion={reduceMotion}
        tabReturnTick={tabReturnTick}
      />

      {/* Apply CTA — only when committed AND consumer wired up onApply.
          Slides in beneath the PathLine; click or Enter fires the payload.
          Issue #12. */}
      <AnimatePresence>
        {onApply && dial.phase === 'committed' && dial.path.length > 1 && (
          <ApplyButton
            theme={theme}
            label={applyLabel}
            count={count}
            formatCount={formatCount}
            onClick={applyCurrent}
          />
        )}
      </AnimatePresence>

      <div
        ref={stageRef}
        className="absolute inset-0 touch-none focus:outline-none"
        // ARIA: dial is a hierarchical menu. role="menu" makes children
        // role-aware to screen readers; aria-expanded reflects whether the
        // fan is open (drawing) or at rest. aria-label gives the menu's
        // overall name so screen readers can announce context on focus.
        // Issue #11.
        role="menu"
        aria-label={title ?? `${tree.label} selector`}
        aria-expanded={dial.phase === 'drawing' || dial.path.length > 1}
        aria-orientation="horizontal"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        {/* Paper warp — pressure indent under the active node. Sits below ink. */}
        {dial.activeEntry && (
          <PaperWarp pos={dial.activeEntry.pos} mode={theme.mode} />
        )}

        {/* Commit wave — radial pulse on each new commit. */}
        <CommitWave path={dial.path} theme={theme} reduceMotion={reduceMotion} />

        {/* Settle ripples — soft water-drop ring on each commit, stacks up
            to 3. Layered with CommitWave (iris-open) for a richer landing. */}
        <SettleRipples path={dial.path} theme={theme} reduceMotion={reduceMotion} />

        {/* Commit particles — small organic burst on each level transition. */}
        <CommitParticles path={dial.path} theme={theme} reduceMotion={reduceMotion} />

        {/* Ink layer */}
        <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }}>
          <AnimatePresence>
            {dial.frozenStrokes.map((stroke, i) => (
              <FrozenStrokeLayer
                key={stroke.id}
                stroke={stroke}
                fromPos={dial.path[i]?.pos}
                toPos={dial.path[i + 1]?.pos}
                toIsActive={i === dial.frozenStrokes.length - 1 && dial.phase !== 'drawing'}
                index={i}
                total={dial.frozenStrokes.length}
                exitMode={backtrackMode}
                theme={theme}
              />
            ))}
          </AnimatePresence>
          {dial.phase === 'drawing' && renderedLive.length >= 2 && dial.activeEntry && (
            <LiveStrokeLayer
              points={renderedLive}
              activePos={dial.activeEntry.pos}
              theme={theme}
            />
          )}
          {commandStroke.length >= 2 && (
            <polyline
              points={polylinePoints(commandStroke)}
              fill="none"
              stroke={mix(theme.accent, isLight ? 62 : 72)}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1 7"
              opacity={0.82}
            />
          )}
          {/* Single traveling pulse along the whole concatenated path —
              directional energy flowing toward the user's current position. */}
          {fullConcatenatedPath && <TravelingPulse d={fullConcatenatedPath} theme={theme} />}
          {/* Ink meniscus — surface-tension highlight at the live ink tip.
              Only the most recent stroke gets it (older strokes look stale
              with the highlight). Issue #313. */}
          {dial.phase === 'drawing' && renderedLive.length >= 2 && (
            <InkMeniscus
              tip={renderedLive[renderedLive.length - 1]}
              strokeWidth={2.2}
              intensity={1}
              theme={theme}
            />
          )}
        </svg>

        <AnimatePresence>
          {commandFlash && (
            <m.div
              key={commandFlash.id}
              className="pointer-events-none absolute"
              style={{
                left: commandFlash.pos.x,
                top: commandFlash.pos.y,
                zIndex: 28,
                transform: 'translate(-50%, -50%)',
                padding: '7px 10px',
                borderRadius: 999,
                background: `color-mix(in srgb, ${theme.paper} ${isLight ? 78 : 56}%, transparent)`,
                border: `1px solid ${mix(theme.accent, 28)}`,
                boxShadow: `0 10px 26px ${mix(theme.ink, isLight ? 10 : 26)}`,
                backdropFilter: 'blur(14px) saturate(135%)',
                WebkitBackdropFilter: 'blur(14px) saturate(135%)',
                color: theme.accent,
                fontFamily: theme.mono,
                fontSize: 9,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
              initial={{ opacity: 0, scale: 0.82, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -6 }}
              transition={{ duration: 0.24, ease: EXPO_OUT }}
            >
              {gestureLabel(commandFlash.command)}
            </m.div>
          )}
        </AnimatePresence>

        {/* Idle root */}
        {dial.phase === 'idle' && stageSize.w > 0 && (
          <IdleRoot
            pos={idleAnchor}
            theme={theme}
            label={tree.label}
            reduceMotion={reduceMotion}
            hintFade={idleHoverProximity}
            hasGreeted={hasGreeted}
          />
        )}

        {/* Ambient ripple — soft ring emanates from idle root every 7s. */}
        {dial.phase === 'idle' && !reduceMotion && stageSize.w > 0 && (
          <AmbientRipple pos={idleAnchor} theme={theme} />
        )}

        {/* First-run hint — one-shot dotted arc from root toward the first
            child, after 3s idle. Persisted via localStorage. Issue #9. */}
        {dial.phase === 'idle' && stageSize.w > 0 && tree.children?.[0] && (
          <FirstRunHint
            rootPos={idleAnchor}
            targetPos={{
              // Hint points toward the 12-o'clock option (first child).
              ...firstRunHintTarget(idleAnchor, fanRadius, flowMode),
            }}
            theme={theme}
            reduceMotion={reduceMotion}
          />
        )}

        {/* Idle motes — small ink flecks drift across the paper, like dust.
            Cursor position biases drift 30% toward the user's attention. */}
        {dial.phase === 'idle' && !reduceMotion && stageSize.w > 0 && (
          <IdleMotes stageSize={stageSize} theme={theme} cursorPos={idleHover} />
        )}

        {/* Cursor halo while drawing — soft accent dot follows the pointer,
            sized by velocity. Confidence drives brightness. */}
        {dial.phase === 'drawing' && dial.pointer && (
          <CursorHalo
            pos={dial.pointer}
            stroke={dial.liveStroke}
            theme={theme}
          />
        )}

        {/* Persistent options — ALWAYS visible when not drawing. Faintly
            present at rest (35% baseline), brighten with cursor proximity,
            click any to commit directly. The drag gesture remains as a
            bonus — both interaction modes coexist.
            NOTE: deliberately NOT wrapped in a parallax (transform) layer —
            an ancestor transform establishes a backdrop-root and would kill
            these glass panes' frost. Their depth comes from the planet layer
            drifting behind them instead. */}
        <AnimatePresence>
          {persistentOptions &&
            persistentOptions.map((c, i) => (
              <IdleGhost
                key={`ghost-${c.node.id}`}
                pos={c.pos}
                label={c.node.label}
                icon={c.node.icon}
                index={i}
                proximity={dial.phase === 'committed' ? 0.82 : Math.max(0.5, idleHoverProximity)}
                theme={theme}
                onSelect={() =>
                  dial.selectChild(
                    c.node,
                    dial.phase === 'idle' ? idleAnchor : undefined,
                    c.pos,
                  )
                }
                acceptPointer={dial.phase !== 'drawing'}
                breathing={dial.phase === 'idle'}
                reduceMotion={reduceMotion}
                focused={focusedOptionIndex === i}
              />
            ))}
        </AnimatePresence>

        {/* Settled past nodes — rendered as a little SOLAR SYSTEM. Each
            committed choice is a planet that gently orbits its anchor;
            adjacent planets feel each other's gravity (the "vicinity"),
            leaning together when their orbits drift close, with a glowing
            field between them. The root is the warm sun. Clicking a planet
            jumps back to that level. Frozen mid-gesture (pointer-capture
            conflict) and under prefers-reduced-motion.
            Parallax depth 2 — a whisper of depth behind the static glass
            options. Kept small (was 5) so the trail doesn't visibly drift
            away from the ink that connects to its anchors. (Only the solid
            layer parallaxes; glass can't sit inside a transform.) */}
        <div style={reduceMotion ? { position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' } : parallaxLayer(2, 3)}>
          <PlanetaryTrail
            entries={dial.path.slice(0, -1).map((entry, i) => ({
              node: entry.node,
              pos: entry.pos,
              isRoot: i === 0,
            }))}
            theme={theme}
            reduceMotion={reduceMotion}
            onJumpBack={
              dial.phase !== 'drawing'
                ? (i: number) => dial.popToLevel(i - 1)
                : undefined
            }
          />
        </div>

        {/* Active node — the current focus. Enters scaled to option size and
            springs DOWN to its smaller settled size (the "shrink to normal"
            that telegraphs "I just became your place — now move on"). */}
        {dial.activeEntry && (
          <ActiveBubble
            pos={dial.activeEntry.pos}
            label={dial.activeEntry.node.label}
            isRoot={dial.path.length === 1}
            theme={theme}
            justPressed={dial.path.length === 1 && dial.phase === 'drawing'}
            approachStrength={dial.homed?.strength ?? 0}
            reduceMotion={reduceMotion}
          />
        )}

        {/* Anticipatory previews — multiple options' children fade in behind
            them as the cursor approaches, scaled by proximity. Reveals where
            each nearby option WOULD lead before the user commits. */}
        <AnimatePresence>
          {proximityPreviews.flatMap(preview =>
            preview.children.map((c, i) => (
              <SubMenuGhost
                key={`prev-${preview.id}-${c.node.id}`}
                pos={c.pos}
                origin={preview.origin}
                label={c.node.label}
                index={i}
                strength={preview.strength}
                theme={theme}
              />
            )),
          )}
        </AnimatePresence>

        {/* Options fan */}
        <AnimatePresence>
          {dial.phase === 'drawing' &&
            clampedChildren.map((c, i) => {
              // Magnetic pull — homed option reaches toward the cursor.
              const isHomed = dial.homed?.id === c.node.id;
              const pull =
                isHomed && dial.pointer && dial.activeEntry
                  ? {
                      x: (dial.pointer.x - c.pos.x) * MAX_OPTION_PULL * dial.homed!.strength,
                      y: (dial.pointer.y - c.pos.y) * MAX_OPTION_PULL * dial.homed!.strength,
                    }
                  : { x: 0, y: 0 };
              return (
                <OptionBubble
                  key={c.node.id}
                  pos={c.pos}
                  pull={pull}
                  label={c.node.label}
                  icon={c.node.icon}
                  index={i}
                  homedStrength={isHomed ? dial.homed!.strength : 0}
                  fanOpacity={fanOpacityMultiplier}
                  // Semantic indicators: dots around perimeter show child count
                  // (zero = leaf), border weight encodes selectivity via share.
                  childCount={c.node.children?.length ?? 0}
                  share={c.node.share}
                  theme={theme}
                  reduceMotion={reduceMotion}
                />
              );
            })}
        </AnimatePresence>
      </div>

    </m.div>
    </LazyMotion>
  );
}

