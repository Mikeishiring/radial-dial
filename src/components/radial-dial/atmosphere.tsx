import { useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { SMOOTH_OUT } from './geometry';
import { mix } from './themes';
import type { DialPathEntry, RadialDialTheme, Vec } from './types';

/**
 * Atmosphere — small visual effects that don't carry information but make the
 * page feel alive: paper pressure indent, commit pulses, particle bursts,
 * ambient ripples while idle, and dust motes drifting across the canvas.
 *
 * These components share three properties:
 *   1. Self-contained — only need theme + position/path props.
 *   2. Self-cleaning — internal timers/effects manage their own lifecycle.
 *   3. Decorative — removable without breaking interaction.
 *
 * Extracted from RadialDial.tsx to reduce that file's size and isolate
 * decorative work from the main component's interaction logic.
 */

// =============================================================================
// PaperWarp — soft pressure indent that follows the active node, like a
// finger pressing into paper. Uses mix-blend-mode so it interacts with the
// underlying noise texture (multiply on light themes, screen on dark).
// =============================================================================
export function PaperWarp({ pos, mode }: { pos: Vec; mode: 'light' | 'dark' }) {
  const isLight = mode === 'light';
  const SIZE = 220;
  return (
    <m.div
      className="pointer-events-none absolute"
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        background: `radial-gradient(circle at center, ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)'} 0%, transparent 62%)`,
        mixBlendMode: isLight ? 'multiply' : 'screen',
        zIndex: 1,
      }}
      animate={{ left: pos.x - SIZE / 2, top: pos.y - SIZE / 2 }}
      transition={{ type: 'spring', stiffness: 200, damping: 28, mass: 0.9 }}
    />
  );
}

// =============================================================================
// CommitWave — radial double-ring pulse from the active position on every
// commit (skipped on undos and on first press). Self-cleans after ~950ms.
// The double ring (outer slow, inner faster, staggered) reads as iris-open.
// =============================================================================
export function CommitWave({
  path,
  theme,
  reduceMotion,
}: {
  path: DialPathEntry[];
  theme: RadialDialTheme;
  reduceMotion: boolean;
}) {
  const [wave, setWave] = useState<{ pos: Vec; key: string } | null>(null);
  const prevPathLength = useRef(path.length);

  useEffect(() => {
    const grew = path.length > prevPathLength.current;
    const isFirstCommit = path.length === 1;
    prevPathLength.current = path.length;
    if (!grew || isFirstCommit || reduceMotion) return;
    const last = path[path.length - 1];
    if (!last) return;
    const next = { pos: last.pos, key: `${last.node.id}-${performance.now()}` };
    setWave(next);
    const t = setTimeout(
      () => setWave(prev => (prev?.key === next.key ? null : prev)),
      950,
    );
    return () => clearTimeout(t);
  }, [path, reduceMotion]);

  if (!wave) return null;
  return (
    <>
      <m.div
        key={`outer-${wave.key}`}
        className="pointer-events-none absolute"
        style={{
          left: wave.pos.x - 48,
          top: wave.pos.y - 48,
          width: 96,
          height: 96,
          borderRadius: '50%',
          border: `1.5px solid ${mix(theme.accent, 60)}`,
          zIndex: 3,
        }}
        initial={{ scale: 0.5, opacity: 0.85 }}
        animate={{ scale: 2.8, opacity: 0 }}
        transition={{ duration: 0.9, ease: SMOOTH_OUT }}
      />
      <m.div
        key={`inner-${wave.key}`}
        className="pointer-events-none absolute"
        style={{
          left: wave.pos.x - 32,
          top: wave.pos.y - 32,
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: `1px solid ${mix(theme.accent, 45)}`,
          zIndex: 3,
        }}
        initial={{ scale: 0.4, opacity: 0.7 }}
        animate={{ scale: 1.9, opacity: 0 }}
        transition={{ duration: 0.7, ease: SMOOTH_OUT, delay: 0.12 }}
      />
    </>
  );
}

// =============================================================================
// SettleRipple — the water-drop-landing ring emitted on every commit.
// Subtler than CommitWave (which is iris-open at 85% alpha): this one is
// 18% accent alpha, fades to 0 over 700ms while expanding 60→180px radius.
// Up to three concurrent ripples stack — older ones drop when over capacity.
// Reads as the dial "settling" each time a choice lands.   Issue #314.
// =============================================================================
const MAX_SETTLE_RIPPLES = 3;
type SettleRippleData = { id: string; pos: Vec };

