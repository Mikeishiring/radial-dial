import { describe, expect, it } from 'vitest';
import { classifyGestureCommand } from './gesture-commands';
import type { Vec } from './types';

function circlePoints(cx: number, cy: number, radius: number): Vec[] {
  return Array.from({ length: 28 }, (_, i) => {
    const a = (i / 27) * Math.PI * 2;
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  });
}

function linePoints(from: Vec, to: Vec): Vec[] {
  return Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
  });
}

describe('classifyGestureCommand', () => {
  it('recognizes a closed circle as reset', () => {
    expect(classifyGestureCommand(circlePoints(220, 180, 42))).toBe('reset');
  });

  it('recognizes upward diagonal layout slashes', () => {
    expect(classifyGestureCommand(linePoints({ x: 80, y: 220 }, { x: 230, y: 120 }))).toBe('next-flow');
    expect(classifyGestureCommand(linePoints({ x: 230, y: 220 }, { x: 80, y: 120 }))).toBe('previous-flow');
  });

  it('ignores short or ambiguous marks', () => {
    expect(classifyGestureCommand(linePoints({ x: 10, y: 10 }, { x: 45, y: 20 }))).toBeNull();
    expect(classifyGestureCommand([
      { x: 10, y: 10 },
      { x: 24, y: 40 },
      { x: 52, y: 18 },
      { x: 78, y: 34 },
      { x: 88, y: 30 },
      { x: 91, y: 50 },
      { x: 94, y: 48 },
      { x: 96, y: 49 },
    ])).toBeNull();
  });
});
