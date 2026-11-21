import { describe, it, expect } from 'vitest';
import oldExamples from './fixtures/v1-examples.json';
import { geometry, newProject, newStudy, newPattern, node, type Project } from '../app/model';
import { parseProject, serialize } from '../persistence/schema';
import {
  changeSymmetry,
  resolvePattern,
  freezePattern,
  symmetryId,
  symmetryCatalog,
} from '../symmetry/config';
import { buildScene } from '../patterns/engine';
import { chooseCapture, capturedPoint, type CaptureContext } from '../editor/capture';
import { apply, IDENTITY } from '../geometry/matrix';
import { cosets, lattice, fundamentalDomain } from '../symmetry/groups';
import { verifyPeriodicity } from '../symmetry/guides';
import { prepareExport, type ExportOptions } from '../export/svg';
import { parsePreset } from '../persistence/presets';
const bounds = { x: -100, y: -100, width: 200, height: 200 };
const source = () =>
  geometry('path', [node(7, 11), { ...node(22, 17), in: { x: -3, y: 2 } }, node(13, 28)], true);
it('un preset v1 conserva su órbita y un preset v2 heredado es autónomo', () => {
  const old = oldExamples[1].patterns[0],
    migrated = parsePreset(JSON.stringify({ presetVersion: 1, pattern: old }));
  expect(migrated.symmetryMode).toBe('own');
  expect(migrated.symmetry.group).toBe(old.symmetry.group);
  expect(migrated.id).not.toBe(old.id);
  expect(migrated.sourceGeometry[0].nodes).toEqual(old.sourceGeometry[0].nodes);
  const p = newProject();
  changeSymmetry(p, null, { family: 'wallpaper', group: 'p6m' });
  p.patterns[0].sourceGeometry = [source()];
  const frozen = freezePattern(p.patterns[0], p.mainSymmetry),
    read = parsePreset(JSON.stringify({ presetVersion: 2, pattern: frozen }));
  expect(read.symmetryMode).toBe('own');
  expect(read.symmetry.group).toBe('p6m');
  expect(resolvePattern(read, newProject()).symmetry).toEqual(frozen.symmetry);
});
it('Penrose mantiene clasificación finita aun cuando el marco elegido es Libre', () => {
  const p = newProject();
  p.patterns[0].generator.kind = 'penrose';
  expect(verifyPeriodicity(resolvePattern(p.patterns[0], p)).status).toBe('FINITE_NONPERIODIC');
  expect(buildScene(resolvePattern(p.patterns[0], p), bounds).status).toBe('FINITE_NONPERIODIC');
});
const options = (p: Project): ExportOptions => ({
  target: 'view',
  scope: 'pattern',
  format: 'svg',
  representation: 'editable',
  width: 100,
  height: 100,
  dpi: 150,
  background: '#ffffff',
  transparent: true,
  quality: 0.9,
  tolerance: 0.02,
  outlineStrokes: true,
  patternId: p.patterns[0].id,
});
const withoutStrokeExtensions = (g: import('../app/model').Geometry) => {
  const { strokeDash, strokeDashOffset, strokeProfile, ...old } = g;
  expect(strokeDash).toEqual([]);
  expect(strokeDashOffset).toBe(0);
  expect(strokeProfile.kind).toBe('uniform');
  return old;
};
describe('PRD v2 · migración real', () => {
  oldExamples.forEach((old, i) =>
    it(`ejemplo v1 ${i + 1}: conserva fuentes, IDs, simetría, generador y regiones`, () => {
      const p = parseProject(JSON.stringify(old));
      expect(p.schemaVersion).toBe(7);
      expect(p.metadata).toEqual(old.metadata);
      expect(
        p.regions.map((r) => ({ ...r, geometry: r.geometry.map(withoutStrokeExtensions) })),
      ).toEqual(old.regions);
      expect(p.applications).toEqual(old.applications);
      for (let k = 0; k < old.patterns.length; k++) {
        const before = old.patterns[k],
          after = p.patterns[k];
        expect(after.id).toBe(before.id);
        expect(after.sourceGeometry.map(withoutStrokeExtensions)).toEqual(before.sourceGeometry);
        expect(after.generator).toEqual(before.generator);
        expect(after.symmetry).toEqual({
          ...before.symmetry,
          origin: { x: 0, y: 0 },
          orientation: 0,
        });
        expect(after.symmetryMode).toBe('own');
      }
      expect(parseProject(serialize(p))).toEqual(p);
    }),
  );
  it('p1 antiguo sigue siendo periódico y los nuevos empiezan Libre', () => {
    const p = parseProject(JSON.stringify(oldExamples[0]));
    expect(buildScene(resolvePattern(p.patterns[0], p), bounds).status).toBe('PERIODIC_SEAMLESS');
    const fresh = newProject(),
      scene = buildScene(resolvePattern(fresh.patterns[0], fresh), bounds);
    expect(scene.instances.map((i) => i.matrix)).toEqual([IDENTITY]);
    expect(scene.status).toBe('FREE_NONPERIODIC');
    expect(fresh.patterns[0].generator.kind).toBe('motif');
  });
  it('migra snapshots v1 sin convertirlos en herencia mutable', () => {
    const old = structuredClone(oldExamples[6]) as unknown as {
      applications: Record<string, unknown>[];
      patterns: unknown[];
    };
    old.applications[0].linked = false;
    old.applications[0].frozenPattern = structuredClone(old.patterns[0]);
    const p = parseProject(JSON.stringify(old)),
      frozen = p.applications[0].frozenPattern!;
    changeSymmetry(p, null, { family: 'radial', group: 'Dn' });
    expect(resolvePattern(frozen, p).symmetry.group).toBe('p1');
  });
});
describe('PRD v2 · cambios no destructivos y configuración efectiva', () => {
  it('AC-22/28: cien cambios sin deriva; restaura la configuración de cada grupo', () => {
    const p = newProject(),
      pat = p.patterns[0];
    pat.symmetryMode = 'own';
    pat.sourceGeometry = [source(), source(), source()];
    changeSymmetry(p, pat.id, { family: 'wallpaper', group: 'p4m' });
    pat.symmetry.width = 83.125;
    pat.symmetry.origin = { x: 13.567891234, y: -27.3 };
    pat.symmetry.orientation = 17;
    const initial = structuredClone(pat.symmetry),
      snapshot = JSON.stringify(pat.sourceGeometry),
      generator = JSON.stringify(pat.generator);
    const choices = [
      { family: 'none', group: 'none' },
      { family: 'wallpaper', group: 'p4m' },
      { family: 'wallpaper', group: 'p6m' },
      { family: 'wallpaper', group: 'p1' },
      { family: 'frieze', group: 'p2' },
      { family: 'radial', group: 'Dn' },
    ] as const;
    for (let i = 0; i < 100; i++) changeSymmetry(p, pat.id, choices[i % choices.length]);
    changeSymmetry(p, pat.id, initial);
    expect(pat.sourceGeometry).toEqual(JSON.parse(snapshot));
    expect(JSON.stringify(pat.generator)).toBe(generator);
    expect(pat.symmetry).toEqual(initial);
    expect(symmetryId(pat.symmetry)).toBe('wallpaper:p4m');
  });
  it('AC-30: resolver de hover no muta proyecto ni fuentes', () => {
    const p = newProject();
    p.patterns[0].sourceGeometry = [source()];
    const before = serialize(p),
      preview = resolvePattern(p.patterns[0], p, {
        target: 'project',
        patternId: p.patterns[0].id,
        choice: { family: 'wallpaper', group: 'p6m' },
      });
    expect(preview.symmetry.group).toBe('p6m');
    expect(preview.sourceGeometry).toBe(p.patterns[0].sourceGeometry);
    expect(serialize(p)).toBe(before);
  });
  it('AC-36: principal sólo afecta herederos; snapshots y Libre son independientes', () => {
    const p = newProject(),
      own = newPattern(),
      free = newPattern();
    own.symmetry = { ...own.symmetry, family: 'radial', group: 'Dn' };
    free.symmetryMode = 'free';
    p.patterns.push(own, free);
    changeSymmetry(p, null, { family: 'wallpaper', group: 'p4m' });
    const frozen = freezePattern(p.patterns[0], p.mainSymmetry);
    changeSymmetry(p, null, { family: 'wallpaper', group: 'p6m' });
    expect(p.patterns.map((pat) => resolvePattern(pat, p).symmetry.group)).toEqual([
      'p6m',
      'Dn',
      'none',
    ]);
    expect(resolvePattern(frozen, p).symmetry.group).toBe('p4m');
  });
  it('AC-34/35: origen y orientación conjugados; dominio y red siguen siendo válidos', () => {
    const p = newProject(),
      pat = p.patterns[0];
    pat.symmetryMode = 'own';
    pat.symmetry = {
      ...pat.symmetry,
      family: 'wallpaper',
      group: 'p4m',
      origin: { x: 27, y: -13 },
      orientation: 23,
    };
    pat.sourceGeometry = [source()];
    const before = serialize(p);
    const ops = cosets(pat.symmetry);
    expect(apply(ops[1], pat.symmetry.origin).x).toBeCloseTo(27);
    expect(verifyPeriodicity(pat).valid).toBe(true);
    const poly = fundamentalDomain(pat.symmetry),
      area =
        Math.abs(
          poly.reduce((a, v, i) => {
            const q = poly[(i + 1) % poly.length];
            return a + v.x * q.y - v.y * q.x;
          }, 0),
        ) / 2;
    const b = lattice(pat.symmetry);
    expect(area).toBeCloseTo(Math.abs(b[0] * b[3] - b[1] * b[2]) / 8, 5);
    expect(serialize(p)).toBe(before);
  });
});
describe('PRD v2 · captura canónica desde instancias', () => {
  for (const group of ['pm', 'p4', 'p6'])
    it(`AC-24/25/26: ${group}, inversa fija y cruce de celdas`, () => {
      const p = newProject(),
        pat = p.patterns[0];
      pat.symmetryMode = 'own';
      pat.symmetry = { ...pat.symmetry, family: 'wallpaper', group };
      pat.sourceGeometry = [source()];
      const scene = buildScene(pat, bounds),
        op = scene.instances.find(
          (i) =>
            i.cell[0] === 0 &&
            i.cell[1] === 0 &&
            (group === 'pm'
              ? i.matrix[0] * i.matrix[3] - i.matrix[1] * i.matrix[2] < 0
              : Math.abs(i.matrix[1]) > 0.5),
        )!;
      expect(op).toBeDefined();
      const a = { x: 14, y: 17 },
        world = apply(op.matrix, a),
        chosen = chooseCapture(pat, scene, world, 0.5, op.matrix).chosen,
        context: CaptureContext = { patternId: pat.id, tool: 'pen', instance: chosen };
      expect(capturedPoint(context, world).x).toBeCloseTo(a.x, 8);
      expect(capturedPoint(context, world).y).toBeCloseTo(a.y, 8);
      const far = { x: world.x + 180, y: world.y - 120 },
        local = capturedPoint(context, far);
      const roundTrip = apply(chosen.matrix, local);
      expect(roundTrip.x).toBeCloseTo(far.x, 8);
      expect(roundTrip.y).toBeCloseTo(far.y, 8);
      changeSymmetry(p, pat.id, { family: 'wallpaper', group: 'pgg' });
      expect(capturedPoint(context, far)).toEqual(local);
    });
  it('la política de ambigüedad no depende del orden SVG', () => {
    const p = newProject(),
      pat = p.patterns[0];
    pat.symmetry = { ...pat.symmetry, family: 'wallpaper', group: 'p4m' };
    const scene = buildScene(pat, bounds),
      point = { x: 12, y: 7 };
    const a = chooseCapture(pat, scene, point, 1),
      b = chooseCapture(pat, { ...scene, instances: [...scene.instances].reverse() }, point, 1);
    expect(a.chosen.id).toBe(b.chosen.id);
  });
});
describe('PRD v2 · exportación confirmada y composición', () => {
  it('Libre produce geometría directa, sin instancias artificiales', () => {
    const p = newProject();
    p.patterns[0].sourceGeometry = [source()];
    const result = prepareExport(p, options(p));
    expect(result.svg).toContain('<path');
    expect(result.svg).not.toContain('<use');
    expect(result.warnings.join(' ')).toContain('Libre');
  });
  it('composición mixta se exporta y rechaza una baldosa seamless inexistente', () => {
    const p = newProject();
    p.patterns[0].sourceGeometry = [source()];
    const second = newPattern();
    second.symmetry = { ...second.symmetry, family: 'wallpaper', group: 'p4m' };
    second.sourceGeometry = [{ ...source(), id: 'second' }];
    p.patterns.push(second);
    const opts = {
      ...options(p),
      scope: 'composition' as const,
      representation: 'expanded' as const,
    };
    const result = prepareExport(p, opts);
    expect(result.geometries.length).toBeGreaterThan(2);
    expect(result.svg).not.toContain('clipPath');
    expect(() => prepareExport(p, { ...opts, target: 'tile' })).toThrow(/común/);
  });
  it('exportar una aplicación congelada ignora cambios de simetría principal', () => {
    const p = parseProject(JSON.stringify(oldExamples[6]));
    const a = p.applications[0];
    a.linked = false;
    a.frozenPattern = freezePattern(p.patterns[0], p.mainSymmetry);
    const opts = { ...options(p), target: 'application' as const, applicationId: a.id };
    const initial = prepareExport(p, opts).svg;
    changeSymmetry(p, null, { family: 'radial', group: 'Dn' });
    p.patterns[0].symmetryMode = 'inherit';
    expect(prepareExport(p, opts).svg).toBe(initial);
  });
});

