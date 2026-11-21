import { ExternalLink, X } from 'lucide-react';
import { Modal } from './Modal';

export const consultedRepositories = [
  ['isohedral/tactile-js', 'Motor de teselaciones isoédricas'],
  ['isohedral/hatviz', 'Reglas de sustitución Hat y jerarquía de metateselas'],
  ['isohedral/tactile', 'Representación y parámetros isoédricos'],
  ['DBraun/tactile-python', 'Referencia de implementación isoédrica'],
  ['mapio/programming-with-escher', 'Composición recursiva y geometría funcional'],
  ['levskaya/eschersketch', 'Dibujo y generadores de simetría'],
  ['guilbep/patterns', 'Simetrías del plano y Penrose'],
  ['ratpi-studio/svg-pattern-generator', 'Generadores vectoriales y controles'],
  ['vladstudio/patterns', 'Generación determinística de patrones'],
  ['looeee/hyperbolic-tiling', 'Referencia de teselaciones hiperbólicas'],
  ['pisan-labs/poincare-paint', 'Referencia del disco de Poincaré'],
] as const;
const libraries = [
  ['react/react', 'Interfaz y actualización de vistas'],
  ['paperjs/paper.js', 'Curvas Bézier, booleanas y recortes'],
  ['junmer/clipper-lib', 'Contornos vectoriales de trazos'],
  ['jakearchibald/idb', 'Guardado local en IndexedDB'],
  ['colinhacks/zod', 'Validación de archivos'],
  ['lucide-icons/lucide', 'Iconos de la interfaz'],
] as const;
const otherReferences = [
  ['Patturn Studio', 'https://patturn.studio/', 'Referencia visual y organización de herramientas'],
  [
    'Isohedral Tiles, Tilings, and Notations',
    'https://isohedral.ca/isohedral-tiles-tilings-and-notations/',
    'Clasificación de Kaplan y Schattschneider',
  ],
  [
    'Spectre · Universidad de Waterloo',
    'https://cs.uwaterloo.ca/~csk/spectre/',
    'Construcciones aperiódicas',
  ],
  [
    'Museo Escher · peces y aves',
    'https://www.escherinhetpaleis.nl/en/about-escher/escher-today/experimenting-fishes-birds',
    'Inspiración para dibujos originales',
  ],
  [
    'Museo Escher · reptiles',
    'https://www.escherinhetpaleis.nl/en/about-escher/escher-today/repeating-reptiles',
    'División regular del plano',
  ],
  ['M. C. Escher · Simetría', 'https://mcescher.com/gallery/symmetry/', 'Galería de referencia'],
  [
    'Inkscape · Tiling tool',
    'https://wiki.inkscape.org/wiki/Tiling_tool',
    'Clones y edición desde instancias',
  ],
] as const;

export function ReferencesDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Repositorios y referencias" className="references-modal" onClose={onClose}>
      <header>
        <h2>Repositorios y referencias</h2>
        <button aria-label="Cerrar referencias" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <p className="help-text">Fuentes consultadas y bibliotecas que hacen posible Patterns.</p>
      <div className="references-scroll" tabIndex={0} aria-label="Listado de referencias">
        {[
          ['Repositorios consultados', consultedRepositories],
          ['Bibliotecas del estudio', libraries],
        ].map(([title, rows]) => (
          <section key={String(title)}>
            <h3>{String(title)}</h3>
            <ul>
              {(rows as typeof consultedRepositories | typeof libraries).map(
                ([repo, description]) => (
                  <li key={repo}>
                    <a
                      href={`https://github.com/${repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>{repo}</span>
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                    <p>{description}</p>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
        <section>
          <h3>Otras referencias</h3>
          <ul>
            {otherReferences.map(([title, url, description]) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <span>{title}</span>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
                <p>{description}</p>
              </li>
            ))}
          </ul>
        </section>
        <a
          className="references-notices"
          href={`${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.txt`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Avisos de las bibliotecas
        </a>
      </div>
    </Modal>
  );
}
