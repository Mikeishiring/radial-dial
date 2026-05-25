import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ALL_THEMES,
  EXPO_OUT,
  PAPER_THEME,
  RadialDial,
  glassSurface,
  mix,
} from '@mikeishiring/radial-dial';
import type {
  DialNode,
  DialPathPayload,
  RadialDialTheme,
} from '@mikeishiring/radial-dial';

type SampleId = 'interface' | 'workflow' | 'material';
type EventKind = 'change' | 'complete' | 'apply';

type SampleTree = {
  id: SampleId;
  name: string;
  total: number;
  countLabel: string;
  tree: DialNode;
};

type EventEntry = {
  kind: EventKind;
  label: string;
  at: string;
};

const SAMPLES: SampleTree[] = [
  {
    id: 'interface',
    name: 'Interface',
    total: 256,
    countLabel: 'states',
    tree: {
      id: 'root',
      label: 'Choose',
      children: [
        {
          id: 'arrange',
          label: 'Arrange',
          icon: <GridIcon />,
          share: 0.72,
          children: [
            { id: 'grid', label: 'Grid', share: 0.38 },
            { id: 'stack', label: 'Stack', share: 0.24 },
            { id: 'orbit', label: 'Orbit', share: 0.18 },
            { id: 'cascade', label: 'Cascade', share: 0.20 },
          ],
        },
        {
          id: 'transform',
          label: 'Transform',
          icon: <TransformIcon />,
          share: 0.64,
          children: [
            { id: 'scale', label: 'Scale', share: 0.30 },
            { id: 'rotate', label: 'Rotate', share: 0.26 },
            { id: 'mask', label: 'Mask', share: 0.22 },
            { id: 'blend', label: 'Blend', share: 0.22 },
          ],
        },
        {
          id: 'inspect',
          label: 'Inspect',
          icon: <InspectIcon />,
          share: 0.48,
          children: [
            { id: 'summary', label: 'Summary', share: 0.42 },
            { id: 'compare', label: 'Compare', share: 0.28 },
            { id: 'trace', label: 'Trace', share: 0.18 },
            { id: 'detail', label: 'Detail', share: 0.12 },
          ],
        },
        {
          id: 'commit',
          label: 'Commit',
          icon: <CommitIcon />,
          share: 0.56,
          children: [
            { id: 'apply', label: 'Apply', share: 0.44 },
            { id: 'pin', label: 'Pin', share: 0.24 },
            { id: 'copy', label: 'Copy', share: 0.18 },
            { id: 'reset', label: 'Reset', share: 0.14 },
          ],
        },
      ],
    },
  },
  {
    id: 'workflow',
    name: 'Workflow',
    total: 96,
    countLabel: 'routes',
    tree: {
      id: 'root',
      label: 'Route',
      children: [
        {
          id: 'triage',
          label: 'Triage',
          icon: <InspectIcon />,
          share: 0.68,
          children: [
            { id: 'accept', label: 'Accept', share: 0.40 },
            { id: 'hold', label: 'Hold', share: 0.24 },
            { id: 'reject', label: 'Reject', share: 0.20 },
            { id: 'review', label: 'Review', share: 0.16 },
          ],
        },
        {
          id: 'priority',
          label: 'Priority',
          icon: <StackIcon />,
          share: 0.52,
          children: [
            { id: 'low', label: 'Low', share: 0.36 },
            { id: 'normal', label: 'Normal', share: 0.34 },
            { id: 'high', label: 'High', share: 0.22 },
            { id: 'urgent', label: 'Urgent', share: 0.08 },
          ],
        },
        {
          id: 'owner',
          label: 'Owner',
          icon: <OrbitIcon />,
          share: 0.74,
          children: [
            { id: 'self', label: 'Self', share: 0.46 },
            { id: 'team', label: 'Team', share: 0.32 },
            { id: 'system', label: 'System', share: 0.22 },
          ],
        },
      ],
    },
  },
  {
    id: 'material',
    name: 'Material',
    total: 144,
    countLabel: 'variants',
    tree: {
      id: 'root',
      label: 'Tune',
      children: [
        {
          id: 'surface',
          label: 'Surface',
          icon: <GridIcon />,
          share: 0.80,
          children: [
            { id: 'matte', label: 'Matte', share: 0.32 },
            { id: 'glass', label: 'Glass', share: 0.26 },
            { id: 'paper', label: 'Paper', share: 0.22 },
            { id: 'metal', label: 'Metal', share: 0.20 },
          ],
        },
        {
          id: 'motion',
          label: 'Motion',
          icon: <TransformIcon />,
          share: 0.58,
          children: [
            { id: 'snap', label: 'Snap', share: 0.30 },
            { id: 'settle', label: 'Settle', share: 0.26 },
            { id: 'trail', label: 'Trail', share: 0.24 },
            { id: 'pulse', label: 'Pulse', share: 0.20 },
          ],
        },
        {
          id: 'density',
          label: 'Density',
          icon: <StackIcon />,
          share: 0.62,
          children: [
            { id: 'quiet', label: 'Quiet', share: 0.42 },
            { id: 'balanced', label: 'Balanced', share: 0.36 },
            { id: 'dense', label: 'Dense', share: 0.22 },
          ],
        },
        {
          id: 'signal',
          label: 'Signal',
          icon: <CommitIcon />,
          share: 0.50,
          children: [
            { id: 'count', label: 'Count', share: 0.36 },
            { id: 'depth', label: 'Depth', share: 0.28 },
            { id: 'state', label: 'State', share: 0.22 },
            { id: 'payload', label: 'Payload', share: 0.14 },
          ],
        },
      ],
    },
  },
];

