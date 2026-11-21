import { describe, expect, it } from 'vitest';
import { geometry, newProject, node } from '../app/model';
import { IDENTITY, apply, multiply, rotate, scale, translate } from '../geometry/matrix';
import { nearestNode, junctionNodes } from '../editor/snap';
import { svgPath } from '../export/svg';
import { clipGeometry } from '../application/clipping';
import { parseProject, serialize } from '../persistence/schema';

describe('atracción de nodos en coordenadas visibles', () => {
  it('reconoce un vértice compartido por posiciones exactas, también tras guardar/abrir', () => {
    const p = newProject(),
      a = geometry('path', [node(0, 0), node(10, 0)]),
      b = geometry('path', [node(0, 0), node(0, 10)]);
    b.transform = translate(10, 0);
    p.patterns[0].sourceGeometry = [a, b];
    const restored = parseProject(serialize(p));
    expect(
      junctionNodes({ x: 10, y: 0 }, restored.patterns[0].sourceGeometry, [IDENTITY]).map((n) => [
        n.id,
        n.index,
      ]),
    ).toEqual([
      [a.id, 1],
      [b.id, 0],
    ]);
    expect(junctionNodes({ x: 10.01, y: 0 }, [a, b], [IDENTITY])).toHaveLength(0);
  });
  it('una Bézier abierta no pinta un cierre implícito en SVG ni en el recorte expandido', () => {
    const g = geometry('path', [node(0, 0), node(10, 0)]);
    g.nodes[0].out = { x: 0, y: 10 };
    g.nodes[1].in = { x: 0, y: 10 };
    g.fill = '#ed3040';
    g.stroke = 'none';
    const mask = geometry('path', [node(-5, -5), node(15, -5), node(15, 15), node(-5, 15)], true),
      region = { id: 'mask', name: 'Máscara', geometry: [mask] };
    expect(svgPath(g)).toContain('fill="none"');
    expect(clipGeometry(g, region)).toHaveLength(0);
    g.closed = true;
    expect(svgPath(g)).toContain('fill="#ed3040"');
    expect(clipGeometry(g, region).length).toBeGreaterThan(0);
  });
  it('elige el más cercano, excluye sólo el nodo móvil y permite cerrar su propio trazado', () => {
    const g = geometry('path', [node(0, 0), node(10, 0)]),
      h = geometry('path', [node(0.5, 0), node(20, 0)]);
    expect(nearestNode({ x: 0.4, y: 0 }, [g, h], [IDENTITY], 1)).toEqual({ x: 0.5, y: 0 });
    expect(nearestNode({ x: 0.1, y: 0 }, [g], [IDENTITY], 1, { id: g.id, index: 1 })).toEqual({
      x: 0,
      y: 0,
    });
    expect(nearestNode({ x: 10, y: 0 }, [g], [IDENTITY], 1, { id: g.id, index: 1 })).toBeNull();
    expect(nearestNode({ x: 12, y: 0 }, [g], [IDENTITY], 1)).toBeNull();
  });
  it('respeta objetos transformados y copias reflejadas/rotadas, sin atraer a objetos ocultos', () => {
    const g = geometry('path', [node(2, 3)]);
    g.transform = translate(5, -1);
    const copy = multiply(rotate(37), scale(-2, 2)),
      target = apply(multiply(copy, g.transform), g.nodes[0]);
    expect(nearestNode({ x: target.x + 0.1, y: target.y }, [g], [copy], 0.5)).toEqual(target);
    g.visible = false;
    expect(nearestNode(target, [g], [copy], 1)).toBeNull();
    g.visible = true;
    g.locked = true;
    expect(nearestNode(target, [g], [copy], 1)).toBeNull();
  });
  it('guarda el radio y abre documentos anteriores con8px sin migración destructiva', () => {
    const p = newProject();
    p.preferences.snapRadiusPx = 17;
    expect(parseProject(serialize(p)).preferences.snapRadiusPx).toBe(17);
    const old = JSON.parse(serialize(p));
    delete old.preferences.snapRadiusPx;
    expect(parseProject(JSON.stringify(old)).preferences.snapRadiusPx).toBe(8);
    old.preferences.snapRadiusPx = 41;
    expect(() => parseProject(JSON.stringify(old))).toThrow();
  });
});
