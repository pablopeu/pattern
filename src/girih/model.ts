import type { Generator } from '../app/model';
import type { GirihKind } from './polygons';
import { girihGrid, girihRosette, girihStar, validateGirihPatch, type GirihTile } from './patch';
import { IDENTITY } from '../geometry/matrix';
export interface GirihOptions {
  version: 1;
  recipe: 'rosette' | 'rhombus-grid' | 'star' | 'single' | 'custom';
  tileKind: GirihKind;
  tiles?: GirihTile[];
  palette: string[];
  showTiles: boolean;
  weave: boolean;
  weaveSource: boolean;
  bandWidth: number;
  gap: number;
  phase: 0 | 1;
  allowBreaks: boolean;
}
export const defaultGirih = (): GirihOptions => ({
  version: 1,
  recipe: 'rosette',
  tileKind: 'decagon',
  palette: ['#28535c', '#c78f4d', '#4f7c6b', '#87613e', '#d0b684'],
  showTiles: false,
  weave: true,
  weaveSource: false,
  bandWidth: 1.2,
  gap: 0.2,
  phase: 0,
  allowBreaks: false,
});
const cache = new Map<
  string,
  { tiles: GirihTile[]; report: ReturnType<typeof validateGirihPatch> }
>();
export function girihDefinition(g: Pick<Generator, 'girih' | 'rows' | 'columns'>) {
  const options = g.girih ?? defaultGirih(),
    key = JSON.stringify([options.recipe, options.tileKind, g.rows, g.columns, options.tiles]),
    old = cache.get(key);
  if (old) return old;
  const tiles =
    options.recipe === 'rosette'
      ? girihRosette()
      : options.recipe === 'star'
        ? girihStar()
        : options.recipe === 'rhombus-grid'
          ? girihGrid(g.rows, g.columns)
          : options.recipe === 'custom'
            ? (options.tiles ?? [])
            : [{ id: 'girih-tile-0', kind: options.tileKind, matrix: IDENTITY }];
  const report = validateGirihPatch(tiles);
  if (report.holes) report.issues.push('El parche deja huecos internos.');
  if (cache.size >= 20) cache.delete(cache.keys().next().value!);
  const result = { tiles, report };
  cache.set(key, result);
  return result;
}
