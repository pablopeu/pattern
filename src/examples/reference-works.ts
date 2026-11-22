/**
 * Estudios de referencia reconstruidos de fuentes vectoriales públicas.
 * Fuente canónica editable (trazado), repeticiones explícitas; procedencia y licencia
 * registradas en el catálogo, el botón Referencias y docs/THIRD_PARTY_NOTICES.md.
 */
import { geometry, newProject, node, type Geometry, type Node, type Project } from '../app/model';
import { newIsohedralTiling, type TilingDefinition } from '../tiling/tiles';
import { defaultSphereVisualization } from '../visualization/model';
import { createTileFill } from '../fill/service';
import { drawingStyle } from '../app/styles';
import type { CatalogExample } from './archive';

/**
 * Silueta del lagarto de M. C. Escher reconstruida por reox
 * (reox.at, obra en dominio público) a partir del trazado de Sean Michael Ragan.
 * 58 puntos del contorno, capturados del SVG publicado y normalizados al centro
 * de rotación de 120° del trío que encastra. Trazado a mano: encastre aproximado.
 */
const LIZARD: [number, number][] = [[1.4899, 21.5318],
  [5.7852, 18.818],
  [12.6645, 15.8472],
  [23.584, 18.0739],
  [12.1083, 21.2171],
  [7.5399, 26.5397],
  [6.2015, 29.7033],
  [6.2472, 32.5148],
  [13.1916, 39.4673],
  [12.8875, 43.2579],
  [20.0764, 46.2978],
  [20.7847, 36.0],
  [12.2208, 30.2377],
  [18.4478, 25.5319],
  [21.5785, 27.6905],
  [31.0718, 25.1528],
  [33.5295, 26.5189],
  [35.6, 29.2597],
  [37.9253, 35.8773],
  [34.9096, 47.3873],
  [42.2977, 39.0441],
  [43.1646, 31.6011],
  [42.962, 26.5244],
  [41.5693, 24.0],
  [36.6871, 19.3806],
  [39.7975, 15.473],
  [41.9836, 6.006],
  [48.8064, 8.7115],
  [53.5474, 8.0219],
  [53.6745, 2.3683],
  [47.6875, 2.3082],
  [41.5693, -0.0],
  [36.5112, 4.1444],
  [33.4657, 9.2993],
  [28.633, 6.3624],
  [30.4064, 1.9117],
  [36.1608, -2.6443],
  [29.0553, -9.271],
  [27.2263, -13.9185],
  [20.7847, -12.0],
  [20.8572, -5.9953],
  [24.3486, -5.2897],
  [26.5969, -2.388],
  [21.2658, -0.4782],
  [17.4544, 1.5549],
  [14.7828, -8.5349],
  [7.6288, -12.1183],
  [4.0723, -10.6481],
  [0.0, -0.0001],
  [7.1854, 8.8506],
  [6.6804, 12.6657],
  [0.0001, 17.0696],
  [-10.0737, 14.3384],
  [-10.2187, 18.6556],
  [-11.2302, 24.2274],
  [-7.5932, 23.7312],
  [-5.2364, 21.0604],
  [0.0001, 23.9999]];

const turn = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0] as const;
};
const rotateNodes = (nodes: Node[], deg: number): Node[] =>
  nodes.map((n) => {
    const [c, s, m, d] = turn(deg);
    const v = (p: { x: number; y: number }) => ({ x: c * p.x + m * p.y, y: s * p.x + d * p.y });
    return { ...v(n), in: v(n.in), out: v(n.out) };
  });

const lizardNodes = (): Node[] => LIZARD.map(([x, y]) => node(x, y));

/** Repeticiones: retícula hexagonal de 72 mm (30°/+60°) con tres orientaciones por nudo. */
function lizardPlacements(): number[][] {
  const a1 = [72 * Math.cos(Math.PI / 6), 72 * Math.sin(Math.PI / 6)] as const,
    a2 = [0, 72] as const,
    out: number[][] = [];
  for (let i = -2; i <= 2; i++)
    for (let j = -2; j <= 2; j++) out.push([1, 0, 0, 1, i * a1[0] + j * a2[0], i * a1[1] + j * a2[1]]);
  return out;
}

