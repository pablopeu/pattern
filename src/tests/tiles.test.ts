import { describe, it, expect } from 'vitest';
import {
  newTiling,
  tileBoundary,
  tileArea,
  tileInstances,
  tileEdges,
  edgePairs,
  transformNodes,
  constrainTiling,
  type TileKind,
} from '../tiling/tiles';
import { tilingIssue } from '../tiling/validate';
import { paperPath, scope } from '../geometry/paper';
import { apply } from '../geometry/matrix';
const kinds: TileKind[] = ['square', 'rectangle', 'parallelogram', 'triangle', 'hexagon'];
for (const kind of kinds)
  describe(`tesela ${kind}`, () => {
    for (const irregular of [false, true])
      it(`${irregular ? 'Bézier irregular' : 'base'}: encastre, área, cobertura y ausencia de solapamiento`, () => {
        let t = newTiling(kind);
        t.width = 40;
        t.height = 33;
        t.shear = 11;
        if (irregular) {
          for (const edge of t.edges) {
            edge[1].y = 0.025;
            edge[1].in = { x: -0.08, y: -0.012 };
            edge[1].out = { x: 0.08, y: 0.012 };
          }
          t = constrainTiling(t);
        }
        expect(tilingIssue(t)).toBeNull();
        const edges = tileEdges(t);
        for (const pair of edgePairs(t)) {
          const target = transformNodes(edges[pair.master], pair.matrix, true),
            other = edges[pair.partner];
          expect(target).toHaveLength(other.length);
          for (let i = 0; i < target.length; i++) {
            expect(target[i].x).toBeCloseTo(other[i].x, 8);
            expect(target[i].y).toBeCloseTo(other[i].y, 8);
            expect(target[i].in.x).toBeCloseTo(other[i].in.x, 8);
            expect(target[i].in.y).toBeCloseTo(other[i].in.y, 8);
            expect(target[i].out.x).toBeCloseTo(other[i].out.x, 8);
            expect(target[i].out.y).toBeCloseTo(other[i].out.y, 8);
          }
        }
        const shape = tileBoundary(t),
          path = paperPath(shape);
        expect(Math.abs((path as paper.CompoundPath).area)).toBeCloseTo(tileArea(t), 6);
        path.remove();
        const view = { x: -37.2, y: -32.1, width: 93.4, height: 87.6 },
          clip = new scope.Path.Rectangle({
            rectangle: new scope.Rectangle(view.x, view.y, view.width, view.height),
            insert: false,
          });
        let area = 0;
        try {
          for (const instance of tileInstances(t, view)) {
            const p = paperPath(shape, instance.matrix),
              cut = p.intersect(clip, { insert: false });
            area += Math.abs((cut as paper.CompoundPath).area);
            p.remove();
            cut.remove();
          }
        } finally {
          clip.remove();
        }
        expect(area).toBeCloseTo(view.width * view.height, 4);
      });
    it('origen/orientación cambian las colocaciones sin alterar el borde canónico', () => {
      const t = newTiling(kind),
        before = tileBoundary(t).nodes;
      t.origin = { x: 7, y: -9 };
      t.rotation = 27;
      expect(tileBoundary(t).nodes).toEqual(before);
      const instances = tileInstances(t, { x: -100, y: -100, width: 200, height: 200 });
      expect(instances.length).toBeGreaterThan(5);
      for (const p of instances)
        expect(Number.isFinite(apply(p.matrix, { x: 0, y: 0 }).x)).toBe(true);
    });
  });
it('no se acepta una curva arbitraria ni un vértice incompatible', () => {
  const t = newTiling();
  t.edges[0][1].y = 2;
  expect(tilingIssue(t)).toMatch(/corredor/);
  t.edges[0][1].y = 0;
  t.edges[1][0].x = 0.2;
  expect(tilingIssue(t)).toMatch(/corredor/);
});

