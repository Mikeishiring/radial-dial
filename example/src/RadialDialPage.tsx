import { useState, type ReactNode } from 'react';
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
  DialBacktrackMode,
  DialFlowMode,
  DialGestureCommand,
  DialInteractionPayload,
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
  label: 'Tune',
  children: [
    {
      id: 'outcome',
      label: 'Outcome',
      icon: <OutcomeIcon />,
      share: 1,
      children: [
        {
          id: 'ship-product',
          label: 'Ship product',
          share: 0.34,
          children: [
            { id: 'radial-v2', label: 'Radial V2', share: 0.28 },
            { id: 'web3-jobs', label: 'Web3 Jobs', share: 0.26 },
            { id: 'plugin-lab', label: 'Plugin lab', share: 0.18 },
            { id: 'prototype', label: 'Prototype', share: 0.22 },
          ],
        },
        {
          id: 'find-role',
          label: 'Find role',
          share: 0.24,
          children: [
            { id: 'founder-mode', label: 'Founder mode' },
            { id: 'principal-ic', label: 'Principal IC' },
            { id: 'operator', label: 'Operator' },
          ],
        },
        {
          id: 'learn-craft',
          label: 'Learn craft',
          share: 0.20,
          children: [
            { id: 'motion', label: 'Motion' },
            { id: 'ai-tools', label: 'AI tools' },
            { id: 'data-viz', label: 'Data viz' },
          ],
        },
        {
          id: 'decide-fast',
          label: 'Decide fast',
          share: 0.22,
          children: [
            { id: 'compare', label: 'Compare' },
            { id: 'triage', label: 'Triage' },
            { id: 'rank', label: 'Rank' },
          ],
        },
      ],
    },
    {
      id: 'taste',
      label: 'Taste',
      icon: <TasteIcon />,
      share: 1,
      children: [
        { id: 'ios-glass', label: 'iOS glass', share: 0.30 },
        { id: 'editorial', label: 'Editorial', share: 0.22 },
        { id: 'dense-tools', label: 'Dense tools', share: 0.26 },
        { id: 'calm-motion', label: 'Calm motion', share: 0.22 },
      ],
    },
    {
      id: 'constraint',
      label: 'Constraints',
      icon: <ConstraintIcon />,
      share: 1,
      children: [
        { id: 'low-meetings', label: 'Low meetings', share: 0.22 },
        { id: 'remote-first', label: 'Remote first', share: 0.24 },
        { id: 'short-sprint', label: 'Short sprint', share: 0.26 },
        { id: 'high-leverage', label: 'High leverage', share: 0.28 },
      ],
    },
    {
      id: 'depth',
      label: 'Depth',
      icon: <DepthIcon />,
      share: 1,
      children: [
        { id: 'one-shot', label: 'One shot', share: 0.24 },
        { id: 'polish-pass', label: 'Polish pass', share: 0.30 },
        { id: 'production', label: 'Production', share: 0.28 },
        { id: 'research', label: 'Research', share: 0.18 },
      ],
    },
  ],
};

const TOTAL_MATCHES = 1_840;

const FLOW_MODES: Array<{
  id: DialFlowMode;
  label: string;
  cue: string;
}> = [
  { id: 'right-flow', label: 'Right', cue: 'left anchor' },
  { id: 'radial', label: 'Orbit', cue: 'compass' },
  { id: 'left-flow', label: 'Left', cue: 'right anchor' },
  { id: 'down-flow', label: 'Stack', cue: 'top anchor' },
];

type FlowEvent = 'start' | 'choose' | 'refine' | 'change' | 'backtrack' | 'apply' | 'clear';
type RadialFlowStepId = 'rest' | 'approach' | 'commit' | 'branch' | 'backtrack' | 'leaf' | 'applied';

const RADIAL_FLOW_STEPS: Array<{
  id: RadialFlowStepId;
  label: string;
  trigger: string;
  result: string;
}> = [
  {
    id: 'rest',
    label: 'Rest',
    trigger: 'Main bubble + siblings',
    result: 'Options stay visible without forcing a grab.',
  },
  {
    id: 'approach',
    label: 'Preview',
    trigger: 'Near an option',
    result: 'Children bloom beside that option only.',
  },
  {
    id: 'commit',
    label: 'Commit',
    trigger: 'Cross the lane',
    result: 'Target becomes the active bubble.',
  },
  {
    id: 'branch',
    label: 'Branch',
    trigger: 'Active node has children',
    result: 'Next options align from that anchor.',
  },
  {
    id: 'backtrack',
    label: 'Backtrack',
    trigger: 'Pull inward',
    result: 'Line erases to the previous anchor.',
  },
  {
    id: 'leaf',
    label: 'Leaf',
    trigger: 'No more children',
    result: 'Review opens with Apply or Change.',
  },
  {
    id: 'applied',
    label: 'Applied',
    trigger: 'Confirm path',
    result: 'Same path hides duplicate Apply.',
  },
];

