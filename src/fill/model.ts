import type { BoundaryRef } from './planar';
import type { Matrix } from '../geometry/matrix';
export interface FillRegion {
  version: 1;
  kind: 'face' | 'tile';
  scope: 'source' | 'orbit' | 'tile';
  linked: boolean;
  status: 'linked' | 'fixed' | 'stale';
  reason?: string;
  faceKey: string;
  topologyKey: string;
  refs: BoundaryRef[];
  inputs: { id: string; patternId: string; shapeId: string; matrix: Matrix; tileMatrix?: Matrix }[];
  context: string;
  captureMatrix: Matrix;
  orbitMatrices: Matrix[];
  closeTolerance: number;
}
