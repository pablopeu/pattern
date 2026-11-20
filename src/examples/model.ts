/** Portable provenance. Thumbnail and geometry remain derived from the project. */
export interface ExampleProvenance {
  id: string;
  category: string;
  description: string;
  construction: string;
  validity: 'EXACT' | 'APPROXIMATED' | 'ARTISTIC' | 'UNVERIFIED';
  artwork: 'original' | 'mathematical' | 'licensed';
  author: string;
  references: { title: string; url: string }[];
}
