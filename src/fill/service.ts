import { geometricGenerator } from '../aperiodic/model';
import { tileFillContour } from './coordinates';
import { tileColorIndex, geometricTiling } from '../tiling/colors';
import { compositionGeometryContext } from '../composition/model';
import { geometry, type Geometry, type Pattern, type Project } from '../app/model';
import type { Scene } from '../patterns/engine';
import { expandedTransforms } from '../patterns/engine';
import { generate } from '../generators';
import { resolvePattern } from '../symmetry/config';
import { IDENTITY, inverse, multiply, apply, type Matrix, type Point } from '../geometry/matrix';
import { paperPath, paperData, scope } from '../geometry/paper';
import { clipGeometry, geometryBounds } from '../application/clipping';
import { tileBoundary } from '../tiling/tiles';
import { profile, type DrawingStyle } from '../app/styles';
import {
  buildArrangement,
  facesAt,
  isFillBudgetError,
  NUMERICAL_CLOSURE,
  type Arrangement,
  type BoundaryInput,
  type PlanarFace,
} from './planar';
import type { Bounds } from '../symmetry/groups';
export interface FillLayer {
  pattern: Pattern;
  scene: Scene | null;
}
export interface ObjectFillCandidate {
  kind: 'object';
  derived: boolean;
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
  colorIndex?: number;
  cell?: [number, number];
  orientation?: number;
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
export function hasFillInk(g: Geometry): boolean {
  return (
    g.visible &&
    g.opacity > 0 &&
    ((g.stroke !== 'none' && g.strokeWidth > 0 && g.strokeOpacity > 0) ||
      (g.fill !== 'none' && g.fillOpacity > 0))
  );
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
    view = new scope.Rectangle(bounds).expand(2 * NUMERICAL_CLOSURE);
  for (const [layerIndex, { pattern, scene }] of layers.entries()) {
    if (!scene) continue;
    for (const instance of scene.instances)
      for (const [placementIndex, placement] of scene.generated.placements.entries()) {
        const matrix = multiply(instance.matrix, placement),
          tile = instance.tileId
            ? scene.tiling?.tiles.find((t) => t.id === instance.tileId)
            : undefined;
        for (const [shapeIndex, g] of scene.generated.geometry.entries()) {
          if (g.fillRegion || !hasFillInk(g) || g.locked) continue;
          const p = paperPath(g, matrix),
            visible = p.bounds.intersects(view) || p.bounds.contains(view);
          p.remove();
          if (!visible) continue;
          const geometry =
            tile && scene.tiling ? clipAxis(g, matrix, scene.tiling.boundary, tile.matrix) : g;
          if (geometry.kind === 'compound' && !geometry.pathData) continue;
          result.push({
            id: `${pattern.id}/${instance.id}/${scene.generated.composition?.ids[placementIndex] ?? placementIndex}/${g.id}`,
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
/** Analyze complete curves around the clicked face when viewport repetition is too dense. */
export function localFillArrangement(
  layers: FillLayer[],
  view: Bounds,
  point: Point,
  tolerance: number,
) {
  const analyze = (bounds: Bounds) => {
    const inputs = collectFillInputs(layers, bounds);
    const arrangement = buildArrangement(inputs, tolerance, undefined, bounds);
    // Accept only complete faces. All curves that could cut them or form holes
    // were included; retain original curve indices for persistent links.
    const faces = arrangement.faces.filter(
      (f) =>
        f.bounds.x >= bounds.x - NUMERICAL_CLOSURE &&
        f.bounds.y >= bounds.y - NUMERICAL_CLOSURE &&
        f.bounds.x + f.bounds.width <= bounds.x + bounds.width + NUMERICAL_CLOSURE &&
        f.bounds.y + f.bounds.height <= bounds.y + bounds.height + NUMERICAL_CLOSURE,
    );
    return { inputs, arrangement: { ...arrangement, faces } };
  };
  // A source face supplies a compact search window, not the final topology.
  // Validate again against EVERY visible instance/layer crossing that window.
  let seeds = 0;
  for (const [layerIndex, { pattern, scene }] of layers.entries()) {
    if (!scene || scene.tiling) continue;
    const geometry = scene.generated.geometry.filter(
      (g) => !g.fillRegion && !g.locked && hasFillInk(g),
    );
    if (!geometry.length) continue;
    const base = geometryBounds(geometry);
    for (const instance of scene.instances)
      for (const [placementIndex, placement] of scene.generated.placements.entries()) {
        const matrix = multiply(instance.matrix, placement),
          q = apply(inverse(matrix), point);
        if (
          q.x < base.x ||
          q.x > base.x + base.width ||
          q.y < base.y ||
          q.y > base.y + base.height ||
          seeds >= 4
        )
          continue;
        seeds++;
        try {
          const inputs = geometry.map((g, i) => ({
            id: `${pattern.id}/${instance.id}/${scene.generated.composition?.ids[placementIndex] ?? placementIndex}/${g.id}`,
            patternId: pattern.id,
            shapeId: g.id,
            geometry: g,
            matrix,
            z: layerIndex * 100000 + i,
          }));
          for (const face of facesAt(buildArrangement(inputs, tolerance), point)) {
            const margin =
              Math.max(face.bounds.width, face.bounds.height) * 0.01 +
              tolerance +
              NUMERICAL_CLOSURE;
            const bounds = {
              x: face.bounds.x - margin,
              y: face.bounds.y - margin,
              width: face.bounds.width + 2 * margin,
              height: face.bounds.height + 2 * margin,
            };
            const local = analyze(bounds);
            if (facesAt(local.arrangement, point).length) return local;
          }
        } catch (error) {
          if (!isFillBudgetError(error)) throw error;
        }
      }
  }
  let radius = Math.max(Math.min(view.width, view.height) / 128, tolerance * 2, 1e-4);
  const reach = Math.max(view.width, view.height, 1) * 8;
  for (let attempt = 0; attempt < 20; attempt++, radius *= 2) {
    const local = analyze({
      x: point.x - radius,
      y: point.y - radius,
      width: radius * 2,
      height: radius * 2,
    });
    if (facesAt(local.arrangement, point).length || radius >= reach) return local;
  }
  throw Error('No se pudo delimitar una región cerrada alrededor del punto.');
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
        if (source?.fillRegion?.kind === 'tile' && scene.tiling) return;
        if (
          !source?.closed ||
          !source.visible ||
          source.locked ||
          (!source.fillRegion && !hasFillInk(g))
        )
          return;
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
            derived: !!source.fillRegion,
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
              cell: tile.cell,
              orientation: tile.orientation,
              ...(pattern.tiling?.colors?.enabled
                ? { colorIndex: tileColorIndex(pattern.tiling, tile) }
                : {}),
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
export function fillCandidatesAt(
  layers: FillLayer[],
  point: Point,
  faces: PlanarFace[],
): FillCandidate[] {
  const immediate = immediateFillCandidates(layers, point),
    candidates: FillCandidate[] = [...immediate];
  for (const face of faces) {
    if (
      immediate.some(
        (c) => c.kind === 'object' && c.derived && equivalentFaces(c.pathData, face.pathData),
      )
    )
      continue;
    candidates.push({
      kind: 'face',
      key: `face/${face.key}`,
      face,
      pathData: face.pathData,
      matrix: IDENTITY,
      z: face.z - 0.1,
    });
  }
  const priority = (c: FillCandidate) => (c.kind === 'object' ? 0 : c.kind === 'face' ? 1 : 2);
  return candidates.sort(
    (a, b) => b.z - a.z || priority(a) - priority(b) || a.key.localeCompare(b.key),
  );
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
        ? {
            id,
            kind: p.tiling?.kind,
            ...(p.tiling?.isohedral ? { type: p.tiling.isohedral.type } : {}),
          }
        : {
            id,
            generator: geometricGenerator(p.generator),
            symmetry: p.symmetry,
            placement: p.placementTransform,
            tiling: geometricTiling(p.tiling),
            visible: p.visible,
            ...(p.composition?.enabled
              ? { composition: compositionGeometryContext(p.composition) }
              : {}),
          };
    }),
  );
}
/** Compare geometric configuration; tile outlines are a view preference. Profiles may follow a fixed tile lattice. */
export function sameFillContext(a: string, b: string, followTileProfiles = false): boolean {
  if (a === b) return true;
  const sorted = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sorted)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, value]) => [k, sorted(value)]),
          )
        : v;
  const normalized = (text: string) => {
    const rows = JSON.parse(text) as Record<string, unknown>[];
    if (!Array.isArray(rows)) throw Error();
    return sorted(
      rows.map((row) => {
        if (!row || typeof row !== 'object') throw Error();
        const tile = row.tiling;
        if (!tile || typeof tile !== 'object' || Array.isArray(tile)) return row;
        const relevant = { ...tile } as Record<string, unknown>;
        delete relevant.colors;
        if (relevant.version === 2) relevant.version = 1;
        delete relevant.showOutline;
        if (followTileProfiles) delete relevant.edges;
        return { ...row, tiling: relevant };
      }),
    );
  };
  try {
    return JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
  } catch {
    return false;
  }
}
export function equivalentFaces(a: string, b: string): boolean {
  const p = new scope.CompoundPath({ pathData: a, insert: false }),
    q = new scope.CompoundPath({ pathData: b, insert: false });
  try {
    if (p.compare(q)) return true;
    q.reverse();
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
  if (
    face.refs.length > 10000 ||
    face.key.length > 200000 ||
    face.pathData.length > 2000000 ||
    inputs.length > 1200
  )
    throw Error(
      'La cara excede los límites de almacenamiento vectorial. Acercá el zoom o simplificá los límites.',
    );
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
  if (
    (g.pathData?.length ?? 0) > 2000000 ||
    g.fillRegion.context.length > 1000000 ||
    g.fillRegion.topologyKey.length > 200000
  )
    throw Error('El relleno excede los límites del documento; no se agregó la región.');
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
      geometricGenerator(p.generator),
      p.symmetry,
      p.symmetryMode,
      p.placementTransform,
      geometricTiling(p.tiling),
      compositionGeometryContext(p.composition),
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
        g.fillRule,
        hasFillInk(g),
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
        Object.assign(g, tileFillContour(tileBoundary(pattern.tiling), g.transform));
        fill.status = 'linked';
        fill.reason = undefined;
        patches.set(g.id, g);
        continue;
      }
      const currentContext = fillContext(
        project,
        fill.inputs.map((r) => r.patternId),
      );
      if (!sameFillContext(fill.context, currentContext, true)) {
        stale('Cambió la configuración de los límites; se conserva el último contorno válido.');
        continue;
      }
      try {
        const inputs: CapturedBoundary[] = fill.inputs.map((ref, index) => {
            const shape = generated.get(ref.patternId)?.find((g) => g.id === ref.shapeId);
            if (!shape || !hasFillInk(shape) || shape.locked)
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
                if (known.has(id) || !hasFillInk(shape) || shape.locked) continue;
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
            try {
              return buildArrangement(inputs, fill.closeTolerance);
            } catch (error) {
              if (!isFillBudgetError(error)) throw error;
              const oldPath = paperPath(old, fill.captureMatrix);
              const b = oldPath.bounds.expand(
                Math.max(oldPath.bounds.width, oldPath.bounds.height) * 0.1 +
                  fill.closeTolerance +
                  NUMERICAL_CLOSURE,
              );
              oldPath.remove();
              return buildArrangement(inputs, fill.closeTolerance, undefined, {
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
              });
            }
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
          const previousPath = paperPath(old, fill.captureMatrix),
            previous = faceGeometry(paperData(previousPath));
          previousPath.remove();
          const owners = [...new Set(fill.refs.map((r) => r.patternId + '/' + r.shapeId))]
              .sort()
              .join('|'),
            sameContour = arrangement.faces.filter(
              (f) =>
                [...new Set(f.refs.map((r) => r.patternId + '/' + r.shapeId))].sort().join('|') ===
                  owners && equivalentFaces(previous.pathData!, f.pathData),
            );
          if (sameContour.length === 1) face = sameContour[0];
        }
        if (!face) {
          stale('La cara cambió de topología; se conserva el último contorno válido.');
          continue;
        }
        const contour = faceGeometry(
          face.pathData,
          inverse(multiply(fill.captureMatrix, g.transform)),
        );
        if (fill.scope === 'orbit') {
          const valid = fill.orbitMatrices.every((matrix) => {
            const world = faceGeometry(contour.pathData!, multiply(matrix, g.transform)),
              path = paperPath(world),
              b = path.bounds;
            path.remove();
            return arrangement.faces.some(
              (f) =>
                Math.abs(f.bounds.x - b.x) < 1e-5 &&
                Math.abs(f.bounds.y - b.y) < 1e-5 &&
                Math.abs(f.bounds.width - b.width) < 1e-5 &&
                Math.abs(f.bounds.height - b.height) < 1e-5 &&
                equivalentFaces(world.pathData!, f.pathData),
            );
          });
          if (!valid) {
            stale(
              'La órbita ya no reproduce todas las caras verificadas. Se conserva el contorno anterior; podés recalcular la región.',
            );
            continue;
          }
        }
        fill.context = currentContext;
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
