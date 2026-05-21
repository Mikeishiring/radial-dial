import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  RadialDial,
  PAPER_THEME,
  ALL_THEMES,
  mix,
  glassSurface,
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

const TOTAL_JOBS = 28_400;

// Compute the running count by multiplying each node's share down the path.
function countForPath(nodes: DialNode[]): number {
  return nodes.reduce((n, node) => n * (node.share ?? 1), TOTAL_JOBS);
}

export function RadialDialPage() {
  const [theme, setTheme] = useState<RadialDialTheme>(PAPER_THEME);
  // The last-applied payload — shown in a toast that auto-dismisses.
  const [lastApplied, setLastApplied] = useState<DialPathPayload | null>(null);
  // When the user drills all the way to a leaf (a node with no children),
  // we open a styled results preview. Null when not at a leaf.
  const [leafPath, setLeafPath] = useState<DialNode[] | null>(null);

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
        total={TOTAL_JOBS}
        onChange={({ nodes }: DialPathPayload) => {
          // Fired on every commit / undo as you drill through levels. When
          // the deepest node is a LEAF (no children), you've reached the end
          // — open the styled preview. Otherwise keep it closed.
          const last = nodes[nodes.length - 1];
          const reachedLeaf = !!last && !last.children?.length;
          setLeafPath(reachedLeaf ? nodes : null);
        }}
        onComplete={({ nodes }: DialPathPayload) => {
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

      {/* Styled results preview — slides in from the right when you drill all
          the way to a leaf. This is "the page opening up" at the end of the
          gesture. Dismiss with the × or by undoing back up a level. */}
      <AnimatePresence>
        {leafPath && (
          <PreviewPanel
            key="preview"
            path={leafPath}
            theme={theme}
            onClose={() => setLeafPath(null)}
          />
        )}
      </AnimatePresence>

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
// PreviewPanel — "the page opening up" at the end of the gesture.
//
// Slides in from the right when the user drills to a leaf. Shows the composed
// query as an editorial headline, the running match count, and a few mock
// result cards styled to feel like a real results page. Dim backdrop behind;
// click it (or the ×) to dismiss. EXPO_OUT entrance / SMOOTH_OUT exit per the
// asymmetric-timing rule.
// =============================================================================
function PreviewPanel({
  path,
  theme,
  onClose,
}: {
  path: DialNode[];
  theme: RadialDialTheme;
  onClose: () => void;
}) {
  const isLight = theme.mode === 'light';
  const count = Math.round(countForPath(path));
  const results = mockResults(path);
  const queryStr = path.map(n => n.label).join(' · ');
  // Heavy frosted glass for the panel — the dial blurs through it (iOS style).
  const panelGlass = glassSurface(theme, { alpha: isLight ? 62 : 46, blur: 28 });
  const cardGlass = glassSurface(theme, { alpha: isLight ? 46 : 26, blur: 8 });

  return (
    <>
      {/* Backdrop — light dim + blur, click to dismiss. Lets the dial stay
          faintly visible behind the glass rather than going opaque. */}
      <motion.div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 40,
          background: mix(theme.ink, isLight ? 6 : 18, 'transparent'),
          backdropFilter: 'blur(3px) saturate(140%)',
          WebkitBackdropFilter: 'blur(3px) saturate(140%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: SMOOTH_OUT }}
      />
      {/* Panel — frosted glass pane sliding in from the right edge. */}
      <motion.aside
        role="dialog"
        aria-label="Results preview"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 41,
          width: 'min(420px, 92vw)',
          background: panelGlass.background,
          backdropFilter: panelGlass.backdropFilter,
          WebkitBackdropFilter: panelGlass.WebkitBackdropFilter,
          borderLeft: `1px solid ${isLight ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.12)'}`,
          boxShadow: `-24px 0 60px ${mix(theme.ink, isLight ? 12 : 44)}, inset 1px 0 0 rgba(255,255,255,${isLight ? 0.5 : 0.08})`,
          display: 'flex',
          flexDirection: 'column',
          padding: '28px 28px 20px',
          overflowY: 'auto',
        }}
        initial={{ x: '101%' }}
        animate={{ x: 0 }}
        exit={{ x: '101%' }}
        transition={{
          // Asymmetric: slower expo-out entrance, snappier smooth-out exit.
          x: { type: 'tween', duration: 0.42, ease: EXPO_OUT },
        }}
      >
        {/* Header row — label + close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontFamily: theme.mono,
              color: mix(theme.ink, isLight ? 45 : 60),
            }}
          >
            Preview
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: mix(theme.ink, isLight ? 6 : 14, 'transparent'),
              color: mix(theme.ink, isLight ? 60 : 70),
              cursor: 'pointer',
              fontSize: 15,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 180ms cubic-bezier(0.22,1,0.36,1)',
            }}
            onMouseEnter={e =>
              (e.currentTarget.style.background = mix(theme.accent, 14, 'transparent'))
            }
            onMouseLeave={e =>
              (e.currentTarget.style.background = mix(theme.ink, isLight ? 6 : 14, 'transparent'))
            }
          >
            ×
          </button>
        </div>

        {/* Query headline */}
        <div
          style={{
            fontFamily: theme.serif,
            fontStyle: 'italic',
            fontSize: 22,
            lineHeight: 1.25,
            color: theme.ink,
            marginBottom: 6,
            letterSpacing: '-0.01em',
          }}
        >
          {queryStr}
        </div>

        {/* Count line */}
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 13,
            color: mix(theme.accent, 85, isLight ? '#000' : '#fff'),
            fontFeatureSettings: '"tnum" 1',
            marginBottom: 22,
          }}
        >
          {count.toLocaleString('en-US')} matching roles
        </div>

        {/* Result cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {results.map((r, i) => (
            <motion.div
              key={r.company + r.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.18 + i * 0.06,
                duration: 0.34,
                ease: EXPO_OUT,
              }}
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: cardGlass.background,
                backdropFilter: cardGlass.backdropFilter,
                WebkitBackdropFilter: cardGlass.WebkitBackdropFilter,
                border: cardGlass.border,
                boxShadow: cardGlass.glassShadow,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: 550,
                    fontSize: 14,
                    color: theme.ink,
                  }}
                >
                  {r.title}
                </span>
                <span
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 11,
                    color: mix(theme.accent, 80, isLight ? '#000' : '#fff'),
                    fontFeatureSettings: '"tnum" 1',
                  }}
                >
                  {r.salary}
                </span>
              </div>
              <div
                style={{
                  fontFamily: theme.serif,
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: mix(theme.ink, isLight ? 55 : 65),
                }}
              >
                {r.company} · {r.location}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 18,
            fontFamily: theme.mono,
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: mix(theme.ink, isLight ? 40 : 50),
          }}
        >
          Escape or × to refine
        </div>
      </motion.aside>
    </>
  );
}

// Generate plausible mock result rows from the committed path. Purely
// illustrative — a real consumer would query their own data here.
function mockResults(path: DialNode[]): Array<{
  title: string;
  company: string;
  location: string;
  salary: string;
}> {
  const leaf = path[path.length - 1]?.label ?? 'Role';
  const companies = ['Uniswap Labs', 'Phantom', 'Farcaster', 'Base', 'Helius'];
  const locations = ['Remote', 'New York', 'Remote · EU', 'San Francisco'];
  const salaries = ['$160k', '$185k', '$210k', '$140k', '$175k'];
  const titlePrefix = leaf.includes('$') || /Seed|Series|Public/.test(leaf)
    ? 'Engineer'
    : leaf;
  return Array.from({ length: 4 }, (_, i) => ({
    title: `${titlePrefix} ${['', 'II', 'Senior', 'Lead'][i] ?? ''}`.trim(),
    company: companies[i % companies.length],
    location: locations[i % locations.length],
    salary: salaries[i % salaries.length],
  }));
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
// Segmented pill (Pill Consolidation #2): ONE container with a sliding
// indicator, not three sibling pills. The active indicator is a shared-layout
// motion.div — Framer FLIP-animates it between segments, so switching themes
// slides the accent capsule across rather than hard-swapping backgrounds.
function ThemeSwitcher({
  theme,
  onChange,
}: {
  theme: RadialDialTheme;
  onChange: (t: RadialDialTheme) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        position: 'relative',
        padding: 3,
        gap: 2,
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
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t)}
            aria-label={`Switch to ${t.name} theme`}
            style={{
              position: 'relative',
              padding: '4px 10px',
              borderRadius: 999,
              background: 'transparent',
              color: active ? theme.accent : mix(theme.ink, 58),
              border: 'none',
              cursor: 'pointer',
              transition: 'color 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* Sliding indicator — shared layoutId means Framer animates it
                from the previously-active segment to this one. */}
            {active && (
              <motion.span
                layoutId="theme-indicator"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  background: mix(theme.accent, 16),
                  boxShadow: `inset 0 0 0 1px ${mix(theme.accent, 28)}`,
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{t.name}</span>
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
