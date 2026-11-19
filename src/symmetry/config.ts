import { newPattern, type Pattern, type Project, type Symmetry } from '../app/model';
import { multiply, translate, scale, apply, type Matrix, type Point } from '../geometry/matrix';
import { geometryBounds } from '../application/clipping';
import { generate } from '../generators';
import { wallpaperNames, friezeNames, lattice, rectangularCell, type Bounds } from './groups';
export type SymmetryChoice = { family: Symmetry['family']; group: string };
export type SymmetryPreview = {
  target: 'project' | 'pattern';
  patternId: string;
  choice: SymmetryChoice;
};
export const symmetryId = (s: SymmetryChoice) => `${s.family}:${s.group}`;
export const symmetryCatalog: SymmetryChoice[] = [
  { family: 'none', group: 'none' },
  ...wallpaperNames.map((group) => ({ family: 'wallpaper' as const, group })),
  ...friezeNames.map((group) => ({ family: 'frieze' as const, group })),
  { family: 'radial', group: 'Cn' },
  { family: 'radial', group: 'Dn' },
];
export const symmetryOrigin = (s: Symmetry): Point => (s.family === 'radial' ? s.center : s.origin);
export function candidateSymmetry(
  current: Symmetry,
  profiles: Record<string, Symmetry>,
  choice: SymmetryChoice,
): Symmetry {
  const saved = profiles[symmetryId(choice)];
  return saved ? structuredClone(saved) : { ...structuredClone(current), ...choice };
}
export function resolveSymmetry(pattern: Pattern, main?: Symmetry): Symmetry {
  if (pattern.symmetryMode === 'free')
    return { ...pattern.symmetry, family: 'none', group: 'none' };
  return pattern.symmetryMode === 'inherit' && main ? main : pattern.symmetry;
}
export function resolvePattern(
  pattern: Pattern,
  project?: Pick<Project, 'mainSymmetry' | 'mainSymmetryProfiles'>,
  preview?: SymmetryPreview | null,
): Pattern {
  let main = project?.mainSymmetry;
  if (preview?.target === 'project' && main)
    main = candidateSymmetry(main, project!.mainSymmetryProfiles, preview.choice);
  let symmetry = resolveSymmetry(pattern, main);
  if (preview?.target === 'pattern' && preview.patternId === pattern.id)
    symmetry = candidateSymmetry(symmetry, pattern.symmetryProfiles, preview.choice);
  return { ...pattern, symmetry, symmetryMode: 'own' };
}
/** The only confirmed group/family change. Sources/generator/applications stay untouched. */
export function changeSymmetry(
  project: Project,
  patternId: string | null,
  choice: SymmetryChoice,
): void {
  if (patternId === null) {
    const current = project.mainSymmetry;
    project.mainSymmetryProfiles[symmetryId(current)] = structuredClone(current);
    project.mainSymmetry = candidateSymmetry(current, project.mainSymmetryProfiles, choice);
    return;
  }
  const p = project.patterns.find((p) => p.id === patternId);
  if (!p) throw Error('No se encontró el conjunto.');
  const current = resolveSymmetry(p, project.mainSymmetry);
  p.symmetryProfiles[symmetryId(current)] = structuredClone(current);
  p.symmetry = candidateSymmetry(current, p.symmetryProfiles, choice);
  p.symmetryMode = 'own';
}
export function freezePattern(pattern: Pattern, main: Symmetry): Pattern {
  return structuredClone({
    ...pattern,
    symmetry: resolveSymmetry(pattern, main),
    symmetryMode: 'own',
  });
}
export function defaultSymmetry(): Symmetry {
  return newPattern().symmetry;
}
export function adaptToCell(pattern: Pattern, main?: Symmetry): Matrix {
  const s = resolveSymmetry(pattern, main),
    generated = generate(pattern.generator, pattern.sourceGeometry),
    base = geometryBounds(generated.geometry);
  const points = generated.placements.flatMap((p) =>
    [
      { x: base.x, y: base.y },
      { x: base.x + base.width, y: base.y },
      { x: base.x, y: base.y + base.height },
      { x: base.x + base.width, y: base.y + base.height },
    ].map((q) => apply(multiply(pattern.placementTransform, p), q)),
  );
  if (!points.length) return pattern.placementTransform;
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y)),
    w = Math.max(...points.map((p) => p.x)) - x,
    h = Math.max(...points.map((p) => p.y)) - y;
  const b = lattice(s),
    origin = symmetryOrigin(s),
    periodic = s.family === 'wallpaper' || s.family === 'frieze';
  const center = periodic
    ? { x: origin.x + (b[0] + b[2]) / 2, y: origin.y + (b[1] + b[3]) / 2 }
    : origin;
  const area = Math.abs(b[0] * b[3] - b[1] * b[2]),
    radius = periodic
      ? area / (2 * Math.max(Math.hypot(b[0], b[1]), Math.hypot(b[2], b[3])))
      : Math.min(s.width, s.height) / 2;
  const factor = (0.75 * radius) / Math.max(0.001, Math.hypot(w, h) / 2);
  return multiply(
    translate(center.x, center.y),
    multiply(
      scale(factor),
      multiply(translate(-x - w / 2, -y - h / 2), pattern.placementTransform),
    ),
  );
}
export function commonRectangularCell(
  patterns: Pattern[],
): { width: number; height: number } | null {
  const cells = patterns
    .filter((p) => p.visible)
    .map((p) => (p.generator.kind === 'penrose' ? null : rectangularCell(p.symmetry)));
  if (!cells.length || cells.some((c) => !c)) return null;
  const common = (values: number[]) => {
    const base = values[0];
    for (let n = 1; n <= 1024; n++)
      if (values.every((v) => Math.abs((base * n) / v - Math.round((base * n) / v)) < 1e-7))
        return base * n;
    return null;
  };
  const width = common(cells.map((c) => c!.width)),
    height = common(cells.map((c) => c!.height));
  return width && height ? { width, height } : null;
}
export function frameBounds(s: Symmetry): Bounds {
  const b = lattice(s),
    o = symmetryOrigin(s),
    points = [
      o,
      { x: o.x + b[0], y: o.y + b[1] },
      { x: o.x + b[2], y: o.y + b[3] },
      { x: o.x + b[0] + b[2], y: o.y + b[1] + b[3] },
    ];
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
