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
import { geometryBounds } from '../application/clipping';
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
export function captureCandidates(pattern: Pattern, scene: Scene, p: Point): CaptureInstance[] {
  const b = geometryBounds(scene.generated.geometry),
    center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  return scene.instances
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
  const candidates = captureCandidates(pattern, scene, p);
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
