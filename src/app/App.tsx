import { DiskDialog } from '../ui/DiskDialog';
import { SphereDialog } from '../ui/SphereDialog';
import { AnimationDialog } from '../ui/AnimationDialog';
import { defaultVisualization } from '../visualization/model';
import { finiteGenerator } from '../aperiodic/model';
import { ExampleGallery } from '../ui/ExampleGallery';
import { ReferencesDialog } from '../ui/ReferencesDialog';
import { IsohedralGallery } from '../ui/IsohedralGallery';
import { newIsohedralTiling } from '../tiling/tiles';
import { isohedralPreset } from '../isohedral/catalog';
import { compositionExample } from '../examples/catalog';
import { SaveDialog } from '../ui/SaveDialog';
import { studyFileName } from './naming';
import { Modal } from '../ui/Modal';
import { SiteFooter } from '../ui/SiteFooter';
import { CommandPalette, type Command } from '../ui/CommandPalette';
import { symmetryCatalog } from '../symmetry/config';
import { StylePanel, StyleIndicator } from '../ui/StylePanel';
import logo from '../assets/icono.png';
import { commonRectangularCell, resolvePattern } from '../symmetry/config';
import { useState, useRef, useEffect } from 'react';
import { railCategories, type Category } from '../ui/navigation';
import {
  Search,
  PaintBucket,
  MousePointer2,
  PenTool,
  Pencil,
  PenLine,
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
  PanelRightClose,
  PanelRightOpen,
  Palette,
  Activity,
  SwatchBook,
  Bookmark,
  Shapes,
  Columns2,
  LayoutGrid,
  Check,
  ChevronDown,
  X,
  Settings2,
  ExternalLink,
  HelpCircle,
  BookOpen,
  Trash2,
} from 'lucide-react';
import { useStudio, type Tool, type StylePage } from './useStudio';
import { newStudy, geometry, uid, type Project } from './model';
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
const stylePages: { id: StylePage; label: string; icon: typeof Palette }[] = [
  { id: 'stroke', label: 'Trazo', icon: PenLine },
  { id: 'profile', label: 'Perfil', icon: Activity },
  { id: 'fill', label: 'Fill', icon: PaintBucket },
  { id: 'palette', label: 'Paleta', icon: SwatchBook },
  { id: 'presets', label: 'Presets', icon: Bookmark },
  { id: 'object', label: 'Objeto', icon: Shapes },
  { id: 'options', label: 'Opciones', icon: Settings2 },
];
const tools: { id: Tool; label: string; shortcut?: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Seleccionar', shortcut: 'V', icon: MousePointer2 },
  { id: 'nodes', label: 'Editar nodos', shortcut: 'A', icon: Waypoints },
  { id: 'pen', label: 'Pluma Bézier', shortcut: 'P', icon: PenTool },
  { id: 'pencil', label: 'Dibujo libre', shortcut: 'B', icon: Pencil },
  { id: 'line', label: 'Línea', shortcut: 'L', icon: Minus },
  { id: 'rectangle', label: 'Rectángulo', shortcut: 'R', icon: Square },
  { id: 'ellipse', label: 'Elipse', shortcut: 'E', icon: Circle },
  { id: 'polygon', label: 'Polígono libre', icon: Hexagon },
  { id: 'fill', label: 'Rellenar región', shortcut: 'F', icon: PaintBucket },
  { id: 'pan', label: 'Desplazar vista', shortcut: 'H', icon: Move },
];
export default function App() {
  const s = useStudio(),
    [exportOpen, setExportOpen] = useState(false),
    [saveOpen, setSaveOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [examplesOpen, setExamplesOpen] = useState(false),
    [commandOpen, setCommandOpen] = useState(false),
    [collapsed, setCollapsed] = useState(() => innerWidth <= 900),
    [category, setCategory] = useState<Category>('symmetry'),
    [help, setHelp] = useState(false),
    [referencesOpen, setReferencesOpen] = useState(false),
    [animationOpen, setAnimationOpen] = useState(false),
    [isohedralOpen, setIsohedralOpen] = useState(false),
    [importText, setImportText] = useState<string | null>(null),
    [importWidth, setImportWidth] = useState(100),
    [library, setLibrary] = useState<Awaited<ReturnType<typeof savedProjects>> | null>(null);
  const openVisualization = () => {
    s.setStyleOpen(false);
    s.change((p) => {
      p.visualization = p.visualization
        ? { ...p.visualization, active: true }
        : defaultVisualization(p, s.pattern.id);
    });
  };
  const closeVisualization = () =>
    s.change((p) => {
      if (p.visualization) p.visualization.active = false;
    });
  const openExport = () => {
    s.setStyleOpen(false);
    setExportOpen(true);
  };
  const deferredCategory = useRef<Category | null>(null);
  useEffect(() => {
    deferredCategory.current = null;
  }, [s.project.metadata.id]);
  const openRef = useRef<HTMLInputElement>(null),
    svgRef = useRef<HTMLInputElement>(null),
    presetRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (s.tool === 'nodes') {
      s.setStylePage('object');
      s.setObjectTab('nodes');
      s.setStyleOpen(!s.inlineNodes.current);
    }
  }, [s.tool]);
  useEffect(() => {
    if (s.mode === 'apply') {
      setCategory('application');
      setCollapsed(false);
      if (innerWidth <= 900) s.setStyleOpen(false);
    }
  }, [s.mode]);
  useEffect(() => {
    const requested = s.styleRequest.current;
    s.styleRequest.current = null;
    if (
      s.selected.length &&
      (s.tool === 'select' || (s.tool === 'nodes' && !s.inlineNodes.current))
    ) {
      s.setStylePage(requested ?? 'object');
      s.setStyleTarget('selection');
      s.setStyleOpen(true);
    }
  }, [s.selected.join(','), s.tool]);
  useEffect(() => {
    const fitPanels = () => {
      if (s.styleOpen && innerWidth <= 900) setCollapsed(true);
    };
    fitPanels();
    window.addEventListener('resize', fitPanels);
    return () => window.removeEventListener('resize', fitPanels);
  }, [s.styleOpen]);
  useEffect(() => {
    const dismiss = (e: PointerEvent) => {
      const menu = document.querySelector<HTMLDetailsElement>('.main-menu[open]');
      if (menu && !menu.contains(e.target as Node)) menu.open = false;
    };
    const escape = (e: KeyboardEvent) => {
      const menu = document.querySelector<HTMLDetailsElement>('.main-menu[open]');
      if (menu && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        menu.open = false;
        menu.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, []);
  useEffect(() => {
    if (
      s.project.visualization?.active ||
      examplesOpen ||
      saveOpen ||
      exportOpen ||
      commandOpen ||
      help ||
      referencesOpen ||
      isohedralOpen ||
      importText !== null ||
      library ||
      s.pendingAction
    ) {
      const menu = document.querySelector<HTMLDetailsElement>('.main-menu');
      if (menu) menu.open = false;
    }
  }, [
    s.project.visualization?.active,
    examplesOpen,
    saveOpen,
    exportOpen,
    commandOpen,
    help,
    referencesOpen,
    isohedralOpen,
    importText,
    library,
    s.pendingAction,
  ]);
  const openCategory = (next: Category) => {
    if (s.interactionActive.current) {
      deferredCategory.current = next;
      return;
    }
    setCategory(next);
    setCollapsed(false);
    if (innerWidth <= 900) s.setStyleOpen(false);
  };
  useEffect(() => {
    if (s.interactionActive.current || !deferredCategory.current) return;
    const next = deferredCategory.current;
    deferredCategory.current = null;
    setCategory(next);
    setCollapsed(false);
    if (innerWidth <= 900) s.setStyleOpen(false);
  }, [s.interactionVersion]);
  const activateTool = (tool: Tool) => {
    if (tool === 'region') openCategory('application');
    else setCollapsed(true);
    s.setTool(tool);
    if (tool === 'fill' && innerWidth <= 900) setCollapsed(true);
  };
  const createRegular = () => {
    setCollapsed(true);
    const g = geometry('polygon', [], true);
    Object.assign(g, s.drawStyle);
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
    s.setObjectTab('shape');
    s.setStylePage('object');
    s.setStyleTarget('selection');
    s.setStyleOpen(true);
  };
  const save = () => {
    s.setStyleOpen(false);
    setSaveOpen(true);
  };
  const saveNamed = async (name: string) => {
    if (saving) return;
    const pending = s.pendingAction;
    let project = structuredClone(s.projectRef.current);
    project.metadata.name = studyFileName(name);
    setSaving(true);
    try {
      parseProject(serialize(project));
      s.change((p) => {
        p.metadata.name = project.metadata.name;
      });
      project = s.projectRef.current;
      try {
        await autosave(project);
      } catch (error) {
        if (pending)
          throw Error(
            'No se pudo guardar en este navegador. El trabajo se conserva; reintentá o cancelá. ' +
              (error as Error).message,
          );
      }
      download(serialize(project), project.metadata.name + '.pattern.json');
      s.setFileSaved(s.projectRef.current === project);
      if (pending && s.projectRef.current !== project) {
        s.setMessage(
          'El trabajo cambió durante el guardado. Guardalo nuevamente antes de continuar.',
        );
        return;
      }
      setSaveOpen(false);
      s.setMessage('Proyecto guardado como archivo JSON editable.');
      if (pending) s.continueDestructive(pending);
    } catch (error) {
      s.setMessage('No se puede guardar: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const replaceProject = (
    project: Project,
    label: string,
    after: () => void = () => {},
    options: { fresh?: boolean } = {},
  ) => {
    s.requestDestructive(label, () => {
      s.load(project, options);
      after();
    });
  };
  const openExamples = () => {
    s.setStyleOpen(false);
    setExamplesOpen(true);
  };
  const openIsohedral = () => {
    s.setStyleOpen(false);
    setIsohedralOpen(true);
  };
  const commands: Command[] = [
    {
      id: 'isohedral-catalog',
      label: 'Explorar catálogo isoédrico IH1–IH93',
      keywords: 'teselas figurativas encastre bordes',
      run: () => {
        openCategory('tiles');
        openIsohedral();
      },
    },
    {
      id: 'references',
      label: 'Repositorios y referencias',
      keywords: 'código fuentes proyectos consultados',
      run: () => setReferencesOpen(true),
    },
    {
      id: 'composition-recursive',
      label: 'Explorar composición recursiva',
      keywords: 'square limit cuadrantes autosimilar peces',
      run: () => {
        openCategory('symmetry');
        s.openComposition();
      },
    },
    {
      id: 'composition-spiral',
      label: 'Explorar espirales y semejanzas',
      keywords: 'espiral roseta escala giro',
      run: () => {
        openCategory('symmetry');
        s.openComposition();
      },
    },
    {
      id: 'examples-gallery',
      label: 'Galería de ejemplos',
      keywords: 'peces aves ejemplos escher originales',
      run: openExamples,
    },
    ...tools.map((t) => ({
      id: `tool-${t.id}`,
      label: t.label,
      keywords: t.id === 'fill' ? 'rellenar fill color' : t.shortcut,
      run: () => {
        activateTool(t.id);
      },
    })),
    ...railCategories.map((c) => ({
      id: `category-${c.id}`,
      label: `Abrir ${c.label}`,
      run: () => openCategory(c.id),
    })),
    ...symmetryCatalog.map((choice) => ({
      id: `symmetry-${choice.family}-${choice.group}`,
      label: `Simetría ${choice.group === 'none' ? 'Libre' : choice.group}`,
      keywords: choice.family,
      run: () => {
        openCategory('symmetry');
        s.changeSymmetryChoice(choice);
      },
    })),
    {
      id: 'regular',
      label: 'Polígono paramétrico',
      keywords: 'forma regular lados',
      run: createRegular,
    },
    {
      id: 'catalog',
      label: 'Explorar catálogo de simetrías',
      run: () => {
        openCategory('symmetry');
        s.setCatalogOpen(true);
      },
    },
    {
      id: 'width',
      label: 'Cambiar grosor de trazo',
      run: () => {
        s.setStylePage('stroke');
        s.setStyleOpen(true);
        requestAnimationFrame(() =>
          document.querySelector<HTMLInputElement>('input[aria-label="Grosor de trazo"]')?.focus(),
        );
      },
    },
    { id: 'export-svg', label: 'Exportar SVG', run: openExport },
    {
      id: 'save',
      label: 'Guardar proyecto JSON',
      run: () => {
        void save();
      },
    },
    { id: 'import', label: 'Importar SVG', run: () => svgRef.current?.click() },
  ];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!document.querySelector('dialog[open],.modal-shade')) setCommandOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      replaceProject(parseProject(await file.text()), 'abrir otro proyecto', () =>
        s.setMessage('Proyecto recuperado.'),
      );
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
        <div className="app-title">
          <strong>Patterns</strong>
          <small>Patrones Geométricos</small>
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
              title={
                mode === 'edit'
                  ? 'Editar el motivo y usar vista dividida'
                  : mode === 'pattern'
                    ? 'Ver y editar el patrón en una vista completa'
                    : 'Recortar el patrón dentro de un perímetro cerrado'
              }
              className={s.mode === mode ? 'active' : ''}
              onClick={() => {
                s.setMode(mode);
                if (mode === 'apply') {
                  setCategory('application');
                  setCollapsed(false);
                  if (innerWidth <= 900) s.setStyleOpen(false);
                }
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
          <button
            className="command-trigger icon-button"
            title="Buscar comandos (Ctrl+K)"
            aria-label="Buscar comandos"
            onClick={() => setCommandOpen(true)}
          >
            <Search size={18} />
          </button>
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
            <summary
              title="Archivo y ejemplos"
              onClick={() => s.setStyleOpen(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
              }}
            >
              Archivo <ChevronDown size={13} />
            </summary>
            <div className="menu-popover">
              <label className="file-project-name">
                Nombre del proyecto
                <input
                  aria-label="Nombre del proyecto"
                  value={s.project.metadata.name}
                  onChange={(e) =>
                    s.change((p) => {
                      p.metadata.name = e.target.value;
                    })
                  }
                />
              </label>
              <button
                onClick={() => {
                  replaceProject(
                    newStudy(),
                    'crear un proyecto nuevo',
                    () => {
                      s.setMode('edit');
                      setCategory('symmetry');
                      setCollapsed(innerWidth <= 900);
                    },
                    { fresh: true },
                  );
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
                  replaceProject(p, 'duplicar el proyecto');
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
              <button onClick={openExamples}>
                <LayoutGrid size={15} /> Galería de ejemplos
              </button>
              <hr />
              <button
                onClick={() => {
                  download(
                    JSON.stringify(
                      {
                        presetVersion: 6,
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
          <button className="primary-button export-trigger" onClick={openExport}>
            <Download size={16} /> Exportar
          </button>
        </div>
      </header>
      <main className={`workspace ${collapsed ? 'panel-collapsed' : ''}`}>
        <nav className="tool-rail" aria-label="Herramientas y categorías">
          <div className="category-rail" role="group" aria-label="Categorías">
            {railCategories.map(({ id, label }) => (
              <button
                key={id}
                title={label}
                aria-label={`Abrir ${label}`}
                aria-pressed={!collapsed && category === id}
                className={!collapsed && category === id ? 'active' : ''}
                onClick={() => openCategory(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="rail-tools" role="group" aria-label="Herramientas de dibujo">
            {tools
              .filter((t) => t.id !== 'pan')
              .map(({ id, label, shortcut, icon: Icon }, i) => (
                <button
                  key={id}
                  className={`${s.tool === id ? 'active' : ''} ${i === 2 || i === 8 ? 'tool-gap' : ''}`}
                  title={`${label}${shortcut ? ' (' + shortcut + ')' : ''}`}
                  aria-label={label}
                  aria-pressed={s.tool === id}
                  onClick={() => {
                    activateTool(id);
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
                createRegular();
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
          </div>
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
            <button
              title="Repositorios y referencias"
              aria-label="Referencias"
              onClick={() => setReferencesOpen(true)}
            >
              <BookOpen size={19} />
            </button>
          </div>
        </nav>
        <Panels
          studio={s}
          category={category}
          collapsed={collapsed}
          onCollapse={() => setCollapsed(true)}
          onExamples={openExamples}
          onIsohedral={openIsohedral}
          onImport={() => svgRef.current?.click()}
        />
        <section className="drawing-area">
          {s.mode !== 'apply' && (
            <div className="continuous-view-controls">
              <button
                disabled={
                  !s.visiblePatterns.some(
                    (p) =>
                      !finiteGenerator(p.generator) &&
                      !p.composition?.enabled &&
                      (p.tiling || ['wallpaper', 'frieze'].includes(p.symmetry.family)),
                  )
                }
                aria-pressed={s.project.preferences.repetitionView === 'single'}
                onClick={() =>
                  s.change((p) => {
                    p.preferences.repetitionView =
                      !p.preferences.split && p.preferences.repetitionView === 'single'
                        ? 'extended'
                        : 'single';
                    p.preferences.sourceView = false;
                    p.preferences.split = false;
                  })
                }
              >
                Una celda
              </button>
              <span>
                {s.symmetryPreview
                  ? 'Previsualización temporal'
                  : s.pattern.composition?.enabled
                    ? s.project.preferences.sourceView
                      ? 'Motivo fuente · composición enlazada'
                      : 'Composición finita'
                    : 'Simetría confirmada'}{' '}
                · {tools.find((t) => t.id === s.tool)?.label ?? s.tool}
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
                aria-label="Visualizar patrón"
                title="Visualización geométrica o artística del patrón"
                onClick={openVisualization}
              >
                <Circle size={17} />
                <span>Visualizar</span>
              </button>
              <button
                aria-label="Animar"
                title="Animación determinística y exportación GIF/WebM"
                onClick={() => setAnimationOpen(true)}
              >
                <Circle size={17} />
                <span>Animar</span>
              </button>
              <StyleIndicator studio={s} />
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
                title="Snap · Distancia de atracción en Preferencias"
                className={(s.project.preferences.snapNodes ?? true) ? 'active' : ''}
                aria-label="Snapping"
                onClick={() =>
                  s.change((p) => {
                    p.preferences.snapNodes = !(p.preferences.snapNodes ?? true);
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
                <Canvas studio={s} cellOnly />
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
                : s.effectivePattern.tiling && !finiteGenerator(s.effectivePattern.generator)
                  ? 'Teselas · cobertura periódica'
                  : status === 'FREE_NONPERIODIC'
                    ? 'Libre · sin repetición'
                    : status === 'PERIODIC_SEAMLESS'
                      ? s.effectivePattern.symmetry.family === 'frieze'
                        ? 'Friso · periódico en una dirección'
                        : 'Periódico · seamless'
                      : status === 'FINITE_NONPERIODIC'
                        ? s.effectivePattern.generator.kind === 'girih'
                          ? 'Girih · parche finito'
                          : finiteGenerator(s.effectivePattern.generator)
                            ? 'Parche aperiódico finito'
                            : 'Composición finita · no periódica'
                        : 'Sin verificar'}
              <small>
                {finiteGenerator(s.effectivePattern.generator)
                  ? s.effectivePattern.generator.kind
                  : s.effectivePattern.tiling
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
        <div className="style-dock">
          <StylePanel studio={s} />
          <nav className="style-panel-rail" aria-label="Accesos del panel derecho">
            {stylePages.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                title={
                  id === 'object' && !s.styleSelection.length
                    ? 'Objeto · seleccioná una figura'
                    : label
                }
                aria-label={`Panel derecho: ${label}`}
                aria-pressed={s.styleOpen && s.stylePage === id}
                disabled={id === 'object' && !s.styleSelection.length}
                onClick={() => {
                  s.setStylePage(id);
                  s.setStyleOpen(true);
                }}
              >
                <Icon size={18} strokeWidth={1.6} />
              </button>
            ))}
            <button
              className="quick-colors"
              title="Colores de trazo y relleno"
              aria-label="Colores de trazo y relleno"
              aria-pressed={s.styleOpen && s.stylePage === 'colors'}
              onClick={() => {
                s.setStylePage('colors');
                s.setStyleOpen(true);
              }}
            >
              <span
                className="quick-stroke"
                style={{
                  background:
                    s.styleContext.value.stroke === 'none'
                      ? 'linear-gradient(135deg,white 43%,#af5858 44% 56%,white 57%)'
                      : s.styleContext.value.stroke,
                }}
              />
              <span
                className="quick-fill"
                style={{
                  background:
                    s.styleContext.value.fill === 'none'
                      ? 'linear-gradient(135deg,white 43%,#af5858 44% 56%,white 57%)'
                      : s.styleContext.value.fill,
                }}
              />
            </button>
            <button
              className="style-panel-toggle"
              title={s.styleOpen ? 'Plegar panel derecho' : 'Desplegar panel derecho'}
              aria-label={s.styleOpen ? 'Plegar panel derecho' : 'Desplegar panel derecho'}
              aria-expanded={s.styleOpen}
              onClick={() => s.setStyleOpen(!s.styleOpen)}
            >
              {s.styleOpen ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
            </button>
          </nav>
        </div>
      </main>
      <SiteFooter />
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
      {commandOpen && <CommandPalette commands={commands} onClose={() => setCommandOpen(false)} />}
      {animationOpen && <AnimationDialog studio={s} onClose={() => setAnimationOpen(false)} />}
      {examplesOpen && (
        <ExampleGallery
          onClose={() => setExamplesOpen(false)}
          onSelect={(id) => {
            const project = compositionExample(id);
            setExamplesOpen(false);
            replaceProject(project, 'cargar un ejemplo', () => {
              s.setMode('edit');
              s.setSelected([]);
              if (
                (project.patterns[0].tiling || finiteGenerator(project.patterns[0].generator)) &&
                !project.patterns[0].composition?.enabled
              ) {
                setCategory('tiles');
                s.setTileTab('shape');
              } else {
                setCategory('symmetry');
                s.openComposition();
              }
              setCollapsed(innerWidth <= 900);
              s.requestFit();
            });
          }}
        />
      )}
      {s.loaded && s.project.visualization?.active && (
        s.project.visualization.kind === 'sphere' ? (
          <SphereDialog
            key={s.project.metadata.id + ':sphere'}
            studio={s}
            onClose={closeVisualization}
            onSave={() => setSaveOpen(true)}
          />
        ) : (
          <DiskDialog
            key={s.project.metadata.id + ':' + s.project.visualization.kind}
            studio={s}
            onClose={closeVisualization}
            onSave={() => setSaveOpen(true)}
          />
        )
      )}
      {saveOpen && (
        <SaveDialog
          name={s.project.metadata.name}
          onSave={saveNamed}
          busy={saving}
          onClose={() => {
            setSaveOpen(false);
            s.cancelDestructive();
          }}
        />
      )}
      {s.pendingAction && !saveOpen && (
        <Modal label="Conservar el trabajo" className="simple-modal" onClose={s.cancelDestructive}>
          <section className="small-dialog">
            <h2>¿Qué querés hacer con el trabajo actual?</h2>
            <p>Antes de {s.pendingAction.label}, podés guardar el proyecto editable.</p>
            <div className="save-actions destructive-actions">
              <button autoFocus onClick={s.cancelDestructive}>
                Cancelar
              </button>
              <button onClick={() => setSaveOpen(true)}>Guardar trabajo y continuar</button>
              <button className="danger-text" onClick={() => s.continueDestructive()}>
                Descartar y continuar
              </button>
            </div>
          </section>
        </Modal>
      )}
      {exportOpen && <ExportDialog studio={s} onClose={() => setExportOpen(false)} />}
      {importText !== null && (
        <Modal label="Importar SVG" className="simple-modal" onClose={() => setImportText(null)}>
          <section className="small-dialog">
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
        </Modal>
      )}
      {library && (
        <Modal
          label="Biblioteca de proyectos"
          className="simple-modal"
          onClose={() => setLibrary(null)}
        >
          <section className="small-dialog">
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
                      const project = await loadSavedProject(p.id);
                      setLibrary(null);
                      replaceProject(project, 'abrir un proyecto de la biblioteca');
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
        </Modal>
      )}
      {isohedralOpen && (
        <IsohedralGallery
          onClose={() => setIsohedralOpen(false)}
          onSelect={(type, curved) => {
            setIsohedralOpen(false);
            if (finiteGenerator(s.pattern.generator)) {
              s.setMessage(
                'Convertí el parche aperiódico a paths antes de usar teselas periódicas.',
              );
              return;
            }
            const fresh = newIsohedralTiling(type);
            fresh.edges = isohedralPreset(type, curved).edges;
            s.change((project) => {
              const p = project.patterns.find((p) => p.id === s.pattern.id)!,
                previous = p.tiling;
              p.tiling = {
                ...fresh,
                width: previous?.width ?? 60,
                origin: previous?.origin ?? { x: 0, y: 0 },
                rotation: previous?.rotation ?? 0,
                showOutline: previous?.showOutline ?? true,
              };
              if (p.composition) p.composition.enabled = false;
            });
            s.setTileEdge(0);
            s.setTileNode(1);
            s.setInstanceExplicit(false);
            openCategory('tiles');
            s.updateViewPreferences({ sourceView: false, repetitionView: 'extended' });
            s.requestFit();
          }}
        />
      )}
      {referencesOpen && <ReferencesDialog onClose={() => setReferencesOpen(false)} />}
      {help && (
        <Modal label="Ayuda" className="simple-modal" onClose={() => setHelp(false)}>
          <section className="small-dialog help-dialog">
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
        </Modal>
      )}
    </div>
  );
}
