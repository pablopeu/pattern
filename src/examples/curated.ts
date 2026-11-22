import { geometry, node, type Project } from '../app/model';
import { scale, multiply, rotate } from '../geometry/matrix';
import { functionalFish, functionalGeometryProject, escherReferences } from './functional-geometry';
import { figurativeProject } from './figurative';
import { aperiodicExamples } from './aperiodic';
import { girihExamples } from './girih';
import { chamberProject } from './chambers';
import { defaultArtisticVisualization } from '../visualization/model';
import { defaultComposition } from '../composition/model';
import { example } from '../app/examples';
import type { CatalogExample } from './archive';
import { referenceExamplesAll } from './reference-works';
function finish(p: Project, id: string, title: string, category: string, description: string) {
  p.metadata.name = title;
  p.patterns[0].name = title;
  p.metadata.example = {
    ...(p.metadata.example ?? {
      construction: 'Estudio editable',
      validity: 'ARTISTIC',
      artwork: 'original',
      author: 'Pattern Studio',
      references: [],
    }),
    id,
    category,
    description,
  };
  p.preferences = {
    ...p.preferences,
    grid: false,
    guides: false,
    structureVisible: false,
    split: false,
    background: '#faf6e9',
  };
  return p;
}
const palettes = [
  ['#315d67', '#b77d56', '#e2cda4', '#739080'],
  ['#7d482f', '#cb986b', '#ead7af', '#426c66'],
  ['#31574d', '#789c70', '#d9ca8c', '#a9583f'],
];
function figure(id: 'fish' | 'bird' | 'reptile' | 'abstract') {
  const p = figurativeProject(id),
    t = p.patterns[0].tiling!;
  t.width = 48;
  t.colors = {
    enabled: true,
    palette: [...palettes[id === 'bird' ? 0 : id === 'reptile' ? 1 : 2]],
  };
  for (const edge of t.edges)
    for (let i = 1; i < edge.length - 1; i++) {
      edge[i].y *= 0.72;
      edge[i].in.y *= 0.72;
      edge[i].out.y *= 0.72;
    }
  for (const g of p.patterns[0].sourceGeometry)
    if (g.fillRegion?.kind === 'tile') g.fill = t.colors.palette[0];
    else if (!g.fillRegion) g.strokeWidth *= 0.75;
  return p;
}
function aperiodic(index: number) {
  const p = aperiodicExamples[index].create(),
    g = p.patterns[0].generator;
  g.frequency = index ? 3 : 5;
  g.radius = 100;
  g.rotation = index === 1 ? 12 : 0;
  if (g.aperiodic) {
    g.aperiodic.palette = [...palettes[index - 1]];
    g.aperiodic.colorBy = index === 1 ? 'type' : 'generation';
    g.aperiodic.showHierarchy = false;
  }
  if (index)
    p.patterns[0].sourceGeometry = [
      {
        ...geometry('compound', [], false),
        pathData:
          index === 1
            ? 'M5 -5C8 -10 13 -8 15 -4M7 -6L9 -4M10 -6L12 -3'
            : 'M9 7C11 3 14 3 16 7M10 7C12 10 14 10 16 7',
        stroke: '#f4e7c8',
        fill: 'none',
        strokeWidth: 0.65,
      },
    ];
  return p;
}
function girih(index: number) {
  const p = girihExamples[index].create(),
    g = p.patterns[0].generator;
  g.spacing = index ? 22 : 30;
  g.rotation = index ? 18 : 0;
  g.rows = 4;
  g.columns = 6;
  g.girih!.palette = [...palettes[index]];
  g.girih!.bandWidth = 1.5;
  g.girih!.gap = 0.25;
  g.girih!.phase = 1;
  p.patterns[0].sourceGeometry = [
    {
      ...geometry('path', [node(-2, 0), node(0, -4), node(2, 0), node(0, 4)], true),
      fill: '#e7c68b',
      stroke: '#315d67',
      strokeWidth: 0.35,
    },
  ];
  return p;
}
function disk(pn: number, qn: number) {
  const p = chamberProject(),
    v = p.visualization!;
  if (v.kind !== 'poincare') throw Error('Expected disk');
  p.metadata.example!.construction = `{${pn},${qn}} · cámaras reflejadas C0 · fuente editable`;
  v.settings.p = pn;
  v.settings.q = qn;
  v.settings.depth = 2;
  v.settings.maxCells = 16;
  v.settings.toleranceMm = 0.04;
  const [field, curve] = p.patterns[0].sourceGeometry;
  field.fill = pn === 7 ? '#315d67' : '#9c583c';
  field.pathData = 'M-30 -30H30V30H-30Z M-6 -6H6V6H-6Z';
  curve.stroke = '#f1ddad';
  curve.strokeWidth = 1.6;
  curve.nodes[0].out = { x: 36, y: -18 };
  curve.nodes[1].in = { x: -36, y: 18 };
  return p;
}
function radial() {
  const p = figure('bird'),
    pat = p.patterns[0],
    v = defaultArtisticVisualization(p, pat.id);
  v.source.selection = { target: 'view', bounds: { x: -50, y: -50, width: 100, height: 100 } };
  v.settings.compression = 3;
  v.settings.maxCurves = 24000;
  p.visualization = v;
  p.metadata.example!.validity = 'ARTISTIC';
  p.metadata.example!.construction = 'Deformación radial artística · mosaico IH44';
  return p;
}
function spiral() {
  const p = functionalGeometryProject(),
    c = defaultComposition('spiral', { x: 0, y: 0, width: 1, height: 1 });
  if (c.kind !== 'spiral') throw Error('Expected spiral');
  c.recipe = 'rosette';
  c.count = 12;
  c.arms = 6;
  c.ratio = 0.94;
  c.angle = 30;
  c.colorByLevel = true;
  c.palette = [...palettes[0]];
  p.patterns[0].composition = c;
  p.metadata.example!.validity = 'ARTISTIC';
  p.metadata.example!.construction = 'Roseta finita de semejanzas · sin certificar encastre';
  return p;
}
function cutting() {
  const p = example(6),
    pat = p.patterns[0];
  pat.sourceGeometry = functionalFish();
  pat.placementTransform = scale(40);
  pat.generator.kind = 'motif';
  pat.generator.placements = [0, -90, -180, -270].map((angle) =>
    multiply(rotate(angle, { x: 0.5, y: 0.5 }), [-0.5, -0.5, -0.5, 0.5, 1, 0]),
  );
  pat.symmetry = {
    ...pat.symmetry,
    family: 'wallpaper',
    group: 'p1',
    width: 40,
    height: 40,
    angle: 90,
  };
  p.metadata.example = {
    id: 'gallery-cutting',
    category: 'Aplicaciones',
    description: '',
    construction: 'Perímetro físico · patrón vinculado editable',
    validity: 'EXACT',
    artwork: 'licensed',
    author: 'mapio · datos del pez; aplicación Pattern Studio',
    references: escherReferences,
  };
  return p;
}
const definitions: [string, string, string, string, () => Project][] = [
  [
    'v3-escher-square',
    'Peces · Límite cuadrado de geometría funcional',
    'Recursivas',
    'Reconstrucción de referencia:412 instancias de una fuente editable, con profundidad y tamaño ajustables.',
    functionalGeometryProject,
  ],
  [
    'gallery-fish',
    'Peces de jade · IH43',
    'Figurativas',
    'Siluetas emparejadas, paleta de jade y detalles editables; celda sin huecos.',
    () => figure('fish'),
  ],
  [
    'gallery-bird',
    'Aves azules · IH44',
    'Figurativas',
    'Aves en una red de giros con colores por clase y bordes compartidos.',
    () => figure('bird'),
  ],
  [
    'gallery-reptile',
    'Reptiles de terracota · IH1',
    'Figurativas',
    'Mosaico de reptiles, perfiles emparejados y paleta de tierra.',
    () => figure('reptile'),
  ],
  [
    'gallery-abstract',
    'Flores de cuatro giros · IH63',
    'Figurativas',
    'Tesela marcada con cuatro giros interiores y paleta de hojas; encastre continuo.',
    () => figure('abstract'),
  ],
  [
    'gallery-penrose',
    'Penrose · Sol y sombra',
    'Aperiódicas',
    'Sustitución de dos triángulos en un parche más detallado, sin celda periódica.',
    () => aperiodic(0),
  ],
  [
    'gallery-hat',
    'Hat · Mosaico de hojas',
    'Aperiódicas',
    'Sustitución Hat con trazos vegetales originales y colores por tipo.',
    () => aperiodic(1),
  ],
  [
    'gallery-spectre',
    'Spectre · Jardín quiral',
    'Aperiódicas',
    'Spectre curvo de una sola mano, pétalos interiores y colores por generación.',
    () => aperiodic(2),
  ],
  [
    'gallery-girih-rosette',
    'Girih · Estrellas de cobre',
    'Girih',
    'Estrella central, bandas anchas y entrecruzado con alternancia global.',
    () => girih(0),
  ],
  [
    'gallery-girih-grid',
    'Girih · Tejido de rombos',
    'Girih',
    'Red oblicua de rombos con bandas que atraviesan bordes y adornos editables.',
    () => girih(1),
  ],
  [
    'gallery-poincare-seven',
    'Poincaré · Rosetas enlazadas {7,3}',
    'Poincaré',
    'Cámaras reflejadas con bordes compartidos y curvas de luz. Fuente plana editable.',
    () => disk(7, 3),
  ],
  [
    'gallery-poincare-five',
    'Poincaré · Teselas florales {5,4}',
    'Poincaré',
    'Adaptación por cámaras con encastre C0 y paleta de arcilla. La tangente puede cambiar.',
    () => disk(5, 4),
  ],
  [
    'gallery-artistic',
    'Disco radial · Campo de aves',
    'Discos artísticos',
    'Mosaico figurativo comprimido radialmente; composición artística derivada.',
    radial,
  ],
  [
    'gallery-spiral',
    'Peces · Roseta autosimilar',
    'Espirales',
    'Ensayo artístico de giros y semejanzas; espacios intencionales, sin certificar teselación.',
    spiral,
  ],
  [
    'gallery-cutting',
    'Plantilla de corte · Peces vinculados',
    'Aplicaciones',
    'Patrón vectorial dentro de un perímetro físico; permite editar fuente y exportar el corte.',
    cutting,
  ],
];
export const curatedCatalog: CatalogExample[] = [
  ...definitions.map(([id, title, category, description, factory]) => {
    const create = () => finish(factory(), id, title, category, description),
      p = create();
    return {
      ...p.metadata.example!,
      title,
      featured: true,
      thumbnail: `${import.meta.env.BASE_URL}examples/${id}.png`,
      create,
    };
  }),
  ...referenceExamplesAll,
];
