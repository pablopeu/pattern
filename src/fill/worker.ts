import { recalculateRegion } from './recalculate';
import { buildArrangement, faceIndex, isFillBudgetError, type Arrangement } from './planar';
import {
  collectFillInputs,
  immediateFillCandidates,
  localFillArrangement,
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
let regional = false,
  view: Bounds,
  tolerance = 0;
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
      view = r.bounds;
      tolerance = r.tolerance;
      index?.dispose();
      index = undefined;
      arrangement = undefined;
      inputs = [];
      regional = false;
      try {
        inputs = collectFillInputs(layers, r.bounds);
        arrangement = buildArrangement(inputs, r.tolerance);
        index = faceIndex(arrangement);
      } catch (error) {
        if (!isFillBudgetError(error)) throw error;
        regional = true;
      }
      self.postMessage({
        type: 'ready',
        curves: arrangement?.curves ?? 0,
        faces: arrangement?.faces.length ?? 0,
        approximate: arrangement?.approximate ?? false,
        regional,
      });
    }
    if (r.type === 'query') {
      const immediate = regional ? immediateFillCandidates(layers, r.point) : [];
      if (regional && immediate[0]?.kind === 'object') {
        self.postMessage({
          type: 'preview',
          id: r.id,
          point: r.point,
          candidates: immediate,
          regional: true,
          curves: 0,
          faces: 0,
        });
      } else {
        if (regional) {
          const local = localFillArrangement(layers, view, r.point, tolerance);
          inputs = local.inputs;
          arrangement = local.arrangement;
          index?.dispose();
          index = faceIndex(arrangement);
        }
        if (arrangement && index) {
          const candidates = fillCandidatesAt(layers, r.point, index.at(r.point));
          self.postMessage({
            type: 'preview',
            id: r.id,
            point: r.point,
            candidates,
            regional,
            curves: arrangement.curves,
            faces: arrangement.faces.length,
          });
        }
      }
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