it('un estudio nuevo usa P3 y estructura al50% sin modificar documentos recuperados', () => {
  const study = newStudy();
  expect(resolvePattern(study.patterns[0], study).symmetry).toMatchObject({
    family: 'wallpaper',
    group: 'p3',
    angle: 60,
  });
  expect(study.preferences).toMatchObject({
    structureVisible: true,
    structureOpacity: 0.5,
    guides: false,
  });
  expect(study.patterns[0].sourceGeometry).toEqual([]);
  const legacy = newProject();
  expect(parseProject(serialize(legacy))).toEqual(legacy);
  expect(legacy.mainSymmetry.family).toBe('none');
});
it('P3 encabeza el catálogo, Libre lo cierra y el resto mantiene su orden', () => {
  expect(symmetryCatalog).toEqual([
    { family: 'wallpaper', group: 'p3' },
    ...[
      'p1',
      'p2',
      'pm',
      'pg',
      'cm',
      'pmm',
      'pmg',
      'pgg',
      'cmm',
      'p4',
      'p4m',
      'p4g',
      'p3m1',
      'p31m',
      'p6',
      'p6m',
    ].map((group) => ({ family: 'wallpaper', group })),
    ...['p1', 'p11g', 'p1m1', 'p11m', 'p2', 'p2mg', 'p2mm'].map((group) => ({
      family: 'frieze',
      group,
    })),
    { family: 'radial', group: 'Cn' },
    { family: 'radial', group: 'Dn' },
    { family: 'none', group: 'none' },
  ]);
});
