import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
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
  FAN_RADIUS,
  MAX_OPTION_PULL,
  OPTION_DIAMETER,
  SETTLED_TRIM_RADIUS,
  SMOOTH_OUT,
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
import {
  ActiveBubble,
  CursorHalo,
  IdleGhost,
  IdleRoot,
  OptionBubble,
  SettledNode,
  SubMenuGhost,
} from './bubbles';
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
import type {
  DialNode,
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
  onChange,
  onComplete,
  onApply,
  applyLabel = 'Apply',
}: RadialDialProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const reduceMotion = usePrefersReducedMotion();

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

  const dial = useRadialDial({
    tree,
    commitDistance,
    fanRadius,
    onChange,
    onComplete,
  });

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
    return { x: stageSize.w / 2, y: isMobile ? stageSize.h * 0.62 : stageSize.h * 0.5 };
  }, [stageSize]);

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
      if (stageRef.current) dial.onPointerDown(e, stageRef.current);
    },
    [dial],
  );
  // Idle-state hover tracking — drives the sneak-peek ghost preview of
  // level-1 children when the cursor approaches the root.
  const [idleHover, setIdleHover] = useState<Vec | null>(null);
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      // Always pass through to the engine; it self-gates on phase.
      dial.onPointerMove(e, stage);
      // For idle hover, capture pointer relative to stage when not drawing.
      if (dial.phase === 'idle') {
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
      if (stageRef.current) dial.onPointerUp(e, stageRef.current);
    },
    [dial],
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

  // Always-visible options — computed early because the keyboard handler
  // (below) needs to reach them for arrow-key cycling.
  //
  // - Phase 'idle'      → tree.children (level-1 categories)
  // - Phase 'committed' → activeEntry.children (next level after last commit)
  // - Phase 'drawing'   → null (real options render via the drawing flow)
  const persistentOptions = useMemo(() => {
    if (dial.phase === 'drawing') return null;
    const activeNode = dial.activeEntry?.node ?? tree;
    const children = activeNode.children;
    if (!children?.length) return null;
    const anchor = dial.activeEntry?.pos ?? idleAnchor;
    const grandparent =
      dial.path.length >= 2 ? dial.path[dial.path.length - 2].pos : null;
    const positions = placeChildren(anchor, grandparent, children.length, fanRadius);
    return children.map((node, i) => ({ node, pos: positions[i] }));
  }, [dial.phase, dial.activeEntry, dial.path, tree, idleAnchor, fanRadius]);
  // Keyboard handler — Escape pops one level (back-out navigation).
  // Enter applies (committed) OR commits focused option.
  // ArrowLeft/Right cycle the focused option clockwise/counter-clockwise.
  // ArrowUp focuses the option closest to 12 o'clock.
  // ArrowDown commits the focused option.
  // Issues #11, #12, #26.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape — back out one level.
      if (e.key === 'Escape' && dial.path.length > 1) {
        e.preventDefault();
        dial.popToLevel(dial.path.length - 2);
        setFocusedOptionIndex(null);
        return;
      }
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

      if (e.key === 'ArrowDown') {
        if (focusedOptionIndex === null || len === 0) return;
        e.preventDefault();
        const opt = options[focusedOptionIndex];
        if (opt) dial.selectChild(opt.node, opt.pos);
        setFocusedOptionIndex(null);
        return;
      }

      if (e.key === 'Enter') {
        // Priority 1: if a keyboard-focused option exists, commit it.
        if (focusedOptionIndex !== null && len > 0) {
          e.preventDefault();
          const opt = options[focusedOptionIndex];
          if (opt) dial.selectChild(opt.node, opt.pos);
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

  // Anticipatory previews — for EVERY option that has children, compute the
  // user's proximity to it. Options the cursor is approaching reveal their
  // children behind them at proximity-scaled opacity. Multiple options can
  // preview simultaneously (the user is "considering" several). The homed
  // option additionally benefits from a homed-strength + acceleration boost.
  //
  // Replaces the single-preview model: now the system shows where each
  // nearby option WOULD lead, smoothly scaled. Reveal happens during
  // approach (cursor-distance based), not just on lock-in.
  const proximityPreviews = useMemo(() => {
    if (dial.phase !== 'drawing' || !dial.pointer || !dial.activeEntry) return [];
    if (recentVelocity > 0.7) return []; // hide entirely when flicking fast
    const trajectoryBoost = Math.max(-0.25, Math.min(0.25, -recentAccel * 0.5));
    const previews: Array<{ id: string; strength: number; children: Array<{ node: DialNode; pos: Vec }> }> = [];
    for (const c of clampedChildren) {
      if (!c.node.children?.length) continue;
      const dist = Math.hypot(dial.pointer.x - c.pos.x, dial.pointer.y - c.pos.y);
      // Proximity ramps from 0 at 110px out to 1 at the bubble's edge.
      const REVEAL_RANGE = 110;
      const edgeDist = Math.max(0, dist - OPTION_DIAMETER / 2);
      const proximity = Math.max(0, 1 - edgeDist / REVEAL_RANGE);
      if (proximity < 0.15) continue;
      // Combined strength: proximity (always present) + homed boost (only
      // for the option the user is actively committing toward).
      const isHomed = dial.homed?.id === c.node.id;
      const homedBoost = isHomed ? dial.homed!.strength * 0.4 : 0;
      const strength = Math.max(0, Math.min(1, proximity * 0.7 + homedBoost + (isHomed ? trajectoryBoost : 0)));
      const positions = placeChildren(
        c.pos,
        dial.activeEntry.pos,
        c.node.children.length,
        fanRadius,
      );
      previews.push({
        id: c.node.id,
        strength,
        children: c.node.children.map((node, i) => ({ node, pos: positions[i] })),
      });
    }
    return previews;
  }, [dial.phase, dial.pointer, dial.activeEntry, clampedChildren, dial.homed, recentVelocity, recentAccel, fanRadius]);

  // Counter projection — when homed on an option whose share narrows count,
  // compute what the count WOULD become on commit. Shown inline next to
  // the live count: "≈ 28,400 → 9,088 jobs". Anticipates consequence.
  const projectedCount = useMemo(() => {
    if (count === null || !dial.homed) return null;
    const homedNode = dial.visibleChildren.find(c => c.node.id === dial.homed!.id)?.node;
    if (!homedNode || homedNode.share === undefined || homedNode.share === 1) return null;
    return count * homedNode.share;
  }, [count, dial.homed, dial.visibleChildren]);

  return (
    <m.div
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
      }}
      // Subtle stage parallax — entire page floats Y by 1.5px on a 14s sine.
      // Time dilates 2.5x when user is drawing — the page "settles" to listen.
      animate={reduceMotion ? {} : { y: [0, -1.5, 0, 1.5, 0] }}
      transition={{ duration: 14 * ambientDilation, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Vignette overlay — accent radial gradient that follows active.
          Breathing slows when user is attentive (drawing). */}
      <m.div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at ${anchor.x}px ${anchor.y}px, ${mix(theme.accent, 8)} 0%, transparent 38%)`,
          transition: `background-image 320ms cubic-bezier(${SMOOTH_OUT.join(',')})`,
        }}
        animate={reduceMotion ? {} : { opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 6 * ambientDilation, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Paper noise overlay — drifts position slowly. Even slower while drawing. */}
      {theme.noise && (
        <m.div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: theme.noise,
            backgroundRepeat: 'repeat',
          }}
          animate={reduceMotion ? {} : { backgroundPositionX: ['0px', '8px', '0px'], backgroundPositionY: ['0px', '6px', '0px'] }}
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
              x: idleAnchor.x,
              y: idleAnchor.y - fanRadius * 0.7,
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
            bonus — both interaction modes coexist. */}
        <AnimatePresence>
          {persistentOptions &&
            persistentOptions.map((c, i) => (
              <IdleGhost
                key={`ghost-${c.node.id}`}
                pos={c.pos}
                label={c.node.label}
                icon={c.node.icon}
                index={i}
                proximity={Math.max(0.5, idleHoverProximity)}
                theme={theme}
                onSelect={() => dial.selectChild(c.node, idleAnchor)}
                breathing={dial.phase === 'idle'}
                reduceMotion={reduceMotion}
                focused={focusedOptionIndex === i}
              />
            ))}
        </AnimatePresence>

        {/* Settled past nodes — the trail of where we've been. Now CLICKABLE:
            tap any settled node to jump back to that level (undo to here).
            The trail itself becomes the navigation. Affordance hint visible
            on hover post-release. Disabled mid-gesture (would conflict with
            pointer capture) — settled nodes are interactive only when phase
            is not 'drawing'. */}
        {dial.path.slice(0, -1).map((entry, i) => (
          <SettledNode
            key={`settled-${i}-${entry.node.id}`}
            pos={entry.pos}
            label={entry.node.label}
            isRoot={i === 0}
            theme={theme}
            onJumpBack={
              dial.phase !== 'drawing' && i >= 1
                ? () => dial.popToLevel(i - 1)
                : undefined
            }
            reduceMotion={reduceMotion}
          />
        ))}

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
  );
}

