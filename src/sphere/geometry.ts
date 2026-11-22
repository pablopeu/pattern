/**
 * Teselaciones esféricas geométricas (PRD v3.0 §11.2.A).
 *
 * Los cinco sólidos platónicos se definen con coordenadas exactas y se proyectan
 * a la esfera unitaria. Las caras se obtienen por dualidad: para cada dirección
 * de cara (vértice del sólido dual) se toman los vértices base más cercanos y se
 * ordenan alrededor del eje. La subdivisión geodésica proyecta cada nuevo vértice
 * a la esfera; sólo las caras del nivel 0 de tetraedro/octaedro/icosaedro son
 * equiláteras, así que el resultado nunca se rotula «regular» sin medirlo.
 */

export type SolidKind = 'tetra' | 'cube' | 'octa' | 'dodeca' | 'icosa';

export interface SolidFace {
  /** Vértices (unitarios) en orden, con normal hacia afuera. */
  vertices: [number, number, number][];
  /** Índice de la cara base original (0..faces-1), estable ante subdivisiones. */
  face: number;
}

const PHI = (1 + Math.sqrt(5)) / 2;

function normalize(v: [number, number, number]): [number, number, number] {
  const n = Math.hypot(v[0], v[1], v[2]);
  if (!(n > 0) || !Number.isFinite(n)) throw Error('Vértice esférico inválido.');
  return [v[0] / n, v[1] / n, v[2] / n];
}

function cross(a: [number, number, number], b: [number, number, number]) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] as [
    number,
    number,
    number,
  ];
}
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

interface Solid {
  vertices: [number, number, number][];
  /** Direcciones de cara (vértices del dual) y cuántos vértices base la forman. */
  faceDirections: [number, number, number][];
  faceSize: number;
}

const cubeCorners = (): [number, number, number][] => {
  const out: [number, number, number][] = [];
  for (const x of [-1, 1])
    for (const y of [-1, 1]) for (const z of [-1, 1]) out.push([x, y, z]);
  return out;
};
const octaVertices = (): [number, number, number][] => [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const dodecaVertices = (): [number, number, number][] => {
  const out: [number, number, number][] = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) out.push([a, b, c]);
  for (const a of [-1, 1])
    for (const b of [-1, 1]) out.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [a * PHI, 0, b / PHI]);
  return out;
};
const icosaVertices = (): [number, number, number][] => {
  const out: [number, number, number][] = [];
  for (const a of [-1, 1])
    for (const b of [-1, 1]) out.push([0, a, b * PHI], [a, b * PHI, 0], [a * PHI, 0, b]);
  return out;
};

function solid(kind: SolidKind): Solid {
  switch (kind) {
    case 'tetra': {
      const vertices: [number, number, number][] = [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
      ];
      // El tetraedro es autodual: las caras miran hacia los vértices opuestos.
      return { vertices, faceDirections: vertices.map((v) => [-v[0], -v[1], -v[2]]), faceSize: 3 };
    }
    case 'cube':
      return { vertices: cubeCorners(), faceDirections: octaVertices(), faceSize: 4 };
    case 'octa':
      return { vertices: octaVertices(), faceDirections: cubeCorners(), faceSize: 3 };
    case 'dodeca':
      return { vertices: dodecaVertices(), faceDirections: icosaVertices(), faceSize: 5 };
    case 'icosa':
      return { vertices: icosaVertices(), faceDirections: dodecaVertices(), faceSize: 3 };
  }
}

/** Arma las caras base con planos de soporte sobre los propios vértices.
 * No asume la dualidad entre listas de coordenadas: cada plano que deja a
 * todos los vértices de un mismo lado es una cara; los vértices sobre el plano
 * se ordenan alrededor de su normal y la normal se orienta hacia afuera. */
