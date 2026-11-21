import type { TilingDefinition, TileInstance } from './tiles';
/** A valid (not necessarily primitive) color period in both lattice directions. */
export const tileColorPeriod = (t: TilingDefinition) =>
  t.colors?.enabled ? t.colors.palette.length : 1;
export function tileColorIndex(
  t: TilingDefinition,
  tile: Pick<TileInstance, 'cell' | 'orientation'>,
): number {
  const n = tileColorPeriod(t);
  return (((tile.cell[0] + 2 * tile.cell[1] + tile.orientation) % n) + n) % n;
}
/** Appearance never changes the arrangement of boundary curves. */
export function geometricTiling(t: TilingDefinition | undefined) {
  if (!t) return t;
  const { colors: _, ...geometry } = t;
  return { ...geometry, version: 1 as const };
}
