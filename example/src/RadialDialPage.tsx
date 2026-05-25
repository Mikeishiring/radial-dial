import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ALL_THEMES,
  COMMIT_DISTANCE,
  EXPO_OUT,
  FAN_RADIUS,
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

type StaticSampleId = 'interface' | 'workflow' | 'material';
type SampleId = 'lab' | StaticSampleId;
type EventKind = 'change' | 'complete' | 'apply';
type ResponseMode = 'spread' | 'compress' | 'group';

type DemoSettings = {
  layers: number;
  amount: number;
  response: ResponseMode;
};

type DialTuning = {
  fanRadius: number;
  commitDistance: number;
  settleRadius: number;
  undoRadius: number;
  angularTolerance: number;
};

type SampleTree = {
  id: SampleId;
  name: string;
  total: number;
  countLabel: string;
  tree: DialNode;
  settings?: DemoSettings;
  tuning?: DialTuning;
  layerCounts?: number[];
  leafCount?: number;
  responseNote?: string;
};

type EventEntry = {
  kind: EventKind;
  label: string;
  at: string;
};

const DEFAULT_SETTINGS: DemoSettings = {
  layers: 3,
  amount: 6,
  response: 'spread',
};

const RESPONSE_MODES: Record<ResponseMode, { label: string; note: string }> = {
  spread: {
    label: 'Spread',
    note: 'More siblings buy more radius, slower commit distance, and a tighter cone.',
  },
  compress: {
    label: 'Compress',
    note: 'More siblings keep the gesture compact, commit earlier, and use a forgiving cone.',
  },
  group: {
    label: 'Group',
    note: 'High sibling counts collapse into banks so each visible fan stays readable.',
  },
};

const SAMPLE_OPTIONS: Array<{ id: SampleId; name: string }> = [
  { id: 'lab', name: 'Lab' },
  { id: 'interface', name: 'Interface' },
  { id: 'workflow', name: 'Workflow' },
  { id: 'material', name: 'Material' },
];

