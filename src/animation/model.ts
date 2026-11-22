/**
 * Sistema de animaciones (PRD v3.0 §13).
 *
 * Cada cuadro se deriva de una función pura `frame(preset, t)` con t∈[0,1]:
 * nunca se acumulan transformaciones cuadro tras cuadro, así que la secuencia no
 * depende de la velocidad de la máquina (§13.4). Los presets cíclicos cierran en
 * t=1 exactamente donde empezaron (§13.5); un desplazamiento no periódico no se
 * ofrece como «loop perfecto».
 */
import type { Visualization } from '../visualization/model';

export type AnimationPreset =
  | 'sphere-spin'
  | 'sphere-tilt'
  | 'disk-spin'
  | 'artistic-spin'
  | 'recursive-levels';

export type AnimationLoop = 'loop' | 'pingpong' | 'once';

export interface AnimationSettings {
  version: 1;
  preset: AnimationPreset;
  duration: number;
  fps: number;
  speed: number;
  direction: 1 | -1;
  loop: AnimationLoop;
  /** Posición normalizada de la línea temporal 0..1. */
  position: number;
}

export const animationPresets: {
  id: AnimationPreset;
  label: string;
  needs: 'sphere' | 'poincare' | 'artistic' | 'recursive' | 'any';
  cyclic: boolean;
  description: string;
}[] = [
  {
    id: 'sphere-spin',
    label: 'Esfera · giro uniforme',
    needs: 'sphere',
    cyclic: true,
    description: 'Giro completo alrededor del eje vertical; cierra en el cuadro final.',
  },
  {
    id: 'sphere-tilt',
    label: 'Esfera · oscilación de cámara',
    needs: 'sphere',
    cyclic: true,
    description: 'La orientación vertical oscila de ida y vuelta sin salto.',
  },
  {
    id: 'disk-spin',
    label: 'Poincaré · rotación del disco',
    needs: 'poincare',
    cyclic: true,
    description: 'Rotación completa de la vista del disco; cierra en el cuadro final.',
  },
  {
    id: 'artistic-spin',
    label: 'Disco artístico · rotación',
    needs: 'artistic',
    cyclic: true,
    description: 'Rotación completa de la deformación artística.',
  },
  {
    id: 'recursive-levels',
    label: 'Recursiva · revelado por niveles',
    needs: 'recursive',
    cyclic: false,
    description: 'Aparición progresiva por nivel de la composición; no es un loop perfecto.',
  },
];
export const presetById = (id: AnimationPreset) => animationPresets.find((p) => p.id === id)!;

/** Presets compatibles con la visualización/proyecto actual. */
export function availablePresets(visualization: Visualization | undefined, recursive: boolean) {
  return animationPresets.filter((p) => {
    if (p.needs === 'recursive') return recursive;
    if (p.needs === 'sphere') return visualization?.kind === 'sphere';
    if (p.needs === 'poincare') return visualization?.kind === 'poincare';
    if (p.needs === 'artistic') return visualization?.kind === 'artistic-disk';
    return true;
  });
}

export function defaultAnimation(
  visualization: Visualization | undefined,
  recursive: boolean,
): AnimationSettings {
  const first = availablePresets(visualization, recursive)[0] ?? animationPresets[3];
  return {
    version: 1,
    preset: first.id,
    duration: 4000,
    fps: 24,
    speed: 1,
    direction: 1,
    loop: first.cyclic ? 'loop' : 'once',
    position: 0,
  };
}

export function validateAnimation(settings: AnimationSettings, recursive = true) {
  const preset = animationPresets.find((p) => p.id === settings.preset);
  const ok =
    !!preset &&
    (preset.needs !== 'recursive' || recursive) &&
    Number.isFinite(settings.duration) &&
    settings.duration >= 250 &&
    settings.duration <= 60000 &&
    Number.isInteger(settings.fps) &&
    [8, 12, 15, 24, 30].includes(settings.fps) &&
    Number.isFinite(settings.speed) &&
    settings.speed >= 0.1 &&
    settings.speed <= 4 &&
    (settings.direction === 1 || settings.direction === -1) &&
    ['loop', 'pingpong', 'once'].includes(settings.loop) &&
    Number.isFinite(settings.position) &&
    settings.position >= 0 &&
    settings.position <= 1;
  if (!ok) throw Error('Animación inválida: preset, duración, fps, velocidad o loop.');
  return settings;
}

/** Parámetros visuales puros para el tiempo normalizado t∈[0,1]. */
export interface FrameState {
  /** Ángulo en grados para renderizadores con vista rotatoria. */
  angle: number;
  /** Desplazamiento vertical de cámara (esfera). */
  pitch: number;
  /** Nivel entero para el revelado recursivo (1..maxLevel). */
  level: number;
}

/**
 * Estado del cuadro. Determinista y sin acumulación: t=0 y t=1 son idénticos en
 * presets cíclicos. `direction=-1` invierte el sentido sin cambiar el cierre.
 */
export function frameState(preset: AnimationPreset, t: number, maxLevel = 4): FrameState {
  const u = ((t % 1) + 1) % 1;
  switch (preset) {
    case 'sphere-spin':
      return { angle: 360 * u, pitch: 0, level: 0 };
    case 'sphere-tilt':
      return { angle: 0, pitch: 60 * Math.sin(2 * Math.PI * u), level: 0 };
    case 'disk-spin':
    case 'artistic-spin':
      return { angle: 360 * u, pitch: 0, level: 0 };
    case 'recursive-levels': {
      const levels = Math.max(1, Math.round(maxLevel)),
        index = Math.min(levels, 1 + Math.floor(u * levels - (u === 1 ? 1 : 0)));
      return { angle: 0, pitch: 0, level: Math.max(1, Math.min(levels, index)) };
    }
  }
}

/** Aplica sentido (dirección) a un ángulo/reversión degiro sin alterar el cierre. */
export function directionalAngle(state: FrameState, direction: 1 | -1): number {
  return direction === 1 ? state.angle : 360 - state.angle;
}

/** Tiempo de cuadro k de N, con loop/pingpong/once y velocidad. */
export function frameTime(
  settings: AnimationSettings,
  frame: number,
  totalFrames: number,
): number {
  const raw = totalFrames <= 1 ? 0 : (frame / totalFrames) * settings.speed;
  if (settings.loop === 'once') return Math.min(1, raw);
  if (settings.loop === 'pingpong') {
    const cycle = raw % 2;
    return cycle <= 1 ? cycle : 2 - cycle;
  }
  return raw % 1;
}
