import { z } from 'zod';
import { compositionIssue } from './evaluate';

const n = z.number().finite(),
  point = z.object({ x: n, y: n });
const base = {
  version: z.literal(1),
  enabled: z.boolean(),
  size: n.min(5).max(1000),
  center: point,
  sourceFrame: z.object({ x: n, y: n, width: n.positive(), height: n.positive() }),
  minSize: n.min(0.02).max(10),
  colorByLevel: z.boolean(),
  palette: z
    .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
    .min(1)
    .max(16),
};
export const compositionSchema = z
  .discriminatedUnion('kind', [
    z.object({
      ...base,
      kind: z.literal('recursive'),
      recipe: z.enum(['square-limit', 'quadrants', 'branching']),
      depth: n.int().min(0).max(6),
      ratio: n.min(0.2).max(0.8),
      angle: n.min(-360).max(360),
      mirror: z.boolean(),
    }),
    z.object({
      ...base,
      kind: z.literal('spiral'),
      recipe: z.enum(['discrete', 'logarithmic', 'rosette', 'fixed-point']),
      count: n.int().min(1).max(256),
      ratio: n.min(0.5).max(1.2),
      angle: n.min(-360).max(360),
      direction: z.union([z.literal(1), z.literal(-1)]),
      offset: point,
      arms: n.int().min(1).max(12),
      mirror: z.boolean(),
    }),
  ])
  .superRefine((value, context) => {
    const issue = compositionIssue(value);
    if (issue) context.addIssue({ code: 'custom', message: issue });
  });
