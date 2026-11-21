import { geometry, newProject, node, type Project } from '../app/model';
import { defaultGirih } from '../girih/model';
export const girihExamples = (['rosette', 'rhombus-grid'] as const).map((recipe) => ({
  id: `girih-${recipe}`,
  title: recipe === 'rosette' ? 'Girih · roseta decagonal' : 'Girih · red entrelazada',
  category: 'Girih',
  featured: true,
  description:
    recipe === 'rosette'
      ? 'Decágono y diez pentágonos unidos; bandas de54° y estrella central editable.'
      : 'Rombos72° en una red finita; las bandas continúan por cada borde compartido.',
  construction: 'Girih · parche finito de polígonos compatibles · alternancia global de hebras',
  validity: 'EXACT' as const,
  artwork: 'mathematical' as const,
  author: 'Pattern Studio · geometría propia, método de Hankin/Kaplan',
  references: [
    {
      title: 'Kaplan2005 · Polygons in Contact',
      url: 'https://cs.uwaterloo.ca/~csk/publications/Papers/kaplan_2005.pdf',
    },
    {
      title: 'Tilings Encyclopedia · Girih',
      url: 'https://tilings.math.uni-bielefeld.de/glossary/girih/',
    },
  ],
  create: (): Project => {
    const p = newProject(),
      pattern = p.patterns[0];
    p.metadata.name = recipe === 'rosette' ? 'Girih · roseta decagonal' : 'Girih · red entrelazada';
    pattern.name = p.metadata.name;
    pattern.generator = {
      ...pattern.generator,
      kind: 'girih',
      version: 3,
      girih: { ...defaultGirih(), recipe },
      spacing: 24,
      rotation: recipe === 'rosette' ? 18 : 0,
      rows: 5,
      columns: 5,
    };
    pattern.symmetryMode = 'free';
    if (recipe === 'rosette')
      pattern.sourceGeometry = [
        {
          ...geometry(
            'path',
            Array.from({ length: 10 }, (_, i) => {
              const angle = ((i * 36 - 90) * Math.PI) / 180,
                r = i % 2 ? 3.5 : 8;
              return node(Math.cos(angle) * r, Math.sin(angle) * r);
            }),
            true,
          ),
          name: 'Estrella central editable',
          fill: '#c78f4d',
          stroke: '#28535c',
          strokeWidth: 0.4,
        },
      ];
    p.preferences.grid = false;
    p.preferences.structureVisible = false;
    p.preferences.repetitionView = 'extended';
    p.preferences.sourceView = false;
    const {
      create: _,
      featured: __,
      title: ___,
      ...metadata
    } = girihExamples.find((e) => e.id === `girih-${recipe}`)!;
    p.metadata.example = metadata;
    return p;
  },
}));
