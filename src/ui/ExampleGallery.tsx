import { useMemo, useState, useEffect } from 'react';
import { Modal } from './Modal';
import { exampleCatalog, catalogTitle } from '../examples/catalog';
import { compositionThumbnail } from '../composition/preview';
import { resolvePattern } from '../symmetry/config';
import { tr, useI18n } from '../i18n';
import { friendlyCategoryLabel } from '../app/ui-mode';
export function ExampleGallery({
  onSelect,
  onClose,
}: {
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const experience = useI18n(),
    simple = experience.uiMode === 'simple',
    displayCategory = (value: string) =>
      tr((simple && friendlyCategoryLabel(value)) || value);
  const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight });
  const narrow = viewport.width < 650;
  useEffect(() => {
    const resize = () => setViewport({ width: innerWidth, height: innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('Todas'),
    [page, setPage] = useState(0);
  const entries = useMemo(
    () =>
      exampleCatalog.map((entry) => {
        const project = entry.create();
        return {
          ...entry,
          title: tr(catalogTitle(entry)),
          thumbnail:
            entry.thumbnail ??
            compositionThumbnail(
              resolvePattern(project.patterns[0], project),
              undefined,
              project.preferences.background,
            ),
        };
      }),
    [],
  );
  const filtered = entries.filter(
    (entry) =>
      (category === 'Todas' || entry.category === category) &&
      `${entry.title} ${entry.description} ${entry.construction}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const pageSize = viewport.height < 700 ? (narrow ? 1 : 2) : narrow ? 2 : 4,
    pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    current = Math.min(page, pages - 1);
  return (
    <Modal label={tr('Galería de ejemplos')} className="example-gallery-modal" onClose={onClose}>
      <header className="gallery-title">
        <div>
          <h2>{tr('Ejemplos para explorar')}</h2>
          <p>{tr('Motivos originales y construcciones editables.')}</p>
        </div>
        <button onClick={onClose} aria-label={tr('Cerrar galería de ejemplos')}>
          ✕
        </button>
      </header>
      <div className="example-filters">
        <input
          aria-label={tr('Buscar ejemplos')}
          type="search"
          value={query}
          placeholder={tr('Peces, aves, espiral…')}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label={tr('Categoría de ejemplos')}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(0);
          }}
        >
          {['Todas', ...new Set(entries.map((row) => row.category))].map((value) => (
            <option key={value}>{tr(value)}</option>
          ))}
        </select>
      </div>
      <div
        className="example-cards"
        style={{ gridTemplateRows: `repeat(${pageSize > (narrow ? 1 : 2) ? 2 : 1},minmax(0,1fr))` }}
      >
        {filtered.slice(current * pageSize, (current + 1) * pageSize).map((entry) => (
          <button
            key={entry.id}
            className="example-card"
            onClick={() => onSelect(entry.id)}
            aria-label={`${tr('Abrir ejemplo')} ${entry.title}`}
            aria-description={`${tr(entry.description)} ${tr(entry.construction)}`}
            title={`${tr(entry.description)} ${tr(entry.construction)}`}
          >
            <img src={entry.thumbnail} alt={tr('Vista previa de {title}', { title: entry.title })} />
            <span className="example-category">
              {displayCategory(entry.category)}
              {entry.artwork === 'original'
                ? ` · ${tr('Original')}`
                : entry.artwork === 'licensed'
                  ? ` · ${tr('Datos acreditados')}`
                  : ` · ${tr('Geometría')}`}
            </span>
            <strong>{entry.title}</strong>
            <span className="example-description">{tr(entry.description)}</span>
            <small className="example-construction">{tr(entry.construction)}</small>
            <small>
              {tr('Validación:')}{' '}
              {entry.validity === 'EXACT' ? tr('transformaciones verificadas') : entry.validity}
            </small>
          </button>
        ))}
        {!filtered.length && <p>{tr('No se encontraron ejemplos.')}</p>}
      </div>
      <div className="page-controls">
        <button disabled={!current} onClick={() => setPage(current - 1)}>
          {tr('Ejemplos anteriores')}
        </button>
        <span>
          {current + 1}/{pages}
        </span>
        <button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>
          {tr('Más ejemplos')}
        </button>
      </div>
    </Modal>
  );
}
