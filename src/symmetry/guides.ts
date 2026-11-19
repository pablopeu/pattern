import type { Pattern, Symmetry } from '../app/model';
import { apply, inverse, multiply, IDENTITY, type Point, type Matrix } from '../geometry/matrix';
import { cosets, lattice, key, canonical, type Periodicity } from './groups';
export interface Axis {
  origin: Point;
  direction: Point;
  glide: boolean;
}
export interface SymmetryGuides {
  axes: Axis[];
  centers: { point: Point; order: number }[];
}
export function symmetryGuides(s: Symmetry): SymmetryGuides {
  const axes: Axis[] = [],
    centers: { point: Point; order: number }[] = [];
  for (const m of cosets(s).slice(1)) {
    const det = m[0] * m[3] - m[1] * m[2];
    if (det < 0) {
      let direction: Point =
        Math.abs(m[2]) > 1e-7
          ? { x: m[2], y: 1 - m[0] }
          : Math.abs(m[0] - 1) < 1e-7
            ? { x: 1, y: 0 }
            : { x: 0, y: 1 };
      const len = Math.hypot(direction.x, direction.y);
      direction = { x: direction.x / len, y: direction.y / len };
      const normal = { x: -direction.y, y: direction.x },
        shift = (normal.x * m[4] + normal.y * m[5]) / 2;
      axes.push({
        origin: { x: normal.x * shift, y: normal.y * shift },
        direction,
        glide: Math.abs(direction.x * m[4] + direction.y * m[5]) > 1e-7,
      });
    } else {
      const fixed: Matrix = [1 - m[0], -m[1], -m[2], 1 - m[3], 0, 0];
      try {
        const point = apply(inverse(fixed), { x: m[4], y: m[5] }),
          angle = Math.acos(Math.max(-1, Math.min(1, (m[0] + m[3]) / 2))),
          order = Math.round((2 * Math.PI) / angle);
        if (!centers.some((c) => Math.hypot(c.point.x - point.x, c.point.y - point.y) < 1e-6))
          centers.push({ point, order });
      } catch {
        /* Translation has no finite rotation center. */
      }
    }
  }
  return { axes, centers };
}
export function verifyPeriodicity(pattern: Pattern): {
  status: Periodicity;
  valid: boolean;
  message: string;
} {
  if (pattern.generator.kind === 'penrose' || pattern.symmetry.family === 'radial')
    return {
      status: 'FINITE_NONPERIODIC',
      valid: false,
      message: 'Composición finita: no existen dos traslaciones de red para verificar.',
    };
  if (pattern.symmetry.family === 'none')
    return {
      status: 'FREE_NONPERIODIC',
      valid: false,
      message: 'Libre: no hay una red de traslaciones ni dominio fundamental.',
    };
  if (pattern.symmetry.family === 'frieze')
    return {
      status: 'PERIODIC_SEAMLESS',
      valid: true,
      message:
        'Traslación a verificada. Un friso es periódico en una dirección; no tiene celda bidimensional.',
    };
  const b = lattice(pattern.symmetry),
    inv = inverse(b),
    ops = cosets(pattern.symmetry),
    fractional = ops.map((m) => canonical(multiply(inv, multiply(m, b)))),
    keys = new Set(fractional.map(key));
  for (const m of fractional) {
    for (let i = 0; i < 4; i++)
      if (Math.abs(m[i] - Math.round(m[i])) > 1e-7)
        return {
          status: 'UNVERIFIED',
          valid: false,
          message: 'Una transformación no preserva los vectores de red.',
        };
    for (const n of fractional)
      if (!keys.has(key(multiply(m, n))))
        return {
          status: 'UNVERIFIED',
          valid: false,
          message: 'Las transformaciones no cierran sobre esta red.',
        };
  }
  if (!keys.has(key(IDENTITY)))
    return { status: 'UNVERIFIED', valid: false, message: 'El grupo no contiene la identidad.' };
  return {
    status: 'PERIODIC_SEAMLESS',
    valid: true,
    message: `Traslaciones a y b verificadas · ${ops.length} operaciones compatibles. La geometría que cruza un borde continúa en la celda vecina.`,
  };
}