describe('integración de teselas con persistencia y exportación', () => {
  for (const kind of kinds)
    it(`${kind}: SVG editable/expandido, DXF y contornos explícitos`, async () => {
      const { newProject, geometry } = await import('../app/model');
      const { prepareExport } = await import('../export/svg');
      const { parseProject, serialize } = await import('../persistence/schema');
      const { exportDXF } = await import('../export/dxf');
      const p = newProject(),
        pat = p.patterns[0];
      pat.tiling = newTiling(kind);
      pat.tiling.edges[0][1].y = 0.02;
      const g = geometry('rectangle', [], true);
      g.fill = '#55765b';
      g.parameters = { x: 10, y: 10, width: 8, height: 9, radius: 0, sides: 4 };
      pat.sourceGeometry = [g];
      const before = serialize(p),
        opts = {
          target: 'view' as const,
          format: 'svg' as const,
          representation: 'editable' as const,
          width: 120,
          height: 100,
          dpi: 150,
          background: '#ffffff',
          transparent: true,
          quality: 0.9,
          tolerance: 0.02,
          outlineStrokes: true,
          patternId: pat.id,
        };
      expect(parseProject(before)).toEqual(p);
      const editable = prepareExport(p, opts);
      expect(editable.svg).toContain('<clipPath');
      expect(editable.svg).not.toContain('data-tile-outline');
      expect(prepareExport(p, { ...opts, includeTileOutlines: true }).svg).toContain(
        'data-tile-outline',
      );
      const expanded = prepareExport(p, { ...opts, representation: 'expanded' });
      expect(expanded.geometries.length).toBeGreaterThan(1);
      expect(expanded.svg).not.toContain('clipPath');
      expect(expanded.svg).not.toContain('<use');
      expect(exportDXF(expanded.geometries, 0.02)).toContain('LWPOLYLINE');
      expect(serialize(p)).toBe(before);
      if (kind === 'parallelogram')
        expect(() => prepareExport(p, { ...opts, target: 'tile' })).toThrow(/rectangular/);
      else expect(prepareExport(p, { ...opts, target: 'tile' }).bounds.width).toBeGreaterThan(0);
      expect(prepareExport(p, { ...opts, target: 'lattice' }).svg).toContain('clipPath');
    });
  it('snapshots/presets conservan la tesela y rechazan bordes incompatibles', async () => {
    const { newProject, geometry } = await import('../app/model');
    const { freezePattern } = await import('../symmetry/config');
    const { parseProject, serialize } = await import('../persistence/schema');
    const { parsePreset } = await import('../persistence/presets');
    const { prepareExport } = await import('../export/svg');
    const p = newProject();
    p.patterns[0].tiling = newTiling('hexagon');
    const shape = geometry('rectangle', [], true);
    shape.parameters = { x: 10, y: 10, width: 10, height: 10, radius: 0, sides: 4 };
    shape.fill = '#334455';
    p.patterns[0].sourceGeometry = [shape];
    const region = geometry('rectangle', [], true);
    region.parameters = { x: -50, y: -50, width: 100, height: 100, radius: 0, sides: 4 };
    p.regions = [{ id: 'r', name: 'Región', geometry: [region] }];
    p.applications = [
      {
        id: 'a',
        name: 'Aplicación',
        patternId: p.patterns[0].id,
        regionId: 'r',
        linked: false,
        frozenPattern: freezePattern(p.patterns[0], p.mainSymmetry),
        placementTransform: [1, 0, 0, 1, 0, 0],
        showOutline: false,
      },
    ];
    const opts = {
        target: 'application' as const,
        format: 'svg' as const,
        representation: 'expanded' as const,
        width: 100,
        height: 100,
        dpi: 150,
        background: '#ffffff',
        transparent: true,
        quality: 0.9,
        tolerance: 0.02,
        outlineStrokes: true,
        patternId: p.patterns[0].id,
        applicationId: 'a',
      },
      first = prepareExport(p, opts).svg;
    p.patterns[0].tiling.width = 80;
    expect(prepareExport(p, opts).svg).toBe(first);
    const preset = parsePreset(
      JSON.stringify({ presetVersion: 3, pattern: freezePattern(p.patterns[0], p.mainSymmetry) }),
    );
    expect(preset.tiling).toEqual(p.patterns[0].tiling);
    p.patterns[0].tiling.edges[0][1].y = 1;
    expect(() => parseProject(serialize(p))).toThrow(/Tesela inválida/);
  });
});

