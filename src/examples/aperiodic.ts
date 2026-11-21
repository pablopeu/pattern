import { geometry, newProject, type Project } from '../app/model';
import { defaultAperiodic } from '../aperiodic/model';
const names = {
  penrose: 'Penrose · dos triángulos',
  hat: 'Hat · jerarquía H/T/P/F',
  spectre: 'Spectre · generaciones curvas',
};
export const aperiodicExamples = (['penrose', 'hat', 'spectre'] as const).map((kind) => ({
  id: `aperiodic-${kind}`,
  title: names[kind],
  category: 'Aperiódicas',
  featured: true,
  description:
    kind === 'penrose'
      ? 'Parche P3 por sustitución de triángulos Robinson, con dos tipos coloreados.'
      : kind === 'hat'
        ? 'Metateselas H/T/P/F y sus marcos de jerarquía; incluye Hat reflejados.'
        : 'Bordes cúbicos alternados, una única mano y colores de grupos de sustitución.',
  construction: `${kind === 'spectre' ? 'Spectre curvo quiral' : kind === 'hat' ? 'Hat por sustitución' : 'Penrose P3'} · parche finito, sin celda de traslación`,
  validity: 'EXACT' as const,
  artwork: 'mathematical' as const,
  author: 'Pattern Studio · reglas Smith/Myers/Kaplan/Goodman-Strauss',
  references:
    kind === 'penrose'
      ? []
      : [
          {
            title: kind === 'hat' ? 'An aperiodic monotile' : 'A chiral aperiodic monotile',
            url: `https://cs.uwaterloo.ca/~csk/${kind === 'hat' ? 'hat' : 'spectre'}/`,
          },
        ],
  create: (): Project => {
    const p = newProject(),
      pattern = p.patterns[0];
    p.metadata.name = names[kind];
    pattern.name = names[kind];
    pattern.generator.kind = kind;
    pattern.generator.frequency = kind === 'penrose' ? 4 : 2;
    pattern.generator.radius = 110;
    pattern.symmetryMode = 'free';
    if (kind !== 'penrose') {
      pattern.generator.version = 2;
      pattern.generator.aperiodic = defaultAperiodic(kind);
      pattern.generator.aperiodic.showHierarchy = kind === 'hat';
      const detail = {
        ...geometry('compound'),
        name: 'Detalle canónico editable',
        pathData: kind === 'hat' ? 'M5 -5C8 -8 12 -8 15 -5' : 'M10 8C12 5 15 5 17 8',
        stroke: '#fff5dc',
        strokeWidth: 0.5,
        fill: 'none',
      };
      pattern.sourceGeometry = [detail];
    }
    p.preferences.grid = false;
    p.preferences.structureVisible = false;
    p.preferences.repetitionView = 'extended';
    p.preferences.sourceView = false;
    const {
      create: _,
      featured: __,
      title: ___,
      ...metadata
    } = aperiodicExamples.find((e) => e.id === `aperiodic-${kind}`)!;
    p.metadata.example = metadata;
    return p;
  },
}));
