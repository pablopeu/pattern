import { describe, it, expect } from 'vitest';
import { geometry, node, newProject, uid } from '../app/model';
import { clipGeometry, strokeRegion, geometryBounds } from '../application/clipping';
import { paperPath, scope, booleanGeometry } from '../geometry/paper';
import { prepareExport, type ExportOptions } from '../export/svg';
import { exportDXF } from '../export/dxf';
import { scale } from '../geometry/matrix';
const rect = (x: number, y: number, w: number, h: number) => {
  const g = geometry('rectangle', [], true);
  g.parameters = { x, y, width: w, height: h, radius: 0, sides: 4 };
  g.fill = '#223344';
  g.stroke = 'none';
  return g;
};
const options: ExportOptions = {
  target: 'view',
  format: 'svg',
  representation: 'expanded',
  width: 100,
  height: 100,
  dpi: 150,
  background: '#ffffff',
  transparent: true,
  quality: 0.9,
  tolerance: 0.01,
  outlineStrokes: true,
  patternId: '',
};
describe('Recorte vectorial exacto', () => {
  it('respeta exterior y agujero incluso en la geometría expandida', () => {
    const outer = rect(0, 0, 100, 100),
      inner = rect(25, 25, 50, 50),
      region = {
        id: 'region',
        name: 'Agujero',
        geometry: [booleanGeometry([outer, inner], 'difference')],
      };
    const result = clipGeometry(rect(-50, -50, 200, 200), region);
    expect(result).toHaveLength(1);
    const path = paperPath(result[0]);
    expect(path.contains(new scope.Point(10, 10))).toBe(true);
    expect(path.contains(new scope.Point(50, 50))).toBe(false);
    expect(path.contains(new scope.Point(150, 50))).toBe(false);
    expect((path as paper.CompoundPath).area).toBeCloseTo(7500, 6);
    path.remove();
  });
  it('recorta una Bézier abierta como curva, no como un área cerrada', () => {
    const line = geometry('path', [node(-10, 50), { ...node(110, 50), in: { x: -40, y: 30 } }]);
    line.strokeWidth = 1;
    const out = clipGeometry(line, { id: 'r', name: 'r', geometry: [rect(0, 0, 100, 100)] });
    expect(out.length).toBe(1);
    const bounds = geometryBounds(out);
    expect(bounds.x).toBeCloseTo(0, 6);
    expect(bounds.width).toBeCloseTo(100, 6);
    expect(out[0].pathData).toContain('c');
  });
  it('la conversión de trazos conserva escalas no uniformes', () => {
    const line = geometry('path', [node(0, 0), node(10, 0)]);
    line.strokeWidth = 2;
    line.transform = scale(2, 3);
    const out = strokeRegion(line);
    const b = geometryBounds([out]);
    expect(b.x).toBeCloseTo(-2, 1);
    expect(b.y).toBeCloseTo(-3, 1);
    expect(b.width).toBeCloseTo(24, 1);
    expect(b.height).toBeCloseTo(6, 1);
  });
  it('SVG expandido de celda sólo incluye geometría dentro de su frontera', () => {
    const p = newProject();
    p.patterns[0].symmetry.angle = 90;
    p.patterns[0].symmetry.width = 60;
    p.patterns[0].symmetry.height = 60;
    p.patterns[0].sourceGeometry = [rect(55, 10, 20, 20)];
    const result = prepareExport(p, { ...options, target: 'tile', patternId: p.patterns[0].id });
    expect(result.svg).not.toContain('clipPath');
    expect(result.svg).not.toContain('<use');
    for (const g of result.geometries) {
      const b = geometryBounds([g]);
      expect(b.x).toBeGreaterThanOrEqual(-1e-6);
      expect(b.x + b.width).toBeLessThanOrEqual(60 + 1e-6);
    }
    expect(result.geometries.length).toBeGreaterThan(1);
  });
  it('red oblicua: rechaza baldosa rectangular; celda de red expandida sin máscaras', () => {
    const p = newProject();
    p.patterns[0].symmetry.angle = 70;
    p.patterns[0].sourceGeometry = [rect(0, 0, 35, 35)];
    expect(() =>
      prepareExport(p, { ...options, target: 'tile', patternId: p.patterns[0].id }),
    ).toThrow(/rectangular/);
    const out = prepareExport(p, { ...options, target: 'lattice', patternId: p.patterns[0].id });
    expect(out.svg).not.toContain('clipPath');
    expect(out.geometries.length).toBeGreaterThan(0);
  });
  it('aplicaciones congeladas conservan su fuente y el DXF su escala', () => {
    const p = newProject(),
      g = rect(0, 0, 100, 50);
    p.patterns[0].sourceGeometry = [g];
    p.patterns[0].symmetry.angle = 90;
    p.patterns[0].symmetry.width = 200;
    p.patterns[0].symmetry.height = 200;
    const region = { id: uid(), name: 'R', geometry: [rect(0, 0, 100, 50)] };
    p.regions.push(region);
    const app = {
      id: uid(),
      name: 'A',
      patternId: p.patterns[0].id,
      regionId: region.id,
      placementTransform: [1, 0, 0, 1, 0, 0] as const,
      linked: false,
      frozenPattern: structuredClone(p.patterns[0]),
      showOutline: false,
    };
    p.applications.push(app);
    p.patterns[0].sourceGeometry = [];
    const out = prepareExport(p, {
      ...options,
      target: 'application',
      patternId: p.patterns[0].id,
      applicationId: app.id,
    });
    expect(out.svg).toContain('width="100mm" height="50mm"');
    expect(out.geometries.length).toBeGreaterThan(0);
    const dxf = exportDXF([g], 0.01);
    expect(dxf).toContain('$INSUNITS\n70\n4');
    expect(dxf).toContain('10\n100\n20\n-50');
  });
});

