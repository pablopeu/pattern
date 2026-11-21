import { geometry, newProject, node } from '../app/model';
import { defaultVisualization } from '../visualization/model';
import type { ExampleProvenance } from './model';
export function chamberProject() {
  const project = newProject(),
    pattern = project.patterns[0];
  project.metadata.name = 'Bordes compartidos · {7,3}';
  pattern.name = 'Campo y curva · fuente plana';
  pattern.sourceGeometry = [
    {
      ...geometry('compound', [], true),
      pathData: 'M-30 -30H30V30H-30Z M-8 -8H8V8H-8Z',
      fill: '#487c78',
      stroke: 'none',
      fillRule: 'evenodd',
    },
    {
      ...geometry('path', [
        { ...node(-45, -12), out: { x: 30, y: -25 } },
        { ...node(45, 12), in: { x: -30, y: 25 } },
      ]),
      stroke: '#f4e9c9',
      strokeWidth: 1.2,
    },
  ];
  const provenance: ExampleProvenance = {
    id: 'poincare-chambers',
    category: 'Poincaré',
    description:
      'Campo con hueco y curva originales, adaptados a triángulos reflejados con bordes compartidos. La tangente puede cambiar.',
    construction: '{7,3} · cámaras reflejadas C0 · fuente editable',
    validity: 'APPROXIMATED',
    artwork: 'original',
    author: 'Pattern Studio',
    references: [
      {
        title: 'Tschanz · Grupos triangulares por reflexión',
        url: 'https://link.springer.com/article/10.1007/s12220-023-01208-x',
      },
    ],
  };
  project.metadata.example = provenance;
  const v = defaultVisualization(project, pattern.id);
  v.source.selection = { target: 'view', bounds: { x: -30, y: -30, width: 60, height: 60 } };
  v.settings.adaptation = 'mirrored-chambers';
  v.settings.depth = 2;
  v.settings.maxCells = 24;
  v.settings.toleranceMm = 0.03;
  v.showStructure = false;
  project.visualization = v;
  project.preferences = {
    ...project.preferences,
    split: false,
    grid: false,
    guides: false,
    structureVisible: false,
  };
  return project;
}
export const chamberExamples = [
  {
    ...chamberProject().metadata.example!,
    title: 'Bordes compartidos · {7,3}',
    featured: true,
    thumbnail: `${import.meta.env.BASE_URL}examples/poincare-chambers.png`,
    create: chamberProject,
  },
];