function lizardProject(): Project {
  const project = newProject(),
    pattern = project.patterns[0],
    base = lizardNodes(),
    palette = ['#c78046', '#7c8f57', '#5b7c8d'];
  pattern.sourceGeometry = palette.map((fill, k) => {
    const g = { ...geometry('path', rotateNodes(base, k * 120), true), fill, stroke: '#2f2a20', strokeWidth: 0.5 };
    g.name = `Lagarto · orientación ${k + 1}`;
    return g as Geometry;
  });
  pattern.generator.kind = 'freeform';
  pattern.generator.placements = lizardPlacements() as never;
  pattern.symmetry.family = 'none';
  pattern.symmetryMode = 'free';
  project.metadata.name = 'Lagartos de Escher · mosaico de referencia';
  project.metadata.example = {
    id: 'gallery-escher-lizard',
    category: 'Referencias',
    description:
      'Reconstrucción del mosaico de lagartos de Escher: tres orientaciones sobre una retícula hexagonal, fuente trazada editable.',
    construction: 'Retícula hexagonal 120° · fuente única trazada · encastre aproximado del dibujo original',
    validity: 'APPROXIMATED',
    artwork: 'licensed',
    author: 'Trazado de reox (dominio público) sobre método de S. M. Ragan · obra original de M. C. Escher',
    references: [
      {
        title: 'reox · reconstrucción del mosaico (dominio público)',
        url: 'https://www.reox.at/blog/posts/create_escher_lizard_tesselation/',
      },
      {
        title: 'Sean Michael Ragan · MC Escher lizard vector art (dominio público)',
        url: 'https://www.seanmichaelragan.com/html/%5B2008-04-18%5D_MC_Escher_lizard_vector_art.shtml',
      },
    ],
  };
  project.preferences = {
    ...project.preferences,
    grid: false,
    guides: false,
    structureVisible: false,
    snap: false,
    snapNodes: false,
    split: false,
    background: '#f5efe2',
  };
  return project;
}

/**
 * Perfiles Bézier cúbicos de Jared Forsyth (github.com/jaredly/tessellations, MIT),
 * docs/rhombus-red.path y docs/hex.path, verbatim. El encastre lo construye el motor.
 */
type EdgeNode = [number, number, number, number, number, number];
const RHOMBUS: EdgeNode[] = [
  [0, 0, 0, 0, 0.155647, 0.071279],
  [0.334917, 0.084645, -0.182417, 0.002387, 0.331398, 0.011706],
  [0.456298, -0.170078, -0.343118, -0.00737, 0.242342, -0.006208],
  [1, 0, -0.483063, 0.149101, 0, 0],
];
const HEX: EdgeNode[] = [
  [0, 0, 0, 0, 0, 0],
  [0.512518, -0.257095, -0.139033, 0.194037, 0, 0],
  [0.546827, -0.104205, 0, 0, 0, 0],
  [0.337571, 0.081242, 0, 0, 0, 0],
  [0.415586, 0.458791, 0, 0, 0, 0],
  [0.578762, 0.468468, 0, 0, 0.056174, -0.410432],
  [1, 0, 0, 0, 0, 0],
];
const curveNodes = (edge: EdgeNode[]): Node[] =>
  edge.map(([x, y, inX, inY, outX, outY]) => ({ x, y, in: { x: inX, y: inY }, out: { x: outX, y: outY } }));

const JAREDLY_REF = [
  { title: 'jaredly/tessellations · perfiles Bézier (MIT)', url: 'https://github.com/jaredly/tessellations/tree/master/docs' },
  { title: 'Licencia MIT del proyecto de origen', url: 'https://github.com/jaredly/tessellations/blob/master/LICENSE' },
];
const AUTHOR = 'Perfiles de Jared Forsyth (jaredly/tessellations, MIT) · reconstrucción Pattern Studio';

function ornamental(id: string, title: string, profile: EdgeNode[], type: number, palette: string[], background: string): Project {
  const project = newProject(),
    pattern = project.patterns[0],
    tiling: TilingDefinition = newIsohedralTiling(type);
  tiling.width = 72;
  tiling.showOutline = false;
  tiling.version = 2;
  tiling.colors = { enabled: true, palette };
  const edge = curveNodes(profile);
  tiling.edges = tiling.edges.map(() => edge);
  pattern.tiling = tiling;
  pattern.name = title;
  pattern.generator.kind = 'tessellation';
  pattern.symmetry.family = 'none';
  const body = createTileFill(
    project,
    pattern,
    { kind: 'tile', key: 'tile', patternId: pattern.id, pathData: '', matrix: [1, 0, 0, 1, 0, 0], z: 0 },
    drawingStyle({ fill: palette[0] }),
  );
  body.stroke = '#3a3427';
  body.strokeWidth = 0.5;
  body.name = 'Silueta de tesela';
  pattern.sourceGeometry = [body];
  project.metadata.name = title;
  project.metadata.example = {
    id,
    category: 'Ornamentales',
    description:
      'Teselación de encastre por curvas Bézier cúbicas. La arista es la fuente editable: mover un nodo rehace el mosaico exacto.',
    construction: `IH${type} · perfil Bézier de referencia · encastre verificado`,
    validity: 'EXACT',
    artwork: 'licensed',
    author: AUTHOR,
    references: JAREDLY_REF,
  };
  project.preferences = {
    ...project.preferences,
    grid: false,
    guides: false,
    structureVisible: false,
    snap: false,
    split: false,
    background,
  };
  return project;
}