// Compute the running count by multiplying each node's share down the path.
function countForPath(nodes: DialNode[]): number {
  return nodes.reduce((n, node) => n * (node.share ?? 1), TOTAL_MATCHES);
}

function flowEventFor(prev: DialNode[], next: DialNode[]): FlowEvent {
  if (next.length === 0) return 'clear';
  if (prev.length === 0) return 'start';
  if (next.length < prev.length) return 'backtrack';
  if (next.length === prev.length && next[next.length - 1]?.id !== prev[prev.length - 1]?.id) {
    return 'change';
  }
  return 'refine';
}

function samePath(a: DialNode[], b: DialNode[]) {
  if (a.length !== b.length) return false;
  return a.every((node, i) => node.id === b[i]?.id);
}

function radialStepFor({
  interaction,
  currentPath,
  flowEvent,
  leafPath,
  lastApplied,
}: {
  interaction: DialInteractionPayload | null;
  currentPath: DialNode[];
  flowEvent: FlowEvent;
  leafPath: DialNode[] | null;
  lastApplied: DialPathPayload | null;
}): RadialFlowStepId {
  if (lastApplied) return 'applied';
  if (leafPath) return 'leaf';
  if (flowEvent === 'backtrack' || flowEvent === 'change') return 'backtrack';
  if (interaction?.mode === 'previewing') return 'approach';
  if (interaction?.mode === 'homing' || interaction?.mode === 'drawing') return 'commit';
  if (currentPath.length > 0 || interaction?.mode === 'committed-options') return 'branch';
  return 'rest';
}

function interactionSignature(payload: DialInteractionPayload) {
  return [
    payload.mode,
    payload.phase,
    payload.depth,
    payload.activeLabel,
    payload.homedLabel ?? '',
    payload.preview?.parentLabel ?? '',
    payload.preview?.childLabels.join('|') ?? '',
    payload.optionLabels.join('|'),
  ].join('::');
}