const STATIC_SAMPLES: SampleTree[] = [
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

function generatedSample(settings: DemoSettings): SampleTree {
  const layerCounts = layerCountsFor(settings);
  const leafCount = layerCounts.reduce((total, count) => total * count, 1);
  const tuning = tuningFor(settings, layerCounts);
  const mode = RESPONSE_MODES[settings.response];
  const tree: DialNode = {
    id: 'lab-root',
    label: `${settings.layers} layers`,
    children: buildLayer(settings, layerCounts, 0, []),
  };

  return {
    id: 'lab',
    name: 'Lab',
    tree,
    total: Math.max(leafCount * 96, 1),
    countLabel: 'routes',
    settings,
    tuning,
    layerCounts,
    leafCount,
    responseNote: mode.note,
  };
}

function layerCountsFor(settings: DemoSettings): number[] {
  const amount = Math.max(2, Math.min(9, settings.amount));
  if (settings.response !== 'group') {
    return Array.from({ length: settings.layers }, () => amount);
  }

  if (amount <= 4) {
    return Array.from({ length: settings.layers }, () => amount);
  }

  const bankCount = Math.ceil(amount / 3);
  const bankSize = Math.ceil(amount / bankCount);
  return Array.from({ length: settings.layers }, (_, index) =>
    index === 0 ? bankCount : bankSize,
  );
}

function tuningFor(settings: DemoSettings, layerCounts: number[]): DialTuning {
  const visibleMax = Math.max(...layerCounts);
  if (settings.response === 'compress') {
    const fanRadius = FAN_RADIUS - 18 + Math.min(visibleMax, 9) * 3;
    return {
      fanRadius,
      commitDistance: fanRadius * 0.68,
      settleRadius: fanRadius * 0.48,
      undoRadius: 40,
      angularTolerance: Math.min(Math.PI / 3.9, Math.max(Math.PI / 8.2, Math.PI / (visibleMax * 0.68))),
    };
  }

  if (settings.response === 'group') {
    const fanRadius = FAN_RADIUS + Math.min(22, Math.max(0, settings.amount - 4) * 5);
    return {
      fanRadius,
      commitDistance: fanRadius * 0.76,
      settleRadius: fanRadius * 0.54,
      undoRadius: 44,
      angularTolerance: Math.min(Math.PI / 4.3, Math.max(Math.PI / 7, Math.PI / Math.max(4.5, visibleMax * 0.82))),
    };
  }

  const fanRadius = FAN_RADIUS + Math.max(0, visibleMax - 4) * 8;
  return {
    fanRadius,
    commitDistance: fanRadius * 0.8,
    settleRadius: fanRadius * 0.56,
    undoRadius: 44,
    angularTolerance: Math.min(Math.PI / 4.2, Math.max(Math.PI / 8.5, Math.PI / Math.max(4, visibleMax * 0.78))),
  };
}

function buildLayer(
  settings: DemoSettings,
  layerCounts: number[],
  layerIndex: number,
  lineage: number[],
): DialNode[] | undefined {
  const count = layerCounts[layerIndex];
  if (!count) return undefined;

  return Array.from({ length: count }, (_, index) => {
    const nextLineage = [...lineage, index + 1];
    const label = labelFor(settings, layerIndex, index, count);
    const children = buildLayer(settings, layerCounts, layerIndex + 1, nextLineage);
    return {
      id: `lab-${nextLineage.join('-')}`,
      label,
      icon: layerIndex === 0 ? iconForIndex(index) : undefined,
      share: shareFor(settings, layerIndex, index, count),
      children,
    };
  });
}

function labelFor(settings: DemoSettings, layerIndex: number, index: number, count: number): string {
  if (settings.response === 'group' && settings.amount > 4 && layerIndex === 0) {
    return `Bank ${index + 1}`;
  }
  const labels = ['Mode', 'Branch', 'Rule', 'Detail', 'Emit'];
  const name = labels[layerIndex] ?? 'Layer';
  if (count <= 4) return `${name} ${index + 1}`;
  return `${name} ${String.fromCharCode(65 + index)}`;
}

function iconForIndex(index: number) {
  const icons = [
    <GridIcon key="grid" />,
    <TransformIcon key="transform" />,
    <InspectIcon key="inspect" />,
    <CommitIcon key="commit" />,
    <StackIcon key="stack" />,
    <OrbitIcon key="orbit" />,
  ];
  return icons[index % icons.length];
}

function shareFor(settings: DemoSettings, layerIndex: number, index: number, count: number): number {
  if (settings.response === 'spread') {
    return Math.max(0.08, (1 / count) * (1.16 - index * 0.025));
  }
  if (settings.response === 'group') {
    const density = layerIndex === 0 && settings.amount > 4 ? 0.94 : 1;
    return Math.max(0.12, density / count);
  }
  const rank = count === 1 ? 1 : 1 - index / (count - 1);
  return Math.max(0.08, 0.34 - layerIndex * 0.025 + rank * 0.2);
}

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
  const [sampleId, setSampleId] = useState<SampleId>('lab');
  const [settings, setSettings] = useState<DemoSettings>(DEFAULT_SETTINGS);
  const [payload, setPayload] = useState<DialPathPayload>({ nodes: [] });
  const [applied, setApplied] = useState<DialPathPayload | null>(null);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const compact = useCompactLayout();

  const labSample = useMemo(() => generatedSample(settings), [settings]);
  const sample = useMemo(
    () =>
      sampleId === 'lab'
        ? labSample
        : STATIC_SAMPLES.find(item => item.id === sampleId) ?? STATIC_SAMPLES[0],
    [labSample, sampleId],
  );
  const tuning = sample.tuning ?? {
    fanRadius: FAN_RADIUS,
    commitDistance: COMMIT_DISTANCE,
    settleRadius: 108,
    undoRadius: 44,
    angularTolerance: Math.PI / 4.5,
  };

  const resetInteraction = () => {
    setPayload({ nodes: [] });
    setApplied(null);
    setEvents([]);
  };

  const pushEvent = (kind: EventKind, nextPayload: DialPathPayload) => {
    const label = nextPayload.nodes.map(node => node.label).join(' > ') || 'root';
    setEvents(prev => [
      { kind, label, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
      ...prev,
    ].slice(0, 4));
  };

  const handleSampleChange = (next: SampleId) => {
    setSampleId(next);
    resetInteraction();
  };

  const handleSettingsChange = (patch: Partial<DemoSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
    setSampleId('lab');
    resetInteraction();
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
        key={sample.id === 'lab' ? `lab-${settings.layers}-${settings.amount}-${settings.response}` : sample.id}
        tree={sample.tree}
        theme={theme}
        title="radial dial"
        hint={sample.responseNote ?? 'gesture primitive for nested choices'}
        countLabel={sample.countLabel}
        total={sample.total}
        actionPlacement={compact ? 'path' : 'auto'}
        applyLabel="Emit"
        fanRadius={tuning.fanRadius}
        commitDistance={tuning.commitDistance}
        settleRadius={tuning.settleRadius}
        undoRadius={tuning.undoRadius}
        angularTolerance={tuning.angularTolerance}
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
        settings={settings}
        onSettingsChange={handleSettingsChange}
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
  settings,
  onSettingsChange,
}: {
  compact: boolean;
  theme: RadialDialTheme;
  sample: SampleTree;
  sampleId: SampleId;
  payload: DialPathPayload;
  applied: DialPathPayload | null;
  events: EventEntry[];
  onSampleChange: (id: SampleId) => void;
  settings: DemoSettings;
  onSettingsChange: (patch: Partial<DemoSettings>) => void;
}) {
  const isLight = theme.mode === 'light';
  const glass = glassSurface(theme, { alpha: isLight ? 62 : 42, blur: 22 });
  const nodes = payload.nodes;
  const count = Math.round(payload.count ?? countForPath(nodes, sample.total));
  const pathText = nodes.map(node => node.label).join(' > ') || 'root';
  const payloadJson = JSON.stringify(
    {
      ...(sample.settings
        ? {
            settings: {
              layers: sample.settings.layers,
              amount: sample.settings.amount,
              response: sample.settings.response,
              visibleFan: sample.layerCounts,
            },
          }
        : {}),
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

      <StructureSettings
        theme={theme}
        settings={settings}
        active={sampleId === 'lab'}
        sample={sample}
        onChange={onSettingsChange}
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

function StructureSettings({
  theme,
  settings,
  active,
  sample,
  onChange,
}: {
  theme: RadialDialTheme;
  settings: DemoSettings;
  active: boolean;
  sample: SampleTree;
  onChange: (patch: Partial<DemoSettings>) => void;
}) {
  const isLight = theme.mode === 'light';
  const layerCounts = sample.layerCounts ?? layerCountsFor(settings);
  const tuning = sample.tuning ?? tuningFor(settings, layerCounts);
  const leafCount = sample.leafCount ?? layerCounts.reduce((total, count) => total * count, 1);
  const response = RESPONSE_MODES[settings.response];

  return (
    <section
      aria-label="Structure settings"
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${active ? mix(theme.accent, 28) : mix(theme.ink, isLight ? 9 : 16)}`,
        background: active
          ? mix(theme.accent, isLight ? 7 : 12, 'transparent')
          : mix(theme.ink, isLight ? 3 : 8, 'transparent'),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <PanelKicker theme={theme}>Structure settings</PanelKicker>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 10,
            color: active ? theme.accent : mix(theme.ink, isLight ? 42 : 54),
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
          {active ? 'driving demo' : 'switches to lab'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        <RangeSetting
          theme={theme}
          label="Layers"
          value={settings.layers}
          min={1}
          max={5}
          onChange={value => onChange({ layers: value })}
        />
        <RangeSetting
          theme={theme}
          label="Amount"
          value={settings.amount}
          min={2}
          max={9}
          onChange={value => onChange({ amount: value })}
        />
      </div>

      <ResponseSwitcher
        theme={theme}
        active={settings.response}
        onChange={responseMode => onChange({ response: responseMode })}
      />

      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px solid ${mix(theme.ink, isLight ? 8 : 14)}`,
        }}
      >
        <LayerMap theme={theme} counts={layerCounts} />
        <p
          style={{
            margin: '9px 0 0',
            color: mix(theme.ink, isLight ? 58 : 68),
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {response.note}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 6,
            marginTop: 10,
          }}
        >
          <TinyStat theme={theme} label="leaves" value={leafCount.toLocaleString('en-US')} />
          <TinyStat theme={theme} label="fan" value={Math.round(tuning.fanRadius).toString()} />
          <TinyStat theme={theme} label="commit" value={Math.round(tuning.commitDistance).toString()} />
        </div>
      </div>
    </section>
  );
}

function RangeSetting({
  theme,
  label,
  value,
  min,
  max,
  onChange,
}: {
  theme: RadialDialTheme;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const isLight = theme.mode === 'light';
  const setClamped = (next: number) => onChange(Math.max(min, Math.min(max, next)));
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: mix(theme.ink, isLight ? 45 : 56),
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 12,
            color: theme.ink,
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {value}
        </span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <button
            type="button"
            aria-label={`Decrease ${label}`}
            disabled={value <= min}
            onClick={() => setClamped(value - 1)}
            style={stepperButtonStyle(theme)}
          >
            -
          </button>
          <button
            type="button"
            aria-label={`Increase ${label}`}
            disabled={value >= max}
            onClick={() => setClamped(value + 1)}
            style={stepperButtonStyle(theme)}
          >
            +
          </button>
        </span>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={event => setClamped(Number(event.currentTarget.value))}
        style={{
          width: '100%',
          accentColor: theme.accent,
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

function stepperButtonStyle(theme: RadialDialTheme): React.CSSProperties {
  return {
    width: 24,
    height: 22,
    padding: 0,
    border: `1px solid ${mix(theme.ink, theme.mode === 'light' ? 12 : 20)}`,
    borderRadius: 6,
    background: mix(theme.ink, theme.mode === 'light' ? 4 : 10, 'transparent'),
    color: theme.ink,
    cursor: 'pointer',
    fontFamily: theme.mono,
    fontSize: 12,
    lineHeight: 1,
  };
}

function ResponseSwitcher({
  theme,
  active,
  onChange,
}: {
  theme: RadialDialTheme;
  active: ResponseMode;
  onChange: (mode: ResponseMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Amount response"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 4,
        marginTop: 10,
        padding: 4,
        borderRadius: 8,
        border: `1px solid ${mix(theme.ink, theme.mode === 'light' ? 10 : 18)}`,
        background: mix(theme.ink, theme.mode === 'light' ? 4 : 10, 'transparent'),
      }}
    >
      {(Object.keys(RESPONSE_MODES) as ResponseMode[]).map(mode => {
        const selected = active === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(mode)}
            style={{
              minWidth: 0,
              padding: '7px 6px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              background: selected ? mix(theme.accent, 16) : 'transparent',
              color: selected ? theme.accent : mix(theme.ink, theme.mode === 'light' ? 62 : 68),
              fontFamily: theme.mono,
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {RESPONSE_MODES[mode].label}
          </button>
        );
      })}
    </div>
  );
}

function LayerMap({ theme, counts }: { theme: RadialDialTheme; counts: number[] }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {counts.map((count, index) => (
        <div
          key={`layer-${index}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '44px 1fr 24px',
            alignItems: 'center',
            gap: 8,
            fontFamily: theme.mono,
            fontSize: 10,
            color: mix(theme.ink, theme.mode === 'light' ? 52 : 62),
          }}
        >
          <span>L{index + 1}</span>
          <span style={{ display: 'flex', gap: 3, minWidth: 0 }}>
            {Array.from({ length: count }, (_, dotIndex) => (
              <span
                key={dotIndex}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: dotIndex % 3 === 0 ? 2 : 999,
                  background: dotIndex === 0 ? theme.accent : mix(theme.ink, theme.mode === 'light' ? 18 : 30),
                }}
              />
            ))}
          </span>
          <span style={{ textAlign: 'right', fontFeatureSettings: '"tnum" 1' }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function TinyStat({
  theme,
  label,
  value,
}: {
  theme: RadialDialTheme;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: '7px 8px',
        borderRadius: 6,
        background: mix(theme.ink, theme.mode === 'light' ? 4 : 10, 'transparent'),
        border: `1px solid ${mix(theme.ink, theme.mode === 'light' ? 8 : 14)}`,
      }}
    >
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 8,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: mix(theme.ink, theme.mode === 'light' ? 42 : 54),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 3,
          fontFamily: theme.mono,
          fontSize: 12,
          color: theme.ink,
          fontFeatureSettings: '"tnum" 1',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
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
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 4,
        padding: 4,
        borderRadius: 8,
        border: `1px solid ${mix(theme.ink, theme.mode === 'light' ? 10 : 18)}`,
        background: mix(theme.ink, theme.mode === 'light' ? 4 : 10, 'transparent'),
      }}
    >
      {SAMPLE_OPTIONS.map(sample => {
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
