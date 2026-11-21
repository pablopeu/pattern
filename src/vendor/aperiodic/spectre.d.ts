import type { UpstreamMatrix } from './hat';
export interface SpectreTree {
  label?: string;
  pts?: { x: number; y: number }[];
  quad: { x: number; y: number }[];
  geoms?: { xform: UpstreamMatrix; geom: SpectreTree }[];
}
export function buildSpectre(depth: number, seed?: string): SpectreTree;
