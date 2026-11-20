import { describe, it, expect } from 'vitest';
import { newProject, geometry, node } from '../app/model';
import {
  defaultDrawingStyle,
  hexColor,
  mixedStyle,
  profile,
  profileWidth,
  styleIssue,
} from '../app/styles';
import { parseProject, serialize } from '../persistence/schema';
import { dashIntervals, strokeRegion } from '../geometry/stroke-outline';
import { svgPath, previewSVGPath, prepareExport } from '../export/svg';
import { exportDXF } from '../export/dxf';
import { paperPath, scope } from '../geometry/paper';
import { scale } from '../geometry/matrix';
import { clipGeometry } from '../application/clipping';

const line = () => ({
  ...geometry('path', [node(0, 0), node(40, 0)]),
  strokeWidth: 4,
  strokeCap: 'butt' as const,
});
function inside(g: ReturnType<typeof geometry>, x: number, y: number) {
  const p = paperPath(g);
  try {
    return p.contains(new scope.Point(x, y));
  } finally {
    p.remove();
  }
}
describe('v2.2 · estilos y persistencia', () => {
  it('HEX corto, largo y alfa sin aceptar longitudes ambiguas', () => {
    expect(hexColor('#aB3')).toEqual({ color: '#aabb33', alpha: 1 });
    expect(hexColor('11223380')).toEqual({ color: '#112233', alpha: 128 / 255 });
    expect(hexColor('#abcd')?.alpha).toBe(221 / 255);
    expect(hexColor('#12345')).toBeNull();
  });
  it('mezcla identifica atributos distintos sin alterar el estilo vigente', () => {
    const a = line(),
      b = { ...line(), fill: '#ff0000', strokeWidth: 2 },
      current = defaultDrawingStyle();
    const m = mixedStyle([a, b], current);
    expect([...m.mixed].sort()).toEqual(['fill', 'strokeWidth']);
    expect(current.strokeWidth).toBe(0.65);
    expect(mixedStyle([], current).mixed.size).toBe(0);
  });
  it('guarda estilo vigente, presets por valor, paletas y atributos por objeto', () => {
    const p = newProject();
    p.drawingStyle = {
      ...defaultDrawingStyle(),
      stroke: '#123456',
      strokeDash: [4, 2],
      strokeDashOffset: -2,
      strokeProfile: profile('taper-both'),
    };
    p.stylePresets = [{ id: 'style1', name: 'Tinta', style: structuredClone(p.drawingStyle) }];
    p.palette = { colors: ['#123456'], recent: ['#ffffff'], favorites: ['#000000'] };
    p.patterns[0].sourceGeometry = [{ ...line(), ...p.drawingStyle }];
    expect(parseProject(serialize(p))).toEqual(p);
    p.drawingStyle.stroke = '#abcdef';
    expect(p.stylePresets[0].style.stroke).toBe('#123456');
  });
  it('migra v3 y snapshots conservando geometría y convirtiendo alfa', () => {
    const p = newProject(),
      g = line();
    g.stroke = '#11223380';
    g.strokeOpacity = 0.5;
    p.patterns[0].sourceGeometry = [g];
    const old = JSON.parse(serialize(p));
    old.schemaVersion = 3;
    delete old.drawingStyle;
    delete old.stylePresets;
    delete old.palette;
    old.applications = [
      {
        id: 'app',
        name: 'Aplicación',
        showOutline: false,
        patternId: p.patterns[0].id,
        regionId: 'region',
        linked: false,
        frozenPattern: { ...structuredClone(p.patterns[0]), symmetryMode: 'own' },
        placementTransform: [1, 0, 0, 1, 0, 0],
        cropMode: 'clip',
      },
    ];
    old.regions = [
      {
        id: 'region',
        name: 'R',
        geometry: [
          {
            ...geometry('rectangle'),
            parameters: { x: 0, y: 0, width: 60, height: 60, radius: 0, sides: 4 },
            closed: true,
          },
        ],
      },
    ];
    const restored = parseProject(JSON.stringify(old));
    expect(restored.schemaVersion).toBe(5);
    expect(restored.patterns[0].sourceGeometry[0]).toMatchObject({
      id: g.id,
      nodes: g.nodes,
      stroke: '#112233',
      strokeOpacity: (0.5 * 128) / 255,
      strokeDash: [],
    });
    expect(restored.applications[0].frozenPattern?.sourceGeometry[0].stroke).toBe('#112233');
  });
  it('rechaza secuencias y perfiles degenerados', () => {
    const s = defaultDrawingStyle();
    expect(styleIssue({ ...s, strokeDash: [0, 0] })).toBeTruthy();
    expect(styleIssue({ ...s, strokeDash: [-1, 3] })).toBeTruthy();
    expect(
      styleIssue({
        ...s,
        strokeProfile: {
          version: 1,
          kind: 'custom',
          points: [
            { at: 0, width: 1 },
            { at: 0, width: 2 },
            { at: 1, width: 1 },
          ],
        },
      }),
    ).toBeTruthy();
    expect(() =>
      parseProject(JSON.stringify({ ...newProject(), drawingStyle: { ...s, strokeDash: [0, 0] } })),
    ).toThrow();
  });
});
describe('v2.2 · contornos derivados', () => {
  it('dash impar duplica período y normaliza fase negativa', () => {
    expect(dashIntervals(12, [3, 2], 0)).toEqual([
      [0, 3],
      [5, 8],
      [10, 12],
    ]);
    expect(dashIntervals(8, [3, 2], -2)).toEqual([
      [2, 5],
      [7, 8],
    ]);
    expect(dashIntervals(12, [3], 0)).toEqual([
      [0, 3],
      [6, 9],
    ]);
  });
  it('guiones reales en contorno y SVG sin mutar eje ni estilo', () => {
    const g = { ...line(), strokeDash: [4, 4] },
      saved = structuredClone(g),
      out = strokeRegion(g);
    expect(inside(out, 2, 0)).toBe(true);
    expect(inside(out, 6, 0)).toBe(false);
    expect(inside(out, 10, 0)).toBe(true);
    expect(svgPath(g)).toContain('stroke-dasharray="4 4"');
    expect(g).toEqual(saved);
  });
  it('perfil suave sin sobrepasar anchos de sus controles', () => {
    const p = profile('taper-both');
    for (let i = 0; i <= 1000; i++) expect(profileWidth(p, i / 1000)).toBeGreaterThanOrEqual(0);
    expect(profileWidth(p, 0)).toBe(0);
    expect(profileWidth(p, 1)).toBe(0);
    expect(profileWidth(p, 0.5)).toBeCloseTo(1);
  });
  it('ancho variable, transformación anisótropa y DXF conservan tinta derivada', () => {
    const g = { ...line(), strokeWidth: 8, strokeProfile: profile('taper-start') },
      out = strokeRegion(g);
    expect(inside(out, 0.1, 3)).toBe(false);
    expect(inside(out, 30, 3)).toBe(true);
    expect(inside(out, 30, 5)).toBe(false);
    const transformed = strokeRegion({ ...g, transform: scale(2, 0.5) });
    expect(inside(transformed, 60, 1.5)).toBe(true);
    expect(inside(transformed, 60, 2.5)).toBe(false);
    expect(svgPath(g)).toContain('fill="#233b2d" stroke="none"');
    expect(exportDXF([g])).toContain('LWPOLYLINE');
    expect(g.nodes).toHaveLength(2);
  });
  it('guiones recortados conservan fase anterior al recorte', () => {
    const g = { ...line(), strokeDash: [4, 4] },
      mask = {
        id: 'mask',
        name: 'M',
        geometry: [
          {
            ...geometry('rectangle'),
            closed: true,
            parameters: { x: 3, y: -5, width: 10, height: 10, radius: 0, sides: 4 },
          },
        ],
      };
    const result = clipGeometry(g, mask, undefined, false, 0.005);
    expect(result).toHaveLength(1);
    expect(inside(result[0], 3.5, 0)).toBe(true);
    expect(inside(result[0], 6, 0)).toBe(false);
    expect(inside(result[0], 10, 0)).toBe(true);
  });
  it('resuelve curva, inflexiones y autointersección como regiones vectoriales', () => {
    const g = geometry('compound');
    g.pathData = 'M0 0C20 35 20 -35 40 0C20 35 20 -35 0 0';
    g.strokeWidth = 4;
    g.strokeProfile = profile('taper-both');
    const out = strokeRegion(g, undefined, 0.01),
      p = paperPath(out);
    expect(p.pathData.length).toBeGreaterThan(100);
    expect(Math.abs((p as paper.CompoundPath).area)).toBeGreaterThan(20);
    p.remove();
  });
});