it('contornos de trazo: extremos butt/square y uniones bevel reales', () => {
  const line = geometry('path', [node(0, 0), node(10, 0), node(10, 10)]);
  line.strokeWidth = 2;
  line.strokeCap = 'butt';
  line.strokeJoin = 'bevel';
  let path = paperPath(strokeRegion(line));
  expect(path.contains(new scope.Point(10.6, -0.6))).toBe(false);
  expect(path.contains(new scope.Point(10.2, -0.2))).toBe(true);
  expect(path.contains(new scope.Point(-0.5, 0))).toBe(false);
  path.remove();
  line.strokeCap = 'square';
  path = paperPath(strokeRegion(line));
  expect(path.contains(new scope.Point(-0.5, 0))).toBe(true);
  path.remove();
});

it('las regiones submilimétricas conservan dimensiones físicas sin mínimos artificiales', () => {
  const g = rect(0, 0, 0.2, 0.3),
    b = geometryBounds([g]);
  expect(b.width).toBeCloseTo(0.2, 10);
  expect(b.height).toBeCloseTo(0.3, 10);
});

it('un perímetro autointersectado con área de paridad válida se admite', async () => {
  const { hasClosedGeometry } = await import('../application/clipping');
  const g = geometry('path', [node(0, 0), node(20, 20), node(0, 20), node(20, 0)], true);
  expect(hasClosedGeometry(g)).toBe(true);
});

it('regiones: une componentes y respeta fill-rule nonzero sin inventar agujeros', async () => {
  const { regionPath } = await import('../application/clipping');
  let r = regionPath({
    id: 'r',
    name: 'r',
    geometry: [rect(0, 0, 100, 100), rect(25, 25, 50, 50)],
  });
  expect(r.contains(new scope.Point(50, 50))).toBe(true);
  r.remove();
  const g = geometry('compound', [], true);
  g.pathData = 'M0 0h100v100h-100ZM25 25h50v50h-50Z';
  g.fillRule = 'nonzero';
  r = regionPath({ id: 'r', name: 'r', geometry: [g] });
  expect(r.contains(new scope.Point(50, 50))).toBe(true);
  r.remove();
  g.fillRule = 'evenodd';
  r = regionPath({ id: 'r', name: 'r', geometry: [g] });
  expect(r.contains(new scope.Point(50, 50))).toBe(false);
  r.remove();
});
