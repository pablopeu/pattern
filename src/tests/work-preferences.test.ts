import { describe, it, expect } from 'vitest';
import { newProject, newStudy } from '../app/model';
import {
  WORK_PREFERENCES_KEY,
  readWorkPreferences,
  rememberWorkPreferenceChanges,
  withWorkPreferences,
} from '../app/work-preferences';
import { hexHSV, hsvHex } from '../ui/color';
describe('preferencias del navegador independientes del estudio', () => {
  const storage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };
  };
  it('nuevo estudio mantiene trabajo/unidades/fondo y reinicia sólo geometría/vista acordada', () => {
    const store = storage(),
      before = newStudy(),
      next = structuredClone(before);
    next.preferences.snap = false;
    next.preferences.snapNodes = false;
    next.preferences.snapRadiusPx = 19;
    next.preferences.fillCloseTolerance = 0.2;
    next.preferences.background = '#e5e9ef';
    next.documentUnits = 'in';
    rememberWorkPreferenceChanges(before, next, store);
    const fresh = withWorkPreferences(newStudy(), true, store);
    expect(fresh.preferences).toMatchObject({
      snap: false,
      snapNodes: false,
      snapRadiusPx: 19,
      fillCloseTolerance: 0.2,
      background: '#e5e9ef',
      structureVisible: true,
      structureOpacity: 0.5,
      split: false,
      repetitionView: 'extended',
    });
    expect(fresh.documentUnits).toBe('in');
    expect(fresh.mainSymmetry.group).toBe('p3');
    expect(fresh.patterns[0].sourceGeometry).toEqual([]);
    const other = newProject();
    other.preferences.background = '#17333a';
    const loaded = withWorkPreferences(other, false, store);
    expect(loaded.preferences.snap).toBe(false);
    expect(loaded.preferences.background).toBe('#17333a');
    expect(readWorkPreferences(store)!.preferences.background).toBe('#e5e9ef');
  });
  it('cargar contenido no crea preferencias y los valores corruptos no bloquean proyectos', () => {
    const store = storage(),
      p = newProject();
    expect(withWorkPreferences(p, false, store)).toBe(p);
    expect(readWorkPreferences(store)).toBeNull();
    store.setItem(
      WORK_PREFERENCES_KEY,
      '{"version":1,"units":"mm","preferences":{"snapRadiusPx":999}}',
    );
    expect(withWorkPreferences(p, true, store)).toBe(p);
    store.setItem(WORK_PREFERENCES_KEY, 'not json');
    expect(readWorkPreferences(store)).toBeNull();
    expect(() =>
      rememberWorkPreferenceChanges(
        p,
        { ...p, documentUnits: 'cm' },
        {
          getItem: () => {
            throw Error('disabled');
          },
          setItem: () => {
            throw Error('disabled');
          },
        },
      ),
    ).not.toThrow();
  });
  it('selector HSV conserva RGB, negro y grises sin depender del picker del sistema', () => {
    for (const color of [
      '#3b82f6',
      '#ff0000',
      '#00ff00',
      '#0000ff',
      '#ffffff',
      '#000000',
      '#a2a2a2',
      '#f8b24e',
    ]) {
      const { h, s, v } = hexHSV(color);
      expect(hsvHex(h, s, v)).toBe(color);
    }
  });
});