it('el contorno exportado no duplica aristas compartidas', async () => {
  const { tileContours } = await import('../tiling/tiles');
  for (const kind of kinds) {
    const t = newTiling(kind);
    t.edges[0][1].y = 0.02;
    const patch = tileInstances(t, { x: -100, y: -100, width: 300, height: 300 }).filter(
      (i) => i.cell[0] >= 0 && i.cell[0] < 2 && i.cell[1] >= 0 && i.cell[1] < 2,
    );
    expect(patch.length).toBe(kind === 'triangle' ? 8 : 4);
    expect(tileContours(t, patch).length).toBe(
      kind === 'triangle' ? 16 : kind === 'hexagon' ? 19 : 12,
    );
  }
});

it('Penrose conserva su construcción finita al suspender una tesela periódica guardada', async () => {
  const { newProject } = await import('../app/model');
  const { buildScene } = await import('../patterns/engine');
  const { resolvePattern, commonRectangularCell } = await import('../symmetry/config');
  const { prepareExport } = await import('../export/svg');
  const p = newProject(),
    pat = p.patterns[0];
  pat.tiling = newTiling('hexagon');
  pat.generator.kind = 'penrose';
  pat.generator.count = 3;
  const view = { x: -60, y: -60, width: 120, height: 120 },
    scene = buildScene(resolvePattern(pat, p), view),
    old = buildScene({ ...resolvePattern(pat, p), tiling: undefined }, view);
  expect(scene.status).toBe('FINITE_NONPERIODIC');
  expect(scene.tiling).toBeUndefined();
  expect(scene.generated.geometry).toEqual(old.generated.geometry);
  expect(commonRectangularCell([resolvePattern(pat, p)])).toBeNull();
  const opts = {
    target: 'tile' as const,
    format: 'svg' as const,
    representation: 'editable' as const,
    width: 120,
    height: 120,
    dpi: 96,
    background: '#ffffff',
    transparent: true,
    quality: 0.9,
    tolerance: 0.02,
    outlineStrokes: true,
    patternId: pat.id,
  };
  expect(() => prepareExport(p, opts)).toThrow(/rectangular/);
  pat.generator.kind = 'motif';
  expect(buildScene(resolvePattern(pat, p), view).tiling).toBeDefined();
});

it('Bézier reflejada e invertida conserva la parametrización geométrica', async () => {
  const { node } = await import('../app/model');
  const source = [
      { ...node(0, 0), out: { x: 2, y: 3 } },
      { ...node(7, 2), in: { x: -1, y: 2 } },
    ],
    matrix = [-1, 0, 0, 1, 5, 4] as const,
    transformed = transformNodes(source, matrix, true);
  const point = (nodes: typeof source, t: number) => {
    const a = nodes[0],
      b = nodes[1],
      u = 1 - t;
    return {
      x:
        u * u * u * a.x +
        3 * u * u * t * (a.x + a.out.x) +
        3 * u * t * t * (b.x + b.in.x) +
        t * t * t * b.x,
      y:
        u * u * u * a.y +
        3 * u * u * t * (a.y + a.out.y) +
        3 * u * t * t * (b.y + b.in.y) +
        t * t * t * b.y,
    };
  };
  for (const t of [0.1, 0.3, 0.7, 0.9]) {
    const expected = apply(matrix, point(source, 1 - t)),
      actual = point(transformed, t);
    expect(actual.x).toBeCloseTo(expected.x, 10);
    expect(actual.y).toBeCloseTo(expected.y, 10);
  }
});
