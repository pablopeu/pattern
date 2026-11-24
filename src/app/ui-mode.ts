import type { UiMode } from './experience';

/** Herramientas esenciales del modo simple (PRD v4.0 §5.2). */
const simpleTools = new Set(['select', 'pen', 'pencil', 'line', 'rectangle', 'ellipse', 'fill']);
export function isToolVisible(tool: string, mode: UiMode): boolean {
  return mode === 'advanced' || simpleTools.has(tool);
}

/** Categorías amigables de galería en modo simple (presentación, no taxonomía). */
const friendlyCategories: Record<string, string> = {
  Figurativas: 'gallery.cat.figures',
  Referencias: 'gallery.cat.figures',
  Espirales: 'gallery.cat.flowers',
  Recursivas: 'gallery.cat.repeating',
  Aperiódicas: 'gallery.cat.repeating',
  Aplicaciones: 'gallery.cat.repeating',
  Girih: 'gallery.cat.decorative',
  Esféricas: 'gallery.cat.decorative',
  'Artísticas': 'gallery.cat.decorative',
  Ornamentales: 'gallery.cat.decorative',
  Hiperbólicas: 'gallery.cat.decorative',
};
export function friendlyCategoryKey(category: string): string | undefined {
  return friendlyCategories[category];
}