export function RadialDialPage() {
  const [theme, setTheme] = useState<RadialDialTheme>(PAPER_THEME);
  const [flowMode, setFlowMode] = useState<DialFlowMode>('right-flow');
  const [backtrackMode, setBacktrackMode] = useState<DialBacktrackMode>('erase');
  const [currentPath, setCurrentPath] = useState<DialNode[]>([]);
  const [flowEvent, setFlowEvent] = useState<FlowEvent>('clear');
  const [radialInteraction, setRadialInteraction] = useState<DialInteractionPayload | null>(null);
  // The last-applied payload — shown in a toast that auto-dismisses.
  const [lastApplied, setLastApplied] = useState<DialPathPayload | null>(null);
  const [lastGesture, setLastGesture] = useState<DialGestureCommand | null>(null);
  // When the user drills all the way to a leaf (a node with no children),
  // we open a styled results preview. Null when not at a leaf.
  const [leafPath, setLeafPath] = useState<DialNode[] | null>(null);
  const cycleFlowMode = (direction: 1 | -1) => {
    setFlowMode(prev => {
      const current = FLOW_MODES.findIndex(mode => mode.id === prev);
      const next = (current + direction + FLOW_MODES.length) % FLOW_MODES.length;
      return FLOW_MODES[next].id;
    });
  };
  const recordApply = (payload: DialPathPayload) => {
    setFlowEvent('apply');
    setLastApplied(payload);
    window.setTimeout(() => {
      setLastApplied(prev => (prev === payload ? null : prev));
    }, 5000);
  };
  const pathIsApplied = !!lastApplied && samePath(lastApplied.nodes, currentPath);
  const activeRadialStep = radialStepFor({
    interaction: radialInteraction,
    currentPath,
    flowEvent,
    leafPath,
    lastApplied,
  });

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
        title="preference lab · v2"
        hint="draw, preview, commit."
        countLabel="matches"
        total={TOTAL_MATCHES}
        flowMode={flowMode}
        backtrackMode={backtrackMode}
        onChange={({ nodes }: DialPathPayload) => {
          // Fired on every commit / undo as you drill through levels. When
          // the deepest node is a LEAF (no children), you've reached the end
          // — open the styled preview. Otherwise keep it closed.
          const last = nodes[nodes.length - 1];
          const reachedLeaf = !!last && !last.children?.length;
          setLastApplied(prev => {
            if (!prev) return prev;
            return samePath(prev.nodes, nodes) ? prev : null;
          });
          setCurrentPath(prev => {
            setFlowEvent(flowEventFor(prev, nodes));
            return nodes;
          });
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
        onApply={pathIsApplied ? undefined : (payload: DialPathPayload) => {
          // Explicit "apply" — slide toast in, auto-dismiss after 5s.
          recordApply(payload);
        }}
        onGestureCommand={(command: DialGestureCommand) => {
          setLastGesture(command);
          window.setTimeout(() => {
            setLastGesture(prev => (prev === command ? null : prev));
          }, 1600);
          if (command === 'reset') {
            setFlowEvent('clear');
            setLastApplied(null);
            setLeafPath(null);
          } else {
            cycleFlowMode(command === 'next-flow' ? 1 : -1);
          }
        }}
        onInteractionChange={(payload: DialInteractionPayload) => {
          setRadialInteraction(prev =>
            prev && interactionSignature(prev) === interactionSignature(payload)
              ? prev
              : payload,
          );
        }}
        applyLabel="APPLY"
        toolbar={
          <DemoToolbar
            theme={theme}
            flowMode={flowMode}
            backtrackMode={backtrackMode}
            onFlowModeChange={setFlowMode}
            onBacktrackModeChange={setBacktrackMode}
            onThemeChange={setTheme}
          />
        }
      />

      {/* Intro card — bottom-left, fades to translucent on idle to stay
          out of the way. The dial's own title sits top-left so this gives
          the user something to read while figuring out the gesture. */}
      <IntroCard theme={theme} />

      <FlowMapPanel
        theme={theme}
        flowMode={flowMode}
        currentPath={currentPath}
        lastGesture={lastGesture}
        backtrackMode={backtrackMode}
        interaction={radialInteraction}
        activeRadialStep={activeRadialStep}
        flowEvent={flowEvent}
      />

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
            onApply={() => {
              recordApply({ nodes: leafPath, count: countForPath(leafPath) });
              setLeafPath(null);
            }}
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

function DemoToolbar({
  theme,
  flowMode,
  backtrackMode,
  onFlowModeChange,
  onBacktrackModeChange,
  onThemeChange,
}: {
  theme: RadialDialTheme;
  flowMode: DialFlowMode;
  backtrackMode: DialBacktrackMode;
  onFlowModeChange: (mode: DialFlowMode) => void;
  onBacktrackModeChange: (mode: DialBacktrackMode) => void;
  onThemeChange: (theme: RadialDialTheme) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        maxWidth: 640,
      }}
    >
      <FlowModeSwitcher theme={theme} value={flowMode} onChange={onFlowModeChange} />
      <StrokeModeSwitcher theme={theme} value={backtrackMode} onChange={onBacktrackModeChange} />
      <ThemeSwitcher theme={theme} onChange={onThemeChange} />
    </div>
  );
}

function StrokeModeSwitcher({
  theme,
  value,
  onChange,
}: {
  theme: RadialDialTheme;
  value: DialBacktrackMode;
  onChange: (mode: DialBacktrackMode) => void;
}) {
  const modes: Array<{ id: DialBacktrackMode; label: string }> = [
    { id: 'erase', label: 'Erase' },
    { id: 'lift', label: 'Lift' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Backtrack ink"
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
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      {modes.map(mode => {
        const active = mode.id === value;
        return (
          <motion.button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode.id)}
            aria-label={`${mode.label} backtrack ink`}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.1 }}
            style={{
              position: 'relative',
              padding: '4px 9px',
              borderRadius: 999,
              background: 'transparent',
              color: active ? theme.accent : mix(theme.ink, 58),
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {active && (
              <motion.span
                layoutId="stroke-mode-indicator"
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
            <span style={{ position: 'relative', zIndex: 1 }}>{mode.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function FlowModeSwitcher({
  theme,
  value,
  onChange,
}: {
  theme: RadialDialTheme;
  value: DialFlowMode;
  onChange: (mode: DialFlowMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Option flow"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        position: 'relative',
        padding: 3,
        gap: 2,
        background: mix(theme.ink, theme.mode === 'light' ? 4 : 8, theme.paper),
        border: `1px solid ${mix(theme.ink, theme.mode === 'light' ? 10 : 18)}`,
        borderRadius: 10,
        fontFamily: theme.mono,
        fontSize: 9,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      {FLOW_MODES.map(mode => {
        const active = mode.id === value;
        return (
          <motion.button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode.id)}
            aria-label={`${mode.label} option flow, ${mode.cue}`}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.1 }}
            style={{
              position: 'relative',
              padding: '5px 9px',
              borderRadius: 7,
              background: 'transparent',
              color: active ? theme.accent : mix(theme.ink, 58),
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {active && (
              <motion.span
                layoutId="flow-mode-indicator"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 7,
                  background: mix(theme.accent, 14),
                  boxShadow: `inset 0 0 0 1px ${mix(theme.accent, 28)}`,
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{mode.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function FlowMapPanel({
  theme,
  flowMode,
  currentPath,
  lastGesture,
  backtrackMode,
  interaction,
  activeRadialStep,
  flowEvent,
}: {
  theme: RadialDialTheme;
  flowMode: DialFlowMode;
  currentPath: DialNode[];
  lastGesture: DialGestureCommand | null;
  backtrackMode: DialBacktrackMode;
  interaction: DialInteractionPayload | null;
  activeRadialStep: RadialFlowStepId;
  flowEvent: FlowEvent;
}) {
  const isLight = theme.mode === 'light';
  const activePath = currentPath.map(n => n.label);
  const eventLabel = {
    start: 'Started',
    choose: 'Changed',
    refine: 'Refined',
    change: 'Changed',
    backtrack: 'Backtracked',
    apply: 'Applied',
    clear: 'Idle',
  }[flowEvent];
  const gestureText = lastGesture === 'reset'
    ? 'Circle reset'
    : lastGesture === 'next-flow'
      ? 'Slash next'
      : lastGesture === 'previous-flow'
        ? 'Slash previous'
        : `${backtrackMode === 'erase' ? 'Erase' : 'Lift'} backtrack · slash layout`;
  const visibleOptions = interaction?.optionLabels.length
    ? interaction.optionLabels.join(' · ')
    : 'No child options';
  const previewText = interaction?.preview
    ? `${interaction.preview.parentLabel} -> ${interaction.preview.childLabels.join(' · ')}`
    : 'No child layer open';
  const targetText = interaction?.homedLabel
    ? `${interaction.homedLabel} is pulling toward the cursor`
    : interaction?.activeLabel
      ? `${interaction.activeLabel} is the current anchor`
      : 'Tune is the current anchor';

  return (
    <motion.aside
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.34, ease: EXPO_OUT }}
      style={{
        position: 'absolute',
        left: 28,
        top: 92,
        zIndex: 27,
        width: 318,
        padding: '18px 18px 16px',
        borderRadius: 10,
        background: `color-mix(in srgb, ${theme.paper} ${isLight ? 72 : 64}%, transparent)`,
        border: `1px solid ${mix(theme.ink, isLight ? 10 : 18)}`,
        boxShadow: `0 18px 48px ${mix(theme.ink, isLight ? 8 : 26)}`,
        backdropFilter: 'blur(18px) saturate(135%)',
        WebkitBackdropFilter: 'blur(18px) saturate(135%)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          fontFamily: theme.mono,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          fontSize: 10,
          color: mix(theme.ink, isLight ? 46 : 58),
        }}
      >
        <span>Radial state</span>
        <span style={{ color: theme.accent }}>{eventLabel}</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${RADIAL_FLOW_STEPS.length}, 1fr)`,
          gap: 0,
          marginBottom: 16,
          padding: '9px 2px 6px',
          position: 'relative',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 18,
            right: 18,
            top: 18,
            height: 1,
            background: `linear-gradient(90deg, ${mix(theme.accent, 32)}, ${mix(theme.ink, isLight ? 14 : 22)})`,
          }}
        />
        {RADIAL_FLOW_STEPS.map((stage, index) => {
          const activeIndex = RADIAL_FLOW_STEPS.findIndex(step => step.id === activeRadialStep);
          const active = stage.id === activeRadialStep;
          const complete = index < activeIndex;
          return (
            <div
              key={stage.id}
              style={{
                minHeight: 42,
                color: active ? theme.accent : complete ? mix(theme.ink, isLight ? 58 : 68) : mix(theme.ink, isLight ? 38 : 50),
                fontFamily: theme.mono,
                fontSize: 8,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                position: 'relative',
                gap: 8,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: active ? 11 : 7,
                  height: active ? 11 : 7,
                  borderRadius: '50%',
                  background: active ? theme.accent : complete ? mix(theme.ink, isLight ? 22 : 34) : theme.paper,
                  border: `1px solid ${active ? mix(theme.accent, 42) : mix(theme.ink, isLight ? 18 : 26)}`,
                  boxShadow: active ? `0 0 0 5px ${mix(theme.accent, 10)}` : `0 0 0 3px ${mix(theme.paper, 75, 'transparent')}`,
                  transition: 'width 180ms cubic-bezier(0.22,1,0.36,1), height 180ms cubic-bezier(0.22,1,0.36,1)',
                  zIndex: 1,
                }}
              />
              <span>{stage.label}</span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          minHeight: 48,
          padding: '0 0 13px',
          borderBottom: `1px solid ${mix(theme.ink, isLight ? 9 : 16)}`,
          marginBottom: 11,
        }}
      >
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: mix(theme.ink, isLight ? 40 : 52),
            marginBottom: 5,
          }}
        >
          Active anchor
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontStyle: 'italic',
            fontSize: 15,
            lineHeight: 1.35,
            color: activePath.length ? theme.ink : mix(theme.ink, isLight ? 45 : 55),
          }}
        >
          {activePath.length ? activePath.join(' > ') : `${interaction?.activeLabel ?? 'Tune'} · ${FLOW_MODES.find(f => f.id === flowMode)?.cue ?? 'ready'}`}
        </div>
      </div>

      <div
        style={{
          padding: '0 0 12px',
          borderBottom: `1px solid ${mix(theme.ink, isLight ? 8 : 14)}`,
          marginBottom: 11,
          display: 'grid',
          gap: 8,
          fontFamily: theme.mono,
          fontSize: 9,
          letterSpacing: '0.08em',
          color: mix(theme.ink, isLight ? 44 : 56),
        }}
      >
        {[
          ['Options', visibleOptions],
          ['Preview', previewText],
          ['Target', targetText],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              display: 'grid',
              gridTemplateColumns: '68px 1fr',
              gap: 10,
              alignItems: 'baseline',
            }}
          >
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.12em', color: mix(theme.ink, isLight ? 34 : 46) }}>
              {label}
            </span>
            <span style={{ lineHeight: 1.35, color: label === 'Preview' && interaction?.preview ? theme.accent : mix(theme.ink, isLight ? 58 : 66) }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          minHeight: 28,
          padding: '0 0 12px',
          borderBottom: `1px solid ${mix(theme.ink, isLight ? 8 : 14)}`,
          marginBottom: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontFamily: theme.mono,
          fontSize: 9,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: lastGesture ? theme.accent : mix(theme.ink, isLight ? 42 : 54),
        }}
      >
        <span>Draw controls</span>
        <span>{gestureText}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {RADIAL_FLOW_STEPS.map(step => {
          const active = step.id === activeRadialStep;
          return (
            <div
              key={step.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '78px 1fr',
                alignItems: 'start',
                columnGap: 10,
                rowGap: 2,
                minHeight: 34,
                padding: '6px 8px',
                borderRadius: 7,
                background: active ? mix(theme.accent, 10) : 'transparent',
                color: active ? theme.accent : mix(theme.ink, isLight ? 56 : 64),
                fontFamily: theme.mono,
                fontSize: 9,
                fontFeatureSettings: '"tnum" 1',
              }}
            >
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {step.label}
              </span>
              <span style={{ color: active ? theme.accent : mix(theme.ink, isLight ? 52 : 62), lineHeight: 1.35 }}>
                {step.trigger}
              </span>
              <span />
              <span style={{ color: mix(theme.ink, isLight ? 38 : 50), lineHeight: 1.35, fontFamily: theme.serif, fontStyle: 'italic', fontSize: 12 }}>
                {step.result}
              </span>
            </div>
          );
        })}
      </div>
    </motion.aside>
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
        Tune a mock preference set. Drift near a choice to preview what
        sits behind it, commit when it feels right, then back out and
        change direction without starting over.
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
  onApply,
}: {
  path: DialNode[];
  theme: RadialDialTheme;
  onClose: () => void;
  onApply: () => void;
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
          {count.toLocaleString('en-US')} preference matches
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 18,
          }}
        >
          <motion.button
            type="button"
            onClick={onApply}
            whileTap={{ scale: 0.96 }}
            style={{
              flex: 1,
              minHeight: 36,
              borderRadius: 9,
              border: 'none',
              background: theme.accent,
              color: theme.paper,
              boxShadow: `0 10px 24px ${mix(theme.accent, isLight ? 20 : 34)}`,
              fontFamily: theme.mono,
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Apply
          </motion.button>
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={{ scale: 0.96 }}
            style={{
              minHeight: 36,
              padding: '0 14px',
              borderRadius: 9,
              border: `1px solid ${mix(theme.ink, isLight ? 14 : 24)}`,
              background: mix(theme.ink, isLight ? 4 : 10, 'transparent'),
              color: mix(theme.ink, isLight ? 62 : 72),
              fontFamily: theme.mono,
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Change
          </motion.button>
        </div>

        {/* Result cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {results.map((r, i) => (
            <motion.div
              key={r.title + r.time}
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
                  {r.fit}
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
                {r.detail} · {r.time}
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
  detail: string;
  fit: string;
  time: string;
}> {
  const leaf = path[path.length - 1]?.label ?? 'Preference';
  const briefs = [
    ['Radial V2 glass spacing pass', 'Bigger lanes, richer previews, calmer labels', '92%', '2h'],
    ['Preference dial for work picks', 'Turns vague taste into a concrete filter path', '88%', '45m'],
    ['Low-meeting product sprint', 'One high-leverage pass with a sharp review surface', '84%', '1d'],
    ['Motion audit checklist', 'Finds where previews, pulls, and backtracking fail', '79%', '35m'],
  ];
  return briefs.map(([title, detail, fit, time], i) => ({
    title: i === 0 ? `${leaf} · ${title}` : title,
    detail,
    fit,
    time,
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
          <motion.button
            key={t.name}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t)}
            aria-label={`Switch to ${t.name} theme`}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.1 }}
            style={{
              position: 'relative',
              padding: '4px 10px',
              borderRadius: 999,
              background: 'transparent',
              color: active ? theme.accent : mix(theme.ink, 58),
              border: 'none',
              cursor: 'pointer',
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
            <span style={{ position: 'relative', zIndex: 1, transition: 'color 220ms cubic-bezier(0.22,1,0.36,1)' }}>
              {t.name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Soft iOS-style category glyphs.
// Rounded, balanced, and abstract enough to survive at small sizes inside glass.
// =============================================================================
const ICON_SIZE = 28;
const ICON_STROKE = 1.85;

function GlyphSvg({ children }: { children: ReactNode }) {
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

function OutcomeIcon() {
  return (
    <GlyphSvg>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 5.5 L12 2.8" />
      <path d="M12 21.2 L12 18.5" />
      <path d="M5.5 12 L2.8 12" />
      <path d="M21.2 12 L18.5 12" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </GlyphSvg>
  );
}

function TasteIcon() {
  return (
    <GlyphSvg>
      <rect x="5" y="5" width="14" height="14" rx="4.5" />
      <path d="M8.4 9.4 C10.4 7.6 13.5 7.4 16 8.8" />
      <path d="M8 15.2 C10.6 17 14 16.7 16.6 14.6" />
      <path d="M16.4 5.8 L18.2 4" />
    </GlyphSvg>
  );
}

function ConstraintIcon() {
  return (
    <GlyphSvg>
      <path d="M5 7.2 H19" />
      <path d="M5 12 H19" />
      <path d="M5 16.8 H19" />
      <circle cx="9" cy="7.2" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="11.8" cy="16.8" r="1.8" fill="currentColor" stroke="none" />
    </GlyphSvg>
  );
}

function DepthIcon() {
  return (
    <GlyphSvg>
      <path d="M12 4.2 L19 8.2 L12 12.2 L5 8.2 Z" />
      <path d="M18.2 12 L12 15.6 L5.8 12" />
      <path d="M18.2 15.8 L12 19.4 L5.8 15.8" />
    </GlyphSvg>
  );
}
