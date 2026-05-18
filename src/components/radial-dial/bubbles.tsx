import { useMemo } from 'react';
import { m } from 'framer-motion';
import { strokeConfidence } from './ink';
import {
  ACTIVE_DIAMETER,
  BLOOM_STAGGER_MS,
  OPTION_DIAMETER,
  OVERSHOOT,
  SETTLED_DIAMETER,
  SMOOTH_OUT,
} from './geometry';
import { mix, mixTwo } from './themes';
import type { InkPoint, RadialDialTheme, Vec } from './types';

/**
 * Bubbles — every round bubble visible in the dial.
 *
 *   IdleRoot       → wax-seal-style root at rest, breathes + greets first visit
 *   SettledNode    → small clickable trail markers (jump-back navigation)
 *   ActiveBubble   → current "you are here" with approach-strength morphing
 *   OptionBubble   → fan options during drawing, with magnetic pull + dots
 *   IdleGhost      → always-visible clickable option (idle + committed phases)
 *   SubMenuGhost   → preview of homed option's children (Houdini hotbox feel)
 *   CursorHalo     → soft accent dot that follows pointer while drawing
 *   ChildCountDots → perimeter dots on options indicating branch count
 *
 * All share a visual grammar: wax-seal style on light themes, embered glow on
 * dark; hover affordances via inline style mutation; geometry imported from
 * the shared module. No engine state coupling — purely props-in, JSX-out.
 */

