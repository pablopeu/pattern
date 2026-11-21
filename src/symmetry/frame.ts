import type { Project, Symmetry } from '../app/model';
import { IDENTITY, inverse, multiply, rotate, translate, type Matrix } from '../geometry/matrix';
import { resolveSymmetry, symmetryOrigin } from './config';
import { fillContext, sameFillContext } from '../fill/service';
const close = (a: Matrix, b: Matrix) => a.every((n, i) => Math.abs(n - b[i]) < 1e-8);
function frame(s: Symmetry) {
  const o = symmetryOrigin(s);
  return multiply(translate(o.x, o.y), rotate(s.orientation));
}
function structure(s: Symmetry) {
  const { origin: _, center: __, orientation: ___, ...rest } = s;
  return JSON.stringify(rest);
}
/** Move an unwrapped construction WITH its rigid symmetry frame.
 * S'=D S D⁻¹ and P'=D P give S'P'=D SP for every instance. Consequently
 * endpoints welded in different copies stay welded, without touching sources,
 * handles or persistent junction gauges. Physical tile frames are independent.
 */
export function patchSymmetryFrame(
  project: Project,
  target: string | null,
  patch: Partial<Symmetry>,
): Map<string, Matrix> {
  const before = structuredClone(project),
    deltas = new Map<string, Matrix>();
  if (target === null) project.mainSymmetry = { ...project.mainSymmetry, ...patch };
  else {
    const p = project.patterns.find((p) => p.id === target);
    if (!p) throw Error('No se encontró el conjunto.');
    p.symmetry = { ...p.symmetry, ...patch };
  }
  for (const p of project.patterns) {
    const previous = before.patterns.find((old) => old.id === p.id)!;
    const a = resolveSymmetry(previous, before.mainSymmetry),
      b = resolveSymmetry(p, project.mainSymmetry);
    if (p.tiling || a.family === 'none' || structure(a) !== structure(b)) continue;
    const delta = multiply(frame(b), inverse(frame(a)));
    if (close(delta, IDENTITY)) continue;
    p.placementTransform = multiply(delta, p.placementTransform);
    deltas.set(p.id, delta);
  }
  // Stored fills may depend on several sets. Only transport their reference
  // frames as one rigid construction when every dependency shares the motion.
  for (const p of project.patterns)
    for (const g of p.sourceGeometry) {
      const fill = g.fillRegion;
      if (!fill) continue;
      const ids = [...new Set([...fill.inputs, ...fill.refs].map((r) => r.patternId))];
      if (!ids.length) ids.push(p.id);
      const delta = deltas.get(ids[0]);
      if (!delta || !ids.every((id) => close(deltas.get(id) ?? IDENTITY, delta))) continue;
      const oldContext = fillContext(before, ids, fill.kind);
      fill.captureMatrix = multiply(delta, fill.captureMatrix);
      fill.orbitMatrices = fill.orbitMatrices.map((m) => multiply(delta, m));
      for (const ref of [...fill.refs, ...fill.inputs]) ref.matrix = multiply(delta, ref.matrix);
      if (sameFillContext(fill.context, oldContext, true))
        fill.context = fillContext(project, ids, fill.kind);
    }
  return deltas;
}
