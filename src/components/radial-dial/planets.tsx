import { useEffect, useMemo, useRef } from 'react';
import { SETTLED_DIAMETER, SMOOTH_OUT } from './geometry';
import { mix, mixTwo } from './themes';
import { MAX_LEAN, orbitParams, vicinity } from './planets-physics';
import type { PlanetEntry } from './planets-physics';
import type { RadialDialTheme, Vec } from './types';

/**
 * PlanetaryTrail — the committed path rendered as a little solar system.
 *
 * Each settled choice becomes a planet that gently orbits its anchor. Adjacent
 * planets feel each other's "vicinity": when their orbits drift them close, a
 * gravitational glow swells between them and they lean toward one another,
 * then the orbit carries them apart again. The root is the warm sun the
 * system hangs from.
 *
 * Built on the canvas pattern: ONE requestAnimationFrame loop computes
 * deterministic orbital positions (sine of elapsed time), applies the
 * gravitational lean, and writes transform/opacity straight to DOM refs —
 * no React re-render per frame. Honors prefers-reduced-motion (planets sit
 * still at their anchors). Only transform + opacity are animated.
 *
 * Orbital shapes + the gravitational response live in ./planets-physics —
 * tune the feel there.
 */

export function PlanetaryTrail({
  entries,
  theme,
  reduceMotion,
  onJumpBack,
}: {
  entries: PlanetEntry[];
  theme: RadialDialTheme;
  reduceMotion: boolean;
  /** Jump back to planet i (undo to that level). Undefined → not interactive. */
  onJumpBack?: (index: number) => void;
}) {
  const isLight = theme.mode === 'light';
  const planetRefs = useRef<Array<HTMLDivElement | null>>([]);
  const fieldRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Stable anchor list for the RAF closure (positions can change between
  // renders as the path grows; the effect re-subscribes on entries change).
  const anchors = useMemo(() => entries.map(e => e.pos), [entries]);

  useEffect(() => {
    if (reduceMotion || anchors.length === 0) return;
    let raf = 0;
    const start = performance.now();

    const tick = () => {
      // Pause work when the tab is hidden — no point burning frames.
      if (document.hidden) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = performance.now() - start;

      // 1) Base orbital positions (anchor + deterministic ellipse offset).
      const base: Vec[] = anchors.map((a, i) => {
        const { radiusX, radiusY, period, phase } = orbitParams(i);
        const w = (2 * Math.PI) / period;
        return {
          x: a.x + Math.cos(w * t + phase) * radiusX,
          y: a.y + Math.sin(w * t + phase) * radiusY,
        };
      });

      // 2) Gravitational lean — each adjacent pair pulls toward each other by
      // the vicinity field strength. Per-frame displacement (not integrated),
      // so it can't run away: the base orbit always carries them back apart.
      const lean: Vec[] = anchors.map(() => ({ x: 0, y: 0 }));
      for (let i = 0; i < base.length - 1; i++) {
        const a = base[i];
        const b = base[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const rest = Math.hypot(
          anchors[i + 1].x - anchors[i].x,
          anchors[i + 1].y - anchors[i].y,
        ) || 1;
        const v = vicinity(dist, rest);
        const ux = dx / dist;
        const uy = dy / dist;
        const pull = v * MAX_LEAN;
        lean[i].x += ux * pull;
        lean[i].y += uy * pull;
        lean[i + 1].x -= ux * pull;
        lean[i + 1].y -= uy * pull;

        // Field glow between this pair: position at midpoint, scale + brighten
        // with vicinity. (Bright when close, faint when far.)
        const field = fieldRefs.current[i];
        if (field) {
          const mx = (a.x + b.x) / 2 + (lean[i].x + lean[i + 1].x) / 2;
          const my = (a.y + b.y) / 2 + (lean[i].y + lean[i + 1].y) / 2;
          const scale = 0.7 + v * 0.9;
          field.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%) scale(${scale})`;
          field.style.opacity = String(0.12 + v * 0.55);
        }
      }

      // 3) Write each planet's offset-from-anchor as a transform. The orbital
      // drift + gravitational lean compose into one translate.
      for (let i = 0; i < base.length; i++) {
        const el = planetRefs.current[i];
        if (!el) continue;
        const ox = base[i].x - anchors[i].x + lean[i].x;
        const oy = base[i].y - anchors[i].y + lean[i].y;
        el.style.transform = `translate(${ox}px, ${oy}px)`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anchors, reduceMotion]);

  return (
    <>
      {/* Gravitational fields — one soft radial glow per adjacent pair, sitting
          behind the planets. RAF drives position + opacity. */}
      {entries.slice(0, -1).map((entry, i) => (
        <div
          key={`field-${i}-${entry.node.id}`}
          ref={el => {
            fieldRefs.current[i] = el;
          }}
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: `radial-gradient(circle at center, ${mix(theme.accent, 26)} 0%, ${mix(theme.accent, 8)} 38%, transparent 70%)`,
            mixBlendMode: isLight ? 'multiply' : 'screen',
            pointerEvents: 'none',
            opacity: 0,
            zIndex: 2,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* Planets — the orbiting bodies. Each = a glow atmosphere + a clickable
          core. The root (i=0) is the warm sun. */}
      {entries.map((entry, i) => {
        const interactive = !!onJumpBack && i >= 1;
        const isSun = entry.isRoot;
        const core = SETTLED_DIAMETER * (isSun ? 0.92 : 0.78);
        const glowSize = core * (isSun ? 2.6 : 2.1);
        return (
          <div
            key={`planet-${i}-${entry.node.id}`}
            ref={el => {
              planetRefs.current[i] = el;
            }}
            style={{
              position: 'absolute',
              left: entry.pos.x,
              top: entry.pos.y,
              width: 0,
              height: 0,
              zIndex: 4,
              willChange: 'transform',
            }}
          >
            {/* Atmospheric glow — warm sun vs cooler planets. */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: -glowSize / 2,
                top: -glowSize / 2,
                width: glowSize,
                height: glowSize,
                borderRadius: '50%',
                background: isSun
                  ? `radial-gradient(circle at center, ${mix(theme.accent, 30)} 0%, ${mix(theme.accent, 10)} 42%, transparent 72%)`
                  : `radial-gradient(circle at center, ${mix(theme.accent, 16)} 0%, transparent 64%)`,
                mixBlendMode: isLight ? 'multiply' : 'screen',
                pointerEvents: 'none',
              }}
            />
            {/* Core body — clickable planet. */}
            <PlanetCore
              label={entry.node.label}
              isSun={isSun}
              size={core}
              theme={theme}
              onClick={interactive ? () => onJumpBack!(i) : undefined}
            />
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// PlanetCore — the clickable body of a planet, centred on its parent's origin.
// ---------------------------------------------------------------------------
function PlanetCore({
  label,
  isSun,
  size,
  theme,
  onClick,
}: {
  label: string;
  isSun: boolean;
  size: number;
  theme: RadialDialTheme;
  onClick?: () => void;
}) {
  const isLight = theme.mode === 'light';
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-label={interactive ? `Jump back to ${label}` : label}
      title={interactive ? 'Click to return to this orbit' : undefined}
      style={{
        position: 'absolute',
        left: -size / 2,
        top: -size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        border: 'none',
        padding: 0,
        // Re-enable pointer events inside the parallax wrapper (pointer-events:
        // none) so planets stay clickable for jump-back navigation.
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: interactive ? 'pointer' : 'default',
        background: isSun
          ? mixTwo(theme.paper, isLight ? 60 : 80, theme.accent, isLight ? 10 : 14)
          : mixTwo(theme.paper, isLight ? 78 : 88, theme.ink, isLight ? 3 : 5),
        boxShadow: isSun
          ? [
              `inset 0 0 0 1.5px ${mix(theme.accent, 45)}`,
              `0 2px 10px ${mix(theme.accent, 14)}`,
              `0 0 24px ${mix(theme.accent, 16)}`,
            ].join(', ')
          : [
              `inset 0 0 0 1px ${mix(theme.ink, isLight ? 28 : 24)}`,
              `0 1px 3px ${mix(theme.ink, isLight ? 7 : 18)}`,
            ].join(', '),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transitionProperty: 'box-shadow, transform',
        transitionDuration: '200ms',
        transitionTimingFunction: `cubic-bezier(${SMOOTH_OUT.join(',')})`,
      }}
      onMouseEnter={e => {
        if (!interactive) return;
        e.currentTarget.style.boxShadow = [
          `inset 0 0 0 1.5px ${mix(theme.accent, 55)}`,
          `0 4px 16px ${mix(theme.accent, 20)}`,
          `0 0 28px ${mix(theme.accent, 22)}`,
        ].join(', ');
      }}
      onMouseLeave={e => {
        if (!interactive) return;
        e.currentTarget.style.boxShadow = [
          `inset 0 0 0 1px ${mix(theme.ink, isLight ? 28 : 24)}`,
          `0 1px 3px ${mix(theme.ink, isLight ? 7 : 18)}`,
        ].join(', ');
      }}
    >
      {!isSun && (
        <span
          style={{
            fontSize: 11,
            fontFamily: theme.serif,
            fontStyle: 'italic',
            color: mix(theme.ink, isLight ? 74 : 82),
            letterSpacing: '0.005em',
            padding: '0 4px',
            textAlign: 'center',
            lineHeight: 1.1,
            maxWidth: size - 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label.toLowerCase()}
        </span>
      )}
      {isSun && (
        <span
          aria-hidden
          style={{
            fontSize: 13,
            color: mix(theme.accent, 70),
            fontFamily: theme.serif,
            fontStyle: 'italic',
          }}
        >
          ·
        </span>
      )}
    </button>
  );
}
