import { z } from 'zod';
import { validPQ } from '../hyperbolic/disk';
const finite = z.number().finite();
export const poincareVisualizationSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('poincare'),
    active: z.boolean(),
    source: z
      .object({
        patternId: z.string().min(1),
        selection: z.discriminatedUnion('target', [
          z
            .object({
              target: z.literal('view'),
              bounds: z
                .object({
                  x: finite.min(-1000000).max(1000000),
                  y: finite.min(-1000000).max(1000000),
                  width: finite.positive().max(100000),
                  height: finite.positive().max(100000),
                })
                .strict(),
            })
            .strict(),
          z.object({ target: z.enum(['tile', 'lattice', 'fundamental']) }).strict(),
        ]),
      })
      .strict(),
    settings: z
      .object({
        p: finite.int().min(3).max(12),
        q: finite.int().min(3).max(12),
        radiusMm: finite.min(1).max(2000),
        toleranceMm: finite.min(0.001).max(1),
        strokeTolerance: finite.min(0.001).max(1),
        depth: finite.int().min(0).max(8),
        maxCells: finite.int().min(1).max(4096),
        radius: finite.min(0.05).max(0.995),
        minimumDiameter: finite.min(0).max(2),
        maxSegments: finite.int().min(1).max(1000000),
        view: z
          .object({ center: z.object({ x: finite, y: finite }).strict(), angle: finite })
          .strict()
          .refine(
            (v) => Math.hypot(v.center.x, v.center.y) <= 0.9,
            'El centro debe estar dentro de radio0,9.',
          ),
      })
      .strict()
      .refine((v) => validPQ(v.p, v.q), 'Elegí p/q con (p−2)(q−2)>4.'),
    showStructure: z.boolean(),
  })
  .strict();

export const artisticVisualizationSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('artistic-disk'),
    active: z.boolean(),
    source: poincareVisualizationSchema.shape.source,
    settings: z
      .object({
        radiusMm: finite.min(1).max(2000),
        toleranceMm: finite.min(0.001).max(1),
        strokeTolerance: finite.min(0.001).max(1),
        maxSegments: finite.int().min(1).max(1000000),
        maxCurves: finite.int().min(1).max(24000),
        compression: finite.min(0.1).max(64),
        view: z
          .object({ center: z.object({ x: finite, y: finite }).strict(), angle: finite })
          .strict()
          .refine(
            (v) => Math.hypot(v.center.x, v.center.y) <= 2,
            'El centro artístico debe estar dentro de radio2.',
          ),
      })
      .strict(),
  })
  .strict();
export const visualizationSchema = z.discriminatedUnion('kind', [
  poincareVisualizationSchema,
  artisticVisualizationSchema,
]);