function countForPath(nodes: DialNode[], total: number): number {
  return nodes.reduce((n, node) => n * (node.share ?? 1), total);
}

function useCompactLayout() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const update = () => setCompact(window.innerWidth < 780 || window.innerHeight < 620);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return compact;
}

export function RadialDialPage() {
  const [theme, setTheme] = useState<RadialDialTheme>(PAPER_THEME);
  const [sampleId, setSampleId] = useState<SampleId>('interface');
  const [payload, setPayload] = useState<DialPathPayload>({ nodes: [] });
  const [applied, setApplied] = useState<DialPathPayload | null>(null);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const compact = useCompactLayout();

  const sample = useMemo(
    () => SAMPLES.find(item => item.id === sampleId) ?? SAMPLES[0],
    [sampleId],
  );

  const pushEvent = (kind: EventKind, nextPayload: DialPathPayload) => {
    const label = nextPayload.nodes.map(node => node.label).join(' > ') || 'root';
    setEvents(prev => [
      { kind, label, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
      ...prev,
    ].slice(0, 4));
  };

  const handleSampleChange = (next: SampleId) => {
    setSampleId(next);
    setPayload({ nodes: [] });
    setApplied(null);
    setEvents([]);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        minHeight: 520,
        position: 'relative',
        overflow: 'hidden',
        background: theme.paper,
      }}
    >
      <RadialDial
        key={sample.id}
        tree={sample.tree}
        theme={theme}
        title="radial dial"
        hint="gesture primitive for nested choices"
        countLabel={sample.countLabel}
        total={sample.total}
        actionPlacement={compact ? 'path' : 'auto'}
        applyLabel="Emit"
        fanRadius={196}
        commitDistance={158}
        undoRadius={44}
        onChange={next => {
          setPayload(next);
          setApplied(null);
          pushEvent('change', next);
        }}
        onComplete={next => pushEvent('complete', next)}
        onApply={next => {
          setApplied(next);
          pushEvent('apply', next);
        }}
        toolbar={<ThemeSwitcher theme={theme} onChange={setTheme} compact={compact} />}
      />

      <InspectorPanel
        compact={compact}
        theme={theme}
        sample={sample}
        sampleId={sampleId}
        payload={payload}
        applied={applied}
        events={events}
        onSampleChange={handleSampleChange}
      />

      <FooterLink theme={theme} compact={compact} />
    </div>
  );
}

