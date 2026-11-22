import { useMemo, useState, useEffect } from 'react';
import { Modal } from './Modal';
import { exampleCatalog, catalogTitle } from '../examples/catalog';
import { compositionThumbnail } from '../composition/preview';
import { resolvePattern } from '../symmetry/config';
export function ExampleGallery({
  onSelect,
  onClose,
}: {
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
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
          title: catalogTitle(entry),
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
    <Modal label="Galería de ejemplos" className="example-gallery-modal" onClose={onClose}>
      <header className="gallery-title">
        <div>
          <h2>Ejemplos para explorar</h2>
          <p>Motivos originales y construcciones editables.</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar galería de ejemplos">
          ✕
        </button>
      </header>
      <div className="example-filters">
        <input
          aria-label="Buscar ejemplos"
          type="search"
          value={query}
          placeholder="Peces, aves, espiral…"
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Categoría de ejemplos"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(0);
          }}
        >
          {['Todas', ...new Set(entries.map((row) => row.category))].map((value) => (
            <option key={value}>{value}</option>
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
            aria-label={`Abrir ejemplo ${entry.title}`}
            aria-description={`${entry.description} ${entry.construction}`}
            title={`${entry.description} ${entry.construction}`}
          >
            <img src={entry.thumbnail} alt={`Vista previa de ${entry.title}`} />
            <span className="example-category">
              {entry.category}
              {entry.artwork === 'original'
                ? ' · Original'
                : entry.artwork === 'licensed'
                  ? ' · Datos acreditados'
                  : ' · Geometría'}
            </span>
            <strong>{entry.title}</strong>
            <span className="example-description">{entry.description}</span>
            <small className="example-construction">{entry.construction}</small>
            <small>
              Validación:{' '}
              {entry.validity === 'EXACT' ? 'transformaciones verificadas' : entry.validity}
            </small>
          </button>
        ))}
        {!filtered.length && <p>No se encontraron ejemplos.</p>}
      </div>
      <div className="page-controls">
        <button disabled={!current} onClick={() => setPage(current - 1)}>
          Ejemplos anteriores
        </button>
        <span>
          {current + 1}/{pages}
        </span>
        <button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>
          Más ejemplos
        </button>
      </div>
    </Modal>
  );
}
