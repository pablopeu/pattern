import type { ArtisticDiskSettings } from '../artistic/disk';
import type { Project } from '../app/model';
import type { FlatSourceSelection } from '../hyperbolic/flat-source';
import type { DiskColorSettings, DiskSettings } from '../hyperbolic/representation';
import { finiteGenerator } from '../aperiodic/model';
import { resolvePattern } from '../symmetry/config';

/** A derived view is independent of generators, canonical geometry and edit mode. */
export interface PoincareVisualization {
  version: 2;
  kind: 'poincare';
  active: boolean;
  source: { patternId: string; selection: FlatSourceSelection };
  settings: Required<Omit<DiskSettings, 'colors'>> & {
    adaptation: 'inscribed' | 'mirrored-chambers';
    /** Documentos previos no lo traen: ausente equivale a 'source'. */
    colors?: DiskColorSettings;
  };
  showStructure: boolean;
}
export interface ArtisticVisualization {
  version: 1;
  kind: 'artistic-disk';
  active: boolean;
  source: PoincareVisualization['source'];
  settings: Omit<Required<ArtisticDiskSettings>, 'angle' | 'center'> & {
    view: { center: { x: number; y: number }; angle: number };
  };
}
export type Visualization = PoincareVisualization | ArtisticVisualization;
export function defaultVisualization(project: Project, patternId: string): PoincareVisualization {
  const pattern = project.patterns.find((p) => p.id === patternId);
  if (!pattern) throw Error('No existe el conjunto fuente.');
  const flat = resolvePattern(pattern, project),
    periodic =
      !finiteGenerator(flat.generator) &&
      !flat.composition?.enabled &&
      (flat.tiling || flat.symmetry.family === 'wallpaper');
  return {
    version: 2,
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
      adaptation: 'inscribed',
      colors: { mode: 'source' },
      maxCurves: 4096,
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

export function defaultArtisticVisualization(
  project: Project,
  patternId: string,
): ArtisticVisualization {
  const base = defaultVisualization(project, patternId);
  return {
    version: 1,
    kind: 'artistic-disk',
    active: true,
    source: base.source,
    settings: {
      radiusMm: 100,
      toleranceMm: 0.02,
      strokeTolerance: 0.02,
      compression: 4,
      maxSegments: 250000,
      maxCurves: 4096,
      view: { center: { x: 0, y: 0 }, angle: 0 },
    },
  };
}
export function changeVisualizationKind(
  project: Project,
  current: Visualization,
  kind: Visualization['kind'],
): Visualization {
  if (current.kind === kind) return structuredClone(current);
  const next =
    kind === 'poincare'
      ? defaultVisualization(project, current.source.patternId)
      : defaultArtisticVisualization(project, current.source.patternId);
  next.active = current.active;
  next.source = structuredClone(current.source);
  for (const key of [
    'radiusMm',
    'toleranceMm',
    'strokeTolerance',
    'maxSegments',
    'maxCurves',
  ] as const)
    next.settings[key] = current.settings[key];
  next.settings.view.angle = current.settings.view.angle;
  const c = current.settings.view.center,
    limit = kind === 'poincare' ? 0.9 : 2,
    scale = Math.min(1, (limit * (1 - 1e-12)) / (Math.hypot(c.x, c.y) || 1));
  next.settings.view.center = { x: c.x * scale, y: c.y * scale };
  return next;
}
