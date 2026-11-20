import type { Matrix, Point } from '../geometry/matrix';
import type { Bounds } from '../symmetry/groups';

export interface CompositionBase {
  version: 1;
  enabled: boolean;
  size: number;
  center: Point;
  sourceFrame: Bounds;
  minSize: number;
  colorByLevel: boolean;
  palette: string[];
}
export interface RecursiveComposition extends CompositionBase {
  kind: 'recursive';
  recipe: 'square-limit' | 'quadrants' | 'branching';
  depth: number;
  ratio: number;
  angle: number;
  mirror: boolean;
}
export interface SpiralComposition extends CompositionBase {
  kind: 'spiral';
  recipe: 'discrete' | 'logarithmic' | 'rosette' | 'fixed-point';
  count: number;
  ratio: number;
  angle: number;
  direction: 1 | -1;
  offset: Point;
  arms: number;
  mirror: boolean;
}
export type Composition = RecursiveComposition | SpiralComposition;
export type Operator =
  | 'motif'
  | 'rotate'
  | 'flip'
  | 'beside'
  | 'above'
  | 'over'
  | 'quartet'
  | 'cycle'
  | 'scale'
  | 'translate'
  | 'subdivide';
/** Layout is derived. A leaf references the existing motif, never a clone. */
export interface CompositionNode {
  operator: Operator;
  matrix: Matrix;
  level: number;
  source?: 'motif';
  children: CompositionNode[];
}
export interface CompiledLeaf {
  id: string;
  matrix: Matrix;
  level: number;
}
export interface CompositionReport {
  leaves: CompiledLeaf[];
  nodes: { id: string; operator: Operator; matrix: Matrix; level: number; children: string[] }[];
  culled: number;
  detailOmitted: number;
  limited: boolean;
  validity: 'EXACT';
  periodicity: 'FINITE_NONPERIODIC';
}

export function defaultComposition(kind: Composition['kind'], frame: Bounds): Composition {
  const base: CompositionBase = {
    version: 1,
    enabled: true,
    size: 150,
    center: { x: 0, y: 0 },
    sourceFrame: { ...frame, width: Math.max(1, frame.width), height: Math.max(1, frame.height) },
    minSize: 0.08,
    colorByLevel: false,
    palette: ['#c78039', '#366a70', '#9c4e4a', '#54734a', '#b9985d'],
  };
  return kind === 'recursive'
    ? { ...base, kind, recipe: 'square-limit', depth: 3, ratio: 0.5, angle: 0, mirror: false }
    : {
        ...base,
        kind,
        recipe: 'logarithmic',
        count: 42,
        ratio: 0.94,
        angle: 31,
        direction: 1,
        offset: { x: 0, y: 0 },
        arms: 1,
        mirror: false,
      };
}
