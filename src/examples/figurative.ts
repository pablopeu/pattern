import { newProject, geometry, node, type Geometry, type Project } from '../app/model';
import { newIsohedralTiling, tileBounds } from '../tiling/tiles';
import { createTileFill } from '../fill/service';
import { drawingStyle } from '../app/styles';
import type { ExampleProvenance } from './model';

type Species = 'fish' | 'bird' | 'reptile' | 'abstract';
const profiles: {
  id: Species;
  type: number;
  title: string;
  fill: string;
  description: string;
  edges?: [number, number][][];
}[] = [
  {
    id: 'fish',
    type: 43,
    title: 'Peces encastrados · IH43',
    fill: '#c78046',
    description:
      'Peces originales con silueta encastrable, aletas, ojos, branquias y escamas independientes.',
    edges: [
      [
        [0, 0],
        [0.2, -0.12],
        [0.4, 0.03],
        [0.6, 0.1],
        [0.8, -0.05],
        [1, 0],
      ],
      [
        [0, 0],
        [0.18, -0.04],
        [0.42, -0.22],
        [0.5, -0.12],
        [0.58, -0.22],
        [0.82, -0.04],
        [1, 0],
      ],
    ],
  },
  {
    id: 'bird',
    type: 44,
    title: 'Aves entrelazadas · IH44',
    fill: '#487c78',
    description:
      'Aves originales que giran para cubrir el plano; pico, ojo y plumas se editan por separado.',
    edges: [
      [
        [0, 0],
        [0.2, -0.1],
        [0.45, 0.04],
        [0.7, -0.15],
        [1, 0],
      ],
      [
        [0, 0],
        [0.25, 0.13],
        [0.5, -0.08],
        [0.75, 0.16],
        [1, 0],
      ],
    ],
  },
  {
    id: 'reptile',
    type: 1,
    title: 'Reptiles del mosaico · IH1',
    fill: '#7c8f57',
    description:
      'Reptiles estilizados originales con ojos, lomo, escamas y dedos separados de sus bordes emparejados.',
    edges: [
      [
        [0, 0],
        [0.28, -0.02],
        [0.4, -0.16],
        [0.52, -0.22],
        [0.64, -0.08],
        [0.78, 0.02],
        [1, 0],
      ],
      [
        [0, 0],
        [0.3, 0.03],
        [0.43, -0.13],
        [0.55, -0.18],
        [0.68, 0.02],
        [1, 0],
      ],
      [
        [0, 0],
        [0.25, 0.08],
        [0.5, -0.07],
        [0.75, 0.05],
        [1, 0],
      ],
    ],
  },
  {
    id: 'abstract',
    type: 63,
    title: 'Cometas del giro · IH63',
    fill: '#203b48',
    description:
      'Ornamento original con cuatro giros interiores y dos aspectos; muestra las marcas que distinguen IH63.',
  },
];
export const figurativeExamples = profiles.map((spec) => ({
  id: `figurative-${spec.id}`,
  title: spec.title,
  category: 'Figurativas',
  description: spec.description,
  construction: `IH${spec.type} · teselación isoédrica verificada · silueta y detalles independientes`,
  validity: 'EXACT' as const,
  artwork: 'original' as const,
  author: 'Pattern Studio',
  references: [
    {
      title: 'Kaplan / Schattschneider · clasificación isoédrica',
      url: 'https://isohedral.ca/isohedral-tiles-tilings-and-notations/',
    },
    ...(spec.id === 'fish' || spec.id === 'bird'
      ? [
          {
            title: 'Museo Escher · referencia conceptual, sin calcar imágenes',
            url: 'https://www.escherinhetpaleis.nl/en/about-escher/escher-today/experimenting-fishes-birds',
          },
        ]
      : []),
  ],
  create: () => figurativeProject(spec.id),
  featured: true,
}));
const ellipse = (x: number, y: number, w: number, fill: string, name: string): Geometry => ({
  ...geometry('ellipse', [], true),
  name,
  fill,
  stroke: fill === '#fcf5df' ? '#263f37' : 'none',
  strokeWidth: 0.35,
  parameters: { x, y, width: w, height: w, sides: 4, radius: 0 },
});
const line = (d: string, name: string, stroke = '#273f37', width = 0.65): Geometry => ({
  ...geometry('compound'),
  name,
  pathData: d,
  stroke,
  strokeWidth: width,
  fill: 'none',
});
const polygon = (points: [number, number][], fill: string, name: string): Geometry => ({
  ...geometry(
    'path',
    points.map(([x, y]) => node(x, y)),
    true,
  ),
  fill,
  stroke: '#273f37',
  strokeWidth: 0.4,
  name,
});
/** Original vectors authored for this project; no Escher tracing or imported artwork. */
export function figurativeProject(id: Species): Project {
  const spec = profiles.find((s) => s.id === id)!;
  const p = newProject(),
    pat = p.patterns[0];
  p.metadata.name = spec.title;
  pat.name = spec.title;
  const meta = figurativeExamples.find((e) => e.id === `figurative-${id}`)!;
  const { create: _, featured: __, title: ___, ...provenance } = meta;
  p.metadata.example = provenance satisfies ExampleProvenance;
  pat.symmetryMode = 'free';
  pat.tiling = newIsohedralTiling(spec.type);
  pat.tiling.showOutline = false;
  const palettes: Record<Species, string[]> = {
    fish: ['#c78046', '#e3c792'],
    bird: ['#487c78', '#b5c9b0'],
    reptile: ['#7c8f57', '#cdbb79', '#9e6b55'],
    abstract: ['#203b48', '#496c75'],
  };
  pat.tiling.version = 2;
  pat.tiling.colors = { enabled: true, palette: palettes[id] };
  if (spec.edges)
    pat.tiling.edges = spec.edges.map((points) =>
      points.map(([x, y], i) => ({
        ...node(x, y),
        in: { x: i ? -(x - points[i - 1][0]) * 0.32 : 0, y: 0 },
        out: { x: i + 1 < points.length ? (points[i + 1][0] - x) * 0.32 : 0, y: 0 },
      })),
    );
  const body = createTileFill(
    p,
    pat,
    {
      kind: 'tile',
      key: 'tile',
      patternId: pat.id,
      pathData: '',
      matrix: [1, 0, 0, 1, 0, 0],
      z: 0,
    },
    drawingStyle({ fill: spec.fill }),
  );
  if (id !== 'abstract') {
    body.fillRegion!.scope = 'source';
    body.name = 'Silueta enlazada · motivo';
    body.stroke = '#273f37';
    body.strokeWidth = 0.4;
  }
  pat.sourceGeometry = [body];
  for (const n of body.nodes)
    for (const point of [n, n.in, n.out])
      for (const key of ['x', 'y'] as const) if (Object.is(point[key], -0)) point[key] = 0;
  if (id === 'fish')
    pat.sourceGeometry.push(
      polygon(
        [
          [29, 17],
          [39, 11],
          [43, 25],
          [38, 32],
        ],
        '#dcb980',
        'Aleta',
      ),
      ellipse(61, 23, 6, '#fcf5df', 'Ojo'),
      ellipse(64, 25, 2.7, '#273f37', 'Pupila'),
      line('M54 18C47 26 47 35 54 43', 'Branquia'),
      line('M20 20Q26 25 20 30M30 26Q36 31 30 36M40 32Q46 37 40 42', 'Escamas', '#f9e8c0', 0.8),
      line('M4 38L16 45M1 44L14 49', 'Cola'),
      line('M65 30L70 30', 'Boca', '#273f37', 0.5),
    );
  if (id === 'bird')
    pat.sourceGeometry.push(
      ellipse(44, -5, 5, '#fcf5df', 'Ojo'),
      ellipse(46, -3.5, 2.3, '#273f37', 'Pupila'),
      polygon(
        [
          [51, -2],
          [60, 0],
          [51, 3],
        ],
        '#dcb980',
        'Pico',
      ),
      line('M39 0C32-18 17-20 23-4C25 0 30 4 38 7', 'Plumas', '#e5ebcf', 0.8),
      line('M5-2L17-7M5 2L17 7', 'Cola'),
      line('M42 3Q41 12 34 16', 'Pecho'),
    );
  if (id === 'reptile')
    pat.sourceGeometry.push(
      ellipse(39, 23, 4, '#fcf5df', 'Ojo superior'),
      ellipse(41, 24, 1.8, '#273f37', 'Pupila superior'),
      ellipse(42, 31, 4, '#fcf5df', 'Ojo inferior'),
      ellipse(44, 32, 1.8, '#273f37', 'Pupila inferior'),
      line('M-7 30C2 22 10 40 21 28S38 28 45 30', 'Lomo', '#e7dfb4', 1.1),
      line('M4-5L7-2M7-7L9-2M10-6L11-1M30 63L33 61M33 65L35 61M36 64L37 60', 'Dedos'),
      line('M16 17Q20 20 16 23M24 34Q28 37 24 40M32 19Q35 22 32 25', 'Escamas', '#354e38', 0.4),
    );
  if (id === 'abstract') {
    const b = tileBounds(pat.tiling),
      x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    pat.sourceGeometry.push(
      polygon(
        [
          [x, y],
          [x + 20, y - 8],
          [x + 25, y],
          [x + 15, y + 6],
        ],
        '#e8bb76',
        'Cometa · cuatro giros',
      ),
      ellipse(x - 3, y - 3, 6, '#fcf5df', 'Centro'),
    );
  }
  p.preferences = {
    ...p.preferences,
    grid: false,
    guides: false,
    structureVisible: false,
    snap: false,
    snapNodes: false,
    background: '#f3eddf',
    repetitionView: 'extended',
    sourceView: false,
    split: false,
  };
  return p;
}
