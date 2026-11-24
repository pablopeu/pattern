import { isSimilarity } from '../geometry/matrix';
import { useMemo, useState } from 'react';
import type { Studio } from '../app/useStudio';
import type { Generator } from '../app/model';
import { seeds, compileAperiodic, type AperiodicKind } from '../aperiodic/compile';
import { defaultAperiodic, isAperiodic } from '../aperiodic/model';
import { Field, Select, Toggle } from './Controls';
import { tr } from '../i18n';
export function activateAperiodic(g: Generator, kind: 'penrose' | AperiodicKind): Generator {
  return {
    ...g,
    kind,
    frequency: Math.max(1, Math.min(kind === 'penrose' ? 7 : 4, Math.round(g.frequency))),
    ...(kind === 'penrose'
      ? {}
      : {
          version: g.girih ? 3 : 2,
          aperiodic: g.kind === kind && g.aperiodic ? g.aperiodic : defaultAperiodic(kind),
        }),
  };
}
export function AperiodicPanel({ studio: s }: { studio: Studio }) {
  const [tab, setTab] = useState('patch'),
    g = s.pattern.generator,
    a = isAperiodic(g),
    options = g.aperiodic,
    change = (fn: (g: Generator) => void) =>
      s.change((p) => fn(p.patterns.find((p) => p.id === s.patternId)!.generator)),
    count = useMemo(
      () =>
        a
          ? compileAperiodic(g.kind, Math.round(g.frequency), options?.seedTile).leaves.length
          : undefined,
      [g.kind, g.frequency, options?.seedTile, a],
    );
  return (
    <div className="compact-fields aperiodic-panel">
      {!isSimilarity(s.pattern.placementTransform) && (
        <p className="math-notice">
          Transformación afín artística: cambia las proporciones de las teselas.
        </p>
      )}
      <Select
        label={tr('Construcción aperiódica')}
        value={g.kind === 'penrose' || a ? g.kind : ''}
        onChange={(kind) => {
          if (!['penrose', 'hat', 'spectre'].includes(kind)) return;
          s.change((p) => {
            const pattern = p.patterns.find((p) => p.id === s.patternId)!;
            pattern.generator = activateAperiodic(
              pattern.generator,
              kind as 'penrose' | AperiodicKind,
            );
            if (pattern.composition) pattern.composition.enabled = false;
          });
          s.setTileEditing(false);
          s.setInstanceExplicit(false);
          s.updateViewPreferences({ sourceView: false, repetitionView: 'extended' });
          s.requestFit();
        }}
        options={[
          { value: '', label: tr('Elegí una construcción') },
          ...['penrose', 'hat', 'spectre'].map((value) => ({
            value,
            label: {
              penrose: 'Penrose · Robinson P3',
              hat: 'Hat · sustitución H/T/P/F',
              spectre: 'Spectre · curvo, una mano',
            }[value]!,
          })),
        ]}
      />
      {(g.kind === 'penrose' || a) && (
        <>
          <div className="context-tabs" role="tablist" aria-label={tr('Opciones aperiódicas')}>
            {['patch', ...(a ? ['color', 'hierarchy'] : [])].map((id) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {{ patch: 'Parche', color: 'Color', hierarchy: 'Jerarquía' }[id]}
              </button>
            ))}
          </div>
          {(tab === 'patch' || !a) && (
            <>
              <div className="two-fields">
                <Field
                  label={tr('Sustituciones')}
                  value={g.frequency}
                  min={1}
                  max={a ? 4 : 7}
                  integer
                  onChange={(v) =>
                    change((g) => {
                      g.frequency = v;
                      if (g.aperiodic) g.aperiodic.generation = Math.min(g.aperiodic.generation, v);
                    })
                  }
                />
                <Field
                  label={tr('Radio del parche')}
                  value={g.radius}
                  min={5}
                  max={500}
                  unit="mm"
                  onChange={(v) =>
                    change((g) => {
                      g.radius = v;
                    })
                  }
                />
              </div>
              {a && options && (
                <>
                  <Select
                    label={tr('Semilla de sustitución')}
                    value={options.seedTile}
                    options={seeds[g.kind as AperiodicKind].map((value) => ({
                      value,
                      label: value,
                    }))}
                    onChange={(v) =>
                      change((g) => {
                        g.aperiodic!.seedTile = v;
                      })
                    }
                  />
                  <Field
                    label={tr('Giro del parche')}
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
                </>
              )}
              <p className="math-notice">
                Parche finito de un sistema aperiódico{count ? ` · ${count} teselas` : ''}. No tiene
                celda repetible.{' '}
                {g.kind === 'hat'
                  ? 'Hat incluye las reflexiones requeridas.'
                  : g.kind === 'spectre'
                    ? 'Spectre conserva una sola mano.'
                    : ''}
              </p>
            </>
          )}
          {a && options && tab === 'color' && (
            <>
              <Select
                label={tr('Colorear sustitución')}
                value={options.colorBy}
                options={[
                  { value: 'type', label: tr('Tipo de tesela') },
                  { value: 'generation', label: tr('Grupo de una generación') },
                  ...(g.kind === 'hat'
                    ? [{ value: 'chirality', label: tr('Orientación reflejada') }]
                    : []),
                ]}
                onChange={(v) =>
                  change((g) => {
                    g.aperiodic!.colorBy = v as typeof options.colorBy;
                  })
                }
              />
              {options.colorBy === 'generation' && (
                <Field
                  label={tr('Generación de color')}
                  value={options.generation}
                  min={1}
                  max={g.frequency}
                  integer
                  onChange={(v) =>
                    change((g) => {
                      g.aperiodic!.generation = v;
                    })
                  }
                />
              )}
              <div className="tile-palette">
                {options.palette.map((color, i) => (
                  <label key={i}>
                    Color {i + 1}
                    <input
                      type="color"
                      aria-label={`Color aperiódico ${i + 1}`}
                      value={color}
                      onChange={(e) =>
                        change((g) => {
                          g.aperiodic!.palette[i] = e.target.value;
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <p className="help-text">
                El color por generación agrupa descendientes del mismo paso de sustitución; el
                motivo fuente se conserva.
              </p>
            </>
          )}
          {a && options && tab === 'hierarchy' && (
            <>
              <Toggle
                label={tr('Mostrar jerarquía de sustitución')}
                checked={options.showHierarchy}
                onChange={(v) =>
                  change((g) => {
                    g.aperiodic!.showHierarchy = v;
                  })
                }
              />
              <Field
                label={tr('Generación de jerarquía')}
                value={options.generation}
                min={1}
                max={g.frequency}
                integer
                onChange={(v) =>
                  change((g) => {
                    g.aperiodic!.generation = v;
                  })
                }
              />
              <p className="help-text">
                Marcos de los grupos de sustitución, no bordes físicos de teselas. Viajan en SVG y
                raster si están visibles.
              </p>
            </>
          )}
          <button
            className="wide-button"
            onClick={() => {
              s.updateViewPreferences({ sourceView: !s.project.preferences.sourceView });
              s.requestFit();
            }}
          >
            {s.project.preferences.sourceView ? 'Ver parche completo' : 'Editar motivo fuente'}
          </button>
          <button
            className="wide-button"
            onClick={() => {
              change((g) => {
                g.kind = 'motif';
              });
              s.setTileEditing(false);
              s.requestFit();
            }}
          >
            Volver al motivo guardado
          </button>
        </>
      )}
    </div>
  );
}
