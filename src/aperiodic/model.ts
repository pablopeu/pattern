import type { Generator } from '../app/model';
import type { AperiodicKind } from './compile';
export interface AperiodicOptions {
  version: 1;
  seedTile: string;
  palette: string[];
  colorBy: 'type' | 'generation' | 'chirality';
  generation: number;
  showHierarchy: boolean;
}
export const isAperiodic = (
  g: Pick<Generator, 'kind'>,
): g is Pick<Generator, 'kind'> & { kind: AperiodicKind } =>
  g.kind === 'hat' || g.kind === 'spectre';
export const finiteGenerator = (g: Pick<Generator, 'kind'>) =>
  g.kind === 'penrose' || isAperiodic(g);
export function defaultAperiodic(kind: AperiodicKind): AperiodicOptions {
  return {
    version: 1,
    seedTile: kind === 'hat' ? 'H' : 'Delta',
    palette: ['#bd794d', '#e7c88e', '#76978b', '#3d6066'],
    colorBy: 'generation',
    generation: 1,
    showHierarchy: false,
  };
}

/** Appearance and hierarchy frames do not change the face arrangement. */
export function geometricGenerator(g: Generator) {
  if (!g.aperiodic) return g;
  return { ...g, aperiodic: { version: g.aperiodic.version, seedTile: g.aperiodic.seedTile } };
}
