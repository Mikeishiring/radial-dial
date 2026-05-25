import { describe, expect, it } from 'vitest';
import { placeChildren } from './useRadialDial';
import type { Vec } from './types';

const parent: Vec = { x: 320, y: 240 };
const radius = 120;

function expectRightOfParent(points: Vec[]) {
  for (const p of points) expect(p.x).toBeGreaterThan(parent.x);
}

function expectLeftOfParent(points: Vec[]) {
  for (const p of points) expect(p.x).toBeLessThan(parent.x);
}

describe('placeChildren', () => {
  it('keeps radial root options off the dead top and bottom axes', () => {
    const points = placeChildren(parent, null, 4, radius);

    expect(points).toHaveLength(4);
    for (const p of points) {
      expect(Math.abs(p.x - parent.x)).toBeGreaterThan(1);
      expect(Math.abs(p.y - parent.y)).toBeGreaterThan(1);
    }
  });

  it('opens every level to the right in right-flow mode', () => {
    const rootPoints = placeChildren(parent, null, 4, radius, 'right-flow');
    expectRightOfParent(rootPoints);

    const childParent = rootPoints[0];
    const childPoints = placeChildren(childParent, parent, 3, radius, 'right-flow');
    for (const p of childPoints) expect(p.x).toBeGreaterThan(childParent.x);
  });

  it('opens every level to the left in left-flow mode', () => {
    const rootPoints = placeChildren(parent, null, 4, radius, 'left-flow');
    expectLeftOfParent(rootPoints);

    const childParent = rootPoints[0];
    const childPoints = placeChildren(childParent, parent, 3, radius, 'left-flow');
    for (const p of childPoints) expect(p.x).toBeLessThan(childParent.x);
  });

  it('can stack choices below the main anchor', () => {
    const points = placeChildren(parent, null, 3, radius, 'down-flow');

    for (const p of points) expect(p.y).toBeGreaterThan(parent.y);
  });
});
