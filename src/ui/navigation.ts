export const categories = [
  { id: 'symmetry', label: 'Simetrías' },
  { id: 'tiles', label: 'Teselas' },
  { id: 'layers', label: 'Capas' },
  { id: 'application', label: 'Aplicación' },
  { id: 'preferences', label: 'Preferencias' },
] as const;
export type Category = (typeof categories)[number]['id'];
/** Aplicar owns its context through the top tab, without another category entry. */
export const railCategories = categories.filter((c) => c.id !== 'application');
