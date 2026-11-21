export type UpstreamMatrix = readonly [number, number, number, number, number, number];
export interface HatTree {
  label?: string;
  shape?: { x: number; y: number }[];
  children?: { T: UpstreamMatrix; geom: HatTree }[];
}
export const outline: { x: number; y: number }[];
export function buildHat(depth: number, seed?: string): HatTree;
