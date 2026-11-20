import type { Geometry } from '../app/model';
import { IDENTITY, inverse, type Matrix } from '../geometry/matrix';
import { paperPath, paperData } from '../geometry/paper';
/** Store an updated boundary in the object's editable affine frame. */
export function tileFillContour(
  boundary: Geometry,
  frame: Matrix,
): Pick<Geometry, 'kind' | 'nodes' | 'closed' | 'pathData' | 'parameters'> {
  if (frame.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-14))
    return {
      kind: boundary.kind,
      nodes: structuredClone(boundary.nodes),
      closed: true,
      pathData: undefined,
      parameters: undefined,
    };
  const p = paperPath(boundary, inverse(frame));
  try {
    return {
      kind: 'compound',
      nodes: [],
      closed: true,
      pathData: paperData(p),
      parameters: undefined,
    };
  } finally {
    p.remove();
  }
}
