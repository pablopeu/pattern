import type { Composition } from '../composition/model';
import type { ExampleProvenance } from '../examples/model';
import type { FillRegion } from '../fill/model';
import {
  defaultDrawingStyle,
  type DrawingStyle,
  type StylePreset,
  type ProjectPalette,
} from './styles';
import type { TilingDefinition } from '../tiling/tiles';
import type { Matrix, Point, Unit } from '../geometry/matrix';
export type Node = Point & { in: Point; out: Point };
export type ShapeKind = 'path' | 'rectangle' | 'ellipse' | 'polygon' | 'compound';
export interface Geometry extends DrawingStyle {
  fillRegion?: FillRegion;
  id: string;
  name: string;
  kind: ShapeKind;
  nodes: Node[];
  closed: boolean;
  transform: Matrix;
  visible: boolean;
  locked: boolean;
  groupId?: string;
  pathData?: string;
  parameters?: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    sides: number;
  };
}
export type GeneratorKind =
  | 'motif'
  | 'grid'
  | 'warp'
  | 'radial'
  | 'rosette'
  | 'wave'
  | 'guilloche'
  | 'spirograph'
  | 'lattice'
  | 'tessellation'
  | 'freeform'
  | 'penrose';
export interface Generator {
  kind: GeneratorKind;
  version: 1;
  seed: number;
  count: number;
  rows: number;
  columns: number;
  spacing: number;
  offset: number;
  aspectRatio: number;
  staggerAxis: 'rows' | 'columns';
  rotation: number;
  scale: number;
  scaleRatio: number;
  amplitude: number;
  frequency: number;
  phase: number;
  radius: number;
  ratio: number;
  distribution: 'rectangular' | 'circular' | 'freeform';
  periodicWarp: boolean;
  placements: Matrix[];
}
export interface Symmetry {
  family: 'none' | 'wallpaper' | 'frieze' | 'radial';
  origin: Point;
  orientation: number;
  group: string;
  width: number;
  height: number;
  angle: number;
  sectors: number;
  center: Point;
}
export interface Pattern {
  composition?: Composition;
  tiling?: TilingDefinition;
  id: string;
  name: string;
  sourceGeometry: Geometry[];
  generator: Generator;
  symmetry: Symmetry;
  symmetryMode: 'own' | 'inherit' | 'free';
  symmetryProfiles: Record<string, Symmetry>;
  placementTransform: Matrix;
  visible: boolean;
}
export interface Region {
  id: string;
  name: string;
  geometry: Geometry[];
}
export interface Application {
  id: string;
  name: string;
  patternId: string;
  regionId: string;
  placementTransform: Matrix;
  linked: boolean;
  frozenPattern?: Pattern;
  showOutline: boolean;
}
export interface Project {
  drawingStyle: DrawingStyle;
  stylePresets: StylePreset[];
  palette: ProjectPalette;
  schemaVersion: 5;
  mainSymmetry: Symmetry;
  mainSymmetryProfiles: Record<string, Symmetry>;
  metadata: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    example?: ExampleProvenance;
  };
  documentUnits: Unit;
  patterns: Pattern[];
  regions: Region[];
  applications: Application[];
  preferences: {
    styleDefaultsFollowSelection: boolean;
    stylePanelPinned: boolean;
    fillCloseTolerance: number;
    fillLinkedDefault: boolean;
    structureVisible: boolean;
    structureOpacity: number;
    grid: boolean;
    snap: boolean;
    snapRadiusPx: number;
    snapNodes: boolean;
    guides: boolean;
    split: boolean;
    background: string;
    fundamental: boolean;
    axes: boolean;
    centers: boolean;
    continuity: boolean;
    outside: boolean;
    sourceView: boolean;
    repetitionView: 'extended' | 'single';
  };
}
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const node = (x: number, y: number): Node => ({
  x,
  y,
  in: { x: 0, y: 0 },
  out: { x: 0, y: 0 },
});
export function geometry(kind: ShapeKind, nodes: Node[] = [], closed = false): Geometry {
  return {
    id: uid(),
    name: {
      path: 'Trazado',
      rectangle: 'Rectángulo',
      ellipse: 'Elipse',
      polygon: 'Polígono',
      compound: 'Compuesto',
    }[kind],
    kind,
    nodes,
    closed,
    transform: [1, 0, 0, 1, 0, 0],
    ...defaultDrawingStyle(),
    visible: true,
    locked: false,
  };
}
export const defaultGenerator = (): Generator => ({
  kind: 'motif',
  version: 1,
  seed: 42,
  count: 12,
  rows: 4,
  columns: 4,
  spacing: 22,
  offset: 0.5,
  aspectRatio: 1,
  staggerAxis: 'rows',
  rotation: 0,
  scale: 1,
  scaleRatio: 0.9,
  amplitude: 6,
  frequency: 3,
  phase: 0,
  radius: 28,
  ratio: 0.35,
  distribution: 'rectangular',
  periodicWarp: true,
  placements: [[1, 0, 0, 1, 0, 0]],
});
export function newPattern(): Pattern {
  return {
    id: uid(),
    name: 'Patrón 01',
    sourceGeometry: [],
    generator: defaultGenerator(),
    visible: true,
    symmetryMode: 'own',
    symmetryProfiles: {},
    placementTransform: [1, 0, 0, 1, 0, 0],
    symmetry: {
      family: 'none',
      group: 'none',
      origin: { x: 0, y: 0 },
      orientation: 0,
      width: 60,
      height: 60,
      angle: 90,
      sectors: 8,
      center: { x: 0, y: 0 },
    },
  };
}
export function newProject(): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: 5,
    drawingStyle: defaultDrawingStyle(),
    stylePresets: [],
    palette: { colors: [], recent: [], favorites: [] },
    mainSymmetry: newPattern().symmetry,
    mainSymmetryProfiles: {},
    metadata: { id: uid(), name: 'Estudio sin título', createdAt: now, updatedAt: now },
    documentUnits: 'mm',
    patterns: [{ ...newPattern(), symmetryMode: 'inherit' }],
    regions: [],
    applications: [],
    preferences: {
      styleDefaultsFollowSelection: true,
      stylePanelPinned: false,
      fillCloseTolerance: 0,
      fillLinkedDefault: true,
      structureVisible: false,
      structureOpacity: 0.22,
      grid: true,
      snap: true,
      snapRadiusPx: 8,
      snapNodes: true,
      guides: true,
      split: false,
      background: '#f8faf5',
      fundamental: false,
      axes: false,
      centers: false,
      continuity: false,
      outside: false,
      sourceView: false,
      repetitionView: 'extended',
    },
  };
}

/** User-facing empty study; neutral newProject remains available for engine/import fixtures. */
export function newStudy(): Project {
  const project = newProject();
  project.mainSymmetry = { ...project.mainSymmetry, family: 'wallpaper', group: 'p3', angle: 60 };
  project.preferences.structureVisible = true;
  project.preferences.structureOpacity = 0.5;
  project.preferences.guides = false;
  return project;
}
