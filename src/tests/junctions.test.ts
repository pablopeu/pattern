import { describe, it, expect } from 'vitest';
import { geometry, newProject, node } from '../app/model';
import { IDENTITY, apply, multiply, rotate, scale, translate } from '../geometry/matrix';
import { joinNodes, enforceJunctions, junctionIssue, detachNode } from '../editor/junctions';
import { parseProject, serialize } from '../persistence/schema';
import { parsePreset } from '../persistence/presets';
import { insertCurveNode } from '../editor/curve-edit';
import { cubic } from '../geometry/paths';

describe('uniones persistentes de extremos', () => {
  it('insertar nodo conserva la curva completa y los vínculos de sus extremos', () => {
    const g = geometry('path', [node(1, 2), node(12, 5)]);
    g.nodes[0].out = { x: 5, y: -7 };
    g.nodes[1].in = { x: -6, y: 9 };
    g.nodes[0].junction = { id: 'anchor', instance: IDENTITY };
    const before = structuredClone(g.nodes),
      point = (nodes: typeof g.nodes, t: number) =>
        cubic(
          nodes[0],
          { x: nodes[0].x + nodes[0].out.x, y: nodes[0].y + nodes[0].out.y },
          { x: nodes[1].x + nodes[1].in.x, y: nodes[1].y + nodes[1].in.y },
          nodes[1],
          t,
        ),
      split = 0.37;
    insertCurveNode(g, 0, split);
    for (let i = 0; i <= 100; i++) {
      const t = i / 100,
        p = point(before, t),
        q =
          t <= split
            ? point(g.nodes.slice(0, 2), t / split)
            : point(g.nodes.slice(1), (t - split) / (1 - split));
      expect(p.x).toBeCloseTo(q.x, 10);
      expect(p.y).toBeCloseTo(q.y, 10);
    }
    expect(g.nodes[0].junction?.id).toBe('anchor');
    expect(g.nodes[1].junction).toBeUndefined();
  });
  it('unir sucesivamente ambos extremos de una Bézier no suelta el primero; JSON, undo y transformaciones conservan la unión', () => {
    const p = newProject(),
      a = geometry('path', [node(0, 0), node(10, 0)]),
      b = geometry('path', [node(0, 10), node(10, 10)]),
      c = geometry('path', [node(0, 0), node(0, 10)]);
    c.nodes[0].out = { x: 4, y: 2 };
    c.nodes[1].in = { x: -3, y: 1 };
    const objects = (p.patterns[0].sourceGeometry = [a, b, c]);
    joinNodes(
      objects,
      { id: c.id, index: 0, instance: IDENTITY },
      { id: a.id, index: 0, instance: IDENTITY },
    );
    joinNodes(
      objects,
      { id: c.id, index: 1, instance: IDENTITY },
      { id: b.id, index: 0, instance: IDENTITY },
    );
    expect(c.nodes[0].junction?.id).toBe(a.nodes[0].junction?.id);
    expect(c.nodes[1].junction?.id).toBe(b.nodes[0].junction?.id);
    const saved = serialize(p),
      old = structuredClone(objects);
    c.nodes[1].x = 3;
    c.nodes[1].y = 14;
    enforceJunctions(objects, old);
    expect(b.nodes[0]).toMatchObject({ x: 3, y: 14 });
    expect(a.nodes[0]).toMatchObject({ x: 0, y: 0 });
    expect(c.nodes[0].out).toEqual({ x: 4, y: 2 });
    expect(junctionIssue(objects)).toBeNull();
    expect(parseProject(serialize(p))).toEqual(p);
    const restored = parseProject(saved).patterns[0].sourceGeometry,
      previous = structuredClone(restored);
    restored[0].transform = translate(7, -2);
    enforceJunctions(restored, previous);
    expect(restored[2].nodes[0]).toMatchObject({ x: 7, y: -2 });
    expect(restored[2].nodes[1]).toMatchObject({ x: 0, y: 10 });
    expect(junctionIssue(restored)).toBeNull();
  });
  it('uniones entre copias reflejadas/rotadas y grupos fusionados mantienen sus marcos', () => {
    const a = geometry('path', [node(1, 2), node(8, 7)]),
      b = geometry('path', [node(7, 3), node(4, 1)]),
      c = geometry('path', [node(-2, 4), node(3, 2)]),
      d = geometry('path', [node(9, -4), node(5, 5)]),
      objects = [a, b, c, d],
      left = multiply(translate(20, 10), rotate(33)),
      right = multiply(rotate(-20), scale(-1, 1));
    a.transform = scale(2, 1);
    joinNodes(
      objects,
      { id: a.id, index: 1, instance: left },
      { id: b.id, index: 0, instance: right },
    );
    joinNodes(
      objects,
      { id: c.id, index: 0, instance: IDENTITY },
      { id: d.id, index: 1, instance: IDENTITY },
    );
    joinNodes(
      objects,
      { id: c.id, index: 0, instance: IDENTITY },
      { id: a.id, index: 1, instance: left },
    );
    expect(junctionIssue(objects)).toBeNull();
    expect(
      new Set([a.nodes[1], b.nodes[0], c.nodes[0], d.nodes[1]].map((n) => n.junction!.id)).size,
    ).toBe(1);
    const old = structuredClone(objects);
    b.nodes[0].x += 8;
    enforceJunctions(objects, old);
    expect(junctionIssue(objects)).toBeNull();
    const x = apply(multiply(left, a.transform), a.nodes[1]),
      y = apply(right, b.nodes[0]);
    expect(x.x).toBeCloseTo(y.x, 8);
    expect(x.y).toBeCloseTo(y.y, 8);
    detachNode(objects, a.id, 1);
    const before = structuredClone(objects);
    b.nodes[0].x += 2;
    enforceJunctions(objects, before);
    expect(a.nodes[1].x).toBe(before[0].nodes[1].x);
  });
  it('rechaza marcos singulares y uniones incoherentes, presets no comparten IDs con el original', () => {
    const p = newProject(),
      a = geometry('path', [node(0, 0), node(3, 0)]),
      b = geometry('path', [node(0, 0), node(0, 3)]);
    p.patterns[0].sourceGeometry = [a, b];
    joinNodes(
      [a, b],
      { id: a.id, index: 0, instance: IDENTITY },
      { id: b.id, index: 0, instance: IDENTITY },
    );
    const preset = parsePreset(JSON.stringify({ presetVersion: 6, pattern: p.patterns[0] }));
    expect(preset.sourceGeometry[0].nodes[0].junction!.id).not.toBe(a.nodes[0].junction!.id);
    expect(junctionIssue(preset.sourceGeometry)).toBeNull();
    a.nodes[0].x = 1;
    expect(() => parseProject(serialize(p))).toThrow(/Unión/);
    a.nodes[0].x = 0;
    a.nodes[0].junction!.instance = [0, 0, 0, 0, 0, 0];
    expect(() => parseProject(serialize(p))).toThrow(/invertible/);
  });
});
