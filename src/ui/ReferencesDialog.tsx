import { ExternalLink, X } from 'lucide-react';
import { Modal } from './Modal';

export const consultedRepositories = [
  ['isohedral/tactile-js', 'Motor de teselaciones isoédricas'],
  ['IkarosKappler/girih', 'Catálogo Girih consultado; construcción matemática independiente'],
  ['isohedral/hatviz', 'Reglas de sustitución Hat y jerarquía de metateselas'],
  ['isohedral/tactile', 'Representación y parámetros isoédricos'],
  ['DBraun/tactile-python', 'Referencia de implementación isoédrica'],
  ['mapio/programming-with-escher', 'Datos del pez GPL3 y composición funcional'],
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
  [
    'Tschanz · Grupos triangulares por reflexión',
    'https://link.springer.com/article/10.1007/s12220-023-01208-x',
    'Fundamentos de cámaras hiperbólicas reflejadas',
  ],
  [
    'Ouyang et al. · Plantillas hiperbólicas',
    'https://scholars.cityu.edu.hk/en/publications/visualization-of-escher-like-hyperbolic-tessellations/',
    'Referencia conceptual de adaptación de motivos; dibujos originales propios',
  ],
  [
    'Kaplan · Polygons in Contact',
    'https://cs.uwaterloo.ca/~csk/publications/Papers/kaplan_2005.pdf',
    'Rayos ornamentales e inferencia de Hankin',
  ],
  [
    'Tilings Encyclopedia · Girih',
    'https://tilings.math.uni-bielefeld.de/glossary/girih/',
    'Ángulos, prototipos y clasificación',
  ],
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
  [
    'Sean Michael Ragan · MC Escher lizard vector art',
    'https://www.seanmichaelragan.com/html/%5B2008-04-18%5D_MC_Escher_lizard_vector_art.shtml',
    'Trazado vectorial del lagarto en dominio público; método de celda hexagonal',
  ],
  [
    'reox · create escher lizard tesselation',
    'https://www.reox.at/blog/posts/create_escher_lizard_tesselation/',
    'Reconstrucción del mosaico de lagartos (dominio público); fuente del estudio de referencia',
  ],
  [
    'jaredly/tessellations',
    'https://github.com/jaredly/tessellations',
    'Perfiles Bézier de encastre (MIT); fuente de los estudios ornamentales',
  ],
  [
    'einarwh/escher-workshop · Henderson Fish',
    'https://github.com/einarwh/escher-workshop',
    'Comparación de curvas del pez de Henderson (MIT); sin duplicar el pez GPL3 existente',
  ],
  [
    'Openclipart · Escher style (Night and Day)',
    'https://openclipart.org/detail/249414',
    'Aves de contraste claro/oscuro en dominio público; documentado para futuras reconstrucciones',
  ],
  [
    'Openclipart · Seamless Lizards Tessellation',
    'https://openclipart.org/detail/295026',
    'Lagartos encastrados en dominio público; variantes cromáticas de una misma geometría',
  ],
  [
    'Openclipart · Tessellating Fish',
    'https://openclipart.org/detail/167216',
    'Peces encastrados en dominio público; silueta independiente del pez Henderson',
  ],
  [
    'Openclipart · Escher Lizard spiral set',
    'https://openclipart.org/detail/357838',
    'Espiral de lagartos con semejanza en dominio público; documentado',
  ],
  [
    'Openclipart · Tortured Lizard',
    'https://openclipart.org/detail/340157',
    'Lagarto sobre hexágono deformado en dominio público; documentado',
  ],
  [
    'Evin Revello · Graphic_Design',
    'https://github.com/evinr/Graphic_Design',
    'SVG de peces de Escher consultado; el repositorio no declara licencia y no se redistribuye',
  ],
  [
    'Paulo Henrique Siqueira · Escher tessellations',
    'https://paulohscwb.github.io/tessellation/escher/',
    'Escenas sobre poliedros; sólo recursos raster, sin geometría vectorial reutilizable',
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
