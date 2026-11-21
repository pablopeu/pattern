import { geometry, type Generator, type Geometry } from '../app/model';
import type { Generated } from '../generators';
import { multiply, rotate, scale, translate } from '../geometry/matrix';
import { clipGeometry } from '../application/clipping';
import { compileAperiodic, aperiodicPath, patchBounds } from './compile';
import { defaultAperiodic, isAperiodic } from './model';
export function generateAperiodic(g: Generator, source: Geometry[]): Generated {
  if (!isAperiodic(g)) throw Error('Generador aperiódico desconocido.');
  const options = g.aperiodic ?? defaultAperiodic(g.kind),
    patch = compileAperiodic(g.kind, Math.round(g.frequency), options.seedTile),
    b = patchBounds(patch),
    factor = (g.radius * 2) / Math.max(b.width, b.height),
    normalization = multiply(
      rotate(g.rotation),
      multiply(scale(factor), translate(-b.x - b.width / 2, -b.y - b.height / 2)),
    ),
    placements = patch.leaves.map((l) => multiply(normalization, multiply(l.matrix, scale(0.1)))),
    body = {
      ...geometry('compound', [], true),
      id: `generated-${g.kind}-body`,
      name: g.kind === 'hat' ? 'Hat' : 'Spectre curvo',
      pathData: aperiodicPath({
        ...patch,
        points: patch.points.map((p) => ({ x: p.x * 10, y: p.y * 10 })),
      }),
      fill: options.palette[0],
      stroke: '#243d36',
      strokeWidth: 0.25,
    },
    motif = source
      .filter((s) => s.visible)
      .flatMap((s) =>
        clipGeometry(s, { id: 'aperiodic-mask', name: 'Tesela canónica', geometry: [body] }).map(
          (clipped, i) => ({ ...clipped, id: i ? `${s.id}/clipped-${i}` : s.id, name: s.name }),
        ),
      ),
    classes = patch.leaves.map((l) =>
      options.colorBy === 'chirality'
        ? l.matrix[0] * l.matrix[3] - l.matrix[1] * l.matrix[2] < 0
          ? 1
          : 0
        : options.colorBy === 'type'
          ? (g.kind === 'hat'
              ? ['H', 'H1', 'T', 'P', 'F']
              : ['Delta', 'Gamma1', 'Gamma2', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi']
            ).indexOf(l.label)
          : (l.ancestry[Math.min(options.generation - 1, Math.max(0, l.ancestry.length - 1))] ?? 0),
    ),
    guides = options.showHierarchy
      ? patch.guides
          .filter((guide) => guide.level === Math.min(options.generation - 1, patch.depth - 1))
          .map((guide) => ({
            geometry: {
              ...geometry('compound', [], true),
              id: `hierarchy-${guide.id}`,
              name: 'Marco de sustitución',
              fill: 'none',
              stroke: '#162e34',
              strokeWidth: 0.08,
              pathData: aperiodicPath({ points: guide.points, curved: false }),
            },
            matrices: [multiply(normalization, guide.matrix)],
          }))
      : [];
  return {
    geometry: [body, ...motif],
    placements,
    finite: true,
    aperiodic: {
      kind: g.kind,
      bodyId: body.id,
      palette: options.palette,
      classes,
      ids: patch.leaves.map((l) => l.id),
      guides,
      source: [body, ...source],
    },
  };
}