function InspectorPanel({
  compact,
  theme,
  sample,
  sampleId,
  payload,
  applied,
  events,
  onSampleChange,
}: {
  compact: boolean;
  theme: RadialDialTheme;
  sample: SampleTree;
  sampleId: SampleId;
  payload: DialPathPayload;
  applied: DialPathPayload | null;
  events: EventEntry[];
  onSampleChange: (id: SampleId) => void;
}) {
  const isLight = theme.mode === 'light';
  const glass = glassSurface(theme, { alpha: isLight ? 62 : 42, blur: 22 });
  const nodes = payload.nodes;
  const count = Math.round(payload.count ?? countForPath(nodes, sample.total));
  const pathText = nodes.map(node => node.label).join(' > ') || 'root';
  const payloadJson = JSON.stringify(
    {
      nodes: nodes.map(node => ({ id: node.id, label: node.label })),
      count,
    },
    null,
    2,
  );

  return (
    <motion.aside
      aria-label="Interaction inspector"
      style={{
        position: 'absolute',
        zIndex: 35,
        right: compact ? 16 : 24,
        left: compact ? 16 : 'auto',
        top: compact ? 'auto' : 92,
        bottom: compact ? 16 : 24,
        width: compact ? 'auto' : 344,
        maxHeight: compact ? '42dvh' : 'calc(100dvh - 116px)',
        overflow: 'auto',
        padding: compact ? 16 : 18,
        color: theme.ink,
        background: glass.background,
        backdropFilter: glass.backdropFilter,
        WebkitBackdropFilter: glass.WebkitBackdropFilter,
        border: glass.border,
        borderRadius: 8,
        boxShadow: glass.glassShadow,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      initial={{ opacity: 0, x: compact ? 0 : 18, y: compact ? 18 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.34, ease: EXPO_OUT }}
    >
      <PanelKicker theme={theme}>Primitive inspector</PanelKicker>
      <div
        style={{
          fontFamily: theme.serif,
          fontStyle: 'italic',
          fontSize: compact ? 20 : 24,
          lineHeight: 1.12,
          marginTop: 8,
          marginBottom: 14,
        }}
      >
        {pathText}
      </div>

      <SegmentedSamples
        theme={theme}
        active={sampleId}
        onChange={onSampleChange}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginTop: 14,
        }}
      >
        <MetricCell theme={theme} label="Depth" value={String(nodes.length)} />
        <MetricCell theme={theme} label={sample.countLabel} value={count.toLocaleString('en-US')} />
      </div>

      <div style={{ marginTop: 14 }}>
        <PanelKicker theme={theme}>Payload</PanelKicker>
        <pre
          style={{
            margin: '8px 0 0',
            padding: 12,
            borderRadius: 6,
            background: mix(theme.ink, isLight ? 5 : 14, 'transparent'),
            border: `1px solid ${mix(theme.ink, isLight ? 10 : 18)}`,
            color: mix(theme.ink, isLight ? 82 : 78),
            fontFamily: theme.mono,
            fontSize: 11,
            lineHeight: 1.45,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {payloadJson}
        </pre>
      </div>

      <AnimatePresence>
        {applied && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.25, ease: EXPO_OUT }}
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 6,
              background: mix(theme.accent, isLight ? 10 : 16, 'transparent'),
              border: `1px solid ${mix(theme.accent, 30)}`,
              fontFamily: theme.mono,
              fontSize: 11,
              color: mix(theme.accent, isLight ? 88 : 78),
            }}
          >
            emitted {applied.nodes.map(node => node.label).join(' > ') || 'root'}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ marginTop: 14 }}>
        <PanelKicker theme={theme}>Events</PanelKicker>
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {(events.length ? events : [{ kind: 'change' as const, label: 'waiting', at: '--:--:--' }]).map((event, index) => (
            <div
              key={`${event.kind}-${event.at}-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '64px 1fr 64px',
                gap: 8,
                alignItems: 'center',
                padding: '7px 0',
                borderTop: index === 0 ? 'none' : `1px solid ${mix(theme.ink, isLight ? 8 : 14)}`,
                fontFamily: theme.mono,
                fontSize: 10,
                color: mix(theme.ink, isLight ? 58 : 66),
              }}
            >
              <span style={{ color: event.kind === 'apply' ? theme.accent : mix(theme.ink, isLight ? 54 : 62) }}>
                {event.kind}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {event.label}
              </span>
              <span style={{ textAlign: 'right', fontFeatureSettings: '"tnum" 1' }}>
                {event.at}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}

function PanelKicker({ theme, children }: { theme: RadialDialTheme; children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: theme.mono,
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: mix(theme.ink, theme.mode === 'light' ? 42 : 54),
      }}
    >
      {children}
    </div>
  );
}

function MetricCell({
  theme,
  label,
  value,
}: {
  theme: RadialDialTheme;
  label: string;
  value: string;
}) {
  const isLight = theme.mode === 'light';
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 6,
        border: `1px solid ${mix(theme.ink, isLight ? 10 : 16)}`,
        background: mix(theme.paper, isLight ? 52 : 22, 'transparent'),
      }}
    >
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: mix(theme.ink, isLight ? 42 : 54),
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 18,
          fontFeatureSettings: '"tnum" 1',
          color: theme.ink,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SegmentedSamples({
  theme,
  active,
  onChange,
}: {
  theme: RadialDialTheme;
  active: SampleId;
  onChange: (id: SampleId) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Sample tree"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 4,
        padding: 4,
        borderRadius: 8,
        border: `1px solid ${mix(theme.ink, theme.mode === 'light' ? 10 : 18)}`,
        background: mix(theme.ink, theme.mode === 'light' ? 4 : 10, 'transparent'),
      }}
    >
      {SAMPLES.map(sample => {
        const selected = active === sample.id;
        return (
          <button
            key={sample.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(sample.id)}
            style={{
              minWidth: 0,
              padding: '7px 8px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              background: selected ? mix(theme.accent, 16) : 'transparent',
              color: selected ? theme.accent : mix(theme.ink, theme.mode === 'light' ? 62 : 68),
              fontFamily: theme.mono,
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {sample.name}
          </button>
        );
      })}
    </div>
  );
}

function ThemeSwitcher({
  theme,
  onChange,
  compact,
}: {
  theme: RadialDialTheme;
  onChange: (t: RadialDialTheme) => void;
  compact: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      style={{
        display: compact ? 'none' : 'inline-flex',
        alignItems: 'center',
        position: 'relative',
        padding: 3,
        gap: 2,
        background: mix(theme.ink, theme.mode === 'light' ? 4 : 8, theme.paper),
        border: `1px solid ${mix(theme.ink, theme.mode === 'light' ? 10 : 18)}`,
        borderRadius: 8,
        fontFamily: theme.mono,
        fontSize: 9,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}
    >
      {ALL_THEMES.map(nextTheme => {
        const active = nextTheme.name === theme.name;
        return (
          <motion.button
            key={nextTheme.name}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(nextTheme)}
            aria-label={`Switch to ${nextTheme.name} theme`}
            whileTap={{ scale: 0.96 }}
            style={{
              position: 'relative',
              padding: '5px 10px',
              borderRadius: 6,
              background: 'transparent',
              color: active ? theme.accent : mix(theme.ink, 58),
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {active && (
              <motion.span
                layoutId="theme-indicator"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 6,
                  background: mix(theme.accent, 14),
                  boxShadow: `inset 0 0 0 1px ${mix(theme.accent, 26)}`,
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{nextTheme.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function FooterLink({ theme, compact }: { theme: RadialDialTheme; compact: boolean }) {
  if (compact) return null;
  return (
    <a
      href="https://github.com/Mikeishiring/radial-dial"
      target="_blank"
      rel="noreferrer noopener"
      style={{
        position: 'absolute',
        left: 32,
        bottom: 28,
        zIndex: 25,
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontFamily: theme.mono,
        color: mix(theme.ink, theme.mode === 'light' ? 45 : 55),
        textDecoration: 'none',
        transition: 'color 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onMouseEnter={event => (event.currentTarget.style.color = theme.accent)}
      onMouseLeave={event =>
        (event.currentTarget.style.color = mix(theme.ink, theme.mode === 'light' ? 45 : 55))
      }
    >
      Mikeishiring/radial-dial
    </a>
  );
}

const ICON_SIZE = 28;
const ICON_STROKE = 1.6;

function BaseIcon({ children }: { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

function GridIcon() {
  return (
    <BaseIcon>
      <path d="M5 5 H10 V10 H5 Z" />
      <path d="M14 5 H19 V10 H14 Z" />
      <path d="M5 14 H10 V19 H5 Z" />
      <path d="M14 14 H19 V19 H14 Z" />
    </BaseIcon>
  );
}

function TransformIcon() {
  return (
    <BaseIcon>
      <path d="M7 7 H17 V17 H7 Z" />
      <path d="M4 12 H20" />
      <path d="M12 4 V20" />
    </BaseIcon>
  );
}

function InspectIcon() {
  return (
    <BaseIcon>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M15 15 L20 20" />
      <path d="M8.5 10.5 H12.5" />
    </BaseIcon>
  );
}

function CommitIcon() {
  return (
    <BaseIcon>
      <path d="M5 12.5 L10 17.5 L19 6.5" />
      <path d="M5 20 H19" />
    </BaseIcon>
  );
}

function StackIcon() {
  return (
    <BaseIcon>
      <path d="M6 7 L12 4 L18 7 L12 10 Z" />
      <path d="M6 12 L12 15 L18 12" />
      <path d="M6 17 L12 20 L18 17" />
    </BaseIcon>
  );
}

function OrbitIcon() {
  return (
    <BaseIcon>
      <circle cx="12" cy="12" r="2" />
      <path d="M4.5 12 C4.5 7.5 19.5 7.5 19.5 12 C19.5 16.5 4.5 16.5 4.5 12 Z" />
      <path d="M12 4.5 C16.5 4.5 16.5 19.5 12 19.5 C7.5 19.5 7.5 4.5 12 4.5 Z" />
    </BaseIcon>
  );
}
