import { useEffect, useState } from 'react';
import { AperiodicPanel } from './AperiodicPanel';
import { finiteGenerator } from '../aperiodic/model';
import type { Studio } from '../app/useStudio';
import { newTiling, tileNames, constrainTiling, type TileKind } from '../tiling/tiles';
import { node } from '../app/model';
import { Field, Select, Toggle } from './Controls';
import { IsohedralControls } from './IsohedralControls';
import { newIsohedral, isohedralConstraints } from '../isohedral/engine';
import { isohedralDefinition } from '../tiling/tiles';
import { splitCanonicalEdge } from '../isohedral/edit';
export function TilePanel({
  studio: s,
  expanded = false,
  onIsohedral,
}: {
  studio: Studio;
  expanded?: boolean;
  onIsohedral: () => void;
}) {
  const [family, setFamily] = useState(
    finiteGenerator(s.pattern.generator) ? 'aperiodic' : 'periodic',
  );
  useEffect(() => {
    if (finiteGenerator(s.pattern.generator)) setFamily('aperiodic');
  }, [s.pattern.id, s.pattern.generator.kind]);
  const tab = s.tileTab;
  const tile = s.pattern.tiling,
    e = tile ? Math.min(s.tileEdge, tile.edges.length - 1) : 0,
    edge = tile?.edges[e],
    n = edge ? Math.min(s.tileNode, edge.length - 1) : 0,
    selected = edge?.[n];
  const iso = tile?.kind === 'isohedral',
    constraints = iso && tile ? isohedralConstraints(isohedralDefinition(tile)) : [],
    constraint = constraints[e],
    movableCenter = constraint === 'mirror' && n === (edge?.length ?? 0) - 1;
  const update = (recipe: Parameters<Studio['editTiling']>[0]) => {
    s.editTiling(recipe);
    s.setInstanceExplicit(false);
  };
  return (
    <details className="tile-panel" open={expanded}>
      <summary>
        <select
          aria-label="Categoría de teselación"
          className="tile-family-select"
          value={family}
          onChange={(e) => setFamily(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="periodic">Encastre</option>
          <option value="aperiodic">Aperiódicas</option>
        </select>
        <strong>
          {family === 'aperiodic'
            ? 'Parche finito'
            : tile?.isohedral
              ? `IH${tile.isohedral.type}`
              : tile
                ? tileNames[tile.kind]
                : 'Desactivadas'}
        </strong>
      </summary>
      {family === 'aperiodic' ? (
        <AperiodicPanel studio={s} />
      ) : (
        <>
          <div className="context-tabs" role="tablist" aria-label="Opciones de tesela">
            {(['shape', 'placement', 'edge', 'tangents'] as const)
              .filter((id) => !!tile || id === 'shape')
              .map((id) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => {
                    s.setTileTab(id);
                    if (id === 'edge' || id === 'tangents') s.setTileEditing(true);
                  }}
                >
                  {
                    {
                      shape: 'Forma',
                      placement: 'Colocación',
                      edge: 'Bordes',
                      tangents: 'Tangentes',
                    }[id]
                  }
                </button>
              ))}
          </div>
          <div className="tile-controls compact-fields">
            <div hidden={tab !== 'shape'} className="compact-fields">
              <p className="help-text" hidden={iso}>
                La tesela define la cobertura. El motivo se recorta dentro de ella y usa su propia
                simetría local.
              </p>
              {finiteGenerator(s.pattern.generator) ? (
                <p className="math-notice">
                  La familia seleccionada conserva su construcción aperiódica finita. Convertí el
                  generador a paths para usar una familia periódica de teselas.
                </p>
              ) : (
                <Toggle
                  label="Usar teselas geométricas"
                  checked={!!tile}
                  onChange={(enabled) => {
                    s.change((p) => {
                      const pat = p.patterns.find((p) => p.id === s.pattern.id)!;
                      if (enabled) pat.tiling = newTiling();
                      else delete pat.tiling;
                    });
                    s.setTileEditing(false);
                    s.setInstanceExplicit(false);
                  }}
                />
              )}
              <button className="wide-button" onClick={onIsohedral}>
                Explorar catálogo IH1–IH93
              </button>
            </div>
            {tile && !finiteGenerator(s.pattern.generator) && (
              <>
                <div hidden={tab !== 'shape'} className="compact-fields">
                  <Select
                    label="Forma de tesela"
                    value={tile.kind}
                    onChange={(kind) => {
                      const fresh = newTiling(kind as TileKind);
                      s.change((p) => {
                        const pat = p.patterns.find((x) => x.id === s.pattern.id)!;
                        pat.tiling = constrainTiling({
                          ...fresh,
                          width: tile.width,
                          height: tile.height,
                          origin: tile.origin,
                          rotation: tile.rotation,
                          showOutline: tile.showOutline,
                        });
                        if (kind === 'isohedral' && pat.composition)
                          pat.composition.enabled = false;
                      });
                      s.setTileEdge(0);
                      s.setTileNode(1);
                      s.setInstanceExplicit(false);
                      if (kind === 'isohedral') {
                        s.updateViewPreferences({ sourceView: false, repetitionView: 'extended' });
                        s.requestFit();
                      }
                    }}
                    options={Object.entries(tileNames).map(([value, label]) => ({ value, label }))}
                  />
                  {iso && <IsohedralControls studio={s} />}
                  <p className="help-text" hidden={iso}>
                    Cambiar de familia reinicia sus bordes; conserva el dibujo. Podés deshacer.
                  </p>
                  <div className="two-fields">
                    <Field
                      label={iso ? 'Escala de tesela' : 'Ancho de tesela'}
                      value={tile.width}
                      min={5}
                      max={400}
                      unit="mm"
                      onChange={(v) =>
                        update((t) => {
                          t.width = v;
                        })
                      }
                    />
                    {['rectangle', 'parallelogram'].includes(tile.kind) && (
                      <Field
                        label="Alto de tesela"
                        value={tile.height}
                        min={5}
                        max={400}
                        unit="mm"
                        onChange={(v) =>
                          update((t) => {
                            t.height = v;
                          })
                        }
                      />
                    )}
                  </div>
                  {tile.kind === 'parallelogram' && (
                    <Field
                      label="Desplazamiento del paralelogramo"
                      value={tile.shear}
                      min={-400}
                      max={400}
                      unit="mm"
                      onChange={(v) =>
                        update((t) => {
                          t.shear = v;
                        })
                      }
                    />
                  )}
                </div>
                <div hidden={tab !== 'placement'} className="compact-fields">
                  <Field
                    label="Orientación de teselas"
                    value={tile.rotation}
                    min={-180}
                    max={180}
                    unit="°"
                    onChange={(v) =>
                      update((t) => {
                        t.rotation = v;
                      })
                    }
                  />
                  <div className="two-fields">
                    {(['x', 'y'] as const).map((axis) => (
                      <Field
                        key={axis}
                        label={`Origen de teselas ${axis.toUpperCase()}`}
                        value={tile.origin[axis]}
                        min={-100000}
                        max={100000}
                        unit="mm"
                        onChange={(v) =>
                          update((t) => {
                            t.origin[axis] = v;
                          })
                        }
                      />
                    ))}
                  </div>
                  <Toggle
                    label="Contornos de teselas"
                    checked={tile.showOutline}
                    onChange={(v) =>
                      update((t) => {
                        t.showOutline = v;
                      })
                    }
                  />
                </div>
                <div hidden={tab !== 'edge' && tab !== 'tangents'} className="compact-fields">
                  <Toggle
                    label="Editar bordes de tesela"
                    checked={s.tileEditing}
                    onChange={s.setTileEditing}
                  />
                  {s.tileEditing && edge && selected && (
                    <>
                      <p className="math-notice" hidden={tab !== 'edge'}>
                        {iso
                          ? constraint === 'straight'
                            ? 'Este borde es un eje de espejo y debe ser recto.'
                            : constraint === 'halfturn'
                              ? 'Editás medio borde; su pareja mantiene un giro de180°.'
                              : constraint === 'mirror'
                                ? 'Editás medio borde; el otro se refleja. Su punto central puede desplazarse.'
                                : 'Cada borde relacionado se actualiza con su isometría.'
                          : tile.kind === 'triangle'
                            ? 'Editás medio borde; la otra mitad mantiene simetría central.'
                            : 'El borde opuesto se actualiza automáticamente.'}{' '}
                        {iso
                          ? 'Se comprueba área, cierre e intersecciones; una edición inválida conserva el estado anterior.'
                          : 'Los vértices son fijos y la curvatura se limita para conservar encastres.'}
                      </p>
                      <div className="two-fields">
                        <Select
                          label="Borde maestro"
                          value={String(e)}
                          onChange={(v) => {
                            s.setTileEdge(Number(v));
                            s.setTileNode(1);
                          }}
                          options={tile.edges.map((_, i) => ({
                            value: String(i),
                            label: `Borde ${i + 1}`,
                          }))}
                        />
                        <Select
                          label="Nodo del borde"
                          value={String(n)}
                          onChange={(v) => s.setTileNode(Number(v))}
                          options={edge.map((_, i) => ({
                            value: String(i),
                            label:
                              constraint === 'mirror' && i === edge.length - 1
                                ? 'Centro del borde'
                                : i === 0 || i === edge.length - 1
                                  ? `Vértice fijo ${i + 1}`
                                  : `Nodo ${i + 1}`,
                          }))}
                        />
                      </div>
                      {tab === 'edge' &&
                        n > 0 &&
                        (n < edge.length - 1 || movableCenter) &&
                        constraint !== 'straight' && (
                          <div className="two-fields">
                            {!movableCenter && (
                              <Field
                                label="Posición en el borde"
                                value={selected.x * 100}
                                min={edge[n - 1].x * 100 + 0.5}
                                max={edge[n + 1].x * 100 - 0.5}
                                unit="%"
                                onChange={(v) =>
                                  update((t) => {
                                    t.edges[e][n].x = v / 100;
                                  })
                                }
                              />
                            )}
                            <Field
                              label="Desvío del borde"
                              value={selected.y * 100}
                              min={iso ? -200 : -7}
                              max={iso ? 200 : 7}
                              step={0.1}
                              unit="%"
                              onChange={(v) =>
                                update((t) => {
                                  t.edges[e][n].y = v / 100;
                                })
                              }
                            />
                          </div>
                        )}
                      <div
                        hidden={tab !== 'tangents' || constraint === 'straight'}
                        className="compact-fields"
                      >
                        <strong>Tangentes Bézier del nodo</strong>
                        {(['in', 'out'] as const)
                          .filter(
                            (handle) =>
                              !(handle === 'in' && n === 0) &&
                              !(handle === 'out' && n === edge.length - 1),
                          )
                          .map((handle) => (
                            <div key={handle} className="two-fields">
                              {(['x', 'y'] as const).map((axis) => (
                                <Field
                                  key={axis}
                                  label={`${handle === 'in' ? 'Entrante' : 'Saliente'} ${axis.toUpperCase()}`}
                                  value={selected[handle][axis] * 100}
                                  step={0.1}
                                  unit="%"
                                  min={-100}
                                  max={100}
                                  onChange={(v) =>
                                    update((t) => {
                                      t.edges[e][n][handle][axis] = v / 100;
                                    })
                                  }
                                />
                              ))}
                            </div>
                          ))}
                      </div>
                      <div className="button-row" hidden={tab !== 'edge'}>
                        <button
                          disabled={edge.length >= (iso ? 32 : 16) || constraint === 'straight'}
                          onClick={() => {
                            let index = 0;
                            for (let i = 1; i < edge.length - 1; i++)
                              if (edge[i + 1].x - edge[i].x > edge[index + 1].x - edge[index].x)
                                index = i;
                            update((t) => {
                              if (iso) {
                                splitCanonicalEdge(t.edges[e], index);
                                return;
                              }
                              const a = t.edges[e][index],
                                b = t.edges[e][index + 1];
                              t.edges[e].splice(
                                index + 1,
                                0,
                                node((a.x + b.x) / 2, (a.y + b.y) / 2),
                              );
                            });
                            s.setTileNode(index + 1);
                          }}
                        >
                          Añadir nodo al borde
                        </button>
                        <button
                          disabled={
                            edge.length <= 3 ||
                            n === 0 ||
                            n === edge.length - 1 ||
                            constraint === 'straight'
                          }
                          onClick={() => {
                            update((t) => {
                              t.edges[e].splice(n, 1);
                            });
                            s.setTileNode(Math.max(1, n - 1));
                          }}
                        >
                          Quitar nodo del borde
                        </button>
                      </div>
                      <button
                        className="wide-button"
                        onClick={() =>
                          update((t) => {
                            t.edges = t.isohedral
                              ? newIsohedral(t.isohedral.type).edges
                              : newTiling(t.kind).edges;
                          })
                        }
                      >
                        Restablecer bordes rectos
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </details>
  );
}
