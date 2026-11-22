import { z } from 'zod';
const finite = z.number().finite();
export const animationSchema = z
  .object({
    version: z.literal(1),
    preset: z.enum([
      'sphere-spin',
      'sphere-tilt',
      'disk-spin',
      'artistic-spin',
      'recursive-levels',
    ]),
    duration: finite.min(250).max(60000),
    fps: z.union([
      z.literal(8),
      z.literal(12),
      z.literal(15),
      z.literal(24),
      z.literal(30),
    ]),
    speed: finite.min(0.1).max(4),
    direction: z.union([z.literal(1), z.literal(-1)]),
    loop: z.enum(['loop', 'pingpong', 'once']),
    position: finite.min(0).max(1),
  })
  .strict();