it('un contorno demasiado denso deja preview corregible y export falla explícitamente', () => {
  const g = { ...line(), strokeDash: [0.001, 0.001], strokeProfile: profile('taper-start') },
    before = structuredClone(g);
  expect(() => svgPath(g)).toThrow(/2048/);
  expect(previewSVGPath(g)).toContain('data-stroke-error=');
  expect(previewSVGPath(g)).toContain('Eje provisional en naranja');
  expect(g).toEqual(before);
  const second = { ...g, id: 'otro-eje' };
  expect(previewSVGPath(second)).toContain('data-stroke-error-shape="otro-eje"');
  const p = newProject();
  p.patterns[0].sourceGeometry = [g];
  expect(() =>
    prepareExport(p, {
      target: 'view',
      format: 'svg',
      representation: 'editable',
      width: 100,
      height: 100,
      dpi: 100,
      background: '#ffffff',
      transparent: true,
      quality: 1,
      tolerance: 0.02,
      outlineStrokes: true,
      patternId: p.patterns[0].id,
    }),
  ).toThrow(/2048/);
  expect(previewSVGPath({ ...g, strokeDash: [] })).not.toContain('data-stroke-error');
});
it('el presupuesto total de vértices limita patrones puntuales complejos antes de Clipper', () => {
  const g = {
    ...geometry('path', [node(0, 0), node(1000, 0)]),
    strokeWidth: 1000,
    strokeDash: [0, 1],
    strokeProfile: profile('custom'),
  };
  expect(() => strokeRegion(g, undefined, 0.02)).toThrow(/presupuesto/);
  expect(() => strokeRegion(line(), undefined, 0)).toThrow(/positiva/);
});
