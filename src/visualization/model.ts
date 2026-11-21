import type { Project } from '../app/model';
import type { FlatSourceSelection } from '../hyperbolic/flat-source';
import type { DiskSettings } from '../hyperbolic/representation';
import { finiteGenerator } from '../aperiodic/model';
import { resolvePattern } from '../symmetry/config';

/** A derived view is independent of generators, canonical geometry and edit mode. */
export interface PoincareVisualization {
  version: 1;
  kind: 'poincare';
  active: boolean;
  source: { patternId: string; selection: FlatSourceSelection };
  settings: Required<DiskSettings>;
  showStructure: boolean;
}
export type Visualization = PoincareVisualization;
export function defaultVisualization(project: Project, patternId: string): Visualization {
  const pattern = project.patterns.find((p) => p.id === patternId);
  if (!pattern) throw Error('No existe el conjunto fuente.');
  const flat = resolvePattern(pattern, project),
    periodic =
      !finiteGenerator(flat.generator) &&
      !flat.composition?.enabled &&
      (flat.tiling || flat.symmetry.family === 'wallpaper');
  return {
    version: 1,
    kind: 'poincare',
    active: true,
    source: {
      patternId,
      selection: periodic
        ? { target: 'lattice' }
        : {
            target: 'view',
            bounds: { x: -50, y: -50, width: 100, height: 100 },
          },
    },
    settings: {
      p: 7,
      q: 3,
      radiusMm: 100,
      toleranceMm: 0.02,
      strokeTolerance: 0.02,
      depth: 4,
      maxCells: 100,
      radius: 0.97,
      minimumDiameter: 0.008,
      maxSegments: 250000,
      view: { center: { x: 0, y: 0 }, angle: 0 },
    },
    showStructure: true,
  };
}
