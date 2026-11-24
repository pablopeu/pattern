import { useState } from 'react';
import type { Studio } from '../app/useStudio';
import { isohedralCatalog } from '../isohedral/catalog';
import { Field } from './Controls';
import { Palette, SlidersHorizontal } from 'lucide-react';
import { TileColors } from './TileColors';

import { tr } from '../i18n';
export function IsohedralControls({ studio: s }: { studio: Studio }) {
  const [page, setPage] = useState(0),
    [colorPage, setColorPage] = useState(false),
    t = s.pattern.tiling;
  if (!t?.isohedral) return null;
  const metadata = isohedralCatalog.find((r) => r.id === t.isohedral!.type)!,
    params = t.isohedral.parameters,
    pages = Math.max(1, Math.ceil(params.length / 2)),
    current = Math.min(page, pages - 1);
  return (
    <div className="isohedral-controls compact-fields">
      <p className="help-text">
        <button
          className="iso-color-switch"
          aria-label={colorPage ? 'Geometría de tesela' : 'Colores de tesela'}
          title={colorPage ? 'Geometría' : 'Colores de tesela'}
          onClick={() => setColorPage(!colorPage)}
        >
          {colorPage ? <SlidersHorizontal size={16} /> : <Palette size={16} />}
        </button>
        <strong>
          IH{metadata.id} · {metadata.group}
        </strong>{' '}
        · {metadata.topology}
        <br />
        {t.edges.length} bordes maestros · encastre verificado
      </p>
      {colorPage ? (
        <TileColors studio={s} />
      ) : (
        <>
          {metadata.marked && (
            <p className="help-text">
              Los detalles se repiten dentro de la tesela para respetar su simetría.
            </p>
          )}
          {params.length > 0 ? (
            <>
              <div className="two-fields">
                {params.slice(current * 2, current * 2 + 2).map((value, offset) => {
                  const index = current * 2 + offset;
                  return (
                    <Field
                      key={`${metadata.id}-${index}`}
                      label={`Parámetro IH ${index + 1}`}
                      value={value}
                      min={-4}
                      max={4}
                      step={0.01}
                      onChange={(value) =>
                        s.editTiling((t) => {
                          t.isohedral!.parameters[index] = value;
                        })
                      }
                    />
                  );
                })}
              </div>
              {pages > 1 && (
                <div className="button-row">
                  <button
                    aria-label={tr('Parámetros IH anteriores')}
                    disabled={!current}
                    onClick={() => setPage(current - 1)}
                  >
                    ←
                  </button>
                  <span>
                    Parámetros {current * 2 + 1}–{Math.min(params.length, current * 2 + 2)} de{' '}
                    {params.length}
                  </span>
                  <button
                    aria-label={tr('Parámetros IH siguientes')}
                    disabled={current + 1 >= pages}
                    onClick={() => setPage(current + 1)}
                  >
                    →
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="help-text">
              Vértices fijados por la simetría; editá los bordes permitidos y los detalles del
              motivo.
            </p>
          )}
        </>
      )}
    </div>
  );
}
