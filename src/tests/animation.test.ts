import { describe, expect, it } from 'vitest';
import {
  availablePresets,
  defaultAnimation,
  directionalAngle,
  frameState,
  frameTime,
  validateAnimation,
  type AnimationSettings,
} from '../animation/model';
import { animationSchema } from '../animation/schema';
import { newProject } from '../app/model';
import { parseProject, serialize } from '../persistence/schema';
import { defaultVisualization, defaultSphereVisualization } from '../visualization/model';

const base: AnimationSettings = {
  version: 1,
  preset: 'sphere-spin',
  duration: 4000,
  fps: 24,
  speed: 1,
  direction: 1,
  loop: 'loop',
  position: 0,
};

describe('animación determinística', () => {
  it('presets cíclicos cierran exactamente en t=0 y t=1', () => {
    for (const preset of ['sphere-spin', 'disk-spin', 'artistic-spin'] as const) {
      const a = frameState(preset, 0),
        b = frameState(preset, 1);
      expect(((b.angle - a.angle) % 360 + 360) % 360).toBe(0);
    }
    expect(frameState('sphere-tilt', 0).pitch).toBeCloseTo(frameState('sphere-tilt', 1).pitch, 9);
  });
  it('el mismo t produce el mismo cuadro y no acumula transformaciones', () => {
    for (let i = 0; i < 50; i++) {
      const t = i / 49;
      expect(frameState('sphere-spin', t)).toEqual(frameState('sphere-spin', t));
    }
    // Saltar a t no depende del recorrido previo.
    expect(frameState('disk-spin', 0.33)).toEqual(frameState('disk-spin', 0.33));
  });
  it('el revelado recursivo entrega niveles enteros acotados', () => {
    const levels = new Set<number>();
    for (let i = 0; i <= 40; i++) {
      const level = frameState('recursive-levels', i / 40, 3).level;
      expect(Number.isInteger(level)).toBe(true);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(3);
      levels.add(level);
    }
    expect(levels.size).toBe(3);
  });
  it('frameTime respeta loop, pingpong, once y velocidad', () => {
    expect(frameTime({ ...base, loop: 'loop' }, 24, 24)).toBe(0);
    expect(frameTime({ ...base, loop: 'once' }, 48, 24)).toBe(1);
    const back = frameTime({ ...base, loop: 'pingpong' }, 18, 24);
    expect(back).toBeGreaterThan(0);
    expect(back).toBeLessThanOrEqual(1);
    expect(frameTime({ ...base, speed: 2, loop: 'once' }, 12, 24)).toBe(1);
    expect(directionalAngle({ angle: 90, pitch: 0, level: 0 }, -1)).toBe(270);
  });
});

describe('validación y persistencia de la animación', () => {
  it('rechaza fps, duración o loop inválidos', () => {
    expect(() => validateAnimation(base)).not.toThrow();
    expect(() => validateAnimation({ ...base, fps: 7 as never })).toThrow(/Animación/);
    expect(() => validateAnimation({ ...base, duration: 100 })).toThrow(/Animación/);
    expect(() => validateAnimation({ ...base, loop: 'bucle' as never })).toThrow(/Animación/);
    expect(() => validateAnimation({ ...base, preset: 'recursive-levels' }, false)).toThrow(
      /Animación/,
    );
    expect(animationSchema.safeParse(base).success).toBe(true);
  });
  it('persiste el bloque animation y conserva documentos sin él', () => {
    const project = newProject();
    expect(parseProject(serialize(project))).toEqual(project);
    project.animation = { ...base, preset: 'disk-spin' };
    expect(parseProject(serialize(project))).toEqual(project);
    expect(parseProject(serialize({ ...project, animation: undefined }))).toEqual({
      ...project,
      animation: undefined,
    });
  });
  it('ofrece solo presets compatibles con la representación actual', () => {
    const project = newProject(),
      patternId = project.patterns[0].id,
      poincare = defaultVisualization(project, patternId),
      sphere = defaultSphereVisualization(project, patternId);
    expect(availablePresets(poincare, false).map((p) => p.id)).toEqual(['disk-spin']);
    expect(availablePresets(sphere, false).map((p) => p.id)).toEqual([
      'sphere-spin',
      'sphere-tilt',
    ]);
    expect(availablePresets(undefined, true).map((p) => p.id)).toEqual(['recursive-levels']);
    expect(defaultAnimation(sphere, false).preset).toBe('sphere-spin');
  });
});
