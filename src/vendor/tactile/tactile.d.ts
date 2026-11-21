/** Typed boundary around the unmodified BSD-3-Clause upstream ES module. */
export interface TactilePoint {
  x: number;
  y: number;
}
export type TactileMatrix = [number, number, number, number, number, number];
export const EdgeShape: {
  readonly J: 10001;
  readonly U: 10002;
  readonly S: 10003;
  readonly I: 10004;
};
export const numTypes: number;
export const tilingTypes: readonly number[];
export interface TactilePart {
  T: TactileMatrix;
  id: number;
  shape: number;
  rev: boolean;
  second: boolean;
}
export class IsohedralTiling {
  constructor(type: number);
  getTilingType(): number;
  numParameters(): number;
  getParameters(): number[];
  setParameters(parameters: number[]): void;
  numEdgeShapes(): number;
  getEdgeShape(index: number): number;
  vertices(): TactilePoint[];
  numVertices(): number;
  getVertex(index: number): TactilePoint;
  shape(): Generator<Omit<TactilePart, 'second'>>;
  parts(): Generator<TactilePart>;
  numAspects(): number;
  getAspectTransform(index: number): TactileMatrix;
  getT1(): TactilePoint;
  getT2(): TactilePoint;
}