export const referenceExamples: CatalogExample[] = [
  {
    id: 'gallery-escher-lizard',
    category: 'Referencias',
    description:
      'Reconstrucción del mosaico de lagartos de Escher: tres orientaciones sobre una retícula hexagonal, fuente trazada editable.',
    construction: 'Retícula hexagonal 120° · fuente única trazada · encastre aproximado del dibujo original',
    validity: 'APPROXIMATED',
    artwork: 'licensed',
    author: 'Trazado de reox (dominio público) sobre método de S. M. Ragan · obra original de M. C. Escher',
    references: [
      {
        title: 'reox · reconstrucción del mosaico (dominio público)',
        url: 'https://www.reox.at/blog/posts/create_escher_lizard_tesselation/',
      },
      {
        title: 'Sean Michael Ragan · MC Escher lizard vector art (dominio público)',
        url: 'https://www.seanmichaelragan.com/html/%5B2008-04-18%5D_MC_Escher_lizard_vector_art.shtml',
      },
    ],
    title: 'Lagartos de Escher · mosaico de referencia',
    featured: true,
    create: lizardProject,
  },
  {
    id: 'gallery-curve-square',
    category: 'Ornamentales',
    description:
      'Teselación de encastre por curvas Bézier cúbicas. La arista es la fuente editable: mover un nodo rehace el mosaico exacto.',
    construction: 'IH1 · perfil Bézier de referencia · encastre verificado',
    validity: 'EXACT',
    artwork: 'licensed',
    author: AUTHOR,
    references: JAREDLY_REF,
    title: 'Encaje Bézier · rombo',
    featured: true,
    create: () => ornamental('gallery-curve-square', 'Encaje Bézier · rombo', RHOMBUS, 1, ['#d99a6c', '#a8b58c', '#7a93a8', '#c9b98f'], '#f5efe2'),
  },
  {
    id: 'gallery-curve-hex',
    category: 'Ornamentales',
    description:
      'Panel hexagonal de encastre Bézier: tres orientaciones y una curvatura que encaja sin huecos.',
    construction: 'IH7 · perfil Bézier de referencia · encastre verificado',
    validity: 'EXACT',
    artwork: 'licensed',
    author: AUTHOR,
    references: JAREDLY_REF,
    title: 'Panel Bézier · hexágono',
    featured: true,
    create: () => ornamental('gallery-curve-hex', 'Panel Bézier · hexágono', HEX, 7, ['#2f4858', '#86bbd8', '#f6ae2d'], '#fbfbf7'),
  },
];

/** Ejemplo esférico: la familia nueva debe poder descubrirse desde la galería. */
function sphereProject(): Project {
  const project = newProject(),
    pattern = project.patterns[0];
  pattern.name = 'Esfera geodésica · icosaedro';
  pattern.sourceGeometry = [
    {
      ...geometry('path', [
        node(0, 0),
        node(30, 6),
        node(14, 30),
        node(4, 18),
      ], true),
      name: 'Pétalo fuente',
      fill: '#71978c',
      stroke: '#253f45',
      strokeWidth: 0.6,
    },
  ];
  pattern.generator.kind = 'grid';
  pattern.generator.rows = 4;
  pattern.generator.columns = 4;
  pattern.generator.spacing = 32;
  pattern.symmetry.family = 'none';
  const visualization = defaultSphereVisualization(project, pattern.id);
  visualization.settings = {
    ...visualization.settings,
    solid: 'icosa',
    level: 2,
    palette: ['#71978c', '#c78046', '#ab6652', '#253f45', '#c5ccaf', '#e3c792'],
    background: '#f7f3e8',
    view: { yaw: 22, pitch: -14, zoom: 1, spin: 1 },
  };
  project.visualization = visualization;
  project.metadata.name = 'Esfera geodésica · icosaedro';
  project.metadata.example = {
    id: 'gallery-sphere-icosa',
    category: 'Esféricas',
    description:
      'Icosaedro subdividido geodésicamente y proyectado sobre la esfera, con paleta por cara; la fuente plana sigue editable.',
    construction: 'Sólido platónico · subdivisión geodésica nivel 2 · vista derivada',
    validity: 'EXACT',
    artwork: 'original',
    author: 'Pattern Studio',
    references: [
      {
        title: 'Isohedral Tiles, Tilings and Notations · clasificación',
        url: 'https://isohedral.ca/isohedral-tiles-tilings-and-notations/',
      },
    ],
  };
  project.preferences = {
    ...project.preferences,
    grid: false,
    guides: false,
    structureVisible: false,
    snap: false,
    split: false,
    background: '#f7f3e8',
  };
  return project;
}

export const referenceExamplesAll: CatalogExample[] = [
  ...referenceExamples,
  {
    id: 'gallery-sphere-icosa',
    category: 'Esféricas',
    description:
      'Icosaedro subdividido geodésicamente y proyectado sobre la esfera, con paleta por cara; la fuente plana sigue editable.',
    construction: 'Sólido platónico · subdivisión geodésica nivel 2 · vista derivada',
    validity: 'EXACT',
    artwork: 'original',
    author: 'Pattern Studio',
    references: [
      {
        title: 'Isohedral Tiles, Tilings and Notations · clasificación',
        url: 'https://isohedral.ca/isohedral-tiles-tilings-and-notations/',
      },
    ],
    title: 'Esfera geodésica · icosaedro',
    featured: true,
    create: sphereProject,
  },
];