// =============================================================================
// ChildCountDots — small dots placed evenly around an option's outer
// perimeter, one per child. Pre-attentive subitizing (≤7 dots counted at a
// glance). Zero dots = leaf node — the absence IS the signal.
// =============================================================================
export function ChildCountDots({
  count,
  homed,
  theme,
}: {
  count: number;
  homed: boolean;
  theme: RadialDialTheme;
}) {
  const visibleCount = Math.min(8, count);
  const dotColor = homed ? mix(theme.accent, 60) : mix(theme.ink, 28);
  const dotSize = 3;
  const ringRadius = OPTION_DIAMETER / 2 + 6;
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ width: OPTION_DIAMETER, height: OPTION_DIAMETER }}
    >
      {Array.from({ length: visibleCount }, (_, i) => {
        const angle = (i / visibleCount) * Math.PI * 2 - Math.PI / 2;
        const cx = OPTION_DIAMETER / 2 + Math.cos(angle) * ringRadius;
        const cy = OPTION_DIAMETER / 2 + Math.sin(angle) * ringRadius;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: cx - dotSize / 2,
              top: cy - dotSize / 2,
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: dotColor,
              transition: `background 180ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          />
        );
      })}
    </div>
  );
}

// =============================================================================
// OptionBubble — fan option during drawing. Magnetic pull toward cursor when
// homed; border weight encodes selectivity; perimeter dots show branch count.
// =============================================================================
export function OptionBubble({
  pos,
  pull,
  label,
  icon,
  index,
  homedStrength,
  fanOpacity = 1,
  childCount = 0,
  share,
  theme,
  reduceMotion,
}: {
  pos: Vec;
  pull: Vec;
  label: string;
  icon?: React.ReactNode;
  index: number;
  homedStrength: number;
  /** 0–1 multiplier — fast users get a faded fan (Kurtenbach expert mode). */
  fanOpacity?: number;
  /** Number of children — drives dot ring around the perimeter. */
  childCount?: number;
  /** Share — drives border weight (lower share = thicker = more selective). */
  share?: number;
  theme: RadialDialTheme;
  reduceMotion: boolean;
}) {
  const homed = homedStrength > 0;
  // Homed option keeps full presence regardless of fan fade — the user is
  // about to commit to it, so it shouldn't disappear with everyone else.
  const effectiveOpacity = homed ? 1 : fanOpacity;
  const isLight = theme.mode === 'light';
  // Selectivity-encoded border weight. Broad options (share ≥ 0.4) at 1px;
  // moderately selective (share 0.2–0.4) at 1.4px; narrow (< 0.2) at 1.8px.
  const selectivityWeight =
    share === undefined || share >= 0.4 ? 1 : share >= 0.2 ? 1.4 : 1.8;
  const idleBorder = `${selectivityWeight}px`;
  const homedBorder = `${selectivityWeight + 0.5}px`;
  return (
    <m.div
      className="pointer-events-none absolute flex flex-col items-center justify-center"
      style={{
        left: pos.x - OPTION_DIAMETER / 2,
        top: pos.y - OPTION_DIAMETER / 2,
        width: OPTION_DIAMETER,
        height: OPTION_DIAMETER,
        borderRadius: '50%',
        background: homed
          ? mixTwo(theme.paper, 92 - homedStrength * 8, theme.accent, homedStrength * 10)
          : mix(theme.paper, isLight ? 88 : 80, theme.paper),
        boxShadow: homed
          ? [
              `inset 0 0 0 ${homedBorder} ${mix(theme.accent, 45 + homedStrength * 50)}`,
              `0 2px 0 ${mix(theme.ink, 4)}`,
              `0 6px 18px ${mix(theme.accent, 6 + homedStrength * 22)}`,
              `0 0 ${20 + homedStrength * 20}px ${mix(theme.accent, homedStrength * 16)}`,
            ].join(', ')
          : [
              `inset 0 0 0 ${idleBorder} ${mix(theme.ink, isLight ? 14 : 22)}`,
              `0 1px 0 ${mix(theme.ink, isLight ? 3 : 0)}`,
              `0 4px 14px ${mix(theme.ink, isLight ? 7 : 26)}`,
            ].join(', '),
        color: homed ? mixTwo(theme.accent, 65 + homedStrength * 35, theme.ink, 10) : mix(theme.ink, 80),
        zIndex: 4,
      }}
      initial={{ scale: 0.5, opacity: 0, x: 0, y: 0 }}
      animate={{
        scale: 1 + homedStrength * 0.14,
        opacity: effectiveOpacity,
        x: pull.x,
        y: pull.y,
      }}
      exit={{ scale: 0.92, opacity: 0 }}
      transition={
        reduceMotion
          ? { duration: 0.18 }
          : {
              default: {
                delay: index * (BLOOM_STAGGER_MS / 1000),
                type: 'spring',
                stiffness: 200,
                damping: 22,
                mass: 0.7,
              },
              // Magnetic pull — its own spring, snappier so the option feels
              // genuinely attracted to the cursor rather than lagging.
              x: { type: 'spring', stiffness: 260, damping: 24, mass: 0.5 },
              y: { type: 'spring', stiffness: 260, damping: 24, mass: 0.5 },
              opacity: { duration: 0.42, ease: SMOOTH_OUT },
            }
      }
    >
      {childCount > 0 && (
        <ChildCountDots count={childCount} homed={homed} theme={theme} />
      )}
      {icon && (
        <span
          style={{
            marginBottom: 6,
            color: 'inherit',
            opacity: 0.92,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transform: `scale(${1 + homedStrength * 0.14})`,
            transition: `opacity 180ms cubic-bezier(${SMOOTH_OUT.join(',')}), transform 220ms cubic-bezier(${OVERSHOOT.join(',')})`,
          }}
        >
          {icon}
        </span>
      )}
      <span
        style={{
          fontSize: 16,
          fontWeight: homed ? 500 : 450,
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: '0.005em',
          padding: '0 6px',
          textAlign: 'center',
          lineHeight: 1.15,
          transition: `color 180ms cubic-bezier(${SMOOTH_OUT.join(',')})`,
        }}
      >
        {label}
      </span>
    </m.div>
  );
}

// =============================================================================
// ActiveBubble — current focus, smaller than options (inverted hierarchy).
// Morphs toward homed option's visual as approachStrength rises.
// =============================================================================
export function ActiveBubble({
  pos,
  label,
  isRoot,
  theme,
  justPressed,
  approachStrength = 0,
}: {
  pos: Vec;
  label: string;
  isRoot: boolean;
  theme: RadialDialTheme;
  justPressed: boolean;
  /** 0–1: how much the user is committing toward an option. */
  approachStrength?: number;
}) {
  const isLight = theme.mode === 'light';
  // As approach strength rises (0 → 1), the active bubble's accent presence
  // intensifies: deeper inset border, stronger glow, slight tint blend.
  const morphedBorder = `${1 + approachStrength * 0.6}px`;
  return (
    <m.div
      key={`active-${label}`}
      className="pointer-events-none absolute flex items-center justify-center"
      style={{
        left: pos.x - ACTIVE_DIAMETER / 2,
        top: pos.y - ACTIVE_DIAMETER / 2,
        width: ACTIVE_DIAMETER,
        height: ACTIVE_DIAMETER,
        borderRadius: '50%',
        background: mixTwo(
          theme.paper,
          isLight ? 65 - approachStrength * 8 : 85 - approachStrength * 8,
          theme.ink,
          isLight ? 6 + approachStrength * 4 : 8 + approachStrength * 4,
        ),
        boxShadow: [
          `inset 0 0 0 ${morphedBorder} ${mix(theme.ink, isLight ? 88 : 55)}`,
          justPressed
            ? `inset 0 2px 4px ${mix(theme.ink, isLight ? 10 : 18)}`
            : `inset 0 1px 2px ${mix(theme.ink, isLight ? 4 : 8)}`,
          `0 1px 0 ${mix(theme.ink, isLight ? 5 : 0)}`,
          `0 8px 20px ${mix(theme.ink, isLight ? 12 : 30)}`,
          `0 0 ${32 + approachStrength * 24}px ${mix(theme.accent, 16 + approachStrength * 22)}`,
        ].join(', '),
        zIndex: 5,
        transition: `box-shadow 220ms cubic-bezier(${SMOOTH_OUT.join(',')}), background 220ms cubic-bezier(${SMOOTH_OUT.join(',')})`,
      }}
      // Two distinct entry feels:
      //  - Root active: WAX-SEAL STAMP on first press (rotated + undersized).
      //  - Non-root active: SHRINKS down from option-bubble size.
      initial={
        isRoot
          ? { scale: 0.7, rotate: -3, opacity: 0 }
          : { scale: OPTION_DIAMETER / ACTIVE_DIAMETER, opacity: 1, rotate: 0 }
      }
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={
        isRoot
          ? { type: 'spring', stiffness: 220, damping: 13, mass: 0.65 }
          : { type: 'spring', stiffness: 200, damping: 24, mass: 0.85 }
      }
    >
      {/* Label flare: briefly saturates to accent on entry, settles to ink. */}
      <m.span
        key={`label-${label}`}
        style={{
          fontSize: 13,
          fontFamily: theme.serif,
          fontStyle: 'italic',
          letterSpacing: '0.005em',
          padding: '0 8px',
          textAlign: 'center',
          lineHeight: 1.1,
        }}
        initial={isRoot ? { color: theme.ink } : { color: theme.accent }}
        animate={{ color: theme.ink }}
        transition={{ duration: 0.7, ease: SMOOTH_OUT }}
      >
        {label}
      </m.span>
    </m.div>
  );
}

// =============================================================================
// SettledNode — past path entry behind the current active. Smaller and dimmer,
// reads as "you've been here." Clickable when not drawing → jump-back nav.
// =============================================================================
export function SettledNode({
  pos,
  label,
  isRoot,
  theme,
  onJumpBack,
}: {
  pos: Vec;
  label: string;
  isRoot: boolean;
  theme: RadialDialTheme;
  /** When provided, settled node becomes a clickable "jump back to here" target. */
  onJumpBack?: () => void;
}) {
  const isLight = theme.mode === 'light';
  const interactive = !!onJumpBack;
  // Root settled shows a quiet "·" — clicking would reset (handled by reset button).
  const showLabel = !isRoot;
  return (
    <m.button
      type="button"
      onClick={onJumpBack}
      disabled={!interactive}
      aria-label={interactive ? `Jump back to ${label}` : undefined}
      className={`absolute flex items-center justify-center ${interactive ? '' : 'pointer-events-none'}`}
      style={{
        left: pos.x - SETTLED_DIAMETER / 2,
        top: pos.y - SETTLED_DIAMETER / 2,
        width: SETTLED_DIAMETER,
        height: SETTLED_DIAMETER,
        borderRadius: '50%',
        background: mixTwo(theme.paper, isLight ? 76 : 88, theme.ink, isLight ? 3 : 5),
        boxShadow: [
          `inset 0 0 0 1px ${mix(theme.ink, isLight ? 30 : 26)}`,
          `0 1px 2px ${mix(theme.ink, isLight ? 6 : 16)}`,
        ].join(', '),
        zIndex: 4,
        border: 'none',
        padding: 0,
        cursor: interactive ? 'pointer' : 'default',
        transitionProperty: 'box-shadow, background, transform',
        transitionDuration: '180ms',
        transitionTimingFunction: `cubic-bezier(${SMOOTH_OUT.join(',')})`,
      }}
      initial={{ scale: ACTIVE_DIAMETER / SETTLED_DIAMETER, opacity: 0.85 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26, mass: 0.7 }}
      onMouseEnter={e => {
        if (!interactive) return;
        e.currentTarget.style.boxShadow = [
          `inset 0 0 0 1.5px ${mix(theme.accent, 50)}`,
          `0 4px 14px ${mix(theme.accent, 18)}`,
        ].join(', ');
        e.currentTarget.style.transform = 'scale(1.06)';
      }}
      onMouseLeave={e => {
        if (!interactive) return;
        e.currentTarget.style.boxShadow = [
          `inset 0 0 0 1px ${mix(theme.ink, isLight ? 30 : 26)}`,
          `0 1px 2px ${mix(theme.ink, isLight ? 6 : 16)}`,
        ].join(', ');
        e.currentTarget.style.transform = 'scale(1)';
      }}
      onFocus={e => {
        if (!interactive) return;
        e.currentTarget.style.boxShadow = [
          `inset 0 0 0 1.5px ${mix(theme.accent, 60)}`,
          `0 0 0 2px ${mix(theme.accent, 30)}`,
        ].join(', ');
      }}
      onBlur={e => {
        e.currentTarget.style.boxShadow = [
          `inset 0 0 0 1px ${mix(theme.ink, isLight ? 30 : 26)}`,
          `0 1px 2px ${mix(theme.ink, isLight ? 6 : 16)}`,
        ].join(', ');
      }}
    >
      <span
        style={{
          fontSize: showLabel ? 12 : 14,
          color: mix(theme.ink, isLight ? 60 : 70),
          fontFamily: theme.serif,
          fontStyle: 'italic',
          letterSpacing: '0.005em',
          padding: '0 4px',
          textAlign: 'center',
          lineHeight: 1.1,
          maxWidth: SETTLED_DIAMETER - 12,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {isRoot ? '·' : label.toLowerCase()}
      </span>
    </m.button>
  );
}

// =============================================================================
// IdleRoot — the wax-seal at rest. Breathes with a soft halo, greets first
// pointer entry with a stronger pulse. Static "tap or drag" caption below.
// =============================================================================
export function IdleRoot({
  pos,
  theme,
  label,
  reduceMotion,
  hintFade = 0,
  hasGreeted = false,
}: {
  pos: Vec;
  theme: RadialDialTheme;
  label: string;
  reduceMotion: boolean;
  /** 0 = full hint visibility; 1 = fully faded (cursor on root). */
  hintFade?: number;
  /** Whether the cursor has entered the page since load. One-time pulse trigger. */
  hasGreeted?: boolean;
}) {
  const isLight = theme.mode === 'light';
  const size = ACTIVE_DIAMETER;
  const ringSize = size * 1.7;
  const greetingTransition = !hasGreeted
    ? { duration: 2.6, repeat: Infinity, ease: SMOOTH_OUT }
    : { duration: 0.7, ease: OVERSHOOT };
  return (
    <>
      <m.div
        className="pointer-events-none absolute"
        style={{
          left: pos.x - ringSize / 2,
          top: pos.y - ringSize / 2,
          width: ringSize,
          height: ringSize,
          borderRadius: '50%',
          border: `1px solid ${mix(theme.accent, 18)}`,
        }}
        animate={reduceMotion ? {} : { scale: [1, 1.06, 1], opacity: [0.55, 0.25, 0.55] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: SMOOTH_OUT }}
      />
      {/* Warm halo that breathes — gentle accent glow opacity pulse. */}
      <m.div
        className="pointer-events-none absolute"
        style={{
          left: pos.x - size,
          top: pos.y - size,
          width: size * 2,
          height: size * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle at center, ${mix(theme.accent, 14)} 0%, transparent 55%)`,
          mixBlendMode: isLight ? 'multiply' : 'screen',
        }}
        animate={reduceMotion ? {} : { opacity: [0.5, 0.95, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: SMOOTH_OUT }}
      />
      <m.div
        className="pointer-events-none absolute flex items-center justify-center"
        style={{
          left: pos.x - size / 2,
          top: pos.y - size / 2,
          width: size,
          height: size,
          borderRadius: '50%',
          background: mixTwo(theme.paper, isLight ? 70 : 88, theme.ink, isLight ? 4 : 6),
          boxShadow: [
            `inset 0 0 0 1px ${mix(theme.ink, isLight ? 80 : 60)}`,
            `0 1px 0 ${mix(theme.ink, isLight ? 6 : 0)}`,
            `0 6px 14px ${mix(theme.ink, isLight ? 10 : 30)}`,
            `0 0 28px ${mix(theme.accent, 12)}`,
          ].join(', '),
        }}
        animate={
          reduceMotion
            ? {}
            : !hasGreeted
              ? { scale: [1, 1.08, 1], rotate: [0, 0.4, -0.4, 0] }
              : { scale: [1, 1.02, 1], rotate: [0, 0.35, -0.35, 0] }
        }
        transition={greetingTransition}
      >
        <span
          style={{
            fontSize: 12,
            color: theme.ink,
            letterSpacing: '0.005em',
            fontFamily: theme.serif,
            fontStyle: 'italic',
          }}
        >
          {label}
        </span>
      </m.div>
      <div
        className="pointer-events-none absolute text-center"
        style={{
          left: pos.x - 100,
          top: pos.y + size * 0.95,
          width: 200,
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: mix(theme.ink, 42),
          fontFamily: theme.mono,
          opacity: 1 - hintFade * 0.85,
          transform: `translateY(${hintFade * 4}px)`,
          transition: `opacity 240ms cubic-bezier(${SMOOTH_OUT.join(',')}), transform 240ms cubic-bezier(${SMOOTH_OUT.join(',')})`,
        }}
      >
        tap or drag
      </div>
    </>
  );
}

