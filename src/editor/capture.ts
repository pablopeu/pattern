import type { Pattern, Geometry } from '../app/model';
import type { Scene } from '../patterns/engine';
import {
  IDENTITY,
  apply,
  inverse,
  multiply,
  distance,
  type Matrix,
  type Point,
} from '../geometry/matrix';
import { cosets, lattice } from '../symmetry/groups';
import { paperPath, scope } from '../geometry/paper';
export interface CaptureInstance {
  id: string;
  patternId: string;
  matrix: Matrix;
  inverse: Matrix;
  reference: Point;
  distance: number;
  shapeId?: string;
}
export interface CaptureContext {
  patternId: string;
  instance: CaptureInstance;
  tool: string;
}
export const matrixId = (m: Matrix) => m.map((n) => n.toFixed(9)).join(',');
function tilesUnderPointer(scene: Scene, p: Point) {
  const data = scene.tiling;
  if (!data) return [];
  const path = paperPath(data.boundary);
  try {
    return data.tiles.filter((tile) => {
      const q = apply(inverse(tile.matrix), p),
        point = new scope.Point(q.x, q.y);
      if (!path.bounds.expand(1e-6).contains(point)) return false;
      const nearest = path.getNearestPoint(point);
      return (
        path.contains(point) || (nearest && distance(q, { x: nearest.x, y: nearest.y }) < 1e-6)
      );
    });
  } finally {
    path.remove();
  }
}
export function captureCandidates(pattern: Pattern, scene: Scene, p: Point): CaptureInstance[] {
  const center = captureReference(pattern);
  const allowed = scene.tiling ? new Set(tilesUnderPointer(scene, p).map((t) => t.id)) : null;
  const standard = scene.instances
    .filter((i) => !allowed || (i.tileId && allowed.has(i.tileId)))
    .flatMap((i) =>
      scene.generated.placements.map((m, k) => {
        const matrix = multiply(i.matrix, m),
          reference = apply(matrix, center);
        return {
          id: `${pattern.id}/${i.id}/${k}`,
          patternId: pattern.id,
          matrix,
          inverse: inverse(matrix),
          reference,
          distance: distance(reference, p),
        };
      }),
    )
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  return [
    ...standard,
    ...scene.fills.flatMap(({ geometry: g, matrices }) =>
      g.locked
        ? []
        : matrices.map((matrix, index) => ({
            id: `${pattern.id}/fill/${g.id}/${index}`,
            patternId: pattern.id,
            matrix,
            inverse: inverse(matrix),
            reference: apply(matrix, center),
            distance: distance(apply(matrix, center), p),
            shapeId: g.id,
          })),
    ),
  ];
}
/** A generic orbit reference independent of existing source extents. */
export function captureReference(pattern: Pattern): Point {
  const s = pattern.symmetry;
  if (s.family === 'none') return { x: 0, y: 0 };
  if (s.family === 'radial')
    return { x: s.center.x + s.width * 0.1732050807569, y: s.center.y + s.width * 0.2718281828459 };
  const q = apply(lattice(s), { x: 0.1732050807569, y: 0.2718281828459 });
  return { x: s.origin.x + q.x, y: s.origin.y + q.y };
}
export function canonicalCandidates(pattern: Pattern, scene: Scene, p: Point): CaptureInstance[] {
  if (scene.generated.finite) return [];
  if (scene.tiling)
    return tilesUnderPointer(scene, p).flatMap((tile) => {
      const local = apply(inverse(tile.matrix), p);
      return canonicalCandidates({ ...pattern, tiling: undefined }, scene.tiling!.inner, local).map(
        (candidate) => {
          const matrix = multiply(tile.matrix, candidate.matrix),
            reference = apply(tile.matrix, candidate.reference);
          return {
            ...candidate,
            id: `${tile.id}/${candidate.id}`,
            matrix,
            inverse: inverse(matrix),
            reference,
            distance: distance(reference, p),
          };
        },
      );
    });

  const s = pattern.symmetry,
    basis = lattice(s),
    inv = inverse(basis),
    center = captureReference(pattern),
    out: CaptureInstance[] = [];
  cosets(s).forEach((op, k) =>
    scene.generated.placements.forEach((place, g) => {
      const base = multiply(op, place),
        reference = apply(base, center),
        q = apply(inv, { x: p.x - reference.x, y: p.y - reference.y }),
        periodic = s.family === 'wallpaper' || s.family === 'frieze';
      const ix = periodic ? Math.round(q.x) : 0,
        iy = s.family === 'wallpaper' ? Math.round(q.y) : 0;
      for (const x of periodic ? [ix - 1, ix, ix + 1] : [0])
        for (const y of s.family === 'wallpaper' ? [iy - 1, iy, iy + 1] : [0]) {
          const shift = periodic ? apply(basis, { x, y }) : { x: 0, y: 0 },
            matrix = multiply([1, 0, 0, 1, shift.x, shift.y], base),
            ref = apply(matrix, center);
          out.push({
            id: `${pattern.id}/${periodic ? `${x}:${y}:${k}` : `radial-${k}`}/${g}`,
            patternId: pattern.id,
            matrix,
            inverse: inverse(matrix),
            reference: ref,
            distance: distance(ref, p),
          });
        }
    }),
  );
  return out;
}
export function hitCandidates(
  pattern: Pattern,
  candidates: CaptureInstance[],
  p: Point,
  tolerance: number,
): CaptureInstance[] {
  const shapes = pattern.sourceGeometry
      .filter((g) => g.visible && !g.locked)
      .map((g) => ({ g, path: paperPath(g) })),
    hits: CaptureInstance[] = [];
  try {
    for (const candidate of candidates) {
      const q = apply(candidate.inverse, p),
        point = new scope.Point(q.x, q.y),
        scale = Math.max(
          1e-6,
          Math.sqrt(
            Math.abs(
              candidate.matrix[0] * candidate.matrix[3] - candidate.matrix[1] * candidate.matrix[2],
            ),
          ),
        ),
        tol = tolerance / scale;
      for (let i = shapes.length - 1; i >= 0; i--) {
        const { g, path } = shapes[i];
        if (
          candidate.shapeId
            ? candidate.shapeId !== g.id
            : g.fillRegion && g.fillRegion.scope !== 'source'
        )
          continue;
        if (!path.bounds.expand(tol * 2 + g.strokeWidth).contains(point)) continue;
        const nearest = path.getNearestPoint(point);
        if (
          (g.fill !== 'none' && path.contains(point)) ||
          (nearest &&
            distance(q, { x: nearest.x, y: nearest.y }) < Math.max(tol, g.strokeWidth / 2))
        ) {
          hits.push({ ...candidate, shapeId: g.id });
          break;
        }
      }
    }
  } finally {
    shapes.forEach((x) => x.path.remove());
  }
  return hits;
}
export function chooseCapture(
  pattern: Pattern,
  scene: Scene,
  p: Point,
  tolerance: number,
  explicit?: Matrix,
): { chosen: CaptureInstance; candidates: CaptureInstance[] } {
  const candidates = [
    ...canonicalCandidates(pattern, scene, p),
    ...captureCandidates(pattern, scene, p),
  ];
  const unique = new Map<string, CaptureInstance>();
  for (const candidate of candidates)
    if (!unique.has(matrixId(candidate.matrix))) unique.set(matrixId(candidate.matrix), candidate);
  candidates.splice(
    0,
    candidates.length,
    ...[...unique.values()].sort((a, b) =>
      Math.abs(a.distance - b.distance) > 1e-8 ? a.distance - b.distance : a.id.localeCompare(b.id),
    ),
  );
  if (!candidates.length) {
    const one = {
      id: 'source',
      patternId: pattern.id,
      matrix: IDENTITY,
      inverse: IDENTITY,
      reference: p,
      distance: 0,
    };
    return { chosen: one, candidates: [one] };
  }
  const selected = explicit
    ? candidates.find((c) => matrixId(c.matrix) === matrixId(explicit))
    : undefined;
  const hits = hitCandidates(pattern, candidates, p, tolerance);
  const seen = new Set<string>();
  const ordered = [...(selected ? [selected] : []), ...hits, ...candidates].filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });
  return { chosen: ordered[0], candidates: ordered };
}
export function capturedPoint(context: CaptureContext, p: Point): Point {
  return apply(context.instance.inverse, p);
}
export function identityCapture(patternId: string, p: Point, tool: string): CaptureContext {
  return {
    patternId,
    tool,
    instance: {
      id: 'source',
      patternId,
      matrix: IDENTITY,
      inverse: IDENTITY,
      reference: p,
      distance: 0,
    },
  };
}
export function findGeometry(patterns: Pattern[], id: string): Geometry | undefined {
  return patterns.flatMap((p) => p.sourceGeometry).find((g) => g.id === id);
}
