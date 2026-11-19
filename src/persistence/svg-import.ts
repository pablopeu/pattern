import { geometry, node, uid, type Geometry } from '../app/model';
import { geometrySchema } from './schema';
import { scope } from '../geometry/paper';
import { multiply, type Matrix } from '../geometry/matrix';
export interface ImportedSVG {
  geometry: Geometry[];
  warnings: string[];
  widthMM: number;
}
const allowed = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'defs',
  'use',
  'title',
  'desc',
]);
const allowedAttributes = new Set([
  'id',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'height',
  'viewBox',
  'preserveAspectRatio',
  'd',
  'points',
  'cx',
  'cy',
  'rx',
  'ry',
  'r',
  'transform',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'fill-rule',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'href',
  'xlink:href',
  'xmlns',
  'xmlns:xlink',
]);
function physicalLength(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^\s*([\d.]+)\s*(mm|cm|in|pt|pc)\s*$/);
  if (!match) return null;
  return (
    Number(match[1]) * ({ mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6 }[match[2]] ?? 1)
  );
}
export function sanitizeSVG(text: string): { root: SVGSVGElement; warnings: string[] } {
  if (text.length > 8_000_000) throw Error('El SVG supera 8 MB. Simplificá la geometría.');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg')
    throw Error('El archivo no es un SVG válido.');
  if (doc.querySelector('svg svg'))
    throw Error(
      'No se admiten SVG anidados. Convertí esos elementos a grupos y paths antes de importar.',
    );
  const warnings: string[] = [];
  const elements = [...doc.querySelectorAll('*')];
  if (elements.length > 50000) throw Error('El SVG contiene demasiados elementos.');
  for (const el of elements) {
    let depth = 0,
      parent = el.parentElement;
    while (parent) {
      if (++depth > 50) throw Error('El SVG tiene más de 50 niveles de anidación.');
      parent = parent.parentElement;
    }
  }
  for (const element of [...doc.querySelectorAll('*')]) {
    if (!allowed.has(element.localName)) {
      warnings.push(`Elemento no compatible eliminado: ${element.localName}`);
      element.remove();
      continue;
    }
    for (const attr of [...element.attributes]) {
      if (attr.name === 'style') {
        for (const declaration of attr.value.split(';')) {
          const [key, ...rest] = declaration.split(':');
          const value = rest.join(':').trim();
          if (allowedAttributes.has(key.trim()) && !/url\(|javascript:|data:/i.test(value))
            element.setAttribute(key.trim(), value);
        }
        element.removeAttribute('style');
        continue;
      }
      if (
        !allowedAttributes.has(attr.name) ||
        (/url\(|javascript:|data:|https?:|\/\//i.test(attr.value) &&
          !attr.name.startsWith('xmlns')) ||
        (['href', 'xlink:href'].includes(attr.name) && !/^#[\w.-]+$/.test(attr.value))
      ) {
        warnings.push(`Atributo no permitido eliminado: ${attr.name}`);
        element.removeAttribute(attr.name);
      }
    }
  }
  const ids = new Set([...doc.querySelectorAll('[id]')].map((e) => e.id));
  // Detect indirect cycles through referenced groups, not only use-to-use links.
  const cycleCache = new Map<Element, boolean>();
  const cycle = (element: Element, stack: Set<Element>, depth = 0): boolean => {
    if (depth > 50 || stack.has(element)) return true;
    const cached = cycleCache.get(element);
    if (cached !== undefined) return cached;
    const next = new Set(stack);
    next.add(element);
    if (element.localName === 'use') {
      const target = doc.getElementById(
        (element.getAttribute('href') || element.getAttribute('xlink:href') || '').slice(1),
      );
      if (target && cycle(target, next, depth + 1)) return true;
    }
    const result = [...element.children].some((child) => cycle(child, next, depth + 1));
    cycleCache.set(element, result);
    return result;
  };
  for (const use of [...doc.querySelectorAll('use')])
    if (cycle(use, new Set())) {
      use.remove();
      warnings.push('Referencia SVG recursiva eliminada.');
    }

  for (const use of [...doc.querySelectorAll('use')]) {
    const ref = (use.getAttribute('href') || use.getAttribute('xlink:href') || '').slice(1);
    if (!ids.has(ref) || doc.getElementById(ref)?.localName === 'use') {
      use.remove();
      warnings.push('Referencia SVG inválida o recursiva eliminada.');
    }
  }
  const costs = new Map<Element, number>();
  const cost = (el: Element): number => {
    const cached = costs.get(el);
    if (cached !== undefined) return cached;
    let n = 1;
    for (const child of el.children) {
      n += cost(child);
      if (n > 100000) break;
    }
    if (el.localName === 'use') {
      const target = doc.getElementById(
        (el.getAttribute('href') || el.getAttribute('xlink:href') || '').slice(1),
      );
      if (target) n += cost(target);
    }
    costs.set(el, n);
    return n;
  };
  if (cost(doc.documentElement) > 100000)
    throw Error('Las referencias del SVG expanden demasiados elementos. Simplificá el archivo.');
  return {
    root: doc.documentElement as unknown as SVGSVGElement,
    warnings: [...new Set(warnings)],
  };
}
export function importSVG(text: string, explicitWidthMM: number): ImportedSVG {
  const { root, warnings } = sanitizeSVG(text),
    physicalWidth = physicalLength(root.getAttribute('width'));
  const view = (root.getAttribute('viewBox') || '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = physicalWidth ?? explicitWidthMM;
  if (!physicalWidth)
    warnings.push(`Escala definida por el usuario: ${explicitWidthMM} mm de ancho.`);
  if (!Number.isFinite(width) || width <= 0)
    throw Error('Definí un ancho físico válido para importar.');
  const cssLength = (value: string | null) => {
    const mm = physicalLength(value);
    return mm === null ? Number.parseFloat(value || '100') : (mm * 96) / 25.4;
  };
  const rawWidth = cssLength(root.getAttribute('width')),
    rawHeight = cssLength(root.getAttribute('height'));
  const vb =
    view.length === 4 && view.every(Number.isFinite) && view[2] > 0 && view[3] > 0
      ? view
      : [0, 0, rawWidth, rawHeight];
  if (vb.some((x) => !Number.isFinite(x)) || vb[2] <= 0 || vb[3] <= 0)
    throw Error('El SVG tiene dimensiones o viewBox inválidos.');
  const physicalHeight = physicalLength(root.getAttribute('height'));
  const height =
    physicalHeight ??
    (root.hasAttribute('width') && root.hasAttribute('height')
      ? (width * rawHeight) / rawWidth
      : (width * vb[3]) / vb[2]);
  if (!Number.isFinite(height) || height <= 0) throw Error('El alto físico del SVG no es válido.');
  const aspect = (root.getAttribute('preserveAspectRatio') || 'xMidYMid meet')
    .replace(/^defer\s+/, '')
    .trim();
  let sx = width / vb[2],
    sy = height / vb[3],
    tx = -vb[0] * sx,
    ty = -vb[1] * sy;
  if (!aspect.startsWith('none')) {
    const factor = aspect.includes('slice') ? Math.max(sx, sy) : Math.min(sx, sy);
    const ax = aspect.includes('xMin') ? 0 : aspect.includes('xMax') ? 1 : 0.5,
      ay = aspect.includes('YMin') ? 0 : aspect.includes('YMax') ? 1 : 0.5;
    sx = sy = factor;
    tx = -vb[0] * factor + (width - vb[2] * factor) * ax;
    ty = -vb[1] * factor + (height - vb[3] * factor) * ay;
  }
  const viewport: Matrix = [sx, 0, 0, sy, tx, ty];
  // Resolve the root viewBox explicitly: Paper.js scales it nonuniformly and does not
  // implement preserveAspectRatio. Retain all child transforms as canonical matrices.
  root.removeAttribute('viewBox');
  root.setAttribute('width', String(vb[2]));
  root.setAttribute('height', String(vb[3]));
  scope.activate();
  let item: paper.Item;
  try {
    item = scope.project.importSVG(root, {
      insert: false,
      expandShapes: true,
      applyMatrix: false,
    }) as paper.Item;
  } catch {
    throw Error('El SVG contiene geometría no compatible.');
  }
  if (aspect.includes('slice'))
    warnings.push(
      'Se conserva la geometría completa: los paths que exceden el viewport SVG no se eliminan.',
    );
  const out: Geometry[] = [],
    groups = new Map<paper.Item, string>();
  const visit = (entry: paper.Item) => {
    if (entry instanceof scope.Path || entry instanceof scope.CompoundPath) {
      const path = entry as paper.PathItem;
      const g = geometry(entry instanceof scope.CompoundPath ? 'compound' : 'path', [], false);
      const global = entry.globalMatrix;
      g.transform = multiply(viewport, [
        global.a,
        global.b,
        global.c,
        global.d,
        global.tx,
        global.ty,
      ]);
      if (entry instanceof scope.Path) {
        g.nodes = entry.segments.map((s) => ({
          ...node(s.point.x, s.point.y),
          in: { x: s.handleIn.x, y: s.handleIn.y },
          out: { x: s.handleOut.x, y: s.handleOut.y },
        }));
        g.closed = entry.closed;
      } else {
        g.pathData = (
          entry as unknown as { getPathData(m: paper.Matrix, p: number): string }
        ).getPathData(new scope.Matrix(), 15);
        g.closed = entry.children.every((p) => (p as paper.Path).closed);
      }
      const color = (c: paper.Color | null) => {
        if (!c) return 'none';
        const opaque = c.clone();
        opaque.alpha = 1;
        return opaque.toCSS(true);
      };
      g.stroke = color(path.strokeColor);
      g.fill = color(path.fillColor);
      g.strokeOpacity = path.strokeColor?.alpha ?? 1;
      g.fillOpacity = path.fillColor?.alpha ?? 1;
      g.opacity = path.opacity;
      let parent = path.parent;
      while (parent) {
        g.opacity *= parent.opacity;
        if (parent.opacity < 1)
          warnings.push(
            'La opacidad de grupo se aplica por objeto; las superposiciones pueden diferir del SVG original.',
          );
        parent = parent.parent;
      }
      g.strokeWidth = path.strokeWidth ?? 1;
      g.strokeCap = path.strokeCap as Geometry['strokeCap'];
      g.strokeJoin = path.strokeJoin as Geometry['strokeJoin'];
      g.miterLimit = path.miterLimit;
      if (!g.stroke.startsWith('#') && g.stroke !== 'none') g.stroke = '#233b2d';
      if (!g.fill.startsWith('#') && g.fill !== 'none') g.fill = '#233b2d';
      g.fillRule = path.fillRule as 'evenodd' | 'nonzero';
      g.name = entry.name || 'SVG importado';
      if (entry.parent && entry.parent !== item) {
        if (!groups.has(entry.parent)) groups.set(entry.parent, uid());
        g.groupId = groups.get(entry.parent);
      }
      if (Math.abs(g.transform[0] * g.transform[3] - g.transform[1] * g.transform[2]) < 1e-8)
        throw Error('El SVG contiene una transformación no invertible.');
      if (!geometrySchema.safeParse(g).success)
        throw Error('El SVG contiene coordenadas o estilos inválidos.');
      out.push(g);
    } else entry.children?.forEach(visit);
  };
  try {
    visit(item);
  } finally {
    item.remove();
  }
  if (out.length > 10000)
    throw Error('El SVG supera 10.000 objetos fuente. Simplificalo antes de importar.');
  if (!out.length) throw Error('No hay paths o formas vectoriales compatibles en el SVG.');
  return { geometry: out, warnings, widthMM: width };
}
