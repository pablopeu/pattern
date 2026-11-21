import { newProject } from '../app/model';
import { geometryBounds } from '../application/clipping';
import { defaultVisualization } from '../visualization/model';
import { fishMotif, birdMotif } from './motifs';
import type { ExampleProvenance } from './model';
const choices = [
  { id: 'fish', title: 'Peces en Poincaré · {7,3}', p: 7, q: 3, source: fishMotif },
  { id: 'bird', title: 'Aves en Poincaré · {5,4}', p: 5, q: 4, source: birdMotif },
];
export function hyperbolicProject(id: 'fish' | 'bird') {
  const choice = choices.find((row) => row.id === id)!,
    project = newProject(),
    pattern = project.patterns[0];
  pattern.name = `${id === 'fish' ? 'Peces' : 'Aves'} · fuente plana original`;
  pattern.symmetryMode = 'free';
  pattern.sourceGeometry = choice.source();
  project.metadata.name = choice.title;
  const provenance: ExampleProvenance = {
    id: `poincare-${id}`,
    category: 'Poincaré',
    description:
      'Motivo figurativo original adaptado a celdas de un disco hiperbólico. Fuente plana editable; sin garantía de continuidad de bordes.',
    construction: `Teselación geométrica {${choice.p},${choice.q}} · adaptación numérica del motivo`,
    validity: 'APPROXIMATED',
    artwork: 'original',
    author: 'Pattern Studio',
    references: [
      {
        title: 'Poincaré Paint · geometría de referencia MIT',
        url: 'https://github.com/pisan-labs/poincare-paint',
      },
    ],
  };
  project.metadata.example = provenance;
  const bounds = geometryBounds(pattern.sourceGeometry),
    visualization = defaultVisualization(project, pattern.id);
  visualization.source.selection = {
    target: 'view',
    bounds: {
      x: bounds.x - 1,
      y: bounds.y - 1,
      width: bounds.width + 2,
      height: bounds.height + 2,
    },
  };
  visualization.settings = {
    ...visualization.settings,
    p: choice.p,
    q: choice.q,
    maxCells: 100,
    depth: 4,
    toleranceMm: 0.03,
  };
  visualization.showStructure = false;
  project.visualization = visualization;
  project.preferences = {
    ...project.preferences,
    split: false,
    grid: false,
    structureVisible: false,
    guides: false,
  };
  return project;
}
export const hyperbolicExamples = choices.map((choice) => {
  const project = hyperbolicProject(choice.id as 'fish' | 'bird');
  return {
    ...project.metadata.example!,
    title: choice.title,
    featured: true,
    thumbnail: `${import.meta.env.BASE_URL}examples/poincare-${choice.id}.png`,
    create: () => hyperbolicProject(choice.id as 'fish' | 'bird'),
  };
});
