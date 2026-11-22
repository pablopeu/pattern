import { type Project, type Geometry } from '../app/model';
import { drawingStyle } from '../app/styles';
import { buildScene } from '../patterns/engine';
import { resolvePattern } from '../symmetry/config';
import { paperPath, scope } from '../geometry/paper';
import { type Matrix } from '../geometry/matrix';
import { buildArrangement, isFillBudgetError, type BoundaryRef } from './planar';
import { collectFillInputs, createFaceFill, createTileFill, localFillArrangement } from './service';
/** References and boundary families must still identify the same face; overlap only disambiguates. */
const families = (refs: BoundaryRef[]) =>
  JSON.stringify(
    refs
      .map((r) => [r.patternId, r.shapeId, r.curve])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
export function recalculateRegion(
  project: Project,
  shapeId: string,
  matrix: Matrix,
  options: { allowBoundaryEvolution?: boolean } = {},
): Geometry {
  const host = project.patterns.find((p) => p.sourceGeometry.some((g) => g.id === shapeId)),
    old = host?.sourceGeometry.find((g) => g.id === shapeId);
  if (!host || !old?.fillRegion) throw Error('El relleno ya no existe.');
  if (old.locked) throw Error('Desbloqueá el relleno para recalcularlo.');
  const effective = resolvePattern(host, project),
    linkedProject = {
      ...project,
      preferences: { ...project.preferences, fillLinkedDefault: true },
    };
  if (old.fillRegion.kind === 'tile') {
    if (!host.tiling) throw Error('Activá una tesela antes de actualizar su interior.');
    return {
      ...createTileFill(
        linkedProject,
        effective,
        { kind: 'tile', key: 'tile/' + host.id, patternId: host.id, pathData: '', matrix, z: 0 },
        drawingStyle(old),
      ),
      ...drawingStyle(old),
      id: old.id,
      name: old.name,
      groupId: old.groupId,
      visible: old.visible,
      locked: old.locked,
    };
  }
  const previous = paperPath(old, matrix);
  try {
    const oldArea = Math.abs((previous as paper.CompoundPath).area),
      b = previous.bounds,
      margin = Math.max(b.width, b.height, effective.symmetry.width, effective.symmetry.height, 10),
      bounds = {
        x: b.x - margin,
        y: b.y - margin,
        width: b.width + 2 * margin,
        height: b.height + 2 * margin,
      };
    if (!Number.isFinite(oldArea) || oldArea < 1e-10)
      throw Error('El contorno anterior no define una región válida.');
    const layers = project.patterns
        .filter((p) => p.visible)
        .map((raw) => {
          const pattern = resolvePattern(raw, project);
          return { pattern, scene: buildScene(pattern, bounds) };
        }),
      { inputs, arrangement } = (() => {
        try {
          const inputs = collectFillInputs(layers, bounds);
          return { inputs, arrangement: buildArrangement(inputs, old.fillRegion!.closeTolerance) };
        } catch (error) {
          if (!isFillBudgetError(error)) throw error;
          const point = previous.interiorPoint;
          return localFillArrangement(
            layers,
            bounds,
            { x: point.x, y: point.y },
            old.fillRegion!.closeTolerance,
          );
        }
      })(),
      signature = families(old.fillRegion.refs),
      contours = previous instanceof scope.CompoundPath ? previous.children.length : 1;
    const matches = arrangement.faces.filter((face) => {
      const sameFamilies = families(face.refs) === signature;
      if (!sameFamilies) {
        if (!options.allowBoundaryEvolution) return false;
        const oldOwners = new Set(old.fillRegion!.refs.map((r) => `${r.patternId}/${r.shapeId}`)),
          nextOwners = new Set(face.refs.map((r) => `${r.patternId}/${r.shapeId}`));
        if (![...oldOwners].every((id) => nextOwners.has(id))) return false;
      }
      const path = new scope.CompoundPath({
        pathData: face.pathData,
        fillRule: 'evenodd',
        insert: false,
      });
      try {
        if (path.children.length !== contours || !path.bounds.intersects(b)) return false;
        const intersection = path.intersect(previous, { insert: false });
        try {
          const overlap = Math.abs((intersection as paper.CompoundPath).area);
          return options.allowBoundaryEvolution
            ? overlap / Math.min(oldArea, face.area) >= 0.8
            : overlap / oldArea >= 0.8 && overlap / face.area >= 0.8;
        } finally {
          intersection.remove();
        }
      } finally {
        path.remove();
      }
    });
    if (matches.length !== 1)
      throw Error(
        matches.length
          ? 'Hay varias caras compatibles. Elegí la región desde Fill; se conservó el contorno anterior.'
          : 'La región anterior ya no tiene una cara equivalente con los mismos límites. Se conservó su contorno.',
      );
    const scene = layers.find((l) => l.pattern.id === host.id)?.scene;
    if (!scene) throw Error('El conjunto del relleno está oculto.');
    return {
      ...createFaceFill(
        linkedProject,
        effective,
        scene,
        matches[0],
        arrangement,
        inputs,
        drawingStyle(old),
      ),
      ...drawingStyle(old),
      id: old.id,
      name: old.name,
      groupId: old.groupId,
      visible: old.visible,
      locked: old.locked,
    };
  } finally {
    previous.remove();
  }
}
