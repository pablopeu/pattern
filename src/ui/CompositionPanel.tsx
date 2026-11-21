import { useMemo, useState } from 'react';
import type { Studio } from '../app/useStudio';
import { geometry, node } from '../app/model';
import { generate } from '../generators';
import { defaultComposition, type Composition } from '../composition/model';
import { generatedBounds } from '../composition/generated';
import { compositionSchema } from '../composition/schema';
import { compositionThumbnail } from '../composition/preview';
import { compositionSource } from '../composition/source';
import { Field, Select, Toggle } from './Controls';

type SavedRecipe = { name: string; definition: Composition };
const storageKey = 'pattern-composition-recipes-v1';
function readSaved(): SavedRecipe[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(value)
      ? value
          .filter(
            (row): row is SavedRecipe =>
              typeof row?.name === 'string' && compositionSchema.safeParse(row.definition).success,
          )
          .slice(0, 32)
      : [];
  } catch {
    return [];
  }
}
const labels = {
  'square-limit': 'Peces hacia el borde cuadrado',
  quadrants: 'Cuadrantes recursivos',
  branching: 'Ramificación autosimilar',
  discrete: 'Espiral discreta',
  logarithmic: 'Espiral logarítmica',
  rosette: 'Roseta autosimilar',
  'fixed-point': 'Hacia un punto fijo',
};
const sample = geometry(
  'path',
  [node(2, 10), node(13, 1), node(10, 8), node(20, 10), node(10, 12), node(13, 19)],
  true,
);
sample.id = 'composition-preview-motif';
sample.fill = '#bb7b42';
sample.stroke = '#273c40';
sample.strokeWidth = 0.4;

