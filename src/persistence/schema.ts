import { z } from 'zod';
import { hasClosedGeometry } from '../application/clipping';
import { paperPath } from '../geometry/paper';
import { migrateDocument } from './migrations';
import type { Project } from '../app/model';
const n = z.number().finite(),
  positive = n.positive(),
  point = z.object({ x: n, y: n }),
  matrix = z.tuple([n, n, n, n, n, n]);
export const geometrySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: z.enum(['path', 'rectangle', 'ellipse', 'polygon', 'compound']),
  nodes: z.array(point.extend({ in: point, out: point })).max(100000),
  closed: z.boolean(),
  transform: matrix,
  stroke: z.string().regex(/^(none|#[0-9a-fA-F]{3,8})$/),
  fill: z.string().regex(/^(none|#[0-9a-fA-F]{3,8})$/),
  strokeWidth: n.min(0).max(1000),
  visible: z.boolean(),
  locked: z.boolean(),
  strokeCap: z.enum(['butt', 'round', 'square']).default('round'),
  strokeJoin: z.enum(['miter', 'round', 'bevel']).default('round'),
  miterLimit: positive.max(100).default(10),
  opacity: n.min(0).max(1).default(1),
  fillOpacity: n.min(0).max(1).default(1),
  strokeOpacity: n.min(0).max(1).default(1),
  fillRule: z.enum(['evenodd', 'nonzero']).default('evenodd'),
  groupId: z.string().optional(),
  pathData: z.string().max(2000000).optional(),
  parameters: z
    .object({
      x: n,
      y: n,
      width: positive,
      height: positive,
      radius: n.min(0),
      sides: n.int().min(3).max(128),
    })
    .optional(),
});
const generator = z.object({
  kind: z.enum([
    'motif',
    'grid',
    'warp',
    'radial',
    'rosette',
    'wave',
    'guilloche',
    'spirograph',
    'lattice',
    'tessellation',
    'freeform',
    'penrose',
  ]),
  version: z.literal(1),
  seed: n.int(),
  count: n.int().min(1).max(128),
  rows: n.int().min(1).max(32),
  columns: n.int().min(1).max(32),
  spacing: positive,
  offset: n,
  aspectRatio: positive.max(10).default(1),
  staggerAxis: z.enum(['rows', 'columns']).default('rows'),
  rotation: n,
  scale: positive.max(100),
  scaleRatio: positive.max(10),
  amplitude: n.min(0).max(500),
  frequency: n.min(1).max(64),
  phase: n,
  radius: positive.max(1000),
  ratio: positive.max(1),
  distribution: z.enum(['rectangular', 'circular', 'freeform']),
  periodicWarp: z.boolean(),
  placements: z.array(matrix).max(2000),
});
const symmetry = z
  .object({
    family: z.enum(['none', 'wallpaper', 'frieze', 'radial']),
    origin: point,
    orientation: n,
    group: z.string(),
    width: positive.max(10000),
    height: positive.max(10000),
    angle: n.min(15).max(165),
    sectors: n.int().min(2).max(64),
    center: point,
  })
  .superRefine((s, ctx) => {
    const allowed =
      s.family === 'none'
        ? ['none']
        : s.family === 'wallpaper'
          ? [
              'p1',
              'p2',
              'pm',
              'pg',
              'cm',
              'pmm',
              'pmg',
              'pgg',
              'cmm',
              'p4',
              'p4m',
              'p4g',
              'p3',
              'p3m1',
              'p31m',
              'p6',
              'p6m',
            ]
          : s.family === 'frieze'
            ? ['p1', 'p11g', 'p1m1', 'p11m', 'p2', 'p2mg', 'p2mm']
            : ['Cn', 'Dn'];
    if (!allowed.includes(s.group))
      ctx.addIssue({
        code: 'custom',
        message: 'Grupo incompatible con su familia',
        path: ['group'],
      });
  });
const pattern = z.object({
  id: z.string(),
  name: z.string(),
  sourceGeometry: z.array(geometrySchema).max(10000),
  generator,
  symmetry,
  symmetryMode: z.enum(['own', 'inherit', 'free']),
  symmetryProfiles: z.record(z.string(), symmetry),
  placementTransform: matrix,
  visible: z.boolean(),
});
export const projectSchema = z.object({
  schemaVersion: z.literal(3),
  mainSymmetry: symmetry,
  mainSymmetryProfiles: z.record(z.string(), symmetry),
  metadata: z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  documentUnits: z.enum(['mm', 'cm', 'in', 'px']),
  patterns: z.array(pattern).min(1).max(100),
  regions: z
    .array(z.object({ id: z.string(), name: z.string(), geometry: z.array(geometrySchema).min(1) }))
    .max(100),
  applications: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        patternId: z.string(),
        regionId: z.string(),
        placementTransform: matrix,
        linked: z.boolean(),
        frozenPattern: pattern.optional(),
        showOutline: z.boolean(),
      }),
    )
    .max(100),
  preferences: z.object({
    structureVisible: z.boolean(),
    structureOpacity: z.number().min(0.03).max(0.8),
    grid: z.boolean(),
    snap: z.boolean(),
    guides: z.boolean(),
    split: z.boolean(),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    fundamental: z.boolean().default(false),
    axes: z.boolean().default(false),
    centers: z.boolean().default(false),
    continuity: z.boolean().default(false),
    outside: z.boolean().default(false),
    sourceView: z.boolean().default(false),
    repetitionView: z.enum(['extended', 'single']).default('extended'),
  }),
});
export function parseProject(text: string): Project {
  if (text.length > 32_000_000) throw Error('El proyecto supera 32 MB. Reducí su complejidad.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw Error('El archivo no contiene JSON válido.');
  }
  const result = projectSchema.safeParse(migrateDocument(raw));
  if (!result.success) {
    const issue = result.error.issues[0];
    throw Error(`Proyecto inválido en ${issue.path.join('.')}: ${issue.message}`);
  }
  const p = result.data;
  const checkMatrix = (m: readonly number[]) => {
    if (Math.abs(m[0] * m[3] - m[1] * m[2]) < 1e-8)
      throw Error('El proyecto contiene una transformación no invertible.');
  };
  const checkPattern = (pat: (typeof p.patterns)[number]) => {
    checkMatrix(pat.placementTransform);
    for (const m of pat.generator.placements) checkMatrix(m);
    for (const g of pat.sourceGeometry) checkGeometry(g);
  };
  const checkGeometry = (g: (typeof p.patterns)[number]['sourceGeometry'][number]) => {
    checkMatrix(g.transform);
    if (['rectangle', 'ellipse', 'polygon'].includes(g.kind) && !g.parameters)
      throw Error(`La forma «${g.name}» perdió sus parámetros.`);
    if (g.kind === 'compound' && (!g.pathData || !/^[\s]*[mM]/.test(g.pathData)))
      throw Error(`El path compuesto «${g.name}» no contiene geometría válida.`);
    if (g.kind === 'compound' && /[^MmZzLlHhVvCcSsQqTtAaEe0-9\s.,+\-]/.test(g.pathData!))
      throw Error(`El path compuesto «${g.name}» contiene comandos inválidos.`);
    if (g.kind === 'compound') {
      try {
        const path = paperPath(g);
        if (!Number.isFinite(path.bounds.x) || !Number.isFinite(path.bounds.y)) throw Error();
        path.remove();
      } catch {
        throw Error(`El path compuesto «${g.name}» contiene comandos inválidos.`);
      }
    }
  };
  for (const [id, value] of Object.entries(p.mainSymmetryProfiles))
    if (id !== `${value.family}:${value.group}`)
      throw Error('Perfil principal de simetría incompatible.');
  for (const pat of p.patterns) {
    for (const [id, value] of Object.entries(pat.symmetryProfiles))
      if (id !== `${value.family}:${value.group}`) throw Error('Perfil de simetría incompatible.');
    checkPattern(pat);
  }
  for (const r of p.regions) for (const g of r.geometry) checkGeometry(g);
  for (const app of p.applications) {
    checkMatrix(app.placementTransform);
    if (app.frozenPattern) {
      if (app.frozenPattern.symmetryMode === 'inherit')
        throw Error('Un snapshot congelado no puede heredar una simetría mutable.');
      checkPattern(app.frozenPattern);
    }
  }
  const geometryIds = [
    ...p.patterns.flatMap((p) => p.sourceGeometry.map((g) => g.id)),
    ...p.regions.flatMap((r) => r.geometry.map((g) => g.id)),
  ];
  if (new Set(geometryIds).size !== geometryIds.length)
    throw Error('El proyecto contiene geometrías con identificadores duplicados.');
  const ids = [
    ...p.patterns.map((x) => x.id),
    ...p.regions.map((x) => x.id),
    ...p.applications.map((x) => x.id),
  ];
  for (const pat of p.patterns) {
    const sourceIds = pat.sourceGeometry.map((g) => g.id);
    if (new Set(sourceIds).size !== sourceIds.length)
      throw Error('Un patrón contiene objetos con identificadores duplicados.');
  }
  if (new Set(ids).size !== ids.length)
    throw Error('El proyecto contiene identificadores duplicados.');
  for (const r of p.regions)
    if (r.geometry.some((g) => !hasClosedGeometry(g)))
      throw Error('Los perímetros deben estar cerrados y encerrar un área válida.');
  for (const a of p.applications) {
    if (
      !p.patterns.some((x) => x.id === a.patternId) ||
      !p.regions.some((x) => x.id === a.regionId)
    )
      throw Error('Una aplicación tiene vínculos inexistentes.');
    if (!a.linked && !a.frozenPattern)
      throw Error('Una aplicación congelada necesita una copia de su patrón.');
  }
  return p as Project;
}
export const serialize = (project: Project) => JSON.stringify(project, null, 2);
