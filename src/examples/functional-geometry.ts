import fishPath from '../vendor/escher/fish.path?raw';
import { geometry, newProject } from '../app/model';
import { defaultComposition } from '../composition/model';
import type { ExampleProvenance } from './model';
export const escherReferences = [
  {
    title: 'Programming with Escher · datos vectoriales GPL-3.0',
    url: 'https://github.com/mapio/programming-with-escher/blob/master/fish.path',
  },
  {
    title: 'Geometría funcional · composición del pez',
    url: 'https://mapio.github.io/programming-with-escher/',
  },
  {
    title: 'Licencia de los datos reutilizados',
    url: 'https://github.com/mapio/programming-with-escher/blob/master/LICENSE.txt',
  },
];
/** The input coordinates are kept verbatim. This unit frame, rather than its
 * bounding box, is the construction frame of the functional-geometry fish. */
export function functionalFish() {
  return [
    {
      ...geometry('compound', [], false),
      name: 'Pez · curvas de la referencia GPL3',
      pathData: fishPath,
      fill: 'none',
      stroke: '#244f4b',
      strokeWidth: 0.009,
    },
  ];
}
export function functionalGeometryProject() {
  const project = newProject(),
    pattern = project.patterns[0];
  project.metadata.name = 'Peces · Límite cuadrado de geometría funcional';
  pattern.name = 'Pez de referencia · fuente única editable';
  pattern.symmetryMode = 'free';
  pattern.sourceGeometry = functionalFish();
  const composition = defaultComposition('recursive', { x: 0, y: 0, width: 1, height: 1 });
  if (composition.kind !== 'recursive') throw Error('Expected recursive defaults');
  composition.recipe = 'henderson';
  composition.depth = 3;
  composition.size = 150;
  pattern.composition = composition;
  const provenance: ExampleProvenance = {
    id: 'v3-escher-square',
    category: 'Recursivas',
    description:
      'Reconstrucción vectorial mediante curvas del pez de Functional Geometry y412 instancias afines. Fuente única editable; profundidad y tamaño ajustables.',
    construction: 'Side/corner/nonet · composición afín finita',
    validity: 'EXACT',
    artwork: 'licensed',
    author: 'mapio · datos del pez de Functional Geometry; adaptación Pattern Studio',
    references: escherReferences,
  };
  project.metadata.example = provenance;
  project.preferences = {
    ...project.preferences,
    grid: false,
    guides: false,
    structureVisible: false,
    split: false,
    background: '#faf6e9',
  };
  return project;
}
