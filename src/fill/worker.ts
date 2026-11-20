import { recalculateRegion } from './recalculate';
import { buildArrangement, faceIndex, type Arrangement } from './planar';
import {
  collectFillInputs,
  fillCandidatesAt,
  createFaceFill,
  refreshLinkedFills,
  type FillLayer,
  type CapturedBoundary,
} from './service';
import type { Bounds } from '../symmetry/groups';
import type { Point, Matrix } from '../geometry/matrix';
import type { Project } from '../app/model';
import type { DrawingStyle } from '../app/styles';
let index: ReturnType<typeof faceIndex> | undefined;
let arrangement: Arrangement | undefined,
  inputs: CapturedBoundary[] = [],
  layers: FillLayer[] = [];
type Request =
  | { type: 'build'; layers: FillLayer[]; bounds: Bounds; tolerance: number }
  | { type: 'query'; point: Point; id: number }
  | { type: 'create'; project: Project; patternId: string; faceKey: string; style: DrawingStyle }
  | { type: 'links'; project: Project }
  | { type: 'recalculate'; project: Project; shapeId: string; matrix: Matrix };
self.onmessage = (event: MessageEvent<Request>) => {
  const r = event.data;
  try {
    if (r.type === 'build') {
      layers = r.layers;
      inputs = collectFillInputs(layers, r.bounds);
      index?.dispose();
      arrangement = buildArrangement(inputs, r.tolerance);
      index = faceIndex(arrangement);
      self.postMessage({
        type: 'ready',
        curves: arrangement.curves,
        faces: arrangement.faces.length,
        approximate: arrangement.approximate,
      });
    }
    if (r.type === 'query' && arrangement) {
      const candidates = fillCandidatesAt(layers, r.point, index!.at(r.point));
      self.postMessage({ type: 'preview', id: r.id, point: r.point, candidates });
    }
    if (r.type === 'create' && arrangement) {
      const layer = layers.find((l) => l.pattern.id === r.patternId),
        face = arrangement.faces.find((f) => f.key === r.faceKey);
      if (!layer?.scene || !face) throw Error('La cara ya no está disponible.');
      self.postMessage({
        type: 'created',
        patternId: r.patternId,
        geometry: createFaceFill(
          r.project,
          layer.pattern,
          layer.scene,
          face,
          arrangement,
          inputs,
          r.style,
        ),
      });
    }
    if (r.type === 'recalculate')
      self.postMessage({
        type: 'recalculated',
        geometry: recalculateRegion(r.project, r.shapeId, r.matrix),
      });
    if (r.type === 'links')
      self.postMessage({ type: 'links', patches: [...refreshLinkedFills(r.project)] });
  } catch (e) {
    self.postMessage({ type: 'error', message: (e as Error).message });
  }
};
