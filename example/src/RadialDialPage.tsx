import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  RadialDial,
  PAPER_THEME,
  ALL_THEMES,
  mix,
  EXPO_OUT,
  SMOOTH_OUT,
} from '@mikeishiring/radial-dial';
import type {
  DialNode,
  DialPathPayload,
  RadialDialTheme,
} from '@mikeishiring/radial-dial';

// =============================================================================
// Demo page — consumes the RadialDial template.
//
// Layout: full-bleed dial fills the viewport, with a thin chrome layer:
//   - Top-left intro card (what is this?)
//   - Top-right theme switcher (wired through the dial's toolbar slot)
//   - Bottom-right footer with repo link
//   - Centre-bottom "last applied" pill (appears for 5s after Apply)
//
// The page is intentionally minimal — the dial itself is the show. Framing
// gives a first-time visitor enough scaffolding to know what to do, then
// gets out of the way.
// =============================================================================

const TREE: DialNode = {
  id: 'root',
  label: 'Find',
  children: [
    {
      id: 'role',
      label: 'Role',
      icon: <RoleIcon />,
      share: 1,
      children: [
        {
          id: 'engineering',
          label: 'Engineering',
          share: 0.46,
          children: [
            { id: 'frontend', label: 'Frontend', share: 0.32 },
            { id: 'backend', label: 'Backend', share: 0.34 },
            { id: 'smart-contract', label: 'Smart contract', share: 0.20 },
            { id: 'full-stack', label: 'Full-stack', share: 0.14 },
          ],
        },
        {
          id: 'design',
          label: 'Design',
          share: 0.12,
          children: [
            { id: 'product-designer', label: 'Product' },
            { id: 'brand', label: 'Brand' },
          ],
        },
        {
          id: 'product',
          label: 'Product',
          share: 0.18,
          children: [
            { id: 'pm', label: 'PM' },
            { id: 'growth', label: 'Growth' },
          ],
        },
        {
          id: 'ops',
          label: 'Ops',
          share: 0.24,
          children: [
            { id: 'recruiting', label: 'Recruiting' },
            { id: 'finance', label: 'Finance' },
            { id: 'people', label: 'People' },
          ],
        },
      ],
    },
    {
      id: 'seniority',
      label: 'Seniority',
      icon: <SeniorityIcon />,
      share: 1,
      children: [
        { id: 'junior', label: 'Junior', share: 0.18 },
        { id: 'mid', label: 'Mid', share: 0.34 },
        { id: 'senior', label: 'Senior', share: 0.30 },
        { id: 'staff', label: 'Staff+', share: 0.18 },
      ],
    },
    {
      id: 'salary',
      label: 'Salary',
      icon: <SalaryIcon />,
      share: 1,
      children: [
        { id: 'sub-100', label: '< $100k', share: 0.14 },
        { id: '100-150', label: '$100–150k', share: 0.32 },
        { id: '150-200', label: '$150–200k', share: 0.30 },
        { id: '200-plus', label: '$200k+', share: 0.24 },
      ],
    },
    {
      id: 'stage',
      label: 'Stage',
      icon: <StageIcon />,
      share: 1,
      children: [
        { id: 'seed', label: 'Seed', share: 0.30 },
        { id: 'series-a', label: 'Series A', share: 0.28 },
        { id: 'series-b-plus', label: 'Series B+', share: 0.26 },
        { id: 'public', label: 'Public', share: 0.16 },
      ],
    },
  ],
};

