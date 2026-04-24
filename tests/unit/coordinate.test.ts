import { describe, expect, it } from 'vitest';

import { clampCoordinate, normalizeCoordinate, scaleCoordinate } from '@ariacore/computer';

describe('coordinate utilities', () => {
  it('scales coordinates between source and destination sizes', () => {
    expect(scaleCoordinate([640, 360], { width: 1280, height: 720 }, { width: 1920, height: 1080 })).toEqual([
      960,
      540
    ]);
  });

  it('clamps negative coordinates to zero', () => {
    expect(clampCoordinate([-10, 20])).toEqual([0, 20]);
  });

  it('normalizes coordinates by display origin', () => {
    expect(normalizeCoordinate([100, 200], { originX: 50, originY: 25 })).toEqual([150, 225]);
  });
});

