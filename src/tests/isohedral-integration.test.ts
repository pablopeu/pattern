import { describe, expect, it } from 'vitest';
import { geometry, newProject } from '../app/model';
import { supportedIsohedralTypes } from '../isohedral/engine';
import {
  newIsohedralTiling,
  newTiling,
  tileBoundary,
  tileEdges,
  tileInstances,
  tileBounds,
  tileFrame,
  edgePairs,
  tileArea,
  tileRectangularCell,
  tileCellBounds,
  tileCellCorners,
} from '../tiling/tiles';
import { buildScene } from '../patterns/engine';
import { parseProject, serialize } from '../persistence/schema';
import { apply, inverse } from '../geometry/matrix';
import { prepareExport, type ExportOptions } from '../export/svg';
import { createTileFill } from '../fill/service';
import { drawingStyle } from '../app/styles';

function projectFor(type: number) {
  const project = newProject(),
    p = project.patterns[0];
  p.tiling = newIsohedralTiling(type);
  const g = geometry('ellipse', [], true);
  g.parameters = { x: 0, y: 0, width: 8, height: 6, sides: 4, radius: 0 };
  g.fill = '#c78039';
  g.stroke = 'none';
  p.sourceGeometry = [g];
  return project;
}
const view = { x: -90, y: -90, width: 180, height: 180 };
describe('adaptación IH a teselas y archivos existentes', () => {
  it.each(supportedIsohedralTypes)(
    'IH%i: Scene/JSON/partes referencian las fuentes sin duplicarlas',
    (type) => {
      const project = projectFor(type),
        p = project.patterns[0],
        original = structuredClone(p.sourceGeometry),
        scene = buildScene(p, view),
        edges = tileEdges(p.tiling!);
      expect(scene.status).toBe('PERIODIC_SEAMLESS');
      expect(scene.tiling!.tiles.length).toBeGreaterThan(3);
      expect(scene.generated.geometry.map((g) => g.id)).toEqual(original.map((g) => g.id));
      expect(p.sourceGeometry).toEqual(original);
      expect(tileArea(p.tiling!)).toBeGreaterThan(0);
      const frame = tileCellBounds(p.tiling!);
      for (const point of tileCellCorners(p.tiling!)) {
        expect(point.x).toBeGreaterThanOrEqual(frame.x - 1e-7);
        expect(point.y).toBeGreaterThanOrEqual(frame.y - 1e-7);
        expect(point.x).toBeLessThanOrEqual(frame.x + frame.width + 1e-7);
        expect(point.y).toBeLessThanOrEqual(frame.y + frame.height + 1e-7);
      }
      expect(tileRectangularCell(p.tiling!)).toBeNull();
      for (const pair of edgePairs(p.tiling!)) {
        const from = edges[pair.master],
          to = edges[pair.partner];
        const point = apply(pair.matrix, from[pair.reverse ? from.length - 1 : 0]);
        expect(point.x).toBeCloseTo(to[0].x, 6);
        expect(point.y).toBeCloseTo(to[0].y, 6);
      }
      const restored = parseProject(serialize(project));
      expect(restored).toEqual(project);
      expect(restored.patterns[0].tiling!.isohedral!.type).toBe(type);
      expect(Object.keys(restored.patterns[0].tiling!.isohedral!)).not.toContain('edges');
    },
  );
  it('colocación de tesela se aplica una sola vez y conserva IDs al cambiar la vista', () => {
    const t = newIsohedralTiling(12),
      local = tileInstances(t, view);
    t.origin = { x: 17, y: -9 };
    t.rotation = 23;
    const placed = tileInstances(t, { x: -200, y: -200, width: 400, height: 400 });
    for (const item of local) {
      const found = placed.find((i) => i.id === item.id)!;
      expect(found).toBeDefined();
      const actual = apply(inverse(tileFrame(t)), apply(found.matrix, { x: 2, y: 3 })),
        expected = apply(item.matrix, { x: 2, y: 3 });
      expect(actual.x).toBeCloseTo(expected.x, 7);
      expect(actual.y).toBeCloseTo(expected.y, 7);
    }
    expect(tileBounds(t)).toEqual(tileBounds(newIsohedralTiling(12)));
  });
  it.each([1, 12, 41, 93])(
    'IH%i: Fill de tesela y SVG editable/expandido usan el mismo contorno',
    (type) => {
      const project = projectFor(type),
        p = project.patterns[0],
        source = structuredClone(p.sourceGeometry);
      p.sourceGeometry.unshift(
        createTileFill(
          project,
          p,
          {
            kind: 'tile',
            key: 'tile',
            patternId: p.id,
            pathData: '',
            matrix: [1, 0, 0, 1, 0, 0],
            z: 0,
          },
          drawingStyle({ fill: '#a85840' }),
        ),
      );
      const options: ExportOptions = {
          patternId: p.id,
          target: 'view',
          format: 'svg',
          representation: 'editable',
          width: 100,
          height: 100,
          dpi: 96,
          background: '#ffffff',
          transparent: true,
          quality: 1,
          tolerance: 0.02,
          outlineStrokes: true,
        },
        editable = prepareExport(project, options),
        expanded = prepareExport(project, { ...options, representation: 'expanded' });
      expect(editable.svg).toContain('clipPath');
      expect(editable.svg).toContain('#a85840');
      expect(expanded.svg).not.toContain('<use');
      expect(expanded.svg).not.toContain('clipPath');
      expect(expanded.geometries.some((g) => g.fill === '#a85840')).toBe(true);
      expect(p.sourceGeometry.slice(1)).toEqual(source);
      expect(tileBoundary(p.tiling!).closed).toBe(true);
    },
  );
  it('rechaza IH no implementados/definiciones ausentes y conserva las cinco familias legadas', () => {
    const project = projectFor(1);
    project.patterns[0].tiling!.isohedral!.type = 94;
    expect(() => parseProject(serialize(project))).toThrow();
    delete project.patterns[0].tiling!.isohedral;
    expect(() => parseProject(serialize(project))).toThrow();
    for (const kind of ['square', 'rectangle', 'parallelogram', 'triangle', 'hexagon'] as const) {
      project.patterns[0].tiling = newTiling(kind);
      expect(parseProject(serialize(project))).toEqual(project);
    }
  });
});
