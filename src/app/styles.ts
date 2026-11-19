import type { Geometry } from './model';
export type ProfileKind = 'uniform' | 'taper-start' | 'taper-end' | 'taper-both' | 'custom';
export interface StrokeProfile {
  version: 1;
  kind: ProfileKind;
  points: { at: number; width: number }[];
}
export interface DrawingStyle {
  stroke: string;
  fill: string;
  strokeWidth: number;
  strokeCap: 'butt' | 'round' | 'square';
  strokeJoin: 'miter' | 'round' | 'bevel';
  miterLimit: number;
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
  fillRule: 'evenodd' | 'nonzero';
  strokeDash: number[];
  strokeDashOffset: number;
  strokeProfile: StrokeProfile;
}
export interface StylePreset {
  id: string;
  name: string;
  style: DrawingStyle;
}
export interface ProjectPalette {
  colors: string[];
  recent: string[];
  favorites: string[];
}
export const styleFields = [
  'stroke',
  'fill',
  'strokeWidth',
  'strokeCap',
  'strokeJoin',
  'miterLimit',
  'opacity',
  'fillOpacity',
  'strokeOpacity',
  'fillRule',
  'strokeDash',
  'strokeDashOffset',
  'strokeProfile',
] as const;
export type StyleField = (typeof styleFields)[number];
export function profile(kind: ProfileKind = 'uniform'): StrokeProfile {
  const points =
    kind === 'taper-start'
      ? [
          { at: 0, width: 0 },
          { at: 0.3, width: 1 },
          { at: 1, width: 1 },
        ]
      : kind === 'taper-end'
        ? [
            { at: 0, width: 1 },
            { at: 0.7, width: 1 },
            { at: 1, width: 0 },
          ]
        : kind === 'taper-both'
          ? [
              { at: 0, width: 0 },
              { at: 0.3, width: 1 },
              { at: 0.7, width: 1 },
              { at: 1, width: 0 },
            ]
          : [
              { at: 0, width: 1 },
              { at: 1, width: 1 },
            ];
  return { version: 1, kind, points };
}
export function defaultDrawingStyle(): DrawingStyle {
  return {
    stroke: '#233b2d',
    fill: 'none',
    strokeWidth: 0.65,
    strokeCap: 'round',
    strokeJoin: 'round',
    miterLimit: 10,
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    fillRule: 'evenodd',
    strokeDash: [],
    strokeDashOffset: 0,
    strokeProfile: profile(),
  };
}
export function drawingStyle(g: Partial<DrawingStyle>): DrawingStyle {
  const result = defaultDrawingStyle();
  for (const k of styleFields)
    if (g[k] !== undefined) Object.assign(result, { [k]: structuredClone(g[k]) });
  return result;
}
export function mixedStyle(objects: Geometry[], current: DrawingStyle) {
  const value = drawingStyle(objects[0] ?? current),
    mixed = new Set<StyleField>();
  for (const key of styleFields)
    if (objects.some((g) => JSON.stringify(g[key]) !== JSON.stringify(objects[0][key])))
      mixed.add(key);
  return { value, mixed };
}
export function hexColor(input: string): { color: string; alpha: number } | null {
  let h = input.trim().replace(/^#/, '');
  if (!/^(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(h)) return null;
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  return {
    color: '#' + h.slice(0, 6).toLowerCase(),
    alpha: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1,
  };
}
export function styleIssue(style: DrawingStyle): string | null {
  const d = style.strokeDash;
  if (
    d.length > 64 ||
    d.some((n) => !Number.isFinite(n) || n < 0 || n > 1000) ||
    (d.length && d.reduce((a, b) => a + b, 0) < 0.001)
  )
    return 'La secuencia necesita longitudes finitas no negativas y un período mayor a 0,001 mm.';
  const repeated = d.length % 2 ? [...d, ...d] : d;
  if (d.length && repeated.every((n, i) => i % 2 === 1 || n === 0) && style.strokeCap === 'butt')
    return 'Los segmentos de longitud cero requieren extremos redondos o cuadrados.';
  if (!Number.isFinite(style.strokeDashOffset)) return 'La fase de guiones debe ser finita.';
  const p = style.strokeProfile.points;
  if (
    p.length < 2 ||
    p.length > 64 ||
    p[0].at !== 0 ||
    p.at(-1)!.at !== 1 ||
    p.some(
      (n, i) =>
        !Number.isFinite(n.at) ||
        !Number.isFinite(n.width) ||
        n.at < 0 ||
        n.at > 1 ||
        n.width < 0 ||
        n.width > 4 ||
        (i > 0 && n.at <= p[i - 1].at),
    ) ||
    p.every((n) => n.width === 0) ||
    (style.strokeProfile.kind === 'uniform' && p.some((n) => n.width !== 1))
  )
    return 'El perfil necesita puntos ordenados de 0 a 1, anchos entre 0 y 4 y algún ancho positivo.';
  return null;
}
export const linePatterns = {
  solid: [],
  dotted: [0.1, 2.5],
  dashed: [4, 2],
  dashdot: [5, 2, 0.1, 2],
  long: [10, 3],
} satisfies Record<string, number[]>;
export function linePatternName(d: number[]): string {
  return (
    Object.entries(linePatterns).find(([, a]) => JSON.stringify(a) === JSON.stringify(d))?.[0] ??
    'custom'
  );
}
/** Monotone cubic Hermite interpolation prevents negative/overshooting widths. */
export function profileWidth(p: StrokeProfile, t: number): number {
  const points = p.points;
  if (!points.length) return 1;
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < points.length - 2 && points[i + 1].at < t) i++;
  const slopes = points.slice(1).map((b, k) => (b.width - points[k].width) / (b.at - points[k].at)),
    tangent = (k: number) => {
      if (k === 0) return slopes[0];
      if (k === points.length - 1) return slopes.at(-1)!;
      const a = slopes[k - 1],
        b = slopes[k];
      return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
    },
    a = points[i],
    b = points[i + 1],
    h = b.at - a.at,
    u = (t - a.at) / h;
  let m0 = tangent(i),
    m1 = tangent(i + 1),
    s = slopes[i];
  if (s === 0) m0 = m1 = 0;
  else {
    const norm = Math.hypot(m0 / s, m1 / s);
    if (norm > 3) {
      m0 *= 3 / norm;
      m1 *= 3 / norm;
    }
  }
  return Math.max(
    0,
    (2 * u * u * u - 3 * u * u + 1) * a.width +
      (u * u * u - 2 * u * u + u) * h * m0 +
      (-2 * u * u * u + 3 * u * u) * b.width +
      (u * u * u - u * u) * h * m1,
  );
}
