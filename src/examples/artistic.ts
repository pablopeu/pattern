import { geometry, newProject, node } from '../app/model';
import { defaultArtisticVisualization } from '../visualization/model';
import { fishMotif } from './motifs';
import type { ExampleProvenance } from './model';
const choices = [
  { id: 'fish', title: 'Mosaico de peces · Disco artístico' },
  { id: 'rings', title: 'Anillos y presión · Disco artístico' },
] as const;
export function artisticDiskProject(id: 'fish' | 'rings') {
  const project = newProject(),
    pattern = project.patterns[0],
    choice = choices.find((row) => row.id === id)!;
  project.mainSymmetry = {
    ...project.mainSymmetry,
    family: 'wallpaper',
    group: 'p1',
    width: id === 'fish' ? 64 : 20,
    height: id === 'fish' ? 38 : 20,
  };
  pattern.name =
    id === 'fish'
      ? 'Peces originales · mosaico plano'
      : 'Anillos y trazo de presión · fuente plana';
  pattern.sourceGeometry =
    id === 'fish'
      ? fishMotif()
      : [
          {
            ...geometry('compound', [], true),
            pathData: 'M2 2H18V18H2Z M7 7H13V13H7Z',
            fill: '#3b82f6',
            stroke: '#111111',
            strokeWidth: 0.6,
            fillRule: 'evenodd',
          },
          {
            ...geometry('path', [node(4, 16), node(16, 16)]),
            stroke: '#c7337c',
            strokeWidth: 2,
            strokeProfile: {
              version: 1,
              kind: 'custom',
              points: [
                { at: 0, width: 0.2 },
                { at: 1, width: 1 },
              ],
            },
          },
        ];
  project.metadata.name = choice.title;
  const provenance: ExampleProvenance = {
    id: `artistic-${id}`,
    category: 'Discos artísticos',
    description:
      'Deformación radial de un mosaico plano finito. Cambiá la fuente o la compresión para explorar el resultado.',
    construction: 'Mapa radial suave al disco · composición artística derivada',
    validity: 'ARTISTIC',
    artwork: 'original',
    author: 'Pattern Studio',
    references: [],
  };
  project.metadata.example = provenance;
  const visualization = defaultArtisticVisualization(project, pattern.id);
  visualization.source.selection = {
    target: 'view',
    bounds:
      id === 'fish'
        ? { x: -96, y: -57, width: 192, height: 114 }
        : { x: -60, y: -60, width: 120, height: 120 },
  };
  visualization.settings.compression = id === 'fish' ? 3 : 6;
  visualization.settings.view = {
    center: id === 'fish' ? { x: 0, y: 0 } : { x: 0.1, y: -0.1 },
    angle: id === 'fish' ? 0 : 0.2,
  };
  visualization.settings.toleranceMm = 0.03;
  visualization.settings.maxCurves = id === 'fish' ? 12000 : 4096;
  project.visualization = visualization;
  project.preferences = {
    ...project.preferences,
    split: false,
    grid: false,
    guides: false,
    structureVisible: false,
  };
  return project;
}
export const artisticDiskExamples = choices.map((choice) => {
  const project = artisticDiskProject(choice.id);
  return {
    ...project.metadata.example!,
    title: choice.title,
    featured: true,
    thumbnail: `${import.meta.env.BASE_URL}examples/artistic-${choice.id}.png`,
    create: () => artisticDiskProject(choice.id),
  };
});
