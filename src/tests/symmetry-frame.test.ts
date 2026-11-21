import { expect, it } from 'vitest';
import { geometry, newProject, node, newPattern } from '../app/model';
import { wallpaperNames, friezeNames, cosets, lattice } from '../symmetry/groups';
import {
  IDENTITY,
  apply,
  inverse,
  multiply,
  rotate,
  scale,
  translate,
  distance,
} from '../geometry/matrix';
import { joinNodes, junctionIssue } from '../editor/junctions';
import { patchSymmetryFrame } from '../symmetry/frame';
import { resolvePattern, resolveSymmetry } from '../symmetry/config';
import { parseProject, serialize } from '../persistence/schema';
import { History } from '../editor/history';
import { buildScene } from '../patterns/engine';
import { collectFillInputs, createFaceFill, refreshLinkedFills } from '../fill/service';
import { buildArrangement, facesAt } from '../fill/planar';
const cases = [
  ...wallpaperNames.map((group) => ({ group, family: 'wallpaper' as const })),
  ...friezeNames.map((group) => ({ group, family: 'frieze' as const })),
  ...['Cn', 'Dn'].map((group) => ({ group, family: 'radial' as const })),
];
it.each(cases)(
  '$family $group: rigid frame motion keeps both Bézier joins and canonical controls intact',
  (choice) => {
    const p = newProject(),
      pat = p.patterns[0];
    p.mainSymmetry = { ...p.mainSymmetry, ...choice, sectors: 5, angle: 77, width: 60, height: 45 };
    pat.placementTransform = multiply(translate(4, -3), multiply(rotate(17), scale(1.2, 0.8)));
    const sym = p.mainSymmetry,
      ops = cosets(sym),
      P = pat.placementTransform,
      shift = sym.family === 'radial' ? { x: 0, y: 0 } : apply(lattice(sym), { x: 1, y: 0 }),
      ma = multiply(ops[0], P),
      mb = multiply(translate(shift.x, shift.y), multiply(ops.at(-1)!, P)),
      point0 = { x: 10, y: 7 },
      point1 = { x: 25, y: 7 };
    const a = geometry('path', [
      node(...(Object.values(apply(inverse(ma), point0)) as [number, number])),
      node(...(Object.values(apply(inverse(ma), point1)) as [number, number])),
    ]);
    const b = geometry('path', [
      node(...(Object.values(apply(inverse(mb), point1)) as [number, number])),
      node(...(Object.values(apply(inverse(mb), point0)) as [number, number])),
    ]);
    a.nodes[0].out = { x: 5, y: -10 };
    b.nodes[0].out = { x: -5, y: 10 };
    pat.sourceGeometry = [a, b];
    joinNodes(
      pat.sourceGeometry,
      { id: b.id, index: 0, instance: mb },
      { id: a.id, index: 1, instance: ma },
    );
    joinNodes(
      pat.sourceGeometry,
      { id: b.id, index: 1, instance: mb },
      { id: a.id, index: 0, instance: ma },
    );
    const original = structuredClone(pat.sourceGeometry),
      old = structuredClone(p),
      history = new History(old);
    const changes = patchSymmetryFrame(p, null, {
        origin: { x: 8, y: -7 },
        center: { x: 8, y: -7 },
        orientation: 23,
      }),
      delta = changes.get(pat.id)!;
    const next = resolveSymmetry(pat, p.mainSymmetry),
      newOps = cosets(next),
      newP = pat.placementTransform,
      newShift = next.family === 'radial' ? { x: 0, y: 0 } : apply(lattice(next), { x: 1, y: 0 }),
      newMa = multiply(newOps[0], newP),
      newMb = multiply(translate(newShift.x, newShift.y), multiply(newOps.at(-1)!, newP));
    for (const [i, j] of [
      [0, 1],
      [1, 0],
    ])
      expect(distance(apply(newMa, a.nodes[i]), apply(newMb, b.nodes[j]))).toBeLessThan(1e-7);
    expect(distance(apply(newMa, a.nodes[0]), apply(delta, point0))).toBeLessThan(1e-7);
    expect(pat.sourceGeometry).toEqual(original);
    expect(junctionIssue(pat.sourceGeometry)).toBeNull();
    expect(parseProject(serialize(p))).toEqual(p);
    history.commit(p);
    expect(history.undo()).toEqual(old);
    expect(history.redo()).toEqual(p);
  },
);
it('does not move independent sets or reinterpret a non-rigid grid resize', () => {
  const p = newProject();
  p.mainSymmetry.family = 'wallpaper';
  p.mainSymmetry.group = 'p3';
  const other = newPattern();
  other.symmetryMode = 'free';
  p.patterns.push(other);
  patchSymmetryFrame(p, null, { origin: { x: 9, y: 8 } });
  expect(other.placementTransform).toEqual(IDENTITY);
  const placement = structuredClone(p.patterns[0].placementTransform);
  patchSymmetryFrame(p, null, { width: 70 });
  expect(p.patterns[0].placementTransform).toEqual(placement);
});
it('transports linked fill references along with the drawing without falsely invalidating its face', () => {
  const p = newProject();
  p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p3', width: 60, angle: 60 };
  const pat = p.patterns[0];
  pat.sourceGeometry = ['M10 7C15 -3 20 -3 25 7', 'M25 7C20 17 15 17 10 7'].map((pathData) => ({
    ...geometry('compound'),
    pathData,
  }));
  const bounds = { x: -35, y: -35, width: 90, height: 90 },
    effective = resolvePattern(pat, p),
    scene = buildScene(effective, bounds),
    inputs = collectFillInputs([{ pattern: effective, scene }], bounds),
    arrangement = buildArrangement(inputs),
    face = facesAt(arrangement, { x: 17.5, y: 7 })[0];
  expect(face).toBeDefined();
  const fill = createFaceFill(p, effective, scene, face, arrangement, inputs, {
    ...p.drawingStyle,
    fill: '#3b82f6',
  });
  pat.sourceGeometry.unshift(fill);
  expect(fill.fillRegion!.linked).toBe(true);
  const source = structuredClone(pat.sourceGeometry.filter((g) => !g.fillRegion));
  patchSymmetryFrame(p, null, { origin: { x: 8, y: 9 }, orientation: 23 });
  const refreshed = refreshLinkedFills(p).get(fill.id)!;
  expect(refreshed.fillRegion!.status).toBe('linked');
  expect(refreshed.fillRegion!.linked).toBe(true);
  expect(pat.sourceGeometry.filter((g) => !g.fillRegion)).toEqual(source);
});
it('editing this set detaches an inherited symmetry without moving the shared frame or other sets', () => {
  const p = newProject();
  p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p3' };
  const other = { ...newPattern(), symmetryMode: 'inherit' as const };
  p.patterns.push(other);
  patchSymmetryFrame(p, p.patterns[0].id, { origin: { x: 9, y: 8 } });
  expect(p.patterns[0].symmetryMode).toBe('own');
  expect(p.patterns[0].symmetry.group).toBe('p3');
  expect(p.patterns[0].symmetry.origin).toEqual({ x: 9, y: 8 });
  expect(p.mainSymmetry.origin).toEqual({ x: 0, y: 0 });
  expect(other.placementTransform).toEqual(IDENTITY);
});
