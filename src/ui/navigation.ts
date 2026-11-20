import type { Tool } from '../app/useStudio';

export const categories = [
  { id: 'drawing', label: 'Dibujo' },
  { id: 'shapes', label: 'Formas' },
  { id: 'symmetry', label: 'Simetrías' },
  { id: 'tiles', label: 'Teselas' },
  { id: 'layers', label: 'Capas' },
  { id: 'application', label: 'Aplicación' },
  { id: 'preferences', label: 'Preferencias' },
] as const;
export type Category = (typeof categories)[number]['id'];

export function toolCategory(tool: Tool): Category {
  if (['rectangle', 'ellipse', 'polygon'].includes(tool)) return 'shapes';
  if (tool === 'region') return 'application';
  return 'drawing';
}