// =============================================================================
// IdleGhost — always-visible CLICKABLE option bubble shown when not drawing.
// Faded at rest; brightens with proximity. Click commits directly. Drag still
// works on the wax seal / empty paper — clicking is the obvious path.
// =============================================================================
export function IdleGhost({
  pos,
  label,
  icon,
  index,
  proximity,
  theme,
  onSelect,
  breathing = true,
  reduceMotion = false,
}: {
  pos: Vec;
  label: string;
  icon?: React.ReactNode;
  index: number;
  proximity: number;
  theme: RadialDialTheme;
  /** Click commits this option directly. */
  onSelect?: () => void;
  /** Whether to apply the slow idle breath (paused during drawing). Issue #312. */
  breathing?: boolean;
  /** Honor prefers-reduced-motion — no breath when true. */
  reduceMotion?: boolean;
}) {
  const isLight = theme.mode === 'light';
  // 45–85% opacity range — these are real affordances, not transient previews.
  const opacity = Math.min(0.85, 0.45 + proximity * 0.4);
  const scale = 0.88 + proximity * 0.12;
  const interactive = !!onSelect;
  // Per-bubble random breath phase so siblings don't pulse in sync. Stable
  // across re-renders of this bubble (useMemo with empty deps). Issue #312.
  const breathDelay = useMemo(() => Math.random() * 1.5, []);
  return (
    <m.button
      type="button"
      onClick={onSelect}
      // stopPropagation on pointer-down so the stage doesn't simultaneously
      // start a drag gesture. Click commits cleanly without engine involvement.
      onPointerDown={e => e.stopPropagation()}
      disabled={!interactive}
      aria-label={interactive ? `Choose ${label}` : undefined}
      className="absolute flex flex-col items-center justify-center"
      style={{
        left: pos.x - OPTION_DIAMETER / 2,
        top: pos.y - OPTION_DIAMETER / 2,
        width: OPTION_DIAMETER,
        height: OPTION_DIAMETER,
        borderRadius: '50%',
        background: mix(theme.paper, isLight ? 60 : 50, theme.paper),
        boxShadow: `inset 0 0 0 1.5px ${mix(theme.ink, isLight ? 14 : 22)}`,
        color: mix(theme.ink, 70),
        zIndex: 4,
        border: 'none',
        padding: 0,
        cursor: interactive ? 'pointer' : 'default',
        transitionProperty: 'box-shadow, background, color',
        transitionDuration: '180ms',
        transitionTimingFunction: `cubic-bezier(${SMOOTH_OUT.join(',')})`,
      }}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity, scale }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{
        // Per-ghost stagger — softer than the actual fan to read as "preview".
        delay: index * 0.04,
        type: 'spring',
        stiffness: 180,
        damping: 22,
        mass: 0.6,
      }}
      onMouseEnter={e => {
        if (!interactive) return;
        e.currentTarget.style.background = mixTwo(theme.paper, 88, theme.accent, 6);
        e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${mix(theme.accent, 50)}, 0 4px 14px ${mix(theme.accent, 16)}`;
        e.currentTarget.style.color = mixTwo(theme.accent, 80, theme.ink, 20);
      }}
      onMouseLeave={e => {
        if (!interactive) return;
        e.currentTarget.style.background = mix(theme.paper, isLight ? 60 : 50, theme.paper);
        e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${mix(theme.ink, isLight ? 14 : 22)}`;
        e.currentTarget.style.color = mix(theme.ink, 70);
      }}
      onFocus={e => {
        if (!interactive) return;
        e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${mix(theme.accent, 60)}, 0 0 0 2px ${mix(theme.accent, 30)}`;
      }}
      onBlur={e => {
        e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${mix(theme.ink, isLight ? 14 : 22)}`;
      }}
    >
      {/* Inner breath — surface-tension pulse on a still bubble. Out of sync
          with siblings via random delay, paused when the dial is in use. */}
      <m.div
        className="flex flex-col items-center justify-center"
        style={{ width: '100%', height: '100%' }}
        animate={
          breathing && !reduceMotion
            ? { scale: [1, 1.012, 1] }
            : { scale: 1 }
        }
        transition={
          breathing && !reduceMotion
            ? {
                duration: 3.8,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: breathDelay,
              }
            : { duration: 0.2 }
        }
      >
        {icon && (
          <span style={{ marginBottom: 3, opacity: 0.8 }}>{icon}</span>
        )}
        <span
          style={{
            fontSize: 11,
            fontWeight: 450,
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '0.005em',
            padding: '0 4px',
            textAlign: 'center',
            lineHeight: 1.05,
          }}
        >
          {label}
        </span>
      </m.div>
    </m.button>
  );
}

