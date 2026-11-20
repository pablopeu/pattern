import { useEffect } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import type { Studio } from '../app/useStudio';
import { uid, type Geometry } from '../app/model';
import { fromMM, toMM, multiply, translate, rotate, scale, type Matrix } from '../geometry/matrix';
import {
  booleanGeometry,
  editablePaths,
  insertNode,
  smoothNodes,
  type BooleanOperation,
} from '../geometry/paper';
import { geometryBounds } from '../application/clipping';
import { pathData } from '../geometry/paths';
import { Field, Toggle, Select } from './Controls';

export function ObjectProperties({ studio: s }: { studio: Studio }) {
  const { nodeIndex, setNodeIndex } = s;
  const selected = s.objects.filter((g) => s.selected.includes(g.id)),
    shape = selected[0],
    u = s.project.documentUnits;
  const tab = s.objectTab;
  const updateShape = (recipe: (g: Geometry) => void) =>
    s.editObjects((gs) => gs.filter((g) => s.selected.includes(g.id)).forEach(recipe));
  const units = (v: number) => fromMM(v, u),
    mm = (v: number) => toMM(v, u);
  const bool = (op: BooleanOperation) => {
    try {
      const result = booleanGeometry(selected, op);
      s.editObjects((gs) => {
        for (let i = gs.length - 1; i >= 0; i--) if (s.selected.includes(gs[i].id)) gs.splice(i, 1);
        gs.push(result);
      });
      s.setSelected([result.id]);
    } catch (e) {
      s.setMessage((e as Error).message);
    }
  };
  const group = () => {
    const id = uid();
    updateShape((g) => {
      g.groupId = id;
    });
  };
  const bounds = shape ? geometryBounds(selected) : null,
    center = bounds
      ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      : { x: 0, y: 0 };
  const around = (matrix: Matrix) =>
    multiply(translate(center.x, center.y), multiply(matrix, translate(-center.x, -center.y)));
  useEffect(() => {
    if (s.tool === 'nodes') s.setObjectTab('nodes');
  }, [s.tool]);
  if (!shape) return <p className="help-text">Seleccioná un objeto para editar sus propiedades.</p>;
  return (
    <div className="object-properties">
      <div className="context-tabs" role="tablist" aria-label="Propiedades del objeto">
        {(['shape', 'transform', 'nodes', 'actions'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => s.setObjectTab(t)}>
            {{ shape: 'Forma', transform: 'Transformar', nodes: 'Nodos', actions: 'Acciones' }[t]}
          </button>
        ))}
      </div>
      <div hidden={tab !== 'shape'} className="compact-fields">
        {' '}
        {shape.parameters && selected.length === 1 ? (
          <>
            <div className="two-fields">
              <Field
                label="Ancho"
                value={units(shape.parameters.width)}
                min={0.01}
                step={0.1}
                unit={u}
                onChange={(v) =>
                  updateShape((g) => {
                    if (g.parameters) g.parameters.width = mm(v);
                  })
                }
              />
              <Field
                label="Alto"
                value={units(shape.parameters.height)}
                min={0.01}
                step={0.1}
                unit={u}
                onChange={(v) =>
                  updateShape((g) => {
                    if (g.parameters) g.parameters.height = mm(v);
                  })
                }
              />
            </div>
            {shape.kind === 'rectangle' && (
              <Field
                label="Redondez"
                value={units(shape.parameters.radius)}
                min={0}
                unit={u}
                step={0.1}
                onChange={(v) =>
                  updateShape((g) => {
                    if (g.parameters) g.parameters.radius = mm(v);
                  })
                }
              />
            )}{' '}
            {shape.kind === 'polygon' && (
              <Field
                integer
                label="Lados"
                value={shape.parameters.sides}
                min={3}
                max={128}
                onChange={(v) =>
                  updateShape((g) => {
                    if (g.parameters) g.parameters.sides = v;
                  })
                }
              />
            )}
          </>
        ) : (
          bounds && (
            <p className="help-text">
              Dimensiones: {units(bounds.width).toFixed(2)} × {units(bounds.height).toFixed(2)} {u}
            </p>
          )
        )}
        <Field
          label="Rotación"
          value={(Math.atan2(shape.transform[1], shape.transform[0]) * 180) / Math.PI}
          min={-180}
          max={180}
          unit="°"
          onChange={(v) =>
            updateShape((g) => {
              const delta =
                v - (Math.atan2(shape.transform[1], shape.transform[0]) * 180) / Math.PI;
              g.transform = multiply(rotate(delta, center), g.transform);
            })
          }
        />
        <Select
          label="Tipo de relleno"
          value={shape.fill === 'none' ? 'none' : 'color'}
          options={[
            { value: 'none', label: 'Sin relleno' },
            { value: 'color', label: 'Color sólido' },
          ]}
          onChange={(v) =>
            s.applyStyle(
              {
                fill:
                  v === 'none'
                    ? 'none'
                    : s.project.drawingStyle.fill === 'none'
                      ? '#233b2d'
                      : s.project.drawingStyle.fill,
              },
              'selection',
            )
          }
        />
        <button className="style-indicator" onClick={() => s.setStylePage('colors')}>
          Trazo {shape.stroke} · {units(shape.strokeWidth).toFixed(2)} {u} · editar colores
        </button>
        <svg
          className="shape-context-preview"
          viewBox={
            bounds
              ? `${bounds.x - 5} ${bounds.y - 5} ${bounds.width + 10} ${bounds.height + 10}`
              : '-5 -5 40 40'
          }
          aria-label="Vista previa del objeto"
        >
          <path
            d={pathData(shape)}
            transform={`matrix(${shape.transform.join(' ')})`}
            fill={shape.fill}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
          />
        </svg>
        <label className="text-field">
          <span>Nombre</span>
          <input
            aria-label="Nombre del objeto"
            value={shape.name}
            onChange={(e) =>
              updateShape((g) => {
                g.name = e.target.value;
              })
            }
          />
        </label>
      </div>
      <div hidden={tab !== 'transform'} className="compact-fields">
        {' '}
        <div className="two-fields">
          <Field
            label="Posición X"
            value={units(shape.transform[4])}
            step={0.1}
            unit={u}
            onChange={(v) =>
              updateShape((g) => {
                g.transform = multiply(translate(mm(v) - shape.transform[4], 0), g.transform);
              })
            }
          />
          <Field
            label="Posición Y"
            value={units(shape.transform[5])}
            step={0.1}
            unit={u}
            onChange={(v) =>
              updateShape((g) => {
                g.transform = multiply(translate(0, mm(v) - shape.transform[5]), g.transform);
              })
            }
          />
        </div>
        <Field
          label="Escala"
          value={Math.hypot(shape.transform[0], shape.transform[1])}
          min={0.01}
          max={100}
          step={0.05}
          onChange={(v) =>
            updateShape((g) => {
              const old = Math.hypot(shape.transform[0], shape.transform[1]);
              g.transform = multiply(around(scale(v / old)), g.transform);
            })
          }
        />
        <div className="button-row">
          <button
            onClick={() =>
              updateShape((g) => {
                g.transform = multiply(around(scale(-1, 1)), g.transform);
              })
            }
          >
            Reflejar X
          </button>
          <button
            onClick={() =>
              updateShape((g) => {
                g.transform = multiply(around(scale(1, -1)), g.transform);
              })
            }
          >
            Reflejar Y
          </button>
        </div>
      </div>
      <div hidden={tab !== 'nodes'} className="compact-fields">
        {' '}
        {shape.kind !== 'path' ? (
          <button
            className="wide-button"
            onClick={() => {
              s.editObjects((gs) => {
                const out = gs.flatMap((g) => (s.selected.includes(g.id) ? editablePaths(g) : [g]));
                gs.splice(0, gs.length, ...out);
              });
              s.setTool('nodes');
            }}
          >
            Convertir a paths editables
          </button>
        ) : (
          <>
            <Toggle
              label="Path cerrado"
              checked={shape.closed}
              onChange={(v) => {
                if (s.mode === 'apply' && !v) {
                  s.setMessage('Un perímetro aplicado debe permanecer cerrado.');
                  return;
                }
                updateShape((g) => {
                  g.closed = v;
                });
              }}
            />
            <Field
              integer
              label="Nodo activo"
              value={Math.min(nodeIndex + 1, shape.nodes.length)}
              min={1}
              max={Math.max(1, shape.nodes.length)}
              onChange={(v) => setNodeIndex(v - 1)}
            />
            {shape.nodes[Math.min(nodeIndex, shape.nodes.length - 1)] && (
              <div className="two-fields">
                {(['x', 'y'] as const).map((axis) => (
                  <Field
                    key={axis}
                    label={`Nodo ${axis.toUpperCase()}`}
                    value={units(shape.nodes[Math.min(nodeIndex, shape.nodes.length - 1)][axis])}
                    unit={u}
                    step={0.1}
                    onChange={(v) =>
                      updateShape((g) => {
                        g.nodes[Math.min(nodeIndex, g.nodes.length - 1)][axis] = mm(v);
                      })
                    }
                  />
                ))}
              </div>
            )}
            <div className="button-row">
              <button
                onClick={() => {
                  s.editObjects((gs) => {
                    const i = gs.findIndex((g) => g.id === shape.id);
                    gs[i] = insertNode(shape, Math.min(nodeIndex, shape.nodes.length - 1));
                  });
                }}
              >
                Insertar nodo
              </button>
              <button
                disabled={shape.nodes.length <= 2}
                onClick={() =>
                  updateShape((g) => {
                    g.nodes.splice(Math.min(nodeIndex, g.nodes.length - 1), 1);
                  })
                }
              >
                Eliminar nodo
              </button>
            </div>
            <div className="button-row">
              <button
                onClick={() =>
                  updateShape((g) => {
                    const i = Math.min(nodeIndex, g.nodes.length - 1),
                      a = g.nodes[i],
                      b = g.nodes[(i + 1) % g.nodes.length];
                    a.out = { x: (b.x - a.x) / 3, y: (b.y - a.y) / 3 + 5 };
                    b.in = { x: (a.x - b.x) / 3, y: (a.y - b.y) / 3 + 5 };
                  })
                }
              >
                Curvar segmento
              </button>
              <button
                onClick={() =>
                  updateShape((g) => {
                    const i = Math.min(nodeIndex, g.nodes.length - 1);
                    g.nodes[i].out = { x: 0, y: 0 };
                    g.nodes[(i + 1) % g.nodes.length].in = { x: 0, y: 0 };
                  })
                }
              >
                Segmento recto
              </button>
            </div>
            <div className="button-row">
              <button
                onClick={() =>
                  updateShape((g) => {
                    g.nodes = smoothNodes(g.nodes, g.closed);
                  })
                }
              >
                Suavizar
              </button>
              <button
                onClick={() =>
                  updateShape((g) => {
                    const n = g.nodes[Math.min(nodeIndex, g.nodes.length - 1)];
                    n.in = { x: 0, y: 0 };
                    n.out = { x: 0, y: 0 };
                  })
                }
              >
                Nodo angular
              </button>
            </div>
          </>
        )}
      </div>
      <div hidden={tab !== 'actions'} className="compact-fields">
        {' '}
        <div className="button-row">
          <button onClick={s.duplicate}>
            <Copy size={14} /> Duplicar
          </button>
          {selected.length > 1 ? (
            <button onClick={group}>Agrupar</button>
          ) : shape.groupId ? (
            <button
              onClick={() =>
                s.editObjects((gs) =>
                  gs
                    .filter((g) => g.groupId === shape.groupId)
                    .forEach((g) => {
                      delete g.groupId;
                    }),
                )
              }
            >
              Desagrupar
            </button>
          ) : null}
          <button title="Eliminar selección" onClick={s.deleteSelected}>
            <Trash2 size={15} />
          </button>
        </div>
        {selected.length > 1 && (
          <>
            <div className="section-caption">OPERACIONES GEOMÉTRICAS</div>
            <div className="boolean-buttons">
              {(
                [
                  ['union', 'Unión'],
                  ['intersection', 'Intersección'],
                  ['difference', 'Diferencia'],
                  ['reverse-difference', 'Diferencia inversa'],
                  ['xor', 'XOR'],
                ] as [BooleanOperation, string][]
              ).map(([op, label]) => (
                <button key={op} onClick={() => bool(op)}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
