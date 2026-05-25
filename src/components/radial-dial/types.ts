import type { ReactNode } from 'react';

/**
 * Radial Dial — public types.
 * The template surface is intentionally small. Every prop here is a deliberate
 * extension point; everything else is internal feel.
 */

/** A node in the tree the dial walks. */
export type DialNode = {
  id: string;
  label: string;
  /** Optional icon rendered above the label (level-1 categories typically). */
  icon?: ReactNode;
  /**
   * Multiplier applied to the running counter when this node is on the
   * committed path. Use to model "this filter narrows the set by N%."
   * Categories with no narrowing should use 1; leaves with their share.
   */
  share?: number;
  children?: DialNode[];
};

/** A 2D point in stage coordinates. */
export type Vec = { x: number; y: number };

/** A captured ink point — coordinates plus motion metadata. */
export type InkPoint = Vec & {
  /** Time captured (performance.now()). */
  t: number;
  /** Speed in px/ms relative to the previous point. */
  v: number;
};

/** A frozen committed stroke — the user's drawn arc between two commits. */
export type FrozenStroke = {
  id: string;
  points: InkPoint[];
  /** When the stroke was frozen — used for the "ink settling" animation. */
  frozenAt: number;
};

/**
 * Theme — every color in the dial derives from these via color-mix().
 * Keep palettes tight: paper, ink, accent. The serif/mono stacks define voice.
 */
export type RadialDialTheme = {
  name: string;
  paper: string;
  ink: string;
  accent: string;
  serif: string;
  mono: string;
  /** Optional SVG noise data URI overlaid on paper. */
  noise?: string;
  /** Whether the page is light-on-dark or dark-on-light. Affects label colours. */
  mode: 'light' | 'dark';
};

/** How child options are arranged as the user walks the hierarchy. */
export type DialFlowMode = 'radial' | 'right-flow' | 'left-flow' | 'down-flow';

/** Shape gestures drawn on empty paper outside the dial's live target zones. */
export type DialGestureCommand = 'reset' | 'next-flow' | 'previous-flow';

/** How committed ink exits when the user backs out of a branch. */
export type DialBacktrackMode = 'lift' | 'erase';

/** Live option-level state for demos, inspectors, and custom chrome. */
export type DialInteractionMode =
  | 'idle-options'
  | 'previewing'
  | 'drawing'
  | 'homing'
  | 'committed-options';

export type DialInteractionPayload = {
  mode: DialInteractionMode;
  phase: DialPhase;
  depth: number;
  activeLabel: string;
  optionLabels: string[];
  homedLabel?: string;
  preview?: {
    parentLabel: string;
    childLabels: string[];
    strength: number;
  };
};

/** Where the dial is in its lifecycle. */
export type DialPhase = 'idle' | 'drawing' | 'committed';

/** A committed path entry — node plus its anchor in stage coordinates. */
export type DialPathEntry = { node: DialNode; pos: Vec };

/** Public callback payload — what consumers see when paths change. */
export type DialPathPayload = {
  /** The committed path (excludes the synthetic root). */
  nodes: DialNode[];
  /** Live count after applying every node.share down the path. */
  count?: number;
};
