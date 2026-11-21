import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from './Modal';
import { isohedralCatalog } from '../isohedral/catalog';
import { isohedralThumbnail } from '../isohedral/preview';

export function IsohedralGallery({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (type: number, curved: boolean) => void;
}) {
  const [query, setQuery] = useState(''),
    [family, setFamily] = useState('Todas'),
    [curved, setCurved] = useState(false),
    [page, setPage] = useState(0),
    [narrow, setNarrow] = useState(innerWidth < 650);
  useEffect(() => {
    const resize = () => setNarrow(innerWidth < 650);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const entries = useMemo(
    () =>
      isohedralCatalog.filter((row) => {
        const q = query
          .trim()
          .toLowerCase()
          .replace(/^ih\s*[-_]?\s*/, '');
        return (
          (!q || `${row.id} ${row.group} ${row.topology}`.toLowerCase().includes(q)) &&
          (family === 'Todas' ||
            (family === 'Marcas interiores' ? row.marked : row.family === family))
        );
      }),
    [query, family],
  );
  const size = narrow ? 2 : 4,
    total = Math.max(1, Math.ceil(entries.length / size)),
    current = Math.min(page, total - 1);
  const cards = useMemo(
    () =>
      entries.slice(current * size, current * size + size).map((row) => ({
        ...row,
        shape: row.implemented ? isohedralThumbnail(row.id, false, curved) : '',
        tiling: row.implemented ? isohedralThumbnail(row.id, true, curved) : '',
      })),
    [entries, current, size, curved],
  );
  return (
    <Modal label="Catálogo isoédrico" className="isohedral-gallery" onClose={onClose}>
      <header>
        <div>
          <h2>Teselas isoédricas</h2>
          <p>93 tipos verificados · 81 geométricos y 12 con marcas interiores</p>
        </div>
        <button aria-label="Cerrar catálogo isoédrico" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="isohedral-filters">
        <input
          aria-label="Buscar tipo IH"
          placeholder="IH41, p3, [4^4]…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Familia isoédrica"
          value={family}
          onChange={(e) => {
            setFamily(e.target.value);
            setPage(0);
          }}
        >
          {[
            'Todas',
            'Traslaciones',
            'Giros',
            'Reflexiones y deslizamientos',
            'Marcas interiores',
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Bordes iniciales del catálogo"
          value={String(curved)}
          onChange={(e) => setCurved(e.target.value === 'true')}
        >
          <option value="false">Bordes rectos</option>
          <option value="true">Curva suave</option>
        </select>
      </div>
      <div className="isohedral-cards">
        {cards.map((row) => (
          <button
            key={row.id}
            disabled={!row.implemented}
            className="isohedral-card"
            aria-label={`Usar IH${row.id}`}
            onClick={() => onSelect(row.id, curved)}
          >
            {row.implemented ? (
              <div className="isohedral-thumbnails">
                <img alt={`Tesela IH${row.id}`} src={row.shape} />
                <img alt={`Teselado IH${row.id}`} src={row.tiling} />
              </div>
            ) : (
              <div className="isohedral-pending">IH{row.id} · marcas interiores</div>
            )}
            <strong>
              IH{row.id} <span>{row.group}</span>
            </strong>
            <small>
              {row.topology} · tesela {row.tileSymmetry}
            </small>
            <div className="isohedral-badges">
              {row.marked && <span>Marcas interiores</span>}
              {row.reflection && <span>Reflexiones</span>}
              {row.rotation && <span>Giros</span>}
              {row.group === 'p1' && <span>Traslaciones</span>}
            </div>
            <p>
              {row.implemented
                ? row.marked
                  ? 'Bordes rectos · el motivo define las marcas'
                  : 'Geometría y encastre verificados · editable'
                : 'Pendiente de construcción y validación'}
            </p>
          </button>
        ))}
      </div>
      {!cards.length && <p className="help-text">No hay tipos con ese filtro.</p>}
      <footer>
        <button disabled={current === 0} onClick={() => setPage(current - 1)}>
          Anteriores
        </button>
        <span>
          {current + 1}/{total}
        </span>
        <button disabled={current + 1 >= total} onClick={() => setPage(current + 1)}>
          Siguientes
        </button>
      </footer>
    </Modal>
  );
}
