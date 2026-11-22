import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseProject, serialize } from '../persistence/schema';
import { repairLegacyJunctionFrames } from '../editor/legacy-junctions';
import { junctionIssue } from '../editor/junctions';
import { recalculateRegion } from '../fill/recalculate';
import { refreshLinkedFills } from '../fill/service';
import { patchSymmetryFrame } from '../symmetry/frame';
import { resolveSymmetry } from '../symmetry/config';
import { instances } from '../symmetry/groups';
import { apply, inverse, multiply, distance } from '../geometry/matrix';
import { paperPath } from '../geometry/paper';
import type { Project } from '../app/model';
const originalText = readFileSync('tests/estudios/test1.json', 'utf8');
const correctedText = readFileSync('tests/estudios/test1-corregido.json', 'utf8');
function actualGaps(p: Project) {
  const pat = p.patterns[0],
    P = pat.placementTransform,
    operations = instances(resolveSymmetry(pat, p.mainSymmetry), {
      x: -350,
      y: -350,
      width: 700,
      height: 700,
    });
  const groups = new Map<string, { g: (typeof pat.sourceGeometry)[number]; index: number }[]>();
  for (const g of pat.sourceGeometry)
    for (const [index, n] of g.nodes.entries())
      if (n.junction) {
        const m = groups.get(n.junction.id) ?? [];
        m.push({ g, index });
        groups.set(n.junction.id, m);
      }
  const gaps: number[] = [];
  for (const members of groups.values()) {
    const a = members[0],
      an = a.g.nodes[a.index];
    for (const b of members.slice(1)) {
      const bn = b.g.nodes[b.index],
        relative = multiply(inverse(an.junction!.instance), bn.junction!.instance),
        wanted = multiply(P, multiply(relative, inverse(P)));
      const nearest = operations.reduce(
        (best, item) => {
          const err = Math.max(...item.matrix.map((n, i) => Math.abs(n - wanted[i])));
          return err < best.error ? { error: err, matrix: item.matrix } : best;
        },
        { error: Infinity, matrix: operations[0].matrix },
      );
      gaps.push(
        distance(
          apply(multiply(P, a.g.transform), an),
          apply(multiply(nearest.matrix, multiply(P, b.g.transform)), bn),
        ),
      );
    }
  }
  return gaps;
}
it('test1 original reproduces the historical gauge gap and explicit repair closes exactly one group', () => {
  const p = parseProject(originalText),
    before = structuredClone(p),
    pat = p.patterns[0];
  expect(Math.max(...actualGaps(p))).toBeGreaterThan(0.1);
  expect(repairLegacyJunctionFrames(p)).toBe(1);
  expect(Math.max(...actualGaps(p))).toBeLessThan(1e-7);
  expect(junctionIssue(pat.sourceGeometry)).toBeNull();
  for (const g of pat.sourceGeometry) {
    const old = before.patterns[0].sourceGeometry.find((o) => o.id === g.id)!;
    expect({ ...g, nodes: [] }).toEqual({ ...old, nodes: [] });
    expect(g.nodes.map((n) => [n.in, n.out])).toEqual(old.nodes.map((n) => [n.in, n.out]));
  }
  expect(repairLegacyJunctionFrames(p)).toBe(0);
  expect(serialize(parseProject(originalText))).toBe(serialize(before));
});
it.each(['locked', 'group', 'size', 'evidence', 'generator'] as const)(
  'legacy repair skips incompatible %s instead of inventing a junction',
  (kind) => {
    const p = parseProject(originalText),
      pat = p.patterns[0];
    if (kind === 'locked') pat.sourceGeometry.forEach((g) => (g.locked = true));
    if (kind === 'group') pat.symmetry.group = 'p4';
    if (kind === 'size') pat.symmetry.width = 61;
    if (kind === 'evidence') pat.sourceGeometry = pat.sourceGeometry.filter((g) => !g.fillRegion);
    if (kind === 'generator') pat.generator.kind = 'grid';
    const before = structuredClone(p);
    expect(repairLegacyJunctionFrames(p)).toBe(0);
    expect(p).toEqual(before);
  },
);
it('explicit test1 recovery rebuilds unique closed faces with changed boundary subdivision and added lines', () => {
  const p = parseProject(originalText);
  repairLegacyJunctionFrames(p);
  for (const pat of p.patterns)
    for (let i = 0; i < pat.sourceGeometry.length; i++) {
      const g = pat.sourceGeometry[i];
      if (!g.fillRegion) continue;
      pat.sourceGeometry[i] = recalculateRegion(p, g.id, g.fillRegion.captureMatrix, {
        allowBoundaryEvolution: true,
      });
    }
  for (const fill of p.patterns[0].sourceGeometry.filter((g) => g.fillRegion)) {
    expect(fill.fillRegion!.status).toBe('linked');
    const path = paperPath(fill);
    expect(Math.abs((path as paper.CompoundPath).area)).toBeGreaterThan(100);
    path.remove();
    expect(refreshLinkedFills(p).get(fill.id)!.fillRegion!.status).toBe('linked');
  }
  expect(parseProject(serialize(p))).toEqual(p);
});
it('corrected test1 resizes60→61→60 without separating actual copies or changing its canonical controls', () => {
  const p = parseProject(correctedText),
    before = structuredClone(p),
    pat = p.patterns[0];
  for (const width of [61, 60]) {
    patchSymmetryFrame(p, pat.id, { width });
    expect(Math.max(...actualGaps(p))).toBeLessThan(1e-7);
    expect(pat.sourceGeometry.filter((g) => !g.fillRegion)).toEqual(
      before.patterns[0].sourceGeometry.filter((g) => !g.fillRegion),
    );
    for (const g of pat.sourceGeometry.filter((g) => g.fillRegion))
      expect(refreshLinkedFills(p).get(g.id)!.fillRegion!.status).toBe('linked');
    expect(parseProject(serialize(p))).toEqual(p);
  }
  expect(
    pat.placementTransform.every(
      (n, i) => Math.abs(n - before.patterns[0].placementTransform[i]) < 1e-12,
    ),
  ).toBe(true);
});