export function baseFaces(kind: SolidKind): SolidFace[] {
  const unit = solid(kind).vertices.map(normalize),
    eps = 1e-9,
    planes: { n: [number, number, number]; d: number; verts: [number, number, number][] }[] = [];
  const seen = (n: [number, number, number], d: number) =>
    planes.some((p) => Math.abs(p.d - d) < 1e-6 && Math.abs(dot(p.n, n) - 1) < 1e-6);
  for (let i = 0; i < unit.length; i++)
    for (let j = i + 1; j < unit.length; j++)
      for (let k = j + 1; k < unit.length; k++) {
        const a = unit[i],
          b = unit[j],
          c = unit[k],
          raw = cross(
            [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as [number, number, number],
            [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as [number, number, number],
          ),
          len = Math.hypot(...raw);
        if (len < 1e-9) continue;
        let n = normalize([raw[0] / len, raw[1] / len, raw[2] / len] as [number, number, number]),
          value = dot(n, a);
        let side = unit.map((v) => dot(n, v) - value);
        // La orientación de la tripleta puede ser entrante: se voltea el plano.
        if (Math.max(...side) > eps) {
          if (Math.min(...side) < -eps) continue;
          n = [-n[0], -n[1], -n[2]];
          value = -value;
          side = side.map((s) => -s);
        }
        if (seen(n, value)) continue;
        const verts = unit.filter((v) => Math.abs(dot(n, v) - value) < 1e-6);
        if (verts.length < 3) continue;
        planes.push({ n, d: value, verts });
      }
  // Orden determinístico de planos (por normal redondeada).
  planes.sort(
    (p, q) =>
      Math.round(p.n[0] * 1e6) - Math.round(q.n[0] * 1e6) ||
      Math.round(p.n[1] * 1e6) - Math.round(q.n[1] * 1e6) ||
      Math.round(p.n[2] * 1e6) - Math.round(q.n[2] * 1e6) ||
      p.d - q.d,
  );
  return planes.map((plane, face) => {
    const n = plane.n,
      helper: [number, number, number] = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0],
      e1 = normalize(cross(n, helper) as [number, number, number]),
      e2 = cross(n, e1),
      ordered = [...plane.verts].sort(
        (a, b) => Math.atan2(dot(a, e2), dot(a, e1)) - Math.atan2(dot(b, e2), dot(b, e1)),
      );
    return { vertices: ordered, face };
  });
}

const mid = (
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] => normalize([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);

/**
 * Subdivisión geodésica: cada nivel cuadruplica las caras y proyecta los puntos
 * medios a la esfera. Determinística y acotada (niveles 0–4).
 */
export function geodesicFaces(kind: SolidKind, level: number): SolidFace[] {
  if (!Number.isInteger(level) || level < 0 || level > 4)
    throw Error('El nivel geodésico debe ser entero entre 0 y 4.');
  if (level === 0) return baseFaces(kind);
  let faces: SolidFace[] = baseFaces(kind).flatMap((poly) =>
    Array.from({ length: poly.vertices.length - 2 }, (_, i) => ({
      vertices: [poly.vertices[0], poly.vertices[i + 1], poly.vertices[i + 2]],
      face: poly.face,
    })),
  );
  for (let l = 1; l < level; l++) {
    const next: SolidFace[] = [];
    for (const f of faces) {
      const [a, b, c] = f.vertices,
        ab = mid(a, b),
        bc = mid(b, c),
        ca = mid(c, a);
      next.push(
        { vertices: [a, ab, ca], face: f.face },
        { vertices: [ab, b, bc], face: f.face },
        { vertices: [bc, c, ca], face: f.face },
        { vertices: [ab, bc, ca], face: f.face },
      );
    }
    if (next.length > 20000) throw Error('La subdivisión esférica excede el presupuesto.');
    faces = next;
  }
  return faces;
}

/** Normal unitaria de la cara (orientada hacia afuera). */
export function faceNormal(vertices: [number, number, number][]): [number, number, number] {
  const [a, b, c] = vertices;
  const n = normalize(
    cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]) as [
      number,
      number,
      number,
    ],
  );
  const centroid = normalize([
    (a[0] + b[0] + c[0]) / 3,
    (a[1] + b[1] + c[1]) / 3,
    (a[2] + b[2] + c[2]) / 3,
  ]);
  return dot(n, centroid) >= 0 ? n : [-n[0], -n[1], -n[2]];
}

/** Color por cara base original (estable bajo subdivisión). */
export function faceColorIndex(face: SolidFace, paletteSize: number): number {
  return paletteSize > 0 ? face.face % paletteSize : 0;
}

export const solids: { kind: SolidKind; label: string; name: string }[] = [
  { kind: 'tetra', label: 'Tetraedro', name: '4 caras triangulares' },
  { kind: 'cube', label: 'Cubo', name: '6 caras cuadradas' },
  { kind: 'octa', label: 'Octaedro', name: '8 caras triangulares' },
  { kind: 'dodeca', label: 'Dodecaedro', name: '12 caras pentagonales' },
  { kind: 'icosa', label: 'Icosaedro', name: '20 caras triangulares' },
];
