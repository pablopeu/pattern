import type { Node, Geometry } from '../app/model';
import type { Matrix, Point } from '../geometry/matrix';
export interface IsohedralDefinition {
  version: 1;
  type: number;
  parameters: number[];
  /** Canonical edge paths; repeated/symmetric edges reference the same entry. */
  edges: Node[][];
}
export type EdgeConstraint = 'free' | 'halfturn' | 'mirror' | 'straight';
export interface IsohedralPart {
  id: string;
  master: number;
  constraint: EdgeConstraint;
  matrix: Matrix;
  reverse: boolean;
  second: boolean;
}
export interface IsohedralLayout {
  basis: Matrix;
  parts: IsohedralPart[];
  edges: Node[][];
  boundary: Geometry;
  aspects: Matrix[];
  vertices: Point[];
  motifSymmetries: Matrix[];
  marked: boolean;
}
