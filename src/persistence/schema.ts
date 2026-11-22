import { visualizationSchema } from '../visualization/schema';
import { girihDefinition } from '../girih/model';
import type { Generator } from '../app/model';
import { compositionSchema } from '../composition/schema';
import { junctionIssue } from '../editor/junctions';
import { defaultDrawingStyle, styleIssue } from '../app/styles';
import { tilingIssue } from '../tiling/validate';
import { z } from 'zod';
import { hasClosedGeometry } from '../application/clipping';
import { paperPath } from '../geometry/paper';
import { migrateDocument } from './migrations';
import type { Project } from '../app/model';
const n = z.number().finite(),
  positive = n.positive(),
  point = z.object({ x: n, y: n }),
  matrix = z.tuple([n, n, n, n, n, n]);
const strokeProfileSchema = z.object({
  version: z.literal(1),
  kind: z.enum(['uniform', 'taper-start', 'taper-end', 'taper-both', 'custom']),
  points: z
    .array(z.object({ at: n.min(0).max(1), width: n.min(0).max(4) }))
    .min(2)
    .max(64),
});
const strokeExtensions = {
  strokeDash: z.array(n.min(0).max(1000)).max(64).default([]),
  strokeDashOffset: n.min(-1000000).max(1000000).default(0),
  strokeProfile: strokeProfileSchema.default(defaultDrawingStyle().strokeProfile),
};
const boundaryRef = z.object({
  inputId: z.string(),
  patternId: z.string(),
  shapeId: z.string(),
  matrix,
  curve: n.int().min(0),
  part: n.int().min(0),
  direction: z.union([z.literal(1), z.literal(-1)]),
});
const fillRegion = z.object({
  version: z.literal(1),
  kind: z.enum(['face', 'tile']),
  scope: z.enum(['source', 'orbit', 'tile']),
  linked: z.boolean(),
  status: z.enum(['linked', 'fixed', 'stale']),
  reason: z.string().max(2000).optional(),
  faceKey: z.string().max(200000),
  topologyKey: z.string().max(200000),
  refs: z.array(boundaryRef).max(10000),
  inputs: z
    .array(
      z.object({
        id: z.string(),
        patternId: z.string(),
        shapeId: z.string(),
        matrix,
        tileMatrix: matrix.optional(),
      }),
    )
    .max(1200),
  context: z.string().max(1000000),
  captureMatrix: matrix,
  orbitMatrices: z.array(matrix).min(1).max(2048),
  closeTolerance: n.min(0).max(5),
});
export const geometrySchema = z.object({
  fillRegion: fillRegion.optional(),
  ...strokeExtensions,
  id: z.string().min(1),
  name: z.string(),
  kind: z.enum(['path', 'rectangle', 'ellipse', 'polygon', 'compound']),
  nodes: z
    .array(
      point.extend({
        in: point,
        out: point,
        junction: z.object({ id: z.string().min(1).max(200), instance: matrix }).optional(),
        detached: z.literal(true).optional(),
      }),
    )
    .max(100000),
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
const generator = z
  .object({
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
      'hat',
      'spectre',
      'girih',
    ]),
    version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    girih: z
      .object({
        version: z.literal(1),
        recipe: z.enum(['rosette', 'rhombus-grid', 'star', 'single', 'custom']),
        tileKind: z.enum(['decagon', 'pentagon', 'hexagon', 'bowtie', 'rhombus']),
        tiles: z
          .array(
            z.object({
              id: z.string().min(1).max(100),
              kind: z.enum(['decagon', 'pentagon', 'hexagon', 'bowtie', 'rhombus']),
              matrix,
            }),
          )
          .max(128)
          .optional(),
        palette: z
          .array(z.string().regex(/^#[\da-fA-F]{6}$/))
          .min(2)
          .max(6),
        showTiles: z.boolean(),
        weave: z.boolean(),
        weaveSource: z.boolean().default(false),
        bandWidth: positive.max(20),
        gap: n.min(0).max(20),
        phase: z.union([z.literal(0), z.literal(1)]),
        allowBreaks: z.boolean(),
      })
      .optional(),
    aperiodic: z
      .object({
        version: z.literal(1),
        seedTile: z.string().max(12),
        palette: z
          .array(z.string().regex(/^#[\da-fA-F]{6}$/))
          .min(2)
          .max(6),
        colorBy: z.enum(['type', 'generation', 'chirality']),
        generation: n.int().min(1).max(4),
        showHierarchy: z.boolean(),
      })
      .optional(),
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
  })
  .superRefine((g, ctx) => {
    if (g.girih && g.version !== 3)
      ctx.addIssue({ code: 'custom', message: 'Girih requiere generador3.' });
    if (g.kind === 'girih') {
      if (g.version !== 3 || !g.girih) {
        ctx.addIssue({ code: 'custom', message: 'Falta la definición Girih3.' });
        return;
      }
      if (
        g.spacing < 5 ||
        g.spacing > 100 ||
        g.girih.bandWidth > g.spacing * 0.25 ||
        g.girih.gap > g.girih.bandWidth
      )
        ctx.addIssue({ code: 'custom', message: 'Escala o banda Girih inválidas.' });
      try {
        const report = girihDefinition(g as Generator).report;
        for (const message of report.issues) ctx.addIssue({ code: 'custom', message });
      } catch (e) {
        ctx.addIssue({
          code: 'custom',
          message: e instanceof Error ? e.message : 'Parche Girih inválido.',
        });
      }
    }

    if (g.aperiodic && g.version < 2)
      ctx.addIssue({ code: 'custom', message: 'Opciones aperiódicas requieren generador2.' });
    if (g.kind === 'hat' || g.kind === 'spectre') {
      if (g.version < 2 || !g.aperiodic)
        ctx.addIssue({
          code: 'custom',
          message: 'Hat/Spectre requiere definición de sustitución.',
        });
      if (!Number.isInteger(g.frequency) || g.frequency > 4)
        ctx.addIssue({ code: 'custom', message: 'Sustituciones: entero de1 a4.' });
      const seeds =
        g.kind === 'hat'
          ? ['H', 'T', 'P', 'F']
          : ['Delta', 'Gamma', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi'];
      if (!seeds.includes(g.aperiodic?.seedTile ?? ''))
        ctx.addIssue({ code: 'custom', message: 'Semilla de sustitución desconocida.' });
    }
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
export const tilingSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]).default(1),
  colors: z
    .object({
      enabled: z.boolean(),
      palette: z
        .array(z.string().regex(/^#[\da-fA-F]{6}$/))
        .min(2)
        .max(6),
    })
    .optional(),
  kind: z.enum(['square', 'rectangle', 'parallelogram', 'triangle', 'hexagon', 'isohedral']),
  isohedral: z
    .object({
      version: z.literal(1),
      type: n.int().min(1).max(93),
      parameters: z.array(n.min(-4).max(4)).max(6),
    })
    .optional(),
  width: n.min(5).max(400),
  height: n.min(5).max(400),
  shear: n.min(-400).max(400),
  origin: point,
  rotation: n.min(-180).max(180),
  showOutline: z.boolean(),
  edges: z
    .array(
      z
        .array(point.extend({ in: point, out: point }))
        .min(2)
        .max(32),
    )
    .min(1)
    .max(5),
});
const pattern = z.object({
  composition: compositionSchema.optional(),
  compositionProfiles: z
    .record(z.string().max(80), compositionSchema)
    .refine(
      (records) =>
        Object.entries(records).length <= 10 &&
        Object.entries(records).every(
          ([key, c]) => key === c.kind || key === `${c.kind}:${c.recipe}`,
        ),
      'Perfiles de composición inválidos.',
    )
    .optional(),
  tiling: tilingSchema.optional(),
  id: z.string(),
  name: z.string(),
  sourceGeometry: z.array(geometrySchema).max(10000),
  generator,
  symmetry,
  symmetryMode: z.enum(['own', 'inherit', 'free']),
  symmetryProfiles: z.record(z.string(), symmetry),
  placementProfiles: z
    .record(z.string().max(80), matrix)
    .refine((v) => Object.keys(v).length <= 48)
    .optional(),
  placementTransform: matrix,
  visible: z.boolean(),
});
export const drawingStyleSchema = geometrySchema
  .pick({
    stroke: true,
    fill: true,
    strokeWidth: true,
    strokeCap: true,
    strokeJoin: true,
    miterLimit: true,
    opacity: true,
    fillOpacity: true,
    strokeOpacity: true,
    fillRule: true,
    strokeDash: true,
    strokeDashOffset: true,
    strokeProfile: true,
  })
  .superRefine((style, ctx) => {
    const issue = styleIssue(style);
    if (issue) ctx.addIssue({ code: 'custom', message: issue });
  });
export const projectSchema = z.object({
  schemaVersion: z.literal(7),
  visualization: visualizationSchema.optional(),
  drawingStyle: drawingStyleSchema,
  stylePresets: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(120),
        style: drawingStyleSchema,
      }),
    )
    .max(128),
  palette: z.object({
    colors: z.array(z.string().regex(/^#[a-fA-F0-9]{6}$/)).max(128),
    recent: z.array(z.string().regex(/^#[a-fA-F0-9]{6}$/)).max(24),
    favorites: z.array(z.string().regex(/^#[a-fA-F0-9]{6}$/)).max(64),
  }),
  mainSymmetry: symmetry,
  mainSymmetryProfiles: z.record(z.string(), symmetry),
  metadata: z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    example: z
      .object({
        id: z.string().max(160),
        category: z.string().max(100),
        description: z.string().max(2000),
        construction: z.string().max(500),
        validity: z.enum(['EXACT', 'APPROXIMATED', 'ARTISTIC', 'UNVERIFIED']),
        artwork: z.enum(['original', 'mathematical', 'licensed']),
        author: z.string().max(300),
        references: z
          .array(
            z.object({
              title: z.string().max(300),
              url: z
                .string()
                .url()
                .regex(/^https:\/\//),
            }),
          )
          .max(32),
      })
      .optional(),
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
    styleDefaultsFollowSelection: z.boolean(),
    stylePanelPinned: z.boolean(),
    fillCloseTolerance: n.min(0).max(5),
    fillLinkedDefault: z.boolean(),
    structureVisible: z.boolean(),
    structureOpacity: z.number().min(0.03).max(0.8),
    grid: z.boolean(),
    snap: z.boolean(),
    snapRadiusPx: n.min(1).max(40).default(8),
    snapNodes: z.boolean().default(true),
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
  if (p.visualization && !p.patterns.some((pat) => pat.id === p.visualization!.source.patternId))
    throw Error('La visualización tiene un conjunto fuente inexistente.');
  const checkMatrix = (m: readonly number[]) => {
    if (Math.abs(m[0] * m[3] - m[1] * m[2]) < 1e-8)
      throw Error('El proyecto contiene una transformación no invertible.');
  };
  const checkPattern = (pat: (typeof p.patterns)[number]) => {
    if (pat.tiling) {
      const issue = tilingIssue(pat.tiling);
      if (issue) throw Error(`Tesela inválida: ${issue}`);
    }
    checkMatrix(pat.placementTransform);
    for (const m of Object.values(pat.placementProfiles ?? {})) checkMatrix(m);
    for (const m of pat.generator.placements) checkMatrix(m);
    for (const g of pat.sourceGeometry) checkGeometry(g);
    const issue = junctionIssue(pat.sourceGeometry);
    if (issue) throw Error(issue);
  };
  const checkGeometry = (g: (typeof p.patterns)[number]['sourceGeometry'][number]) => {
    const issue = styleIssue(g);
    if (issue) throw Error(issue);
    checkMatrix(g.transform);
    for (const node of g.nodes) {
      if (node.junction) checkMatrix(node.junction.instance);
      if (node.detached && node.junction)
        throw Error('Un nodo separado no puede conservar una unión.');
    }
    if (g.fillRegion) {
      checkMatrix(g.fillRegion.captureMatrix);
      for (const m of g.fillRegion.orbitMatrices) checkMatrix(m);
      for (const input of g.fillRegion.inputs) {
        checkMatrix(input.matrix);
        if (input.tileMatrix) checkMatrix(input.tileMatrix);
      }
      for (const ref of g.fillRegion.refs) checkMatrix(ref.matrix);
    }
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
export const serialize = (project: Project) =>
  JSON.stringify({ ...project, schemaVersion: 7 }, null, 2);
