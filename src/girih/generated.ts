import { flattened } from '../geometry/paper';
import type { Generator, Geometry } from '../app/model';
import type { Generated } from '../generators';
import {
  IDENTITY,
  apply,
  multiply,
  rotate,
  scale,
  isSimilarity,
  type Matrix,
} from '../geometry/matrix';
import { girihBody } from './patch';
import { defaultGirih, girihDefinition } from './model';
import { girihStrands, solveWeave, type WeaveResult } from './weave';
import { weaveRibbons } from './ribbons';
import { girihNames } from './polygons';
export interface GirihReport {
  tiles: number;
  adjacencies: number;
  boundaryEdges: number;
  strands: number;
  crossings: number;
  conflicts: number;
  breaks: number;
  ambiguous: number;
  woven: boolean;
  sourceAxes: number;
  validity: 'EXACT' | 'APPROXIMATED' | 'ARTISTIC' | 'INVALID';
}
const cache = new Map<string, { geometry: Geometry[]; girih: GirihReport }>();
export function generateGirih(g: Generator, source: Geometry[]): Generated {
  const options = g.girih ?? defaultGirih(),
    sourceAxes = options.weaveSource
      ? source.filter((s) => s.visible && !s.fillRegion && s.stroke !== 'none' && s.strokeWidth > 0)
      : [],
    key = JSON.stringify([
      options,
      g.spacing,
      g.rotation,
      g.rows,
      g.columns,
      sourceAxes.map((g) => [
        g.id,
        g.kind,
        g.nodes,
        g.pathData,
        g.parameters,
        g.transform,
        g.closed,
      ]),
    ]);
  let derived = cache.get(key);
  if (!derived) {
    const { tiles, report } = girihDefinition(g);
    if (report.issues.length) throw Error(report.issues[0]);
    if (g.spacing < 5 || g.spacing > 100 || options.bandWidth > g.spacing * 0.25)
      throw Error('La banda es demasiado ancha para el lado de la tesela.');
    const frame = multiply(rotate(g.rotation), scale(g.spacing)),
      strands = [
        ...girihStrands(tiles).map((s) => ({
          ...s,
          points: s.points.map((p) => apply(frame, p)),
        })),
        ...sourceAxes.flatMap((g) =>
          flattened(g, 0.02).map((p, index) => ({ ...p, id: `source-${g.id}/${index}` })),
        ),
      ],
      weave = solveWeave(strands, options.phase, options.allowBreaks),
      disabled: WeaveResult = { ...weave, valid: false },
      geometry = [
        ...tiles.map((t) => ({
          ...girihBody(t.kind),
          id: `generated-${t.id}`,
          name: girihNames[t.kind],
          transform: multiply(frame, t.matrix),
          fill: options.showTiles
            ? options.palette[Object.keys(girihNames).indexOf(t.kind) % options.palette.length]
            : 'none',
          fillOpacity: 0.16,
          stroke: options.showTiles ? '#607668' : 'none',
        })),
        ...weaveRibbons(
          strands,
          options.weave ? weave : disabled,
          options.bandWidth,
          options.gap,
          options.palette,
        ),
      ];
    derived = {
      geometry,
      girih: {
        tiles: tiles.length,
        adjacencies: report.adjacencies.length,
        boundaryEdges: report.boundaryEdges,
        strands: strands.length,
        crossings: weave.crossings.length,
        conflicts: weave.conflicts.length,
        breaks: options.weave && weave.valid ? weave.breaks : 0,
        ambiguous: weave.ambiguous.length + weave.overlaps,
        woven: options.weave && weave.valid,
        sourceAxes: sourceAxes.length,
        validity:
          options.weave && !weave.valid
            ? 'INVALID'
            : options.weave && weave.breaks
              ? 'ARTISTIC'
              : sourceAxes.length
                ? 'APPROXIMATED'
                : 'EXACT',
      },
    };
    if (cache.size >= 16) cache.delete(cache.keys().next().value!);
    cache.set(key, derived);
  }
  return {
    geometry: [...derived.geometry, ...source.filter((s) => s.visible && !sourceAxes.includes(s))],
    placements: [IDENTITY],
    finite: true,
    girih: derived.girih,
    sourceGeometry: source,
  };
}

export function placedGirihReport(report: GirihReport, matrix: Matrix): GirihReport {
  return report.validity === 'INVALID' || isSimilarity(matrix)
    ? report
    : { ...report, validity: 'ARTISTIC' };
}
