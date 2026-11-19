/** Pure, versioned migrations. V1 p1 always remains wallpaper p1. */
export const LATEST_SCHEMA_VERSION = 3;
type Versioned = { schemaVersion: number } & Record<string, unknown>;
export function migratePatternV1(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const p = structuredClone(value) as Record<string, unknown>,
    sym = p.symmetry;
  return {
    ...p,
    symmetry:
      sym && typeof sym === 'object' ? { ...sym, origin: { x: 0, y: 0 }, orientation: 0 } : sym,
    symmetryMode: 'own',
    symmetryProfiles: {},
    placementTransform: [1, 0, 0, 1, 0, 0],
    visible: true,
  };
}
const migrations: Record<number, (value: Versioned) => Versioned> = {
  2: (doc) => {
    const p = structuredClone(doc);
    p.schemaVersion = 3;
    if (p.preferences && typeof p.preferences === 'object')
      p.preferences = { ...p.preferences, structureVisible: false, structureOpacity: 0.22 };
    return p;
  },
  1: (doc) => {
    const p = structuredClone(doc);
    p.schemaVersion = 2;
    p.mainSymmetry = {
      family: 'none',
      group: 'none',
      width: 60,
      height: 60,
      angle: 90,
      sectors: 8,
      center: { x: 0, y: 0 },
      origin: { x: 0, y: 0 },
      orientation: 0,
    };
    p.mainSymmetryProfiles = {};
    if (Array.isArray(p.patterns)) p.patterns = p.patterns.map(migratePatternV1);
    if (Array.isArray(p.applications))
      p.applications = p.applications.map((a) =>
        a && typeof a === 'object' && 'frozenPattern' in a
          ? { ...a, frozenPattern: migratePatternV1(a.frozenPattern) }
          : a,
      );
    if (p.preferences && typeof p.preferences === 'object')
      p.preferences = { ...p.preferences, sourceView: false, repetitionView: 'extended' };
    return p;
  },
};
export function migrateDocument(raw: unknown): unknown {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('schemaVersion' in raw) ||
    typeof raw.schemaVersion !== 'number'
  )
    throw Error('El archivo no declara una versión de proyecto.');
  if (raw.schemaVersion > LATEST_SCHEMA_VERSION)
    throw Error(
      `Este archivo usa la versión ${raw.schemaVersion}; esta aplicación admite hasta la versión ${LATEST_SCHEMA_VERSION}.`,
    );
  let doc = structuredClone(raw) as Versioned;
  while (doc.schemaVersion < LATEST_SCHEMA_VERSION) {
    const upgrade = migrations[doc.schemaVersion];
    if (!upgrade) throw Error(`No existe una migración para el formato ${doc.schemaVersion}.`);
    const next = upgrade(doc);
    if (next.schemaVersion <= doc.schemaVersion) throw Error('Migración de proyecto inválida.');
    doc = next;
  }
  return doc;
}