export function RadialDialPage() {
  const [theme, setTheme] = useState<RadialDialTheme>(PAPER_THEME);
  // The last-applied payload — shown in a toast that auto-dismisses.
  const [lastApplied, setLastApplied] = useState<DialPathPayload | null>(null);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: theme.paper,
      }}
    >
      <RadialDial
        tree={TREE}
        theme={theme}
        title="radial · dial"
        hint="press, draw a line, release."
        countLabel="jobs"
        total={28_400}
        onComplete={({ nodes }) => {
          // Fired automatically on release with any committed path. The Apply
          // CTA is a separate explicit confirmation step (below).
          if (typeof window !== 'undefined') {
            // eslint-disable-next-line no-console
            console.info(
              '[RadialDial] complete:',
              nodes.map((n: DialNode) => n.label).join(' › '),
            );
          }
        }}
        onApply={(payload: DialPathPayload) => {
          // Explicit "apply" — slide toast in, auto-dismiss after 5s.
          setLastApplied(payload);
          window.setTimeout(() => {
            setLastApplied(prev => (prev === payload ? null : prev));
          }, 5000);
        }}
        applyLabel="APPLY"
        toolbar={<ThemeSwitcher theme={theme} onChange={setTheme} />}
      />

      {/* Intro card — bottom-left, fades to translucent on idle to stay
          out of the way. The dial's own title sits top-left so this gives
          the user something to read while figuring out the gesture. */}
      <IntroCard theme={theme} />

      {/* Last-applied toast — slides up from the bottom centre. */}
      <AnimatePresence>
        {lastApplied && (
          <AppliedToast key="toast" payload={lastApplied} theme={theme} />
        )}
      </AnimatePresence>

      {/* Footer link to the repo — bottom-right, very small. */}
      <FooterLink theme={theme} />
    </div>
  );
}

// =============================================================================
// IntroCard — discoverability copy for first-time visitors.
// Three-line composition: what + how + key gestures.
// =============================================================================
function IntroCard({ theme }: { theme: RadialDialTheme }) {
  const isLight = theme.mode === 'light';
  return (
    <div
      style={{
        position: 'absolute',
        left: 32,
        bottom: 32,
        zIndex: 25,
        maxWidth: 280,
        pointerEvents: 'none',
        fontFamily: theme.serif,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontFamily: theme.mono,
          color: mix(theme.ink, isLight ? 45 : 55),
          marginBottom: 6,
        }}
      >
        DEMO
      </div>
      <div
        style={{
          fontSize: 14,
          fontStyle: 'italic',
          color: mix(theme.ink, isLight ? 65 : 65),
          letterSpacing: '-0.005em',
          lineHeight: 1.45,
        }}
      >
        A hierarchical marking-menu dial. Click any option, or press
        the centre and drag toward one. Keep drawing to commit the
        next level. Escape to back out.
      </div>
    </div>
  );
}

// =============================================================================
// AppliedToast — slides up from the bottom centre showing the path
// that was just applied. Auto-dismisses (parent state). Issue #12 visualised.
// =============================================================================
function AppliedToast({
  payload,
  theme,
}: {
  payload: DialPathPayload;
  theme: RadialDialTheme;
}) {
  const isLight = theme.mode === 'light';
  const pathStr = payload.nodes.map(n => n.label).join(' › ');
  return (
    <motion.div
      style={{
        position: 'absolute',
        bottom: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 26,
        padding: '10px 18px',
        background: mix(theme.ink, isLight ? 90 : 80, theme.paper),
        color: theme.paper,
        borderRadius: 999,
        boxShadow: `0 8px 24px ${mix(theme.ink, isLight ? 14 : 36)}`,
        fontFamily: theme.mono,
        fontSize: 12,
        letterSpacing: '0.04em',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{
        opacity: { duration: 0.3, ease: EXPO_OUT },
        y: { duration: 0.3, ease: EXPO_OUT },
        scale: { duration: 0.3, ease: EXPO_OUT },
        exit: { duration: 0.25, ease: SMOOTH_OUT },
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: mix(theme.accent, 90, theme.paper),
        }}
      >
        APPLIED
      </span>
      <span style={{ opacity: 0.4 }}>—</span>
      <span style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 13 }}>
        {pathStr}
      </span>
      {payload.count !== undefined && (
        <>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ fontFeatureSettings: '"tnum" 1' }}>
            {Math.round(payload.count).toLocaleString('en-US')} matches
          </span>
        </>
      )}
    </motion.div>
  );
}

