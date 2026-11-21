import { geometry, node, type Geometry } from '../app/model';
function path(
  name: string,
  points: [number, number, number?, number?, number?, number?][],
  fill: string,
  stroke = '#173b40',
  width = 0.45,
  closed = true,
): Geometry {
  const g = geometry(
    'path',
    points.map(([x, y, ix = 0, iy = 0, ox = 0, oy = 0]) => ({
      ...node(x, y),
      in: { x: ix, y: iy },
      out: { x: ox, y: oy },
    })),
    closed,
  );
  return { ...g, name, fill, stroke, strokeWidth: width };
}
function eye(x: number, y: number, size: number, fill: string, name: string): Geometry {
  const g = geometry('ellipse', [], true);
  return {
    ...g,
    name,
    fill,
    stroke: 'none',
    parameters: { x, y, width: size, height: size, radius: 0, sides: 4 },
  };
}
/** Original Bézier drawings authored for this project; no traced Escher coordinates/assets. */
export function fishMotif(): Geometry[] {
  return [
    path(
      'Pez · silueta editable',
      [
        [-17, -3, 2, -2, -4, -1],
        [-27, -11, 0, 0, 1, 5],
        [-23, 0, -1, -4, -1, 4],
        [-27, 11, 1, -5, 0, 0],
        [-17, 3, -4, 1, 3, 5],
        [-6, 10, -5, -1, 5, 3],
        [9, 8, -5, 3, 5, -2],
        [20, 0, -3, 3, -3, -3],
        [9, -8, 5, 2, -5, -3],
        [-6, -10, 5, -3, -5, 1],
      ],
      '#c78039',
    ),
    path(
      'Aleta dorsal',
      [
        [-11, -8],
        [-4, -15],
        [4, -10, 0, 0, -5, -1],
      ],
      '#e5c59a',
      '#173b40',
      0.35,
    ),
    path(
      'Aleta ventral',
      [
        [-6, 8],
        [1, 14],
        [7, 8],
      ],
      '#e5c59a',
      '#173b40',
      0.35,
    ),
    eye(9, -4, 4, '#f8f0db', 'Ojo · blanco'),
    eye(10.6, -3, 1.65, '#173b40', 'Ojo · pupila'),
    eye(10.8, -3, 0.5, '#ffffff', 'Ojo · luz'),
    path(
      'Branquia',
      [
        [4, -6, 0, 0, 5, 2],
        [4, 6, 5, -2],
      ],
      'none',
      '#f4dfbb',
      0.7,
      false,
    ),
    path(
      'Escama 1',
      [
        [-2, -5, 0, 0, -5, 3],
        [-2, 5, -5, -3],
      ],
      'none',
      '#e8bd84',
      0.5,
      false,
    ),
    path(
      'Escama 2',
      [
        [-8, -4, 0, 0, -4, 2],
        [-8, 4, -4, -2],
      ],
      'none',
      '#e8bd84',
      0.5,
      false,
    ),
    path(
      'Cola · radios',
      [
        [-24, -7],
        [-18, 0],
        [-24, 7],
      ],
      'none',
      '#efd6ae',
      0.55,
      false,
    ),
  ];
}
export function birdMotif(): Geometry[] {
  return [
    path(
      'Ave · silueta editable',
      [
        [21, -4, 0, 0, -2, -1],
        [15, -7, 3, -1, -3, 0],
        [8, -4, 2, -2, -3, -3],
        [0, -16, 1, 4, -3, 4],
        [-9, -5, 3, -2, -6, -1],
        [-27, -12, 5, 4, 4, 5],
        [-17, 0, -3, -4, -3, 5],
        [-27, 14, 3, -5, 5, -1],
        [-10, 7, -5, 2, 4, 1],
        [-5, 20, -1, -4, 5, -5],
        [7, 4, -2, 6, 5, -2],
        [17, 1, -4, 1, 2, -1],
        [25, -2],
      ],
      '#356a70',
    ),
    path(
      'Ala · luz',
      [
        [-20, -7],
        [-8, -2, 0, 0, 5, 0],
        [4, 1, -4, 0],
      ],
      'none',
      '#cbd9c5',
      0.8,
      false,
    ),
    path(
      'Pluma interior',
      [
        [-3, -10],
        [-1, -2],
        [3, 2],
      ],
      'none',
      '#a2bdb6',
      0.6,
      false,
    ),
    path(
      'Pluma inferior',
      [
        [-5, 13],
        [-1, 5],
        [3, 3],
      ],
      'none',
      '#a2bdb6',
      0.6,
      false,
    ),
    eye(14, -4, 2.5, '#f8efd8', 'Ojo · blanco'),
    eye(15, -3.5, 1.1, '#173b40', 'Ojo · pupila'),
    path(
      'Pico',
      [
        [21, -4],
        [25, -2],
        [20, -1],
      ],
      '#c29348',
      '#173b40',
      0.25,
    ),
  ];
}
