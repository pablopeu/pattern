import { describe, expect, test } from 'vitest';
import {
  gdjFishTessellation,
  nightDayBirds,
  spiralLizards,
  torturedLizards,
} from '../examples/reference-builders';
import { serialize, parseProject } from '../persistence/schema';
import { buildScene } from '../patterns/engine';
import { exampleCatalog } from '../examples/catalog';

const studies = {
  'gallery-spiral-lizards': spiralLizards,
  'gallery-night-day': nightDayBirds,
  'gallery-tortured-lizard': torturedLizards,
  'gallery-gdj-fish': gdjFishTessellation,
} as const;

describe('estudios de referencia del incremento de galería', () => {
  test('cada estudio expone metadatos, fuente editable y licencia', () => {
    for (const create of Object.values(studies)) {
      const project = create(),
        pattern = project.patterns[0];
      expect(pattern.sourceGeometry.length).toBeGreaterThan(1);
      for (const geometry of pattern.sourceGeometry) {
        expect(geometry.pathData && geometry.pathData.length).toBeTruthy();
        expect(geometry.pathData).toMatch(/^M/);
      }
      const meta = project.metadata.example!;
      expect(meta.artwork).toBe('licensed');
      expect(meta.references.length).toBeGreaterThan(0);
      expect(meta.references[0].url).toMatch(/^https:\/\/openclipart\.org\//);
      expect(meta.validity).toBe('APPROXIMATED');
    }
  });

  test('la geometría se regenera determinísticamente; sólo cambian las identidades', () => {
    for (const create of Object.values(studies)) {
      const signature = (project: ReturnType<typeof create>) =>
        project.patterns[0].sourceGeometry.map((geometry) => geometry.pathData);
      expect(signature(create())).toEqual(signature(create()));
      expect(create().metadata.id).not.toBe(create().metadata.id);
    }
  });

  test('los estudios periódicos cubren la vista sin errores del motor', () => {
    for (const id of ['gallery-night-day', 'gallery-tortured-lizard', 'gallery-gdj-fish']) {
      const scene = buildScene(studies[id as keyof typeof studies]().patterns[0], {
        x: -150,
        y: -150,
        width: 300,
        height: 300,
      });
      expect(scene.status).toBe('PERIODIC_SEAMLESS');
      expect(scene.instances.length).toBeGreaterThan(1);
    }
  });

  test('el JSON guarda y reabre la geometría sin convertir copias en objetos', () => {
    for (const create of Object.values(studies)) {
      const project = create(),
        reopened = parseProject(serialize(project));
      expect(reopened.patterns[0].sourceGeometry.length).toBe(
        project.patterns[0].sourceGeometry.length,
      );
      for (const [index, geometry] of reopened.patterns[0].sourceGeometry.entries())
        expect(geometry.pathData).toBe(project.patterns[0].sourceGeometry[index].pathData);
    }
  });

  test('el catálogo publica los cuatro estudios una sola vez', () => {
    for (const id of Object.keys(studies)) {
      const entries = exampleCatalog.filter((entry) => entry.id === id);
      expect(entries).toHaveLength(1);
      expect(entries[0].featured).toBe(true);
      expect(entries[0].title).toBeTruthy();
    }
  });
});