// =============================================================================
// SubMenuGhost — preview of a homed option's children, rendered at their
// would-be positions while the user is still deliberating. Reveals the path
// FORWARD before commitment. Smaller + dimmer than real options.
// =============================================================================
export function SubMenuGhost({
  pos,
  label,
  index,
  strength,
  theme,
}: {
  pos: Vec;
  label: string;
  index: number;
  /** Homed strength of the parent option — drives preview opacity. */
  strength: number;
  theme: RadialDialTheme;
}) {
  const SIZE = OPTION_DIAMETER * 0.7;
  const isLight = theme.mode === 'light';
  const opacity = Math.min(0.5, strength * 0.65);
  return (
    <m.div
      className="pointer-events-none absolute flex items-center justify-center"
      style={{
        left: pos.x - SIZE / 2,
        top: pos.y - SIZE / 2,
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        background: mix(theme.paper, isLight ? 50 : 40, theme.paper),
        boxShadow: `inset 0 0 0 1px ${mix(theme.accent, 18 + strength * 18)}`,
        color: mix(theme.accent, 60),
        zIndex: 3,
      }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity, scale: 0.92 + strength * 0.08 }}
      exit={{ opacity: 0, scale: 0.55 }}
      transition={{
        delay: index * 0.04,
        type: 'spring',
        stiffness: 220,
        damping: 26,
        mass: 0.5,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 450,
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: '0.005em',
          padding: '0 4px',
          textAlign: 'center',
          lineHeight: 1.05,
        }}
      >
        {label}
      </span>
    </m.div>
  );
}

// =============================================================================
// CursorHalo — soft accent dot following the pointer while drawing. Diameter
// scales with velocity; opacity tied to stroke confidence.
// =============================================================================
export function CursorHalo({
  pos,
  stroke,
  theme,
}: {
  pos: Vec;
  stroke: InkPoint[];
  theme: RadialDialTheme;
}) {
  const v = stroke.length > 0 ? stroke[stroke.length - 1].v : 0;
  const confidence = useMemo(() => strokeConfidence(stroke), [stroke]);
  // Diameter: 8px at rest, scales up to ~22px at fast velocity.
  const diameter = 8 + Math.min(14, v * 12);
  const opacity = 0.25 + confidence * 0.55;
  return (
    <m.div
      className="pointer-events-none absolute"
      style={{
        left: pos.x - diameter / 2,
        top: pos.y - diameter / 2,
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        background: `radial-gradient(circle at center, ${mix(theme.accent, 70)} 0%, ${mix(theme.accent, 0)} 70%)`,
        zIndex: 6,
      }}
      animate={{ opacity }}
      transition={{ duration: 0.12, ease: SMOOTH_OUT }}
    />
  );
}
