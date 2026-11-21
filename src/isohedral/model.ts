import type { Node } from '../app/model';
export interface IsohedralDefinition {
  version: 1;
  type: number;
  parameters: number[];
  /** Canonical edge paths; repeated/symmetric edges reference the same entry. */
  edges: Node[][];
}
export type EdgeConstraint = 'free' | 'halfturn' | 'mirror' | 'straight';
