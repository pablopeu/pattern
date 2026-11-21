import { example, exampleNames } from '../app/examples';
import { newProject, type Project } from '../app/model';
import { defaultComposition, type Composition } from '../composition/model';
import { generatedBounds } from '../composition/generated';
import { generate } from '../generators';
import type { ExampleProvenance } from './model';
import { girihExamples } from './girih';
import { aperiodicExamples } from './aperiodic';
import { figurativeExamples } from './figurative';
import { hyperbolicExamples } from './hyperbolic';
import { fishMotif, birdMotif } from './motifs';
export { fishMotif, birdMotif } from './motifs';

export interface CatalogExample extends ExampleProvenance {
  create: () => Project;
  featured: boolean;
  title?: string;
  thumbnail?: string;
}
const reference = {
  title: 'Geometría funcional · referencia conceptual',
  url: 'https://mapio.github.io/programming-with-escher/',
};
const originals: Omit<CatalogExample, 'create' | 'featured'>[] = [
  {
    id: 'fish-square',
    category: 'Recursivas',
    description:
      'Peces originales orientados en anillos que disminuyen hacia los bordes de un cuadrado.',
    construction: 'Anillos diádicos · composición afín finita',
    validity: 'EXACT',
    artwork: 'original',
    author: 'Pattern Studio',
    references: [reference],
  },
  {
    id: 'birds-quadrants',
    category: 'Recursivas',
    description: 'Aves originales, giros y reflejos organizados en cuadrantes autosimilares.',
    construction: 'Subdivisión por cuadrantes · sin certificación de teselado',
    validity: 'EXACT',
    artwork: 'original',
    author: 'Pattern Studio',
    references: [reference],
  },
  {
    id: 'fish-spiral',
    category: 'Espirales',
    description: 'Un banco de peces se aproxima al centro mediante giro y escala progresiva.',
    construction: 'Espiral logarítmica discreta · semejanzas',
    validity: 'EXACT',
    artwork: 'original',
    author: 'Pattern Studio',
    references: [],
  },
  {
    id: 'birds-rosette',
    category: 'Espirales',
    description: 'Seis brazos de aves en una roseta autosimilar sobre fondo oscuro.',
    construction: 'Roseta finita de semejanzas · seis brazos',
    validity: 'EXACT',
    artwork: 'original',
    author: 'Pattern Studio',
    references: [],
  },
];
const titles = [
  'Peces al límite · original',
  'Vuelo en cuadrantes · original',
  'Cardumen en espiral · original',
  'Aves en roseta · original',
];
function artisticProject(index: number): Project {
  const p = newProject(),
    pattern = p.patterns[0];
  p.metadata.name = titles[index];
  p.metadata.example = { ...originals[index] };
  pattern.name = index % 2 ? 'Aves · fuente única' : 'Peces · fuente única';
  pattern.symmetryMode = 'free';
  pattern.sourceGeometry = index % 2 ? birdMotif() : fishMotif();
  const c = defaultComposition(
    index < 2 ? 'recursive' : 'spiral',
    generatedBounds(generate(pattern.generator, pattern.sourceGeometry)),
  );
  c.size = 160;
  c.colorByLevel = true;
  c.palette = ['#c78039', '#356a70', '#9b514b', '#7c874d', '#c8aa73'];
  if (index === 1 && c.kind === 'recursive') {
    c.recipe = 'quadrants';
    c.depth = 3;
    c.mirror = true;
    c.angle = 0;
    c.palette = ['#356a70', '#9d594e', '#c29348', '#547e70'];
  }
  if (index === 2 && c.kind === 'spiral') {
    c.count = 72;
    c.ratio = 0.96;
    c.angle = 27;
    c.direction = -1;
  }
  if (index === 3 && c.kind === 'spiral') {
    c.recipe = 'rosette';
    c.count = 24;
    c.ratio = 0.88;
    c.angle = 19;
    c.arms = 6;
    c.palette = ['#d7bf84', '#91b4ae', '#cf8c6c', '#d3d9bd'];
  }
  pattern.composition = c;
  p.preferences = {
    ...p.preferences,
    grid: false,
    structureVisible: false,
    guides: false,
    snap: false,
    background: index === 3 ? '#17333a' : '#f3eddf',
    sourceView: false,
    repetitionView: 'extended',
  };
  return p;
}
export const exampleCatalog: CatalogExample[] = [
  ...originals.map((row, index) => ({
    ...row,
    description: row.description,
    create: () => artisticProject(index),
    featured: true,
  })),
  ...figurativeExamples,
  ...aperiodicExamples,
  ...girihExamples,
  ...hyperbolicExamples,
  ...exampleNames.map((name, index) => ({
    id: `legacy-${index}`,
    category: 'Clásicos',
    description: name,
    construction: index === 7 ? 'Parche Penrose finito' : 'Ejemplo euclidiano del estudio',
    validity: 'EXACT' as const,
    artwork: 'mathematical' as const,
    author: 'Pattern Studio',
    references: [],
    featured: false,
    create: () => example(index),
  })),
];
export function catalogTitle(entry: CatalogExample): string {
  if (entry.title) return entry.title;
  const index = originals.findIndex((row) => row.id === entry.id);
  return index < 0 ? entry.description : titles[index];
}
export const compositionExample = (id: string): Project => {
  const entry = exampleCatalog.find((row) => row.id === id);
  if (!entry) throw Error('Ejemplo no encontrado.');
  return entry.create();
};
export function recipeForExample(id: string): Composition | undefined {
  return compositionExample(id).patterns[0].composition;
}
