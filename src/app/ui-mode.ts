import type { UiMode } from './experience';

/** Herramientas esenciales del modo simple (PRD v4.0 §5.2). */
const simpleTools = new Set(['select', 'pen', 'pencil', 'line', 'rectangle', 'ellipse', 'fill']);
export function isToolVisible(tool: string, mode: UiMode): boolean {
  return mode === 'advanced' || simpleTools.has(tool);
}

/** Categorías amigables de galería en modo simple (presentación, no taxonomía). */
const friendlyCategories: Record<string, string> = {
  Figurativas: 'Peces, aves y reptiles',
  Referencias: 'Peces, aves y reptiles',
  Espirales: 'Flores y rosetas',
  Recursivas: 'Figuras repetidas',
  Aperiódicas: 'Figuras repetidas',
  Aplicaciones: 'Figuras repetidas',
  Girih: 'Diseños decorativos',
  Esféricas: 'Diseños decorativos',
  'Artísticas': 'Diseños decorativos',
  Ornamentales: 'Diseños decorativos',
  Hiperbólicas: 'Diseños decorativos',
  'Discos artísticos': 'Diseños decorativos',
  Poincaré: 'Diseños decorativos',
};
/** Etiqueta de presentación amigable en modo simple; undefined conserva la original. */
export function friendlyCategoryLabel(category: string): string | undefined {
  return friendlyCategories[category];
}
