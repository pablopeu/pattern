import {
  tileBoundary,
  tileBounds,
  tileInstances,
  tileOperations,
  type TileInstance,
  type TilingDefinition,
} from '../tiling/tiles';
import type { Geometry } from '../app/model';
import type { Pattern } from '../app/model';
import { generate, type Generated } from '../generators';
import { IDENTITY, multiply, apply, type Matrix } from '../geometry/matrix';
import { visibleInstances, type Bounds, type Instance, type Periodicity } from '../symmetry/groups';
import { geometryBounds, clipGeometry } from '../application/clipping';
export interface Scene {
  fills: { geometry: Geometry; matrices: Matrix[] }[];
  tiling?: {
    definition: TilingDefinition;
    boundary: Geometry;
    tiles: TileInstance[];
    inner: Scene;
  };
  generated: Generated;
  instances: Instance[];
  status: Periodicity;
  message: string;
}
export function buildScene(pattern: Pattern, bounds: Bounds, prepared?: Generated): Scene {
  if (pattern.tiling && pattern.generator.kind !== 'penrose') {
    const definition = pattern.tiling,
      boundary = tileBoundary(definition),
      inner = buildScene(
        {
          ...pattern,
          tiling: undefined,
          sourceGeometry: pattern.sourceGeometry.filter(
            (g) => !g.fillRegion || g.fillRegion.scope === 'source',
          ),
        },
        tileBounds(definition),
        prepared,
      ),
      tiles = tileInstances(definition, bounds);
    // Continue a stroke across paired boundaries without splitting its canonical source.
    const base = geometryBounds(inner.generated.geometry),
      corners = [
        { x: base.x, y: base.y },
        { x: base.x + base.width, y: base.y },
        { x: base.x, y: base.y + base.height },
        { x: base.x + base.width, y: base.y + base.height },
      ],
      padding = Math.max(1, ...inner.generated.geometry.map((g) => g.strokeWidth)) * 2,
      wrapped = new Map<string, Instance>(),
      local = { ...definition, origin: { x: 0, y: 0 }, rotation: 0 };
    for (const instance of inner.instances) {
      const points = inner.generated.placements.flatMap((p) =>
          corners.map((q) => apply(multiply(instance.matrix, p), q)),
        ),
        xs = points.map((p) => p.x),
        ys = points.map((p) => p.y);
      if (!points.length) continue;
      const content = {
        x: Math.min(...xs) - padding,
        y: Math.min(...ys) - padding,
        width: Math.max(...xs) - Math.min(...xs) + 2 * padding,
        height: Math.max(...ys) - Math.min(...ys) + 2 * padding,
      };
      for (const wrap of tileOperations(local, tileBounds(local), content)) {
        const matrix = multiply(wrap.matrix, instance.matrix),
          key = matrix.map((v) => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(9))).join(',');
        if (!wrapped.has(key))
          wrapped.set(key, { ...instance, id: `${wrap.id}/${instance.id}`, matrix });
        if (wrapped.size > 60000)
          throw Error('Demasiados fragmentos de motivo. Simplificá el dibujo o aumentá la tesela.');
      }
    }
    inner.instances = [...wrapped.values()];
    if (tiles.length * inner.instances.length > 60000)
      throw Error('Demasiadas operaciones de tesela. Acercá el zoom o simplificá el motivo local.');
    const instances = tiles.flatMap((tile) =>
      inner.instances.map((instance) => ({
        ...instance,
        id: `${tile.id}/${instance.id}`,
        tileId: tile.id,
        matrix: multiply(tile.matrix, instance.matrix),
      })),
    );
    const fillGeometry = (g: Geometry): Geometry => {
      if (g.fillRegion!.scope !== 'tile') return g;
      if (g.fillRegion!.linked && g.fillRegion!.status !== 'stale')
        return {
          ...g,
          nodes: boundary.nodes,
          kind: boundary.kind,
          pathData: undefined,
          parameters: undefined,
          closed: true,
        };
      const parts = clipGeometry(
        { ...g, stroke: 'none' },
        { id: 'tile-fill-clip', name: 'Interior material', geometry: [boundary] },
      );
      return {
        ...g,
        kind: 'compound',
        nodes: [],
        parameters: undefined,
        pathData: parts.map((p) => p.pathData ?? '').join(''),
        closed: true,
      };
    };
    return {
      fills: pattern.sourceGeometry
        .filter((g) => g.visible && g.fillRegion && g.fillRegion.scope !== 'source')
        .map((g) => ({
          geometry: fillGeometry(g),
          matrices:
            g.fillRegion!.scope === 'tile'
              ? tiles.map((t) => t.matrix)
              : g.fillRegion!.orbitMatrices,
        })),
      generated: inner.generated,
      instances,
      tiling: { definition, boundary, tiles, inner },
      status: 'PERIODIC_SEAMLESS',
      message: 'Teselado geométrico por encastre · simetría del motivo local independiente',
    };
  }

  const derived = pattern.sourceGeometry.filter((g) => g.fillRegion);
  const generated = {
    ...(prepared ??
      generate(
        pattern.generator,
        pattern.sourceGeometry.filter((g) => !g.fillRegion),
      )),
  };
  generated.geometry = [
    ...derived.filter((g) => g.visible && g.fillRegion!.scope === 'source'),
    ...generated.geometry,
  ];
  const order = new Map(pattern.sourceGeometry.map((g, i) => [g.id, i]));
  generated.geometry.sort(
    (a, b) =>
      (order.get(a.id) ?? pattern.sourceGeometry.length) -
      (order.get(b.id) ?? pattern.sourceGeometry.length),
  );
  generated.placements = generated.placements.map((m) =>
    multiply(pattern.placementTransform ?? IDENTITY, m),
  );
  const free = pattern.symmetry.family === 'none' && !generated.finite;
  const finite = generated.finite || pattern.symmetry.family === 'radial';
  const base = geometryBounds(generated.geometry),
    corners = [
      { x: base.x, y: base.y },
      { x: base.x + base.width, y: base.y },
      { x: base.x, y: base.y + base.height },
      { x: base.x + base.width, y: base.y + base.height },
    ],
    extent = generated.placements.flatMap((m) => corners.map((p) => apply(m, p)));
  const padding = Math.max(1, ...generated.geometry.map((g) => g.strokeWidth)) * 2;
  const motif = extent.length
    ? {
        x: Math.min(...extent.map((p) => p.x)) - padding,
        y: Math.min(...extent.map((p) => p.y)) - padding,
        width:
          Math.max(...extent.map((p) => p.x)) - Math.min(...extent.map((p) => p.x)) + padding * 2,
        height:
          Math.max(...extent.map((p) => p.y)) - Math.min(...extent.map((p) => p.y)) + padding * 2,
      }
    : base;
  const repeating = generated.finite
    ? [{ id: 'finite', matrix: IDENTITY, cell: [0, 0] as [number, number] }]
    : visibleInstances(pattern.symmetry, bounds, motif);
  return {
    fills: derived
      .filter((g) => g.visible && g.fillRegion!.scope !== 'source')
      .map((g) => ({
        geometry: g,
        matrices:
          g.fillRegion!.scope === 'tile'
            ? [g.fillRegion!.captureMatrix]
            : g.fillRegion!.orbitMatrices,
      })),
    generated,
    instances: repeating,
    status: free ? 'FREE_NONPERIODIC' : finite ? 'FINITE_NONPERIODIC' : 'PERIODIC_SEAMLESS',
    message: free
      ? 'Libre · geometría sin operaciones de grupo'
      : generated.finite
        ? 'Penrose · región aperiódica finita'
        : pattern.symmetry.family === 'radial'
          ? 'Simetría radial · sin periodicidad de traslación'
          : pattern.symmetry.family === 'frieze'
            ? 'Periódico en una dirección'
            : 'Periódico por construcción sobre su red de traslación',
  };
}
export function expandedTransforms(scene: Scene): Matrix[] {
  return scene.instances.flatMap((i) =>
    scene.generated.placements.map((p) => multiply(i.matrix, p)),
  );
}
