import { geometry, type Geometry, type Pattern, type Project } from '../app/model';
import type { Scene } from '../patterns/engine';
import { expandedTransforms } from '../patterns/engine';
import { generate } from '../generators';
import { resolvePattern } from '../symmetry/config';
import { IDENTITY, inverse, multiply, apply, type Matrix, type Point } from '../geometry/matrix';
import { paperPath, paperData, scope } from '../geometry/paper';
import { clipGeometry } from '../application/clipping';
import { tileBoundary } from '../tiling/tiles';
import { profile, type DrawingStyle } from '../app/styles';
import { buildArrangement, type Arrangement, type BoundaryInput, type PlanarFace } from './planar';
import type { Bounds } from '../symmetry/groups';
export interface FillLayer {
  pattern: Pattern;
  scene: Scene | null;
}
export interface ObjectFillCandidate {
  kind: 'object';
  key: string;
  patternId: string;
  shapeId: string;
  pathData: string;
  matrix: Matrix;
  z: number;
}
export interface TileFillCandidate {
  kind: 'tile';
  key: string;
  patternId: string;
  pathData: string;
  matrix: Matrix;
  z: number;
}
export interface FaceFillCandidate {
  kind: 'face';
  key: string;
  face: PlanarFace;
  pathData: string;
  matrix: Matrix;
  z: number;
}
export type FillCandidate = ObjectFillCandidate | TileFillCandidate | FaceFillCandidate;
export interface CapturedBoundary extends BoundaryInput {
  tileMatrix?: Matrix;
}
const matrixKey = (m: Matrix) => m.map((n) => Number(n.toFixed(8))).join(',');
export function clipAxis(
  g: Geometry,
  matrix: Matrix,
  boundary: Geometry,
  tileMatrix: Matrix,
): Geometry {
  const axis = {
      ...g,
      fill: 'none',
      stroke: '#000000',
      strokeDash: [],
      strokeProfile: profile(),
      strokeWidth: 1,
    },
    region = {
      id: 'fill-tile',
      name: 'Clip real',
      geometry: [{ ...boundary, transform: tileMatrix }],
    },
    pieces = clipGeometry(axis, region, matrix, false, 0.01),
    path = geometry('compound');
  path.pathData = pieces.map((g) => g.pathData ?? '').join('');
  path.closed = false;
  const p = paperPath(path, inverse(matrix));
  path.pathData = paperData(p);
  p.remove();
  return path;
}
export function collectFillInputs(layers: FillLayer[], bounds: Bounds): CapturedBoundary[] {
  const result: CapturedBoundary[] = [],
    view = new scope.Rectangle(bounds);
  for (const [layerIndex, { pattern, scene }] of layers.entries()) {
    if (!scene) continue;
    for (const instance of scene.instances)
      for (const [placementIndex, placement] of scene.generated.placements.entries()) {
        const matrix = multiply(instance.matrix, placement),
          tile = instance.tileId
            ? scene.tiling?.tiles.find((t) => t.id === instance.tileId)
            : undefined;
        for (const [shapeIndex, g] of scene.generated.geometry.entries()) {
          if (g.fillRegion || !g.visible || g.locked || (g.stroke === 'none' && g.fill === 'none'))
            continue;
          const p = paperPath(g, matrix),
            visible = p.bounds.intersects(view) || p.bounds.contains(view);
          p.remove();
          if (!visible) continue;
          const geometry =
            tile && scene.tiling ? clipAxis(g, matrix, scene.tiling.boundary, tile.matrix) : g;
          if (geometry.kind === 'compound' && !geometry.pathData) continue;
          result.push({
            id: `${pattern.id}/${instance.id}/${placementIndex}/${g.id}`,
            patternId: pattern.id,
            shapeId: g.id,
            geometry,
            matrix,
            z: layerIndex * 100000 + shapeIndex,
            tileMatrix: tile?.matrix,
          });
          if (result.length > 1200)
            throw Error(
              'Fill admite hasta 1200 entradas visibles. Acercá el zoom u ocultá conjuntos.',
            );
        }
      }
  }
  return result;
}
export function immediateFillCandidates(layers: FillLayer[], point: Point): FillCandidate[] {
  const result: FillCandidate[] = [],
    paths = new Map<Geometry, paper.PathItem>();
  try {
    for (const [layerIndex, { pattern, scene }] of layers.entries()) {
      if (!scene) continue;
      const raw = new Map(pattern.sourceGeometry.map((g) => [g.id, g]));
      const inspect = (g: Geometry, matrix: Matrix, z: number) => {
        const source = raw.get(g.id);
        if (!source?.closed || !source.visible || source.locked) return;
        let path = paths.get(g);
        if (!path) {
          path = paperPath(g);
          paths.set(g, path);
        }
        const q = apply(inverse(matrix), point),
          p = new scope.Point(q.x, q.y);
        if (!path.bounds.contains(p) || !path.contains(p)) return;
        const world = paperPath(g, matrix);
        try {
          result.push({
            kind: 'object',
            key: `object/${pattern.id}/${g.id}/${matrixKey(matrix)}`,
            patternId: pattern.id,
            shapeId: g.id,
            pathData: paperData(world),
            matrix,
            z,
          });
        } finally {
          world.remove();
        }
      };
      const allowed = new Set<string>();
      if (scene.tiling) {
        const data = scene.tiling,
          path = paperPath(data.boundary);
        paths.set(data.boundary, path);
        for (const tile of data.tiles) {
          const q = apply(inverse(tile.matrix), point),
            p = new scope.Point(q.x, q.y);
          if (!path.bounds.contains(p) || !path.contains(p)) continue;
          allowed.add(tile.id);
          const world = paperPath(data.boundary, tile.matrix);
          try {
            result.push({
              kind: 'tile',
              key: `tile/${pattern.id}/${tile.id}`,
              patternId: pattern.id,
              pathData: paperData(world),
              matrix: tile.matrix,
              z: layerIndex * 100000 - 10,
            });
          } finally {
            world.remove();
          }
        }
      }
      for (const instance of scene.instances) {
        if (scene.tiling && instance.tileId && !allowed.has(instance.tileId)) continue;
        for (const placement of scene.generated.placements)
          for (const [i, g] of scene.generated.geometry.entries())
            inspect(g, multiply(instance.matrix, placement), layerIndex * 100000 + i);
      }
      for (const { geometry: g, matrices } of scene.fills)
        for (const m of matrices)
          inspect(
            g,
            m,
            layerIndex * 100000 + pattern.sourceGeometry.findIndex((source) => source.id === g.id),
          );
    }
  } finally {
    for (const p of paths.values()) p.remove();
  }
  return result.sort((a, b) => b.z - a.z || a.key.localeCompare(b.key));
}
export function fillContext(
  project: Project,
  ids: string[],
  kind: 'face' | 'tile' = 'face',
): string {
  return JSON.stringify(
    [...new Set(ids)].sort().map((id) => {
      const raw = project.patterns.find((p) => p.id === id);
      if (!raw) return { id, missing: true };
      const p = resolvePattern(raw, project);
      return kind === 'tile'
        ? { id, kind: p.tiling?.kind }
        : {
            id,
            generator: p.generator,
            symmetry: p.symmetry,
            placement: p.placementTransform,
            tiling: p.tiling,
            visible: p.visible,
          };
    }),
  );
}
export function equivalentFaces(a: string, b: string): boolean {
  const p = new scope.CompoundPath({ pathData: a, insert: false }),
    q = new scope.CompoundPath({ pathData: b, insert: false });
  try {
    return p.compare(q);
  } finally {
    p.remove();
    q.remove();
  }
}
export function faceGeometry(data: string, matrix: Matrix = IDENTITY): Geometry {
  const g = geometry('compound', [], true);
  g.pathData = data;
  const p = paperPath(g, matrix);
  g.pathData = paperData(p);
  p.remove();
  return g;
}
export function createFaceFill(
  project: Project,
  target: Pattern,
  scene: Scene,
  face: PlanarFace,
  arrangement: Arrangement,
  inputs: CapturedBoundary[],
  style: DrawingStyle,
): Geometry {
  const dependencies = [...new Set(face.refs.map((r) => r.patternId))],
    captured = face.refs.find((r) => r.patternId === target.id)?.matrix ?? IDENTITY,
    g = {
      ...faceGeometry(face.pathData, inverse(captured)),
      ...structuredClone(style),
      stroke: 'none',
      name: 'Relleno de cara',
    },
    referenceInputs = inputs,
    local = arrangement,
    identity = local.faces.find((f) => equivalentFaces(f.pathData, face.pathData));
  const sourceEquivalent =
    dependencies.length === 1 &&
    dependencies[0] === target.id &&
    project.patterns.filter((p) => p.visible && p.sourceGeometry.some((g) => !g.fillRegion))
      .length === 1 &&
    !scene.tiling &&
    scene.generated.placements.length === 1;
  const matrices: Matrix[] = [];
  for (const m of expandedTransforms(scene)) {
    if (matrices.some((v) => matrixKey(v) === matrixKey(m))) continue;
    if (sourceEquivalent) {
      if (matrices.length < 2048) matrices.push(m);
      continue;
    }
    const candidate = faceGeometry(g.pathData!, m),
      p = paperPath(candidate),
      b = p.bounds;
    p.remove();
    const match = arrangement.faces.some(
      (f) =>
        Math.abs(f.bounds.x - b.x) < 1e-5 &&
        Math.abs(f.bounds.y - b.y) < 1e-5 &&
        Math.abs(f.bounds.width - b.width) < 1e-5 &&
        Math.abs(f.bounds.height - b.height) < 1e-5 &&
        equivalentFaces(f.pathData, candidate.pathData!),
    );
    if (match) matrices.push(m);
    if (matrices.length > 2048)
      throw Error('La órbita concreta supera 2048 regiones. Acercá el zoom.');
  }
  if (!matrices.length) matrices.push(captured);
  const linked = project.preferences.fillLinkedDefault && !!identity;
  g.fillRegion = {
    version: 1,
    kind: 'face',
    scope: sourceEquivalent ? 'source' : 'orbit',
    linked,
    status: linked ? 'linked' : 'fixed',
    reason: identity
      ? !sourceEquivalent
        ? 'Órbita concreta verificada; se conserva su configuración de creación.'
        : undefined
      : 'Contorno fijo: no se pudo identificar un vínculo topológico estable.',
    faceKey: face.key,
    topologyKey: identity?.key ?? '',
    refs: face.refs,
    inputs: referenceInputs.map(({ id, patternId, shapeId, matrix, tileMatrix }) => ({
      id,
      patternId,
      shapeId,
      matrix,
      tileMatrix,
    })),
    context: fillContext(
      project,
      referenceInputs.map((i) => i.patternId),
    ),
    captureMatrix: captured,
    orbitMatrices: matrices,
    closeTolerance: arrangement.closeTolerance,
  };
  return g;
}
export function createTileFill(
  project: Project,
  target: Pattern,
  candidate: TileFillCandidate,
  style: DrawingStyle,
): Geometry {
  if (!target.tiling) throw Error('La tesela ya no está activa.');
  const boundary = tileBoundary(target.tiling),
    g = {
      ...boundary,
      ...structuredClone(style),
      id: geometry('path').id,
      stroke: 'none',
      name: 'Relleno de tesela',
    };
  const linked = project.preferences.fillLinkedDefault;
  g.fillRegion = {
    version: 1,
    kind: 'tile',
    scope: 'tile',
    linked,
    status: linked ? 'linked' : 'fixed',
    faceKey: `tile/${target.id}`,
    topologyKey: 'tile-interior',
    refs: [],
    inputs: [],
    context: fillContext(project, [target.id], 'tile'),
    captureMatrix: candidate.matrix,
    orbitMatrices: [candidate.matrix],
    closeTolerance: 0,
  };
  return g;
}
export function axesFingerprint(project: Project): string {
  return JSON.stringify([
    project.mainSymmetry,
    project.patterns.map((p) => [
      p.id,
      p.visible,
      p.generator,
      p.symmetry,
      p.symmetryMode,
      p.placementTransform,
      p.tiling,
      p.sourceGeometry.map((g) => [
        g.id,
        g.kind,
        g.nodes,
        g.closed,
        g.pathData,
        g.parameters,
        g.transform,
        g.visible,
        g.locked,
        g.fillRegion,
      ]),
    ]),
  ]);
}
export function refreshLinkedFills(project: Project): Map<string, Geometry> {
  const patches = new Map<string, Geometry>(),
    resolved = project.patterns.map((p) => resolvePattern(p, project)),
    generated = new Map(
      resolved.map((p) => [
        p.id,
        generate(
          p.generator,
          p.sourceGeometry.filter((g) => !g.fillRegion),
        ).geometry,
      ]),
    );
  for (const pattern of project.patterns)
    for (const old of pattern.sourceGeometry) {
      const meta = old.fillRegion;
      if (!meta?.linked) continue;
      const g = structuredClone(old),
        fill = g.fillRegion!,
        stale = (reason: string) => {
          fill.status = 'stale';
          fill.reason = reason;
          patches.set(g.id, g);
        };
      if (fill.kind === 'tile') {
        if (!pattern.tiling) {
          stale('Tesela desactivada; se conserva el último contorno válido.');
          continue;
        }
        if (fill.context !== fillContext(project, [pattern.id], 'tile')) {
          stale('Cambió la familia de tesela; se conserva el contorno anterior.');
          continue;
        }
        const b = tileBoundary(pattern.tiling);
        g.nodes = b.nodes;
        g.kind = b.kind;
        g.pathData = undefined;
        g.parameters = undefined;
        g.closed = true;
        fill.status = 'linked';
        fill.reason = undefined;
        patches.set(g.id, g);
        continue;
      }
      if (
        fill.context !==
        fillContext(
          project,
          fill.refs.map((r) => r.patternId),
        )
      ) {
        stale('Cambió la configuración de los límites; se conserva el último contorno válido.');
        continue;
      }
      try {
        const inputs: CapturedBoundary[] = fill.inputs.map((ref, index) => {
            const shape = generated.get(ref.patternId)?.find((g) => g.id === ref.shapeId);
            if (!shape || !shape.visible || shape.locked)
              throw Error('Un límite fue eliminado, ocultado o bloqueado.');
            const pat = resolved.find((p) => p.id === ref.patternId),
              b = pat?.tiling ? tileBoundary(pat.tiling) : undefined;
            return {
              ...ref,
              geometry:
                ref.tileMatrix && b ? clipAxis(shape, ref.matrix, b, ref.tileMatrix) : shape,
              z: index,
            };
          }),
          arrangement = (() => {
            const known = new Set(inputs.map((i) => i.id));
            for (const ref of fill.inputs) {
              const prefix = ref.id.endsWith('/' + ref.shapeId)
                ? ref.id.slice(0, -ref.shapeId.length)
                : null;
              if (!prefix) continue;
              for (const shape of generated.get(ref.patternId) ?? []) {
                const id = prefix + shape.id;
                if (known.has(id) || !shape.visible || shape.locked) continue;
                const pat = resolved.find((p) => p.id === ref.patternId),
                  b = pat?.tiling ? tileBoundary(pat.tiling) : undefined;
                inputs.push({
                  ...ref,
                  id,
                  shapeId: shape.id,
                  geometry:
                    ref.tileMatrix && b ? clipAxis(shape, ref.matrix, b, ref.tileMatrix) : shape,
                  z: inputs.length,
                });
                known.add(id);
              }
            }
            return buildArrangement(inputs, fill.closeTolerance);
          })();
        let face = arrangement.faces.find((f) => f.key === fill.topologyKey);
        if (!face) {
          const required = new Set(fill.refs.map((r) => r.inputId)),
            owners = [...new Set(fill.refs.map((r) => r.patternId + '/' + r.shapeId))]
              .sort()
              .join('|'),
            compatible = arrangement.faces.filter((f) => {
              const ids = new Set(f.refs.map((r) => r.inputId));
              return (
                [...required].every((id) => ids.has(id)) &&
                [...new Set(f.refs.map((r) => r.patternId + '/' + r.shapeId))].sort().join('|') ===
                  owners
              );
            });
          if (compatible.length === 1) face = compatible[0];
        }
        if (!face) {
          stale('La cara cambió de topología; se conserva el último contorno válido.');
          continue;
        }
        const contour = faceGeometry(face.pathData, inverse(fill.captureMatrix));
        g.kind = contour.kind;
        g.nodes = [];
        g.pathData = contour.pathData;
        g.parameters = undefined;
        g.closed = true;
        fill.topologyKey = face.key;
        fill.refs = face.refs;
        fill.inputs = inputs.map(({ id, patternId, shapeId, matrix, tileMatrix }) => ({
          id,
          patternId,
          shapeId,
          matrix,
          tileMatrix,
        }));
        fill.status = 'linked';
        fill.reason = fill.scope === 'orbit' ? 'Órbita concreta verificada.' : undefined;
        patches.set(g.id, g);
      } catch (e) {
        stale((e as Error).message + ' Contorno anterior conservado.');
      }
    }
  return patches;
}