export function CompositionPanel({
  studio: s,
  onExamples,
}: {
  studio: Studio;
  onExamples: () => void;
}) {
  const [page, setPage] = useState('recipe'),
    [layout, setLayout] = useState('shape'),
    [saved, setSaved] = useState(readSaved),
    [name, setName] = useState('');
  const c = s.pattern.composition;
  const frame = useMemo(
    () =>
      generatedBounds(
        generate(
          s.pattern.generator,
          compositionSource(s.effectivePattern).filter(
            (g) => !g.fillRegion || g.fillRegion.scope === 'source',
          ),
        ),
      ),
    [s.effectivePattern],
  );
  const cards = useMemo(
    () =>
      (['recursive', 'spiral'] as const).map((kind) => {
        const definition = defaultComposition(kind, frame);
        const pattern = s.pattern.sourceGeometry.length
          ? { ...s.effectivePattern, sourceGeometry: compositionSource(s.effectivePattern) }
          : { ...s.effectivePattern, sourceGeometry: [sample] };
        return { kind, definition, thumbnail: compositionThumbnail(pattern, definition) };
      }),
    [s.effectivePattern, frame],
  );
  const update = (fn: (value: Composition) => void) =>
    s.change((p) => {
      const pattern = p.patterns.find((p) => p.id === s.patternId)!;
      if (pattern.composition) fn(pattern.composition);
    });
  const activate = (definition: Composition) => {
    s.change((p) => {
      const pattern = p.patterns.find((p) => p.id === s.patternId)!;
      pattern.sourceGeometry = structuredClone(compositionSource(s.effectivePattern));
      pattern.composition = structuredClone(definition);
    });
    s.updateViewPreferences({ sourceView: false, split: false, repetitionView: 'extended' });
    s.setStyleOpen(false);
    s.requestFit();
  };
  return (
    <div className="composition-panel">
      <div className="section-caption">
        COMPOSICIÓN <span>Fuente editable</span>
      </div>
      <div className="composition-tabs" role="tablist" aria-label="Opciones de composición">
        {[
          ['recipe', 'Receta'],
          ['layout', 'Geometría'],
          ['color', 'Color'],
          ['saved', 'Guardadas'],
        ].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={page === id} onClick={() => setPage(id)}>
            {label}
          </button>
        ))}
      </div>
      {(!c || page === 'recipe') && (
        <div className="composition-family-cards">
          {cards.map((card) => (
            <button
              key={card.kind}
              aria-label={
                card.kind === 'recursive' ? 'Composición recursiva' : 'Espirales y semejanzas'
              }
              aria-pressed={c?.enabled && c.kind === card.kind}
              disabled={!s.pattern.sourceGeometry.length}
              onClick={() => activate(card.definition)}
            >
              <img src={card.thumbnail} alt="" />
              <strong>{card.kind === 'recursive' ? 'Recursiva' : 'Espiral'}</strong>
              <small>Disposición finita</small>
            </button>
          ))}
        </div>
      )}
      {!s.pattern.sourceGeometry.length && (
        <>
          <p className="help-text">Dibujá un motivo para componerlo o abrí un ejemplo original.</p>
          <button className="wide-button" onClick={onExamples}>
            Explorar ejemplos
          </button>
        </>
      )}
      {c && (
        <>
          <Toggle
            label="Composición activa"
            checked={c.enabled}
            onChange={(enabled) => {
              update((c) => {
                c.enabled = enabled;
              });
              s.requestFit();
            }}
          />
          {page === 'recipe' && (
            <div className="compact-fields">
              <Select
                label="Receta de composición"
                value={c.recipe}
                options={Object.entries(labels)
                  .filter(([id]) =>
                    c.kind === 'recursive'
                      ? ['square-limit', 'quadrants', 'branching'].includes(id)
                      : !['square-limit', 'quadrants', 'branching'].includes(id),
                  )
                  .map(([value, label]) => ({ value, label }))}
                onChange={(recipe) =>
                  update((value) => {
                    if (value.kind === 'recursive') value.recipe = recipe as typeof value.recipe;
                    else {
                      value.recipe = recipe as typeof value.recipe;
                      if (recipe === 'rosette') value.arms = 6;
                      if (recipe === 'fixed-point') {
                        value.angle = 0;
                        value.ratio = 0.85;
                        value.offset = { x: 0, y: 0 };
                      }
                    }
                  })
                }
              />
              {c.kind === 'recursive' ? (
                <Field
                  label="Profundidad recursiva"
                  value={c.depth}
                  min={0}
                  max={6}
                  integer
                  onChange={(depth) =>
                    update((c) => {
                      if (c.kind === 'recursive') c.depth = depth;
                    })
                  }
                />
              ) : (
                <Field
                  label="Repeticiones de semejanza"
                  value={c.count}
                  min={1}
                  max={256}
                  integer
                  onChange={(count) =>
                    update((c) => {
                      if (c.kind === 'spiral') c.count = count;
                    })
                  }
                />
              )}
              <Toggle
                label="Reflejos alternados"
                checked={c.mirror}
                onChange={(v) =>
                  update((c) => {
                    c.mirror = v;
                  })
                }
              />
              <p className="help-text">
                {c.kind === 'recursive'
                  ? 'Subdivide y orienta copias del mismo motivo.'
                  : 'Combina giro, escala y desplazamiento.'}{' '}
                No es una celda periódica.
              </p>
            </div>
          )}
          {page === 'layout' && (
            <div className="compact-fields">
              <Select
                label="Grupo de parámetros de composición"
                value={layout}
                onChange={setLayout}
                options={[
                  { value: 'shape', label: 'Forma y escala' },
                  { value: 'position', label: 'Centro y desplazamiento' },
                  { value: 'detail', label: 'Detalle y dirección' },
                ]}
              />
              {layout === 'shape' && (
                <>
                  <Field
                    label="Tamaño de composición"
                    unit="mm"
                    min={5}
                    max={1000}
                    value={c.size}
                    onChange={(size) =>
                      update((c) => {
                        c.size = size;
                      })
                    }
                  />
                  {(c.kind === 'spiral' || c.recipe !== 'square-limit') && (
                    <Field
                      label="Escala por nivel"
                      value={c.ratio}
                      min={c.kind === 'recursive' ? 0.2 : 0.5}
                      max={c.kind === 'recursive' ? 0.8 : 1.2}
                      step={0.01}
                      onChange={(ratio) =>
                        update((c) => {
                          c.ratio = ratio;
                        })
                      }
                    />
                  )}
                  <Field
                    label="Giro por nivel"
                    unit="°"
                    min={-360}
                    max={360}
                    value={c.angle}
                    onChange={(angle) =>
                      update((c) => {
                        c.angle = angle;
                      })
                    }
                  />
                </>
              )}
              {layout === 'position' && (
                <>
                  {(['x', 'y'] as const).map((axis) => (
                    <Field
                      key={axis}
                      label={`Centro de composición ${axis.toUpperCase()}`}
                      value={c.center[axis]}
                      unit="mm"
                      onChange={(v) =>
                        update((c) => {
                          c.center[axis] = v;
                        })
                      }
                    />
                  ))}
                  {c.kind === 'spiral' &&
                    (['x', 'y'] as const).map((axis) => (
                      <Field
                        key={axis}
                        label={`Desplazamiento de espiral ${axis.toUpperCase()}`}
                        value={c.offset[axis]}
                        min={-500}
                        max={500}
                        unit="mm"
                        onChange={(v) =>
                          update((c) => {
                            if (c.kind === 'spiral') c.offset[axis] = v;
                          })
                        }
                      />
                    ))}
                </>
              )}
              {layout === 'detail' && (
                <>
                  <Field
                    label="Detalle mínimo de composición"
                    unit="mm"
                    value={c.minSize}
                    min={0.02}
                    max={10}
                    step={0.02}
                    onChange={(v) =>
                      update((c) => {
                        c.minSize = v;
                      })
                    }
                  />
                  {c.kind === 'spiral' && (
                    <Select
                      label="Dirección de espiral"
                      value={String(c.direction)}
                      options={[
                        { value: '1', label: 'Horario' },
                        { value: '-1', label: 'Antihorario' },
                      ]}
                      onChange={(v) =>
                        update((c) => {
                          if (c.kind === 'spiral') c.direction = Number(v) as 1 | -1;
                        })
                      }
                    />
                  )}
                  {c.kind === 'spiral' && c.recipe === 'rosette' && (
                    <Field
                      label="Brazos de roseta"
                      value={c.arms}
                      min={1}
                      max={12}
                      integer
                      onChange={(v) =>
                        update((c) => {
                          if (c.kind === 'spiral') c.arms = v;
                        })
                      }
                    />
                  )}
                  <button
                    className="wide-button"
                    onClick={() => {
                      update((c) => {
                        c.sourceFrame = {
                          ...frame,
                          width: Math.max(1, frame.width),
                          height: Math.max(1, frame.height),
                        };
                      });
                      s.requestFit();
                    }}
                  >
                    Encuadrar motivo fuente
                  </button>
                </>
              )}
            </div>
          )}
          {page === 'color' && (
            <>
              <Toggle
                label="Color por nivel"
                checked={c.colorByLevel}
                onChange={(v) =>
                  update((c) => {
                    c.colorByLevel = v;
                  })
                }
              />
              <p className="help-text">
                Colorea el primer relleno del motivo. Los ojos, trazos y detalles de contraste
                conservan su estilo.
              </p>
              <div className="composition-palette">
                {c.palette.map((color, index) => (
                  <label key={index}>
                    <span>Nivel {index + 1}</span>
                    <input
                      type="color"
                      aria-label={`Color de nivel ${index + 1}`}
                      value={color}
                      onChange={(e) =>
                        update((c) => {
                          c.palette[index] = e.target.value;
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          {page === 'saved' && (
            <>
              <label className="text-field">
                <span>Nombre de receta</span>
                <input
                  aria-label="Nombre de receta"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button
                className="wide-button"
                disabled={!name.trim()}
                onClick={() => {
                  const next = [
                    ...saved.filter((r) => r.name !== name.trim()),
                    { name: name.trim(), definition: structuredClone(c) },
                  ].slice(-32);
                  try {
                    localStorage.setItem(storageKey, JSON.stringify(next));
                    setSaved(next);
                    s.setMessage('Receta guardada en este navegador.');
                  } catch {
                    s.setMessage(
                      'No se pudo guardar la receta; el archivo JSON conserva la composición.',
                    );
                  }
                }}
              >
                Guardar receta personal
              </button>
              <p className="help-text">
                Guardadas en este navegador. El JSON y el preset del patrón transportan la receta
                actual.
              </p>
              <div className="saved-composition-recipes">
                {saved.map((row) => (
                  <button
                    key={row.name}
                    onClick={() =>
                      activate({ ...row.definition, enabled: true, sourceFrame: c.sourceFrame })
                    }
                  >
                    {row.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="composition-source-actions">
            <button
              className="wide-button"
              onClick={() => {
                s.updateViewPreferences({ sourceView: !s.project.preferences.sourceView });
                s.setStyleOpen(false);
                s.requestFit();
              }}
            >
              {s.project.preferences.sourceView ? 'Ver composición' : 'Editar motivo fuente'}
            </button>
            <button
              className="wide-button"
              onClick={() => {
                s.updateViewPreferences({ sourceView: false });
                s.requestFit();
              }}
            >
              Ajustar composición
            </button>
          </div>
        </>
      )}
    </div>
  );
}
