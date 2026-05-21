import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { EXPO_OUT, OVERSHOOT, SMOOTH_OUT } from './geometry';
import { mix } from './themes';
import type { DialNode, RadialDialTheme } from './types';

/**
 * Chrome — the textual readouts and persistent controls around the dial:
 *   - PathLine: the prose breadcrumb + counter ("≈ 9,088 jobs · salary › $100–150k")
 *   - PathWord: clickable word inside the prose path
 *   - AnimatedNumber: a number that smoothly rolls to its target
 *   - ResetButton: small accent-bordered control top-right
 *
 * Extracted from RadialDial.tsx because they're "dumb" display components —
 * they take props in, render JSX out, no shared state with the gesture engine.
 */

// =============================================================================
// PathLine — one composed prose line that fuses counter + breadcrumb.
//
// Reads as a single sentence: "≈ 9,088 jobs · salary › $100–150k". Path words
// are clickable when not actively drawing — the prose IS the breadcrumb.
// Replaces three earlier chrome components (Counter, Breadcrumbs, ResultToast).
// =============================================================================
export function PathLine({
  theme,
  count,
  projectedCount,
  label,
  format,
  path,
  onPopTo,
  pulseKey,
  reduceMotion,
  tabReturnTick = 0,
}: {
  theme: RadialDialTheme;
  count: number | null;
  /** When homed on a narrowing option, projected count after commit. */
  projectedCount?: number | null;
  label: string;
  format: (n: number) => string;
  path: DialNode[];
  onPopTo?: (breadcrumbIndex: number) => void;
  pulseKey: number;
  reduceMotion: boolean;
  /** Bumped on tab-return so the count flashes "still here". */
  tabReturnTick?: number;
}) {
  const interactive = !!onPopTo;
  // Combined trigger key for the wrapper pulse — fires on commit AND tab-return.
  const wrapperKey = `${pulseKey}-${tabReturnTick}`;
  // Dramatic-narrowing flash: when the count drops by >50% in one commit,
  // the digits flash brighter accent for 500ms, rewarding decisive narrowing.
  const prevCountRef = useRef<number | null>(count);
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (count !== null && prevCountRef.current !== null && count > 0) {
      const ratio = count / prevCountRef.current;
      if (ratio < 0.5 && ratio > 0) {
        setFlashing(true);
        const t = setTimeout(() => setFlashing(false), 520);
        prevCountRef.current = count;
        return () => clearTimeout(t);
      }
    }
    prevCountRef.current = count;
  }, [count]);
  const hasProjection = projectedCount !== null && projectedCount !== undefined;
  return (
    <m.div
      key={wrapperKey}
      initial={{ scale: reduceMotion ? 1 : 0.97, opacity: 0.75 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: OVERSHOOT }}
      // `layout` lets adjacent siblings smoothly reflow when the projection
      // slot appears/disappears, using Framer's FLIP-via-transform under the
      // hood (transforms only — no animated layout properties). Issue #292.
      layout
      // ARIA: the path-line composes a single sentence (≈ count → projection
      // label · breadcrumb). aria-live="polite" announces the WHOLE sentence
      // on commit/undo, aria-atomic="true" ensures it reads as one unit not
      // fragment-by-fragment. role="status" so screen readers handle it as
      // a passive status update, not a navigation event. Issue #25.
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Current selection"
      className={`absolute left-1/2 z-20 -translate-x-1/2 flex items-baseline ${interactive ? '' : 'pointer-events-none'}`}
      style={{ top: 56, gap: 0 }}
    >
      {count !== null && (
        <>
          <m.span
            layout="position"
            style={{
              fontSize: 17,
              fontStyle: 'italic',
              color: mix(theme.ink, 62),
              fontFamily: theme.serif,
              marginRight: 8,
            }}
          >
            ≈
          </m.span>
          <m.span
            layout="position"
            style={{
              fontSize: 17,
              color: flashing ? theme.accent : theme.ink,
              fontFamily: theme.mono,
              fontFeatureSettings: '"tnum" 1',
              letterSpacing: '0.005em',
              fontVariantNumeric: 'tabular-nums',
              textShadow: flashing ? `0 0 14px ${mix(theme.accent, 40)}` : 'none',
              transition: `color 280ms cubic-bezier(${SMOOTH_OUT.join(',')}), text-shadow 280ms cubic-bezier(${SMOOTH_OUT.join(',')})`,
            }}
          >
            <AnimatedNumber value={count} format={format} reduceMotion={reduceMotion} />
          </m.span>
          {/* Projected count — appears when homed on a narrowing option.
              Slot now mounts/unmounts via AnimatePresence (no more reserved
              gap at rest). EXPO_OUT entrance, SMOOTH_OUT exit, asymmetric
              timing per project guidelines. Issue #292. */}
          <AnimatePresence initial={false} mode="popLayout">
            {hasProjection && (
              <m.span
                key="projection"
                layout="position"
                initial={{ opacity: 0, scale: 0.86, x: -6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.92, x: -4 }}
                transition={{
                  opacity: { duration: 0.3, ease: EXPO_OUT },
                  scale: { duration: 0.3, ease: EXPO_OUT },
                  x: { duration: 0.3, ease: EXPO_OUT },
                  exit: { duration: 0.2, ease: SMOOTH_OUT },
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: 6,
                  marginLeft: 8,
                  fontSize: 17,
                  fontFamily: theme.mono,
                  fontFeatureSettings: '"tnum" 1',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span
                  style={{
                    color: mix(theme.accent, 50),
                    fontStyle: 'italic',
                    fontFamily: theme.serif,
                    fontSize: 18,
                  }}
                >
                  →
                </span>
                <span style={{ color: mix(theme.accent, 75) }}>
                  <AnimatedNumber value={projectedCount!} format={format} reduceMotion={reduceMotion} />
                </span>
              </m.span>
            )}
          </AnimatePresence>
          <m.span
            layout="position"
            style={{
              fontSize: 17,
              fontStyle: 'italic',
              color: mix(theme.ink, 62),
              fontFamily: theme.serif,
              marginLeft: 8,
            }}
          >
            {label}
          </m.span>
        </>
      )}
      <AnimatePresence initial={false}>
        {path.map((node, i) => (
          <m.span
            key={`${i}-${node.id}`}
            initial={{ opacity: 0, scale: 0.85, x: -4 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: -4 }}
            transition={{ duration: 0.26, ease: OVERSHOOT }}
            className="inline-flex items-baseline"
          >
            <span
              style={{
                fontSize: 16,
                color: mix(theme.ink, i === 0 ? 30 : 35),
                fontStyle: 'italic',
                fontFamily: theme.serif,
                margin: '0 10px',
              }}
            >
              {i === 0 ? '·' : '›'}
            </span>
            <PathWord
              theme={theme}
              label={node.label}
              onClick={interactive ? () => onPopTo!(i) : undefined}
            />
          </m.span>
        ))}
      </AnimatePresence>
    </m.div>
  );
}

/**
 * A clickable word inside the prose path. Reads as text by default; gains a
 * soft accent underline + cursor pointer when clickable. Plain text otherwise.
 */
function PathWord({
  theme,
  label,
  onClick,
}: {
  theme: RadialDialTheme;
  label: string;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      data-breadcrumb-label={label}
      aria-label={interactive ? `Go back to ${label}` : `${label} (current)`}
      style={{
        fontSize: 16,
        fontFamily: theme.serif,
        fontStyle: 'italic',
        color: theme.accent,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: interactive ? 'pointer' : 'default',
        textDecoration: 'none',
        transition: `color 180ms cubic-bezier(${SMOOTH_OUT.join(',')}), text-decoration-color 180ms cubic-bezier(${SMOOTH_OUT.join(',')})`,
      }}
      onMouseEnter={e => {
        if (!interactive) return;
        e.currentTarget.style.textDecoration = `underline ${mix(theme.accent, 55)}`;
        e.currentTarget.style.textUnderlineOffset = '3px';
      }}
      onMouseLeave={e => {
        if (!interactive) return;
        e.currentTarget.style.textDecoration = 'none';
      }}
      onFocus={e => {
        if (!interactive) return;
        e.currentTarget.style.outline = `2px solid ${mix(theme.accent, 30)}`;
        e.currentTarget.style.outlineOffset = '3px';
        e.currentTarget.style.borderRadius = '4px';
      }}
      onBlur={e => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      {label.toLowerCase()}
    </button>
  );
}

// =============================================================================
// AnimatedNumber — number springs to its new value with a slight overshoot,
// then settles. Stiffness/damping tuned so the digit appears to "catch up
// too fast" and bounce ~3% past target before resting. The motion value is
// piped directly to the DOM via Framer Motion's `motion.span` text-content
// path — no React re-render per frame, 60fps on weak devices. Issue #315.
// Bypassed when prefers-reduced-motion is set.
// =============================================================================
export function AnimatedNumber({
  value,
  format,
  reduceMotion,
}: {
  value: number;
  format: (n: number) => string;
  reduceMotion: boolean;
}) {
  // Source motion value — set imperatively on every value change.
  const mv = useMotionValue(value);
  // Spring config: stiffness 240, damping 22 — slight overshoot, not bouncy.
  // (Audit recommendation from issue #315 for the "count breathes" feel.)
  const spring = useSpring(mv, { stiffness: 240, damping: 22, mass: 1 });
  // Transform the spring's numeric value to the formatted display string.
  // motion.span renders MotionValue<string> children as live text content.
  const display = useTransform(spring, n => format(n));

  useEffect(() => {
    if (reduceMotion) {
      // Skip the spring entirely — instant jump for users who opted out.
      mv.jump(value);
      spring.jump(value);
    } else {
      mv.set(value);
    }
  }, [value, reduceMotion, mv, spring]);

  return <m.span>{display}</m.span>;
}

// =============================================================================
// ApplyButton — the terminal CTA. Slides in below the path word when the
// user has committed at least one level and `onApply` is provided. Reads
// like an outlet for the gesture: the water has been gathered, now drain it.
// EXPO_OUT entrance (300ms), SMOOTH_OUT exit (200ms) — asymmetric per
// project guidelines. Issue #12.
// =============================================================================
export function ApplyButton({
  theme,
  label,
  count,
  formatCount,
  onClick,
}: {
  theme: RadialDialTheme;
  label: string;
  /** Optional inline count, e.g. "Apply 47 matches". */
  count?: number | null;
  formatCount?: (n: number) => string;
  onClick: () => void;
}) {
  const countStr =
    count !== null && count !== undefined && formatCount
      ? ` ${formatCount(count)}`
      : '';
  return (
    <m.div
      className="absolute left-1/2 z-20 -translate-x-1/2"
      // Positioned just under PathLine (top: 56) — give it air to breathe.
      style={{ top: 96 }}
      initial={{ opacity: 0, y: -8, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.96 }}
      transition={{
        opacity: { duration: 0.3, ease: EXPO_OUT },
        y: { duration: 0.3, ease: EXPO_OUT },
        scale: { duration: 0.3, ease: EXPO_OUT },
        exit: { duration: 0.2, ease: SMOOTH_OUT },
      }}
    >
      <m.button
        type="button"
        onClick={onClick}
        aria-label={`${label}${countStr}`}
        className="focus-visible:outline-none"
        style={{
          padding: '8px 20px',
          fontSize: 12,
          letterSpacing: '0.08em',
          fontWeight: 500,
          fontFamily: theme.mono,
          color: theme.paper,
          background: theme.accent,
          border: `1.5px solid ${mix(theme.accent, 90)}`,
          borderRadius: 999,
          cursor: 'pointer',
          boxShadow: `0 6px 18px ${mix(theme.accent, 22)}, 0 0 28px ${mix(theme.accent, 16)}`,
          transitionProperty: 'background, transform, box-shadow',
          transitionDuration: '180ms',
          transitionTimingFunction: `cubic-bezier(${SMOOTH_OUT.join(',')})`,
        }}
        whileHover={{ scale: 1.04, y: -1 }}
        whileTap={{ scale: 0.94 }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = `0 8px 22px ${mix(theme.accent, 30)}, 0 0 40px ${mix(theme.accent, 24)}`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = `0 6px 18px ${mix(theme.accent, 22)}, 0 0 28px ${mix(theme.accent, 16)}`;
        }}
        onFocus={e => {
          e.currentTarget.style.boxShadow = `0 0 0 3px ${mix(theme.accent, 28)}, 0 8px 22px ${mix(theme.accent, 30)}`;
        }}
        onBlur={e => {
          e.currentTarget.style.boxShadow = `0 6px 18px ${mix(theme.accent, 22)}, 0 0 28px ${mix(theme.accent, 16)}`;
        }}
      >
        <span style={{ textTransform: 'uppercase' }}>{label}</span>
        {countStr && (
          <span
            style={{
              marginLeft: 8,
              fontFeatureSettings: '"tnum" 1',
              fontVariantNumeric: 'tabular-nums',
              opacity: 0.92,
            }}
          >
            {countStr.trim()}
          </span>
        )}
      </m.button>
    </m.div>
  );
}

// =============================================================================
// ResetButton — small accent-bordered pill, top-right of the dial.
// "Perks up" 1px on hover acknowledging intent before the click commits.
// =============================================================================
export function ResetButton({
  theme,
  onClick,
}: {
  theme: RadialDialTheme;
  onClick: () => void;
}) {
  const isLight = theme.mode === 'light';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Reset selection"
      className="transition-transform active:scale-[0.94] focus-visible:outline-none"
      style={{
        padding: '5px 12px',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontFamily: theme.mono,
        color: mix(theme.ink, isLight ? 70 : 60),
        background: 'transparent',
        border: `1px solid ${mix(theme.ink, isLight ? 14 : 22)}`,
        borderRadius: 999,
        transitionProperty: 'background, border-color, color, transform',
        transitionDuration: '180ms',
        transitionTimingFunction: `cubic-bezier(${SMOOTH_OUT.join(',')})`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = mix(theme.accent, 6);
        e.currentTarget.style.borderColor = mix(theme.accent, 35);
        e.currentTarget.style.color = theme.accent;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = mix(theme.ink, isLight ? 14 : 22);
        e.currentTarget.style.color = mix(theme.ink, isLight ? 70 : 60);
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onFocus={e => {
        e.currentTarget.style.boxShadow = `0 0 0 2px ${mix(theme.accent, 30)}`;
      }}
      onBlur={e => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      reset
    </button>
  );
}
