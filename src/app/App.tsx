import logo from '../../icono.png';
import { commonRectangularCell, resolvePattern } from '../symmetry/config';
import { useState, useRef } from 'react';
import {
  MousePointer2,
  PenTool,
  Pencil,
  Minus,
  Square,
  Circle,
  Hexagon,
  Move,
  Waypoints,
  Upload,
  Undo2,
  Redo2,
  Download,
  Save,
  FolderOpen,
  Plus,
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  Columns2,
  LayoutGrid,
  Check,
  ChevronDown,
  X,
  Settings2,
  ExternalLink,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { useStudio, type Tool } from './useStudio';
import { example, exampleNames } from './examples';
import { newProject, geometry, uid } from './model';
import { freezePattern } from '../symmetry/config';
import { IDENTITY } from '../geometry/matrix';
import { parseProject, serialize } from '../persistence/schema';
import { download, autosave, savedProjects, loadSavedProject } from '../persistence/storage';
import { parsePreset } from '../persistence/presets';
import { importSVG } from '../persistence/svg-import';
import { Canvas } from '../editor/Canvas';
import { Panels } from '../ui/Panels';
import { ExportDialog } from '../ui/ExportDialog';
import { buildScene } from '../patterns/engine';
const tools: { id: Tool; label: string; shortcut?: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Seleccionar', shortcut: 'V', icon: MousePointer2 },
  { id: 'nodes', label: 'Editar nodos', shortcut: 'A', icon: Waypoints },
  { id: 'pen', label: 'Pluma Bézier', shortcut: 'P', icon: PenTool },
  { id: 'pencil', label: 'Dibujo libre', shortcut: 'B', icon: Pencil },
  { id: 'line', label: 'Línea', shortcut: 'L', icon: Minus },
  { id: 'rectangle', label: 'Rectángulo', shortcut: 'R', icon: Square },
  { id: 'ellipse', label: 'Elipse', shortcut: 'E', icon: Circle },
  { id: 'polygon', label: 'Polígono libre', icon: Hexagon },
  { id: 'pan', label: 'Desplazar vista', shortcut: 'H', icon: Move },
];
export default function App() {
  const s = useStudio(),
    [exportOpen, setExportOpen] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [help, setHelp] = useState(false),
    [importText, setImportText] = useState<string | null>(null),
    [importWidth, setImportWidth] = useState(100),
    [library, setLibrary] = useState<Awaited<ReturnType<typeof savedProjects>> | null>(null);
  const openRef = useRef<HTMLInputElement>(null),
    svgRef = useRef<HTMLInputElement>(null),
    presetRef = useRef<HTMLInputElement>(null);
  const save = async () => {
    const project = s.projectRef.current;
    try {
      parseProject(serialize(project));
    } catch (e) {
      s.setMessage('No se puede guardar: ' + (e as Error).message);
      return;
    }
    try {
      await autosave(project);
    } catch {
      /* The portable file remains available if local storage fails. */
    }
    download(serialize(project), project.metadata.name + '.pattern.json');
    s.setFileSaved(true);
    s.setMessage('Proyecto guardado como archivo JSON editable.');
  };
  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      s.load(parseProject(await file.text()));
      s.setMessage('Proyecto recuperado.');
    } catch (e) {
      s.setMessage((e as Error).message);
    }
  };
  const importFile = async () => {
    if (!importText) return;
    try {
      const imported = importSVG(importText, importWidth);
      if (s.mode === 'apply') {
        if (imported.geometry.some((g) => !g.closed))
          throw Error(
            'El SVG contiene paths abiertos. Cerrá esos trazados en el archivo o importalos en Diseño; no se cerrarán automáticamente.',
          );
        const id = uid();
        s.change((p) =>
          p.regions.push({
            id,
            name: `Perímetro importado ${p.regions.length + 1}`,
            geometry: imported.geometry,
          }),
        );
        s.setRegionId(id);
        s.setSelected([]);
        s.setInstance(IDENTITY);
      } else {
        s.editObjects((gs) => gs.push(...imported.geometry));
        s.setSelected(imported.geometry.map((g) => g.id));
        s.setInstance(IDENTITY);
      }
      setImportText(null);
      s.setMessage(imported.warnings.join(' · ') || 'SVG importado conservando sus dimensiones.');
    } catch (e) {
      s.setMessage((e as Error).message);
    }
  };
  let status = 'UNVERIFIED',
    statusText = '';
  try {
    const scene = buildScene(s.effectivePattern, { x: 0, y: 0, width: 1, height: 1 });
    status = scene.status;
    statusText = scene.message;
  } catch (e) {
    statusText = (e as Error).message;
  }
  const confirmedVisible = s.project.patterns
    .filter((p) => p.visible)
    .map((p) => resolvePattern(p, s.project));
  const mixed = confirmedVisible.length > 1,
    commonCell = mixed ? commonRectangularCell(confirmedVisible) : null;
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="Pattern Studio">
          <img src={logo} alt="PEU Patterns" width="142" height="66" />
        </a>
        <div className="top-divider" />
        <div className="project-name">
          <input
            aria-label="Nombre del proyecto"
            value={s.project.metadata.name}
            onChange={(e) =>
              s.change((p) => {
                p.metadata.name = e.target.value;
              })
            }
          />
          <span
            title={
              s.fileSaved
                ? 'Archivo guardado'
                : 'Cambios conservados en autosave; podés guardar un archivo JSON'
            }
          >
            {!s.fileSaved && '•'}
          </span>
          <ChevronDown size={13} />
        </div>
        <div className="mode-switch" role="tablist" aria-label="Contexto de trabajo">
          {(
            [
              ['edit', 'Diseño'],
              ['pattern', 'Patrón'],
              ['apply', 'Aplicar'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              role="tab"
              aria-selected={s.mode === mode}
              className={s.mode === mode ? 'active' : ''}
              onClick={() => {
                s.setMode(mode);
                if ((mode === 'apply') !== (s.mode === 'apply')) {
                  s.setSelected([]);
                  s.setTool('select');
                }
                s.setSymmetryPreview(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="top-actions">
          <span className={`save-indicator ${s.saved.includes('Error') ? 'error' : ''}`}>
            <Check size={13} />
            {s.saved}
          </span>
          <button
            className="icon-button"
            title="Guardar proyecto JSON"
            aria-label="Guardar proyecto"
            onClick={save}
          >
            <Save size={18} />
          </button>
          <details
            className="main-menu"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('.menu-popover button,.menu-popover a'))
                e.currentTarget.removeAttribute('open');
            }}
          >
            <summary title="Archivo y ejemplos">
              Archivo <ChevronDown size={13} />
            </summary>
            <div className="menu-popover">
              <button
                onClick={() => {
                  s.load(newProject());
                  s.setMode('edit');
                }}
              >
                <Plus size={15} /> Nuevo proyecto
              </button>
              <button onClick={() => openRef.current?.click()}>
                <FolderOpen size={15} /> Abrir proyecto JSON
              </button>
              <button onClick={save}>
                <Save size={15} /> Guardar archivo JSON
              </button>
              <button
                onClick={() => {
                  const p = structuredClone(s.project);
                  p.metadata.id = uid();
                  p.metadata.name += ' copia';
                  s.load(p);
                }}
              >
                <Copy size={15} /> Duplicar proyecto
              </button>
              <button
                onClick={async () => {
                  try {
                    await autosave(s.projectRef.current);
                    setLibrary(await savedProjects());
                  } catch (e) {
                    s.setMessage((e as Error).message);
                  }
                }}
              >
                <FolderOpen size={15} /> Biblioteca de este navegador
              </button>
              <hr />
              <label>Ejemplos editables</label>
              {exampleNames.map((name, index) => (
                <button
                  key={name}
                  onClick={() => {
                    s.load(example(index));
                    s.setMode(index === 6 ? 'apply' : 'edit');
                  }}
                >
                  {name}
                </button>
              ))}
              <hr />
              <button
                onClick={() => {
                  download(
                    JSON.stringify(
                      {
                        presetVersion: 3,
                        pattern: freezePattern(s.pattern, s.project.mainSymmetry),
                      },
                      null,
                      2,
                    ),
                    s.pattern.name + '.preset.json',
                  );
                }}
              >
                Exportar preset del patrón
              </button>
              <button onClick={() => presetRef.current?.click()}>Importar preset del patrón</button>
              <button onClick={() => setHelp(true)}>
                <HelpCircle size={15} /> Atajos y ayuda
              </button>
              {import.meta.env.DEV && (
                <a href={`http://${location.hostname}:4174`} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} /> Avances y feedback
                </a>
              )}
            </div>
          </details>
          <button className="primary-button export-trigger" onClick={() => setExportOpen(true)}>
            <Download size={16} /> Exportar
          </button>
        </div>
      </header>
      <main className={`workspace ${collapsed ? 'panel-collapsed' : ''}`}>
        <nav className="tool-rail" aria-label="Herramientas de dibujo">
          {tools.map(({ id, label, shortcut, icon: Icon }, i) => (
            <button
              key={id}
              className={`${s.tool === id ? 'active' : ''} ${i === 2 || i === 8 ? 'tool-gap' : ''}`}
              title={`${label}${shortcut ? ' (' + shortcut + ')' : ''}`}
              aria-label={label}
              aria-pressed={s.tool === id}
              onClick={() => {
                s.setTool(id);
              }}
            >
              <Icon size={20} strokeWidth={1.6} />
            </button>
          ))}
          <div className="rail-divider" />
          <button
            title="Polígono regular paramétrico"
            aria-label="Crear polígono regular"
            onClick={() => {
              const g = geometry('polygon', [], true);
              g.parameters = { x: 0, y: 0, width: 30, height: 30, radius: 0, sides: 6 };
              if (s.mode === 'apply' && !s.region) {
                const id = uid();
                s.change((p) =>
                  p.regions.push({ id, name: `Perímetro ${p.regions.length + 1}`, geometry: [g] }),
                );
                s.setRegionId(id);
              } else s.editObjects((gs) => gs.push(g));
              s.setInstance(IDENTITY);
              s.setSelected([g.id]);
            }}
          >
            <Hexagon size={19} />
            <small>+</small>
          </button>
          <button
            title="Importar SVG"
            aria-label="Importar SVG"
            onClick={() => svgRef.current?.click()}
          >
            <Upload size={19} />
          </button>
          <button
            title="Eliminar selección"
            aria-label="Eliminar selección"
            disabled={!s.selected.length}
            onClick={s.deleteSelected}
          >
            <Trash2 size={18} />
          </button>
          <div className="rail-bottom">
            <button
              title="Panel de propiedades"
              aria-label="Plegar panel"
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            </button>
            <button title="Ayuda y atajos" aria-label="Ayuda" onClick={() => setHelp(true)}>
              <HelpCircle size={19} />
            </button>
          </div>
        </nav>
        {!collapsed && <Panels studio={s} onImport={() => svgRef.current?.click()} />}
        <section className="drawing-area">
          {s.mode !== 'apply' && (
            <div className="continuous-view-controls">
              <button
                aria-pressed={s.project.preferences.sourceView}
                onClick={() =>
                  s.change((p) => {
                    p.preferences.sourceView = !p.preferences.sourceView;
                  })
                }
              >
                Fuente pura
              </button>
              <button
                disabled={
                  !s.visiblePatterns.some(
                    (p) =>
                      p.generator.kind !== 'penrose' &&
                      (p.tiling || ['wallpaper', 'frieze'].includes(p.symmetry.family)),
                  )
                }
                aria-pressed={s.project.preferences.repetitionView === 'single'}
                onClick={() =>
                  s.change((p) => {
                    p.preferences.repetitionView =
                      p.preferences.repetitionView === 'single' ? 'extended' : 'single';
                  })
                }
              >
                Una celda
              </button>
              <span>
                {s.symmetryPreview ? 'Previsualización temporal' : 'Simetría confirmada'} ·{' '}
                {tools.find((t) => t.id === s.tool)?.label ?? s.tool}
              </span>
            </div>
          )}
          <div className="workspace-bar">
            <div className="breadcrumb">
              <span>
                {s.mode === 'apply'
                  ? 'APLICACIÓN'
                  : s.pattern.generator.kind === 'motif'
                    ? 'MOTIVO PROPIO'
                    : 'GENERADOR'}
              </span>
              <i>/</i>
              <strong>{s.pattern.name}</strong>
            </div>
            <div className="workspace-actions">
              <button
                title="Deshacer (Ctrl+Z)"
                aria-label="Deshacer"
                disabled={!s.canUndo}
                onClick={s.undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                title="Rehacer (Ctrl+Shift+Z)"
                aria-label="Rehacer"
                disabled={!s.canRedo}
                onClick={s.redo}
              >
                <Redo2 size={17} />
              </button>
              <i />
              {s.mode === 'edit' && (
                <button
                  className={s.project.preferences.split ? 'active' : ''}
                  title="Vista dividida sincronizada"
                  aria-label="Vista dividida"
                  onClick={() =>
                    s.change((p) => {
                      p.preferences.split = !p.preferences.split;
                    })
                  }
                >
                  {s.project.preferences.split ? <Columns2 size={18} /> : <LayoutGrid size={18} />}
                  <span>{s.project.preferences.split ? 'Dividida' : 'Una vista'}</span>
                </button>
              )}
              <button
                title="Snapping"
                className={s.project.preferences.snap ? 'active' : ''}
                aria-label="Snapping"
                onClick={() =>
                  s.change((p) => {
                    p.preferences.snap = !p.preferences.snap;
                  })
                }
              >
                <Settings2 size={16} />
                <span>Snap</span>
              </button>
            </div>
          </div>
          <div
            className={`canvases ${s.mode === 'edit' && s.project.preferences.split ? 'split' : ''}`}
          >
            {s.mode === 'edit' && s.project.preferences.split ? (
              <>
                <Canvas studio={s} editorOnly />
                <Canvas studio={s} previewOnly />
              </>
            ) : (
              <Canvas studio={s} editorOnly={s.project.preferences.sourceView} />
            )}
          </div>
          <footer className="statusbar">
            <div
              className={`periodicity-status ${status === 'PERIODIC_SEAMLESS' ? 'periodic' : 'finite'}`}
              title={statusText}
            >
              <span />
              {mixed
                ? commonCell
                  ? 'Composición · celda común verificada'
                  : 'Composición · sin celda común verificada'
                : s.effectivePattern.tiling && s.effectivePattern.generator.kind !== 'penrose'
                  ? 'Teselas · cobertura periódica'
                  : status === 'FREE_NONPERIODIC'
                    ? 'Libre · sin repetición'
                    : status === 'PERIODIC_SEAMLESS'
                      ? s.effectivePattern.symmetry.family === 'frieze'
                        ? 'Friso · periódico en una dirección'
                        : 'Periódico · seamless'
                      : status === 'FINITE_NONPERIODIC'
                        ? 'Composición finita · no periódica'
                        : 'Sin verificar'}
              <small>
                {s.effectivePattern.tiling && s.effectivePattern.generator.kind !== 'penrose'
                  ? `Motivo local: ${s.effectivePattern.symmetry.family === 'none' ? 'Libre' : s.effectivePattern.symmetry.group}`
                  : s.effectivePattern.symmetry.family === 'none'
                    ? 'Libre'
                    : s.effectivePattern.symmetry.group}
              </small>
            </div>
            <div>
              {s.objects.length} objetos fuente <i />{' '}
              {s.selected.length
                ? `${s.selected.length} seleccionados`
                : 'Geometría no destructiva'}{' '}
              <i /> {s.project.documentUnits}
            </div>
          </footer>
        </section>
      </main>
      <input
        hidden
        ref={presetRef}
        type="file"
        accept=".json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            try {
              const pattern = parsePreset(await file.text());
              s.change((p) => p.patterns.push(pattern));
              s.setPatternId(pattern.id);
              s.setSelected([]);
              s.setMessage('Preset importado como patrón editable.');
            } catch (e) {
              s.setMessage((e as Error).message);
            }
          }
          e.target.value = '';
        }}
      />
      <input
        hidden
        ref={openRef}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          void open(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        hidden
        ref={svgRef}
        type="file"
        accept=".svg,image/svg+xml"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) setImportText(await file.text());
          e.target.value = '';
        }}
      />
      {s.message && (
        <div className="toast" role="status">
          {s.message}
          <button aria-label="Cerrar mensaje" onClick={() => s.setMessage('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {exportOpen && <ExportDialog studio={s} onClose={() => setExportOpen(false)} />}
      {importText !== null && (
        <div className="modal-shade">
          <section
            className="small-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Importar SVG"
          >
            <header>
              <h2>Importar geometría</h2>
              <button aria-label="Cerrar importación" onClick={() => setImportText(null)}>
                <X size={19} />
              </button>
            </header>
            <p>
              Si el SVG declara medidas físicas se conservan. Si sólo declara píxeles o viewBox,
              definí su ancho en milímetros.
            </p>
            <label className="text-field">
              <span>Ancho si no hay escala física (mm)</span>
              <input
                aria-label="Ancho físico de importación"
                type="number"
                min={0.1}
                value={importWidth}
                onChange={(e) => setImportWidth(Number(e.target.value))}
              />
            </label>
            <p className="help-text">
              Destino: {s.mode === 'apply' ? 'perímetro cerrado' : 'geometría fuente del patrón'}.
              Scripts y recursos activos se eliminan.
            </p>
            <button className="primary-button" onClick={importFile}>
              <Upload size={15} /> Importar SVG
            </button>
          </section>
        </div>
      )}
      {library && (
        <div className="modal-shade">
          <section
            className="small-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Biblioteca de proyectos"
          >
            <header>
              <h2>Tu biblioteca local</h2>
              <button aria-label="Cerrar biblioteca" onClick={() => setLibrary(null)}>
                <X size={19} />
              </button>
            </header>
            <p className="help-text">
              Los ejemplos y los proyectos nuevos no borran tus proyectos anteriores. Exportá JSON
              para llevarlos a otro navegador.
            </p>
            <div className="library-list">
              {library.map((p) => (
                <button
                  key={p.id}
                  onClick={async () => {
                    try {
                      s.load(await loadSavedProject(p.id));
                      setLibrary(null);
                    } catch (e) {
                      s.setMessage((e as Error).message);
                    }
                  }}
                >
                  <span>{p.name}</span>
                  <small>{new Date(p.updatedAt).toLocaleString()}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {help && (
        <div className="modal-shade">
          <section
            className="small-dialog help-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Ayuda"
          >
            <header>
              <h2>Un estudio para explorar.</h2>
              <button aria-label="Cerrar ayuda" onClick={() => setHelp(false)}>
                <X size={19} />
              </button>
            </header>
            <p>
              Dibujá una forma, elegí una simetría y mirá cómo se transforma. Cada copia sigue
              vinculada a la geometría original.
            </p>
            <div className="shortcut-grid">
              {tools
                .filter((t) => t.shortcut)
                .map((t) => (
                  <div key={t.id}>
                    <span>{t.label}</span>
                    <kbd>{t.shortcut}</kbd>
                  </div>
                ))}
              <div>
                <span>Deshacer / rehacer</span>
                <kbd>Ctrl Z / Shift Z</kbd>
              </div>
              <div>
                <span>Duplicar</span>
                <kbd>Ctrl D</kbd>
              </div>
              <div>
                <span>Seleccionar todo</span>
                <kbd>Ctrl A</kbd>
              </div>
              <div>
                <span>Pan</span>
                <kbd>Espacio + arrastrar</kbd>
              </div>
              <div>
                <span>Zoom al cursor</span>
                <kbd>Ctrl + rueda</kbd>
              </div>
              <div>
                <span>Terminar path</span>
                <kbd>Enter / doble clic</kbd>
              </div>
              <div>
                <span>Cerrar path</span>
                <kbd>Shift Enter / primer nodo</kbd>
              </div>
              <div>
                <span>Cancelar path</span>
                <kbd>Esc</kbd>
              </div>
            </div>
            <p className="help-text">
              Pluma: clic para anclar; arrastrá para crear tangentes. Nodos: mové los cuadrados y
              sus tiradores. Alt permite separar tangentes. Shift suma objetos a la selección; Alt
              selecciona un miembro del grupo.
            </p>
            <p className="help-text">
              En Aplicar, dibujá un perímetro y usá «Aplicar al perímetro». El guardado JSON
              conserva el proyecto completo; el autosave vive en este navegador.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
