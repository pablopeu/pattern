import type { Project } from '../app/model';
import type { Composition } from '../composition/model';
import { curatedCatalog } from './curated';
import { compositionExample as archivedExample } from './archive';
export type { CatalogExample } from './archive';
export { fishMotif, birdMotif } from './motifs';
export const exampleCatalog = curatedCatalog;
export const catalogTitle = (entry: (typeof exampleCatalog)[number]) =>
  entry.title ?? entry.description;
/** Old fixture identifiers remain readable for regressions and existing recipes. */
export const compositionExample = (id: string): Project =>
  exampleCatalog.find((e) => e.id === id)?.create() ?? archivedExample(id);
export const recipeForExample = (id: string): Composition | undefined =>
  compositionExample(id).patterns[0].composition;
