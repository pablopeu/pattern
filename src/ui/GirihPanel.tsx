import { useMemo, useState } from 'react';
import type { Studio } from '../app/useStudio';
import type { Generator } from '../app/model';
import { defaultGirih, girihDefinition } from '../girih/model';
import { generateGirih, placedGirihReport } from '../girih/generated';
import { attachGirih } from '../girih/patch';
import { girihNames, girihPolygon, girihAngles, type GirihKind } from '../girih/polygons';
import { Field, Select, Toggle } from './Controls';
import { Modal } from './Modal';
export function activateGirih(g: Generator): Generator {
  return {
    ...g,
    kind: 'girih',
    version: 3,
    girih: g.girih ?? defaultGirih(),
    spacing: Math.max(5, Math.min(100, g.spacing)),
    rows: Math.min(8, g.rows),
    columns: Math.min(8, g.columns),
  };
}
export function GirihPanel({ studio: s }: { studio: Studio }) {
  const [tab, setTab] = useState('design'),
    [catalog, setCatalog] = useState(false),
    [base, setBase] = useState(0),
    [edge, setEdge] = useState(0),
    [incoming, setIncoming] = useState(0),
    [kind, setKind] = useState<GirihKind>('pentagon'),
    g = s.pattern.generator,
    active = g.kind === 'girih',
    options = g.girih ?? defaultGirih(),
    computation = useMemo(() => {
      try {
        return {
          report: active
            ? generateGirih(
                g,
                s.pattern.sourceGeometry.filter((g) => !g.fillRegion),
              ).girih
            : undefined,
          error: '',
        };
      } catch (e) {
        return {
          report: undefined,
          error: e instanceof Error ? e.message : 'No se pudo construir el entrelazado.',
        };
      }
    }, [g, active, s.pattern.sourceGeometry]),
    derived = computation.report
      ? placedGirihReport(computation.report, s.pattern.placementTransform)
      : undefined,
    patch = active ? girihDefinition(g).tiles : [],
    baseIndex = Math.min(base, Math.max(0, patch.length - 1)),
    maxEdge = patch.length ? girihPolygon(patch[baseIndex].kind).length - 1 : 0,
    change = (recipe: (g: Generator) => void) =>
      s.change((p) => recipe(p.patterns.find((p) => p.id === s.patternId)!.generator)),
    activate = () => {
      change((g) => Object.assign(g, activateGirih(g)));
      s.setTileEditing(false);
      s.setInstanceExplicit(false);
      s.updateViewPreferences({ sourceView: false, repetitionView: 'extended' });
      s.requestFit();
    };
  return (
    <div className="compact-fields girih-panel">
      {computation.error && (
        <p className="math-notice" role="alert">
          {computation.error} Desactivá los ejes fuente o simplificá el dibujo; el original se
          conserva.
        </p>
      )}
      {!active ? (
        <>
          <p className="help-text">
            Cinco formas Girih, bordes compatibles y bandas vectoriales entrelazadas. Conserva tu
            motivo.
          </p>
          <button className="wide-button" onClick={activate}>
            Activar Girih
          </button>
        </>
      ) : (
        <>
          <div className="context-tabs" role="tablist" aria-label="Opciones Girih">
            {['design', 'bands', 'color', 'join'].map((id) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {{ design: 'Diseño', bands: 'Bandas', color: 'Color', join: 'Unir' }[id]}
              </button>
            ))}
          </div>
          {tab === 'design' && (
            <>
              <Select
                label="Construcción Girih"
                value={options.recipe}
                options={[
                  { value: 'rosette', label: 'Roseta decagonal y pentágonos' },
                  { value: 'rhombus-grid', label: 'Red de rombos72°' },
                  { value: 'star', label: 'Estrella de cinco rombos' },
                  { value: 'single', label: 'Una tesela del catálogo' },
                  { value: 'custom', label: 'Parche personalizado' },
                ]}
                onChange={(value) => {
                  change((g) => {
                    if (value === 'custom')
                      g.girih!.tiles = structuredClone(girihDefinition(g).tiles);
                    g.girih!.recipe = value as typeof options.recipe;
                  });
                  s.requestFit();
                }}
              />
              <div className="two-fields">
                <Field
                  label="Lado Girih"
                  value={g.spacing}
                  min={5}
                  max={100}
                  unit="mm"
                  onChange={(v) =>
                    change((g) => {
                      g.spacing = v;
                      g.girih!.bandWidth = Math.min(g.girih!.bandWidth, v * 0.2);
                      g.girih!.gap = Math.min(g.girih!.gap, g.girih!.bandWidth);
                    })
                  }
                />
                <Field
                  label="Giro Girih"
                  value={g.rotation}
                  min={-180}
                  max={180}
                  unit="°"
                  onChange={(v) =>
                    change((g) => {
                      g.rotation = v;
                    })
                  }
                />
              </div>
              {options.recipe === 'rhombus-grid' && (
                <div className="two-fields">
                  <Field
                    label="Filas Girih"
                    value={g.rows}
                    min={1}
                    max={8}
                    integer
                    onChange={(v) =>
                      change((g) => {
                        g.rows = v;
                      })
                    }
                  />
                  <Field
                    label="Columnas Girih"
                    value={g.columns}
                    min={1}
                    max={8}
                    integer
                    onChange={(v) =>
                      change((g) => {
                        g.columns = v;
                      })
                    }
                  />
                </div>
              )}
              <button className="wide-button" onClick={() => setCatalog(true)}>
                Catálogo de cinco teselas Girih
              </button>
              <Toggle
                label="Mostrar polígonos Girih"
                checked={options.showTiles}
                onChange={(v) =>
                  change((g) => {
                    g.girih!.showTiles = v;
                  })
                }
              />
              <p className="math-notice">
                {derived?.tiles} teselas · {derived?.adjacencies} bordes unidos.{' '}
                {options.recipe === 'single'
                  ? 'Tesela aislada: no demuestra una cobertura.'
                  : 'Parche finito con adyacencias verificadas.'}{' '}
              </p>
            </>
          )}
          {tab === 'bands' && (
            <>
              <Toggle
                label="Entrelazar bandas Girih"
                checked={options.weave}
                onChange={(v) =>
                  change((g) => {
                    g.girih!.weave = v;
                  })
                }
              />
              <Toggle
                label="Entrelazar trazos del motivo"
                checked={options.weaveSource}
                onChange={(v) =>
                  change((g) => {
                    g.girih!.weaveSource = v;
                  })
                }
              />
              <div className="two-fields">
                <Field
                  label="Ancho de banda Girih"
                  value={options.bandWidth}
                  min={0.1}
                  max={Math.min(5, g.spacing * 0.2)}
                  step={0.1}
                  unit="mm"
                  onChange={(v) =>
                    change((g) => {
                      g.girih!.bandWidth = v;
                      g.girih!.gap = Math.min(g.girih!.gap, v);
                    })
                  }
                />
                <Field
                  label="Separación de cruce Girih"
                  value={options.gap}
                  min={0}
                  max={options.bandWidth}
                  step={0.05}
                  unit="mm"
                  onChange={(v) =>
                    change((g) => {
                      g.girih!.gap = v;
                    })
                  }
                />
              </div>
              <button
                className="wide-button"
                onClick={() =>
                  change((g) => {
                    g.girih!.phase = g.girih!.phase ? 0 : 1;
                  })
                }
              >
                Invertir arriba/abajo
              </button>
              <p
                className={derived?.conflicts || derived?.ambiguous ? 'math-notice' : 'help-text'}
                role="status"
              >
                {derived?.validity} · {derived?.crossings} cruces ·{' '}
                {derived?.woven
                  ? derived.breaks
                    ? `${derived.breaks} cortes de alternancia aceptados`
                    : 'Alternancia global verificada'
                  : options.weave
                    ? 'Conflicto: se conserva la banda sin cortes.'
                    : 'Bandas sin entrelazado'}
                .
                {derived?.ambiguous
                  ? ` ${derived.ambiguous} contactos ambiguos; cambiá el ensamblado.`
                  : ''}
              </p>
              {!!derived?.conflicts && (
                <Toggle
                  label="Permitir cortes explícitos de alternancia"
                  checked={options.allowBreaks}
                  onChange={(v) =>
                    change((g) => {
                      g.girih!.allowBreaks = v;
                    })
                  }
                />
              )}
              <p className="help-text">
                Los huecos del paso inferior son geometría vectorial. El solver conecta los bordes
                compartidos y comprueba cada hebra completa.
              </p>
            </>
          )}
          {tab === 'color' && (
            <>
              <div className="tile-palette">
                {options.palette.map((color, i) => (
                  <label key={i}>
                    Color {i + 1}
                    <input
                      type="color"
                      aria-label={`Color Girih ${i + 1}`}
                      value={color}
                      onChange={(e) =>
                        change((g) => {
                          g.girih!.palette[i] = e.target.value;
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <p className="help-text">
                Paleta de bandas y de polígonos guía. Los dibujos que agregues conservan sus propios
                colores.
              </p>
            </>
          )}
          {tab === 'join' && (
            <>
              <div className="two-fields">
                <Field
                  label="Tesela base Girih"
                  value={baseIndex + 1}
                  min={1}
                  max={patch.length}
                  integer
                  onChange={(v) => {
                    setBase(v - 1);
                    setEdge(0);
                  }}
                />
                <Field
                  label="Borde base Girih"
                  value={Math.min(edge, maxEdge) + 1}
                  min={1}
                  max={maxEdge + 1}
                  integer
                  onChange={(v) => setEdge(v - 1)}
                />
              </div>
              <Select
                label="Tesela nueva Girih"
                value={kind}
                options={Object.entries(girihNames).map(([value, label]) => ({ value, label }))}
                onChange={(v) => {
                  setKind(v as GirihKind);
                  setIncoming(0);
                }}
              />
              <Field
                label="Borde nuevo Girih"
                value={incoming + 1}
                min={1}
                max={girihPolygon(kind).length}
                integer
                onChange={(v) => setIncoming(v - 1)}
              />
              <button
                className="wide-button"
                onClick={() => {
                  try {
                    const next = attachGirih(
                      patch,
                      baseIndex,
                      Math.min(edge, maxEdge),
                      kind,
                      incoming,
                    );
                    change((g) => {
                      g.girih!.recipe = 'custom';
                      g.girih!.tiles = next;
                    });
                    s.setMessage('Tesela unida con borde y área verificados.');
                    s.requestFit();
                  } catch (e) {
                    s.setMessage(e instanceof Error ? e.message : 'No se pudo unir la tesela.');
                  }
                }}
              >
                Unir por este borde
              </button>
              <p className="help-text">
                Bordes completos de la misma longitud; rechaza colisiones y conserva el último
                parche válido. Máximo128 teselas.
              </p>
            </>
          )}
          <div className="two-fields">
            <button
              className="wide-button"
              aria-label={
                s.project.preferences.sourceView ? 'Ver resultado Girih' : 'Editar trazos fuente'
              }
              onClick={() => {
                s.updateViewPreferences({ sourceView: !s.project.preferences.sourceView });
                s.requestFit();
              }}
            >
              {s.project.preferences.sourceView ? 'Ver resultado' : 'Editar fuente'}
            </button>
            <button
              className="wide-button"
              aria-label="Volver al motivo guardado"
              onClick={() => {
                change((g) => {
                  g.kind = 'motif';
                });
                s.requestFit();
              }}
            >
              Volver al motivo
            </button>
          </div>
        </>
      )}
      {catalog && (
        <Modal
          label="Catálogo Girih"
          className="simple-modal girih-catalog"
          onClose={() => setCatalog(false)}
        >
          <header>
            <h2>Cinco teselas Girih</h2>
            <button aria-label="Cerrar catálogo Girih" onClick={() => setCatalog(false)}>
              ×
            </button>
          </header>
          <div className="girih-catalog-grid">
            {(Object.keys(girihNames) as GirihKind[]).map((kind) => {
              const points = girihPolygon(kind),
                xs = points.map((p) => p.x),
                ys = points.map((p) => p.y),
                x = Math.min(...xs) - 0.25,
                y = Math.min(...ys) - 0.25,
                w = Math.max(...xs) - x + 0.25,
                h = Math.max(...ys) - y + 0.25;
              return (
                <button
                  key={kind}
                  aria-label={`Usar tesela Girih ${girihNames[kind]}`}
                  onClick={() => {
                    change((g) => {
                      g.girih!.recipe = 'single';
                      g.girih!.tileKind = kind;
                      g.girih!.showTiles = true;
                    });
                    setCatalog(false);
                    s.requestFit();
                  }}
                >
                  <svg viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true">
                    <polygon
                      points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="#b4cba7"
                      stroke="#324f43"
                      strokeWidth=".025"
                    />
                  </svg>
                  <strong>{girihNames[kind]}</strong>
                  <small>{girihAngles[kind].join('° · ')}°</small>
                </button>
              );
            })}
          </div>
          <p className="help-text">
            Lados iguales, ángulos múltiplos de36°. Seleccionar una forma no garantiza un teselado;
            Unir comprueba su adyacencia.
          </p>
        </Modal>
      )}
    </div>
  );
}
