import type { SolidKind } from './geometry';

/** Ajustes de la visualización esférica derivada (PRD v3.0 §11). */
export interface SphereSettings {
  /** Geodésica: sólido platónico subdividido. Artística: textura deformada. */
  mode: 'geodesic' | 'artistic';
  solid: SolidKind;
  /** Nivel de subdivisión geodésica (0–4). */
  level: number;
  /** Orientación de la esfera en grados, zoom y sentido de giro. */
  view: { yaw: number; pitch: number; zoom: number; spin: 1 | -1 };
  lighting: boolean;
  borders: boolean;
  background: string;
  palette: string[];
}

const defaults: SphereSettings = {
  mode: 'geodesic',
  solid: 'icosa',
  level: 1,
  view: { yaw: 18, pitch: -12, zoom: 1, spin: 1 },
  lighting: true,
  borders: true,
  background: '#f7f3e8',
  palette: ['#c78046', '#71978c', '#ab6652', '#253f45', '#c5ccaf', '#e3c792'],
};

export function defaultSphereSettings(): SphereSettings {
  return structuredClone(defaults);
}

export function validateSphereSettings(settings: SphereSettings) {
  const ok =
    ['geodesic', 'artistic'].includes(settings.mode) &&
    ['tetra', 'cube', 'octa', 'dodeca', 'icosa'].includes(settings.solid) &&
    Number.isInteger(settings.level) &&
    settings.level >= 0 &&
    settings.level <= 4 &&
    Number.isFinite(settings.view.yaw) &&
    Number.isFinite(settings.view.pitch) &&
    settings.view.pitch >= -90 &&
    settings.view.pitch <= 90 &&
    Number.isFinite(settings.view.zoom) &&
    settings.view.zoom >= 0.3 &&
    settings.view.zoom <= 3 &&
    (settings.view.spin === 1 || settings.view.spin === -1) &&
    /^#[\da-fA-F]{6}$/.test(settings.background) &&
    settings.palette.length >= 2 &&
    settings.palette.length <= 8 &&
    settings.palette.every((c) => /^#[\da-fA-F]{6}$/.test(c));
  if (!ok) throw Error('Ajustes esféricos inválidos: sólido, nivel, vista, fondo o paleta.');
  return settings;
}