export function SettleRipples({
  path,
  theme,
  reduceMotion,
}: {
  path: DialPathEntry[];
  theme: RadialDialTheme;
  reduceMotion: boolean;
}) {
  const [ripples, setRipples] = useState<SettleRippleData[]>([]);
  const prevPathLength = useRef(path.length);

  useEffect(() => {
    const grew = path.length > prevPathLength.current;
    const isFirstPress = path.length === 1;
    prevPathLength.current = path.length;
    if (!grew || isFirstPress || reduceMotion) return;
    const last = path[path.length - 1];
    if (!last) return;
    const next: SettleRippleData = {
      id: `ripple-${last.node.id}-${performance.now()}`,
      pos: last.pos,
    };
    setRipples(prev => {
      const stacked = [...prev, next];
      // Cap concurrent ripples so heavy commit bursts can't pile up.
      return stacked.length > MAX_SETTLE_RIPPLES
        ? stacked.slice(stacked.length - MAX_SETTLE_RIPPLES)
        : stacked;
    });
    const t = setTimeout(
      () => setRipples(prev => prev.filter(r => r.id !== next.id)),
      720,
    );
    return () => clearTimeout(t);
  }, [path, reduceMotion]);

  if (!ripples.length) return null;
  return (
    <>
      {ripples.map(r => (
        <m.div
          key={r.id}
          className="pointer-events-none absolute"
          style={{
            // Element is 120px (radius 60). We scale 1 → 3 to land at radius 180.
            left: r.pos.x - 60,
            top: r.pos.y - 60,
            width: 120,
            height: 120,
            borderRadius: '50%',
            border: `1px solid ${mix(theme.accent, 18)}`,
            zIndex: 2,
          }}
          initial={{ scale: 1, opacity: 1 }}
          // Opacity 1 here multiplies the 18% accent alpha baked into the
          // border colour — that's how we land at 18% → 0 net visibility.
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 0.7, ease: SMOOTH_OUT }}
        />
      ))}
    </>
  );
}

// =============================================================================
// CommitParticles — small organic burst on each commit. 6–7 particles drift
// outward at jittered angles/speeds for a non-mechanical look. Skipped on
// first press, undos, and reduced motion.
// =============================================================================
type Particle = { angle: number; speed: number; size: number };
type Burst = { id: string; pos: Vec; particles: Particle[] };

