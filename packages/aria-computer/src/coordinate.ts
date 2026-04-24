import type { Coordinate } from '@ariacore/types';

export function scaleCoordinate(
  coordinate: Coordinate,
  source: { width: number; height: number },
  destination: { width: number; height: number }
): Coordinate {
  return clampCoordinate([
    Math.round((coordinate[0] / source.width) * destination.width),
    Math.round((coordinate[1] / source.height) * destination.height)
  ]);
}

export function clampCoordinate(coordinate: Coordinate): Coordinate {
  return [Math.max(0, coordinate[0]), Math.max(0, coordinate[1])];
}

export function normalizeCoordinate(
  coordinate: Coordinate,
  display: { originX: number; originY: number }
): Coordinate {
  return [coordinate[0] + display.originX, coordinate[1] + display.originY];
}