// =============================================================================
// FooterLink — tiny mono-spaced link to the repo. Bottom-right.
// =============================================================================
function FooterLink({ theme }: { theme: RadialDialTheme }) {
  const isLight = theme.mode === 'light';
  return (
    <a
      href="https://github.com/Mikeishiring/radial-dial"
      target="_blank"
      rel="noreferrer noopener"
      style={{
        position: 'absolute',
        right: 32,
        bottom: 32,
        zIndex: 25,
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontFamily: theme.mono,
        color: mix(theme.ink, isLight ? 45 : 55),
        textDecoration: 'none',
        transition: 'color 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = theme.accent)}
      onMouseLeave={e =>
        (e.currentTarget.style.color = mix(theme.ink, isLight ? 45 : 55))
      }
    >
      Mikeishiring/radial-dial ↗
    </a>
  );
}

// =============================================================================
// Theme switcher — small pill row, slides indicator under active theme.
// =============================================================================
function ThemeSwitcher({
  theme,
  onChange,
}: {
  theme: RadialDialTheme;
  onChange: (t: RadialDialTheme) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 3,
        gap: 0,
        background: mix(theme.ink, theme.mode === 'light' ? 4 : 8, theme.paper),
        border: `1px solid ${mix(theme.ink, theme.mode === 'light' ? 10 : 18)}`,
        borderRadius: 999,
        fontFamily: theme.mono,
        fontSize: 9,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
      }}
    >
      {ALL_THEMES.map((t: RadialDialTheme) => {
        const active = t.name === theme.name;
        return (
          <button
            key={t.name}
            type="button"
            onClick={() => onChange(t)}
            aria-label={`Switch to ${t.name} theme`}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: active ? mix(theme.accent, 16) : 'transparent',
              color: active ? theme.accent : mix(theme.ink, 55),
              border: 'none',
              cursor: 'pointer',
              transitionProperty: 'background, color',
              transitionDuration: '200ms',
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Hand-inked category icons.
// Each: 28×28 rendered, 1.6px stroke, ROUND caps and joins so the line ends
// look like brush strokes rather than guillotined edges. Slight asymmetry
// is deliberate — these should feel drawn, not generated.
//
//  Role       → a chair from the side. "Where the role sits."
//  Seniority  → ascending steps. Walking up the ranks.
//  Salary     → calligraphic $ with extended stem. Editorial flourish.
//  Stage      → a small spire. The company building, growing tall.
// =============================================================================
const ICON_SIZE = 28;
const ICON_STROKE = 1.6;

function RoleIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: ICON_SIZE, height: ICON_SIZE, display: 'block', flexShrink: 0 }}
    >
      {/* chair back */}
      <path d="M7.5 5 L 7.2 14" />
      {/* seat */}
      <path d="M5.5 14 L 17.8 14" />
      {/* rear leg */}
      <path d="M7.5 14 L 7 21" />
      {/* front leg */}
      <path d="M16 14 L 17 21" />
    </svg>
  );
}

function SeniorityIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: ICON_SIZE, height: ICON_SIZE, display: 'block', flexShrink: 0 }}
    >
      <path d="M3.5 19.5 L 8 19.5 L 8 14.5 L 13 14.5 L 13 9.5 L 18 9.5 L 18 4.5 L 21 4.5" />
    </svg>
  );
}

function SalaryIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: ICON_SIZE, height: ICON_SIZE, display: 'block', flexShrink: 0 }}
    >
      <path d="M12 3 L 12 21" />
      <path d="M16.5 7 Q 12 5 8.5 7 Q 5.2 9 8.4 11.4 Q 11.5 13.4 15 14.6 Q 18 16 15 19 Q 12 20.8 7.8 18.8" />
    </svg>
  );
}

function StageIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: ICON_SIZE, height: ICON_SIZE, display: 'block', flexShrink: 0 }}
    >
      <path d="M8 21 L 8 9.5" />
      <path d="M16 21 L 16 9.5" />
      <path d="M7 21 L 17 21" />
      <path d="M6.5 9.5 L 12 4 L 17.5 9.5" />
      <circle cx="12" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