export function CommitParticles({
  path,
  theme,
  reduceMotion,
}: {
  path: DialPathEntry[];
  theme: RadialDialTheme;
  reduceMotion: boolean;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const prevPathLength = useRef(path.length);

  useEffect(() => {
    const grew = path.length > prevPathLength.current;
    const isFirstPress = path.length === 1;
    prevPathLength.current = path.length;
    if (!grew || isFirstPress || reduceMotion) return;
    const last = path[path.length - 1];
    if (!last) return;

    const count = 6 + Math.floor(Math.random() * 2);
    const baseAngleStep = (Math.PI * 2) / count;
    const particles: Particle[] = Array.from({ length: count }, (_, i) => ({
      angle: i * baseAngleStep + (Math.random() - 0.5) * 0.5,
      speed: 36 + Math.random() * 22,
      size: 1.8 + Math.random() * 1.6,
    }));
    const burst: Burst = {
      id: `burst-${last.node.id}-${performance.now()}`,
      pos: last.pos,
      particles,
    };
    setBursts(prev => [...prev, burst]);
    const t = setTimeout(() => {
      setBursts(prev => prev.filter(b => b.id !== burst.id));
    }, 700);
    return () => clearTimeout(t);
  }, [path, reduceMotion]);

  return (
    <>
      {bursts.map(burst => (
        <BurstLayer key={burst.id} burst={burst} theme={theme} />
      ))}
    </>
  );
}

function BurstLayer({ burst, theme }: { burst: Burst; theme: RadialDialTheme }) {
  return (
    <>
      {burst.particles.map((p, i) => {
        const dx = Math.cos(p.angle) * p.speed;
        const dy = Math.sin(p.angle) * p.speed;
        return (
          <m.div
            key={`${burst.id}-${i}`}
            className="pointer-events-none absolute"
            style={{
              left: burst.pos.x - p.size,
              top: burst.pos.y - p.size,
              width: p.size * 2,
              height: p.size * 2,
              borderRadius: '50%',
              background: theme.accent,
              zIndex: 5,
            }}
            initial={{ x: 0, y: 0, opacity: 0.85, scale: 1 }}
            animate={{ x: dx, y: dy, opacity: 0, scale: 0.4 }}
            transition={{
              duration: 0.6 + Math.random() * 0.15,
              ease: [0.19, 1, 0.22, 1], // expo-out — fast initial, gentle tail
            }}
          />
        );
      })}
    </>
  );
}

// =============================================================================
// AmbientRipple — soft accent ring emanates from a fixed position every ~7s.
// Used when idle to telegraph "the dial is alive, waiting for you."
// =============================================================================
export function AmbientRipple({ pos, theme }: { pos: Vec; theme: RadialDialTheme }) {
  const [ripples, setRipples] = useState<Array<{ id: number }>>([]);
  useEffect(() => {
    const tick = () => {
      const id = performance.now();
      setRipples(prev => [...prev, { id }]);
      setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 1900);
    };
    const interval = setInterval(tick, 7000);
    // First ripple after a short delay so the page doesn't immediately ping on load.
    const initial = setTimeout(tick, 3500);
    return () => {
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, []);
  return (
    <>
      {ripples.map(r => (
        <m.div
          key={r.id}
          className="pointer-events-none absolute"
          style={{
            left: pos.x - 28,
            top: pos.y - 28,
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: `1px solid ${mix(theme.accent, 35)}`,
            zIndex: 2,
          }}
          initial={{ scale: 0.6, opacity: 0.6 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 1.8, ease: [0.19, 1, 0.22, 1] }}
        />
      ))}
    </>
  );
}

// =============================================================================
// IdleMotes — periodic small ink flecks drift diagonally across the paper,
// fading in and out. Like dust motes in a sunbeam: rare (60% chance per
// 9s tick), calm, organic. Adds quiet life to long idle states.
//
// Issue #316 — when the user's cursor is on the page, motes bias their
// drift direction 30% toward the cursor. Like dust catching light: ambient
// elements should follow attention. The bias never overrides random
// motion entirely — 70% own randomness keeps the field feeling organic.
// =============================================================================
type Mote = {
  id: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  size: number;
};

const ATTENTION_BIAS_WEIGHT = 0.3; // 30% pull toward cursor, 70% random.
const MIN_BIAS_DISTANCE = 40;      // Don't bias motes that spawn on top of the cursor.

export function IdleMotes({
  stageSize,
  theme,
  cursorPos,
}: {
  stageSize: { w: number; h: number };
  theme: RadialDialTheme;
  /** Latest known cursor position; motes drift toward it slightly. */
  cursorPos?: Vec | null;
}) {
  const [motes, setMotes] = useState<Mote[]>([]);
  // Mirror cursorPos in a ref so changes don't restart the spawn interval.
  // Motes inherit the cursor position AT SPAWN TIME, not continuously.
  const cursorRef = useRef<Vec | null>(cursorPos ?? null);
  cursorRef.current = cursorPos ?? null;

  useEffect(() => {
    const spawn = () => {
      if (Math.random() > 0.6) return;
      const startX = Math.random() * stageSize.w;
      const startY = Math.random() * stageSize.h;
      const randAngle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      // Random direction vector (unit length).
      let dirX = Math.cos(randAngle);
      let dirY = Math.sin(randAngle);
      // Blend toward cursor when available, but only for motes far enough
      // from the cursor that the bias makes geometric sense.
      const cursor = cursorRef.current;
      if (cursor) {
        const vx = cursor.x - startX;
        const vy = cursor.y - startY;
        const len = Math.hypot(vx, vy);
        if (len > MIN_BIAS_DISTANCE) {
          const cx = vx / len;
          const cy = vy / len;
          const w = ATTENTION_BIAS_WEIGHT;
          const bx = (1 - w) * dirX + w * cx;
          const by = (1 - w) * dirY + w * cy;
          // Re-normalize so distance stays consistent regardless of blend.
          const blendLen = Math.hypot(bx, by) || 1;
          dirX = bx / blendLen;
          dirY = by / blendLen;
        }
      }
      const mote: Mote = {
        id: performance.now() + Math.random(),
        startX,
        startY,
        dx: dirX * dist,
        dy: dirY * dist,
        size: 1.5 + Math.random() * 1.5,
      };
      setMotes(prev => [...prev, mote]);
      setTimeout(() => setMotes(prev => prev.filter(m => m.id !== mote.id)), 4500);
    };
    const interval = setInterval(spawn, 9000);
    return () => clearInterval(interval);
  }, [stageSize.w, stageSize.h]);
  return (
    <>
      {motes.map(mote => (
        <m.div
          key={mote.id}
          className="pointer-events-none absolute"
          style={{
            left: mote.startX,
            top: mote.startY,
            width: mote.size,
            height: mote.size,
            borderRadius: '50%',
            background: theme.ink,
            zIndex: 1,
          }}
          initial={{ opacity: 0, x: 0, y: 0 }}
          animate={{ opacity: [0, 0.18, 0], x: mote.dx, y: mote.dy }}
          transition={{ duration: 4.2, ease: [0.22, 1, 0.36, 1], times: [0, 0.4, 1] }}
        />
      ))}
    </>
  );
}
