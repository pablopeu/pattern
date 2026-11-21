import metadata from './catalog.json';
import { newIsohedral, supportedIsohedralTypes } from './engine';
import type { IsohedralDefinition } from './model';
import { isohedralConstraints } from './engine';

/** Classification facts from Kaplan/Schattschneider2025; see REFERENCES_V30.md. */
export const isohedralCatalog = metadata.map((row) => ({
  ...row,
  implemented: supportedIsohedralTypes.includes(row.id),
  family:
    row.group === 'p1'
      ? 'Traslaciones'
      : /[mg]/.test(row.group)
        ? 'Reflexiones y deslizamientos'
        : 'Giros',
  reflection: /[mg]/.test(row.group),
  rotation: /[2346]/.test(row.group),
}));
export function isohedralPreset(type: number, curved = false): IsohedralDefinition {
  const def = newIsohedral(type);
  if (curved) {
    const index = isohedralConstraints(def).findIndex((c) => c !== 'straight');
    if (index >= 0) {
      const n = def.edges[index][1];
      n.y = 0.015;
      n.in = { x: -0.13, y: -0.01 };
      n.out = { x: 0.13, y: 0.01 };
    }
  }
  return def;
}
