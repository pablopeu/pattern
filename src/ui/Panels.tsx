import { GirihPanel, activateGirih } from './GirihPanel';
import { sceneLayers } from '../patterns/layers';
import { AperiodicPanel, activateAperiodic } from './AperiodicPanel';
import { isAperiodic } from '../aperiodic/model';
import { CompositionPanel } from './CompositionPanel';
import { TilePanel } from './TilePanel';
import { SymmetryGallery } from './SymmetryGallery';
import { freezePattern } from '../symmetry/config';
import { useState, useEffect, useRef } from 'react';
import { type Category } from './navigation';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Layers,
  SlidersHorizontal,
  Unlink,
  Link2,
  Scissors,
} from 'lucide-react';
import type { Studio } from '../app/useStudio';
import { newPattern, uid, type Generator } from '../app/model';
import {
  fromMM,
  toMM,
  IDENTITY,
  multiply,
  rotate,
  scale,
  translate,
  type Matrix,
} from '../geometry/matrix';

import { hasClosedGeometry } from '../application/clipping';
import { generatorLabels, generatorParameters, generate } from '../generators';

import { pathData } from '../geometry/paths';
import { Field, Section, Select, Toggle } from './Controls';
import { tr, message, translateMessage, useI18n, useExperienceActions, type MessageKey, type LanguagePreference, type ThemePreference, type UiMode } from '../i18n';
const paramLabels: Partial<Record<keyof Generator, string>> = {
  rows: 'Filas',
  columns: 'Columnas',
  spacing: 'Espaciado',
  offset: 'Desfase de filas',
  rotation: 'Rotación del motivo',
  scale: 'Escala del motivo',
  scaleRatio: 'Relación de escala',
  count: 'Cantidad',
  amplitude: 'Amplitud',
  frequency: 'Frecuencia',
  phase: 'Fase',
  radius: 'Radio',
  ratio: 'Relación de radios',
  seed: 'Semilla',
  aspectRatio: 'Relación de ejes',
};
const ranges: Partial<Record<keyof Generator, [number, number, number]>> = {
  rows: [1, 12, 1],
  columns: [1, 12, 1],
  spacing: [2, 100, 0.5],
  offset: [0, 1, 0.05],
  rotation: [-180, 180, 1],
  scale: [0.05, 3, 0.05],
  scaleRatio: [0.1, 1.5, 0.05],
  count: [2, 64, 1],
  amplitude: [0, 40, 0.5],
  frequency: [1, 24, 1],
  phase: [0, 360, 1],
  radius: [2, 120, 1],
  ratio: [0.05, 1, 0.01],
  seed: [0, 2147483647, 1],
  aspectRatio: [0.1, 3, 0.05],
};
function ExperiencePrefs() {
  const experience = useI18n(),
    actions = useExperienceActions();
  return (
    <div className="experience-inline" role="group" aria-label={message('prefs.experience')}>
      <strong>{message('prefs.experience')}</strong>
      <div className="experience-row">
      <label className="text-field">
        <span>{message('prefs.language')}</span>
        <select
          aria-label={message('prefs.language')}
          value={experience.language}
          onChange={(e) => actions.setLanguage(e.target.value as LanguagePreference)}
        >
          <option value="auto">{message('prefs.language.auto')}</option>
          <option value="es">{message('prefs.language.es')}</option>
          <option value="en">{message('prefs.language.en')}</option>
        </select>
      </label>
      <label className="text-field">
        <span>{message('prefs.appearance')}</span>
        <select
          aria-label={message('prefs.appearance')}
          value={experience.theme}
          onChange={(e) => actions.setTheme(e.target.value as ThemePreference)}
        >
          <option value="auto">{message('prefs.appearance.auto')}</option>
          <option value="light">{message('prefs.appearance.light')}</option>
          <option value="dark">{message('prefs.appearance.dark')}</option>
        </select>
      </label>
      <label className="text-field">
        <span>{message('prefs.uiMode')}</span>
        <select
          aria-label={message('prefs.uiMode')}
          value={experience.uiMode}
          onChange={(e) => actions.setUiMode(e.target.value as UiMode)}
        >
          <option value="simple">{message('prefs.uiMode.simple')}</option>
          <option value="advanced">{message('prefs.uiMode.advanced')}</option>
        </select>
      </label>
      </div>
    </div>
  );
}

export function Panels({
  studio: s,
  onImport,
  category,
  collapsed,
  onCollapse,
  onExamples,
  onIsohedral,
}: {
  studio: Studio;
  onImport: () => void;
  category: Category;
  collapsed: boolean;
  onCollapse: () => void;
  onExamples: () => void;
  onIsohedral: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [generatorPage, setGeneratorPage] = useState(0),
    [placementPage, setPlacementPage] = useState(0),
    [applicationPage, setApplicationPage] = useState('region');
  const [tabs, setTabs] = useState<Partial<Record<Category, string>>>({});
  useEffect(() => {
    if (s.compositionRequest) setTabs((old) => ({ ...old, symmetry: 'composition' }));
  }, [s.compositionRequest]);
  const tab =
    category === 'layers' && s.mode === 'apply'
      ? 'layers'
      : (tabs[category] ?? (category === 'layers' ? 'layers' : 'design'));
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [category, tab]);
  const setTab = (next: string) => setTabs((old) => ({ ...old, [category]: next }));
  const u = s.project.documentUnits,
    selected = s.objects.filter((g) => !g.locked && s.selected.includes(g.id));
  const updatePattern = (recipe: (p: Studio['pattern']) => void) =>
    s.change((p) => recipe(p.patterns.find((x) => x.id === s.pattern.id)!));
  const units = (value: number) => fromMM(value, u),
    mm = (value: number) => toMM(value, u);
  const changeApplication = (recipe: (a: NonNullable<Studio['application']>) => void) =>
    s.change((p) => {
      const a = p.applications.find((a) => a.id === s.applicationId);
      if (a) recipe(a);
    });
  const generatorKeys = (
    s.pattern.generator.kind === 'warp' && s.pattern.generator.distribution === 'circular'
      ? ([
          'distribution',
          'count',
          'radius',
          'aspectRatio',
          'rotation',
          'scale',
          'scaleRatio',
          'amplitude',
          'frequency',
          'phase',
        ] as (keyof Generator)[])
      : generatorParameters[s.pattern.generator.kind]
  ).filter((key) => key !== 'seed' || s.pattern.generator.distribution === 'freeform');
  const addApplication = () => {
    if (!s.region) {
      s.setMessage('Dibujá o importá un perímetro cerrado antes de aplicar el patrón.');
      return;
    }
    if (s.region.geometry.some((g) => !hasClosedGeometry(g))) {
      s.setMessage('Cerrá todos los trazados del perímetro antes de aplicar.');
      return;
    }
    const id = uid();
    s.change((p) =>
      p.applications.push({
        id,
        name: `Aplicación ${p.applications.length + 1}`,
        patternId: s.pattern.id,
        regionId: s.regionId,
        placementTransform: IDENTITY,
        linked: true,
        showOutline: true,
      }),
    );
    s.setApplicationId(id);
    s.setSelected([]);
    s.setTool('select');
  };
  return (
    <aside
      className="context-panel"
      aria-label={tr('Panel contextual')}
      hidden={collapsed}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCollapse();
        }
      }}
    >
      <header className="context-heading">
        <span>{message(`category.${category}` as MessageKey)}</span>
        <button
          aria-label={tr('Cerrar panel izquierdo')}
          title={tr('Cerrar panel izquierdo (Esc)')}
          onClick={onCollapse}
        >
          ×
        </button>
      </header>
      {category === 'layers' && s.mode !== 'apply' && (
        <div className="panel-tabs" role="tablist" aria-label={tr('Organización')}>
          <button
            role="tab"
            aria-selected={tab === 'design'}
            className={tab === 'design' ? 'selected' : ''}
            onClick={() => setTab('design')}
          >
            <SlidersHorizontal size={15} /> {tr('Conjuntos')}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'layers'}
            className={tab === 'layers' ? 'selected' : ''}
            onClick={() => setTab('layers')}
          >
            <Layers size={15} />{tr('Objetos')}<span>{s.objects.length}</span>
          </button>
        </div>
      )}
      {category === 'symmetry' && (
        <div className="panel-tabs" role="tablist" aria-label={tr('Opciones de simetría')}>
          <button role="tab" aria-selected={tab === 'design'} onClick={() => setTab('design')}>
            {tr('Grupo y red')}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'placement'}
            onClick={() => setTab('placement')}
          >
            {tr('Colocación')}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'generator'}
            onClick={() => setTab('generator')}
          >
            {tr('Generador')}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'composition'}
            onClick={() => setTab('composition')}
          >
            {tr('Composición')}
          </button>
        </div>
      )}
      <div ref={scrollRef} className={`panel-scroll context-${category}`}>
        {category === 'layers' && tab === 'design' && s.mode !== 'apply' && (
          <div className="pattern-set-list" aria-label={tr('Conjuntos de composición')}>
            <p className="help-text">
              Un conjunto agrupa varios trazos y rellenos. Una zona cerrada no crea otro conjunto.
            </p>
            {s.project.patterns.map((p, i) => (
              <div
                key={p.id}
                className={`pattern-set-row ${p.id === s.pattern.id ? 'active' : ''}`}
              >
                <button
                  className="set-name"
                  onClick={() => {
                    s.setPatternId(p.id);
                    s.setSelected([]);
                    s.setInstance(IDENTITY);
                    s.setInstanceExplicit(false);
                  }}
                >
                  {p.name}
                  <small>
                    {p.symmetryMode === 'inherit'
                      ? 'hereda'
                      : p.symmetryMode === 'free'
                        ? 'Libre'
                        : p.symmetry.group}{' '}
                    · {p.sourceGeometry.filter((g) => !g.fillRegion).length} trazos
                  </small>
                </button>
                <button
                  aria-label={`Visibilidad ${p.name}`}
                  onClick={() =>
                    s.change((doc) => {
                      doc.patterns[i].visible = !doc.patterns[i].visible;
                    })
                  }
                >
                  {p.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button
                  aria-label={`Subir conjunto ${p.name}`}
                  disabled={i === s.project.patterns.length - 1}
                  onClick={() =>
                    s.change((doc) => {
                      [doc.patterns[i], doc.patterns[i + 1]] = [
                        doc.patterns[i + 1],
                        doc.patterns[i],
                      ];
                    })
                  }
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  aria-label={`Bajar conjunto ${p.name}`}
                  disabled={i === 0}
                  onClick={() =>
                    s.change((doc) => {
                      [doc.patterns[i], doc.patterns[i - 1]] = [
                        doc.patterns[i - 1],
                        doc.patterns[i],
                      ];
                    })
                  }
                >
                  <ChevronDown size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {category === 'symmetry' && tab !== 'generator' && tab !== 'composition' && (
          <SymmetryGallery studio={s} section={tab === 'placement' ? 'placement' : 'parameters'} />
        )}
        {category === 'symmetry' && tab === 'composition' && (
          <CompositionPanel studio={s} onExamples={onExamples} />
        )}
        {category === 'tiles' && (
          <TilePanel key={s.pattern.id} studio={s} onIsohedral={onIsohedral} />
        )}
        {category === 'layers' && tab === 'layers' ? (
          <>
            <div className="section-caption">
              {s.mode === 'apply' ? tr('OBJETOS DEL PERÍMETRO') : tr('OBJETOS DEL CONJUNTO')}{' '}
              <span>{tr('{n} objetos', { n: s.objects.length })}</span>
            </div>
            <div className="layer-list">
              {s.objects.length === 0 && (
                <p className="help-text">{tr('Dibujá una forma para agregar la primera capa.')}</p>
              )}
              <p className="help-text">
                {tr('Cada fila es un objeto. El candado evita seleccionarlo y editarlo; sigue visible.')}
              </p>
              {[...s.objects].reverse().map((g) => (
                <div
                  className={`layer-row ${s.selected.includes(g.id) ? 'selected' : ''}`}
                  key={g.id}
                >
                  <button
                    className="layer-name"
                    disabled={g.locked}
                    title={g.locked ? tr('Desbloqueá el objeto para editarlo') : tr('Seleccionar objeto')}
                    onClick={(e) => {
                      s.setSelected(e.shiftKey ? [...new Set([...s.selected, g.id])] : [g.id]);
                      s.setInstance(IDENTITY);
                    }}
                  >
                    <svg viewBox="-10 -10 90 90">
                      <path
                        d={pathData(g)}
                        transform={`matrix(${g.transform.join(' ')})`}
                        fill={g.fill}
                        stroke={g.stroke}
                        strokeWidth={2}
                      />
                    </svg>
                    <span>{translateMessage(g.name)}</span>
                  </button>
                  <button
                    title={g.visible ? tr('Ocultar') : tr('Mostrar')}
                    aria-label={`${g.visible ? tr('Ocultar') : tr('Mostrar')} ${translateMessage(g.name)}`}
                    onClick={() =>
                      s.editObjects((gs) => {
                        const o = gs.find((x) => x.id === g.id)!;
                        o.visible = !o.visible;
                      })
                    }
                  >
                    {g.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    title={g.locked ? tr('Desbloquear para editar') : tr('Bloquear para evitar cambios')}
                    aria-label={`${g.locked ? tr('Desbloquear') : tr('Bloquear')} ${translateMessage(g.name)}`}
                    aria-pressed={g.locked}
                    onClick={() => {
                      s.editObjects((gs) => {
                        const o = gs.find((x) => x.id === g.id)!;
                        o.locked = !o.locked;
                      });
                      if (!g.locked) s.setSelected((ids) => ids.filter((id) => id !== g.id));
                    }}
                  >
                    {g.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                </div>
              ))}
            </div>
            <div className="button-row">
              <button
                disabled={!selected.length}
                title={tr('Subir capa')}
                onClick={() =>
                  s.editObjects((gs) => {
                    for (let i = gs.length - 2; i >= 0; i--)
                      if (s.selected.includes(gs[i].id)) [gs[i], gs[i + 1]] = [gs[i + 1], gs[i]];
                  })
                }
              >
                <ChevronUp size={16} />
              </button>
              <button
                disabled={!selected.length}
                title={tr('Bajar capa')}
                onClick={() =>
                  s.editObjects((gs) => {
                    for (let i = 1; i < gs.length; i++)
                      if (s.selected.includes(gs[i].id)) [gs[i], gs[i - 1]] = [gs[i - 1], gs[i]];
                  })
                }
              >
                <ChevronDown size={16} />
              </button>
              <button disabled={!selected.length} onClick={s.duplicate}>
                <Copy size={16} /> {tr('Duplicar')}
              </button>
              <button disabled={!selected.length} title={tr('Eliminar')} onClick={s.deleteSelected}>
                <Trash2 size={16} />
              </button>
            </div>
          </>
        ) : (
          <>
            {((category === 'layers' && s.mode !== 'apply') ||
              (category === 'application' && s.mode === 'apply')) && (
              <Section title={s.mode === 'apply' ? 'APPLICATION' : 'DESIGN'}>
                {s.mode !== 'apply' ? (
                  <>
                    <Select
                      label={tr('Conjunto activo')}
                      value={s.pattern.id}
                      onChange={(id) => {
                        s.setPatternId(id);
                        s.setSelected([]);
                      }}
                      options={s.project.patterns.map((p) => ({ value: p.id, label: p.name }))}
                    />
                    <div className="button-row">
                      <button
                        onClick={() => {
                          const p = newPattern();
                          p.name = `Patrón ${s.project.patterns.length + 1}`;
                          s.change((doc) => doc.patterns.push(p));
                          s.setPatternId(p.id);
                          s.setSelected([]);
                        }}
                      >
                        <Plus size={14} /> Nuevo conjunto
                      </button>
                      <button
                        title={tr('Duplicar conjunto')}
                        onClick={() => {
                          const p = structuredClone(s.pattern);
                          p.id = uid();
                          p.name += ' copia';
                          const groups = new Map<string, string>();
                          for (const g of p.sourceGeometry) {
                            g.id = uid();
                            if (g.groupId) {
                              if (!groups.has(g.groupId)) groups.set(g.groupId, uid());
                              g.groupId = groups.get(g.groupId);
                            }
                          }
                          s.change((doc) => doc.patterns.push(p));
                          s.setPatternId(p.id);
                        }}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <label className="text-field">
                      <span>{tr('Nombre del conjunto')}</span>
                      <input
                        aria-label={tr('Nombre del conjunto')}
                        value={s.pattern.name}
                        onChange={(e) =>
                          updatePattern((p) => {
                            p.name = e.target.value;
                          })
                        }
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <div
                      className="context-tabs"
                      role="tablist"
                      aria-label={tr('Opciones de aplicación')}
                    >
                      {['region', 'transform', 'link']
                        .filter((id) => !!s.application || id === 'region')
                        .map((id) => (
                          <button
                            key={id}
                            role="tab"
                            aria-selected={applicationPage === id}
                            onClick={() => setApplicationPage(id)}
                          >
                            {{ region: 'Perímetro', transform: 'Transformar', link: 'Vínculo' }[id]}
                          </button>
                        ))}
                    </div>
                    <div hidden={applicationPage !== 'region'} className="compact-fields">
                      <Select
                        label={tr('Perímetro')}
                        value={s.regionId}
                        onChange={(id) => {
                          s.setRegionId(id);
                          s.setSelected([]);
                        }}
                        options={[
                          { value: '', label: tr('Seleccionar perímetro') },
                          ...s.project.regions.map((r) => ({ value: r.id, label: r.name })),
                        ]}
                      />
                      <div className="button-row">
                        <button
                          onClick={() => {
                            s.setRegionId('');
                            s.setSelected([]);
                            s.setTool('region');
                          }}
                        >
                          <Plus size={14} /> Dibujar
                        </button>
                        <button onClick={onImport}>{tr('Importar SVG')}</button>
                      </div>
                      <Select
                        label={tr('Patrón a aplicar')}
                        value={s.pattern.id}
                        onChange={s.setPatternId}
                        options={s.project.patterns.map((p) => ({ value: p.id, label: p.name }))}
                      />
                      <button className="wide-button primary-soft" onClick={addApplication}>
                        <Plus size={15} /> Aplicar al perímetro
                      </button>
                      {s.project.applications.length > 0 && (
                        <Select
                          label={tr('Aplicación activa')}
                          value={s.applicationId}
                          onChange={(id) => {
                            s.setApplicationId(id);
                            const a = s.project.applications.find((a) => a.id === id);
                            if (a) {
                              s.setRegionId(a.regionId);
                              s.setPatternId(a.patternId);
                            }
                          }}
                          options={[
                            { value: '', label: tr('Seleccionar aplicación') },
                            ...s.project.applications.map((a) => ({ value: a.id, label: a.name })),
                          ]}
                        />
                      )}
                    </div>
                    {s.application && (
                      <>
                        <div hidden={applicationPage !== 'link'} className="compact-fields">
                          <Select
                            label={tr('Cambiar patrón vinculado')}
                            value={s.application.patternId}
                            onChange={(id) =>
                              changeApplication((a) => {
                                a.patternId = id;
                                a.linked = true;
                                a.frozenPattern = undefined;
                              })
                            }
                            options={s.project.patterns.map((p) => ({
                              value: p.id,
                              label: p.name,
                            }))}
                          />
                        </div>
                        <div hidden={applicationPage !== 'transform'} className="compact-fields">
                          <Field
                            label={tr('Escala uniforme')}
                            value={Math.sqrt(
                              Math.abs(
                                s.application.placementTransform[0] *
                                  s.application.placementTransform[3] -
                                  s.application.placementTransform[1] *
                                    s.application.placementTransform[2],
                              ),
                            )}
                            min={0.05}
                            max={10}
                            step={0.05}
                            onChange={(v) =>
                              changeApplication((a) => {
                                const m = a.placementTransform,
                                  angle = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
                                const next = multiply(rotate(angle), scale(v));
                                a.placementTransform = [
                                  next[0],
                                  next[1],
                                  next[2],
                                  next[3],
                                  m[4],
                                  m[5],
                                ];
                              })
                            }
                          />
                          <Field
                            label={tr('Escala X')}
                            value={Math.hypot(
                              s.application.placementTransform[0],
                              s.application.placementTransform[1],
                            )}
                            min={0.05}
                            max={10}
                            step={0.05}
                            onChange={(value) =>
                              changeApplication((a) => {
                                const m = a.placementTransform,
                                  old = Math.hypot(m[0], m[1]);
                                a.placementTransform = [
                                  (m[0] * value) / old,
                                  (m[1] * value) / old,
                                  m[2],
                                  m[3],
                                  m[4],
                                  m[5],
                                ];
                              })
                            }
                          />
                          <Field
                            label={tr('Escala Y')}
                            value={Math.hypot(
                              s.application.placementTransform[2],
                              s.application.placementTransform[3],
                            )}
                            min={0.05}
                            max={10}
                            step={0.05}
                            onChange={(value) =>
                              changeApplication((a) => {
                                const m = a.placementTransform,
                                  old = Math.hypot(m[2], m[3]);
                                a.placementTransform = [
                                  m[0],
                                  m[1],
                                  (m[2] * value) / old,
                                  (m[3] * value) / old,
                                  m[4],
                                  m[5],
                                ];
                              })
                            }
                          />
                          <Field
                            label={tr('Rotación de aplicación')}
                            value={
                              (Math.atan2(
                                s.application.placementTransform[1],
                                s.application.placementTransform[0],
                              ) *
                                180) /
                              Math.PI
                            }
                            min={-180}
                            max={180}
                            unit="°"
                            onChange={(value) =>
                              changeApplication((a) => {
                                const m = a.placementTransform;
                                const next = multiply(
                                  rotate(value - (Math.atan2(m[1], m[0]) * 180) / Math.PI),
                                  m,
                                );
                                a.placementTransform = [
                                  next[0],
                                  next[1],
                                  next[2],
                                  next[3],
                                  m[4],
                                  m[5],
                                ];
                              })
                            }
                          />
                          {(['x', 'y'] as const).map((axis, i) => (
                            <Field
                              key={axis}
                              label={`Fase ${axis.toUpperCase()}`}
                              unit={u}
                              value={units(s.application!.placementTransform[i + 4])}
                              step={0.5}
                              onChange={(v) =>
                                changeApplication((a) => {
                                  const m = [...a.placementTransform];
                                  m[i + 4] = mm(v);
                                  a.placementTransform = m as unknown as Matrix;
                                })
                              }
                            />
                          ))}
                        </div>
                        <div hidden={applicationPage !== 'link'} className="compact-fields">
                          <Toggle
                            label={tr('Ver patrón fuera del contorno')}
                            checked={s.project.preferences.outside}
                            onChange={(v) =>
                              s.change((p) => {
                                p.preferences.outside = v;
                              })
                            }
                          />
                          <Toggle
                            label={tr('Mostrar contorno')}
                            checked={s.application.showOutline}
                            onChange={(v) =>
                              changeApplication((a) => {
                                a.showOutline = v;
                              })
                            }
                          />
                          <button
                            className="wide-button"
                            onClick={() =>
                              changeApplication((a) => {
                                a.linked = !a.linked;
                                a.frozenPattern = a.linked
                                  ? undefined
                                  : freezePattern(
                                      s.project.patterns.find((p) => p.id === a.patternId)!,
                                      s.project.mainSymmetry,
                                    );
                              })
                            }
                          >
                            {s.application.linked ? <Link2 size={14} /> : <Unlink size={14} />}{' '}
                            {s.application.linked
                              ? 'Vinculado · congelar copia'
                              : 'Congelado · volver a vincular'}
                          </button>
                          <button
                            className="wide-button danger-text"
                            onClick={() =>
                              s.requestDestructive('eliminar la aplicación', () => {
                                s.change((p) => {
                                  p.applications = p.applications.filter(
                                    (a) => a.id !== s.applicationId,
                                  );
                                });
                                s.setApplicationId('');
                              })
                            }
                          >
                            <Trash2 size={14} /> Eliminar aplicación
                          </button>
                        </div>
                      </>
                    )}
                    <p className="help-text">
                      El perímetro recorta el patrón sin deformarlo. Podés combinar regiones y
                      agujeros con operaciones geométricas.
                    </p>
                  </>
                )}
              </Section>
            )}
            {category === 'symmetry' && tab === 'generator' && (
              <>
                <Section title={tr('GENERATOR')}>
                  <Select
                    label={tr('Familia')}
                    value={s.pattern.generator.kind}
                    onChange={(kind) => {
                      setGeneratorPage(0);
                      updatePattern((p) => {
                        if (kind === 'girih') {
                          p.generator = activateGirih(p.generator);
                          if (p.composition) p.composition.enabled = false;
                        } else if (kind === 'hat' || kind === 'spectre') {
                          p.generator = activateAperiodic(p.generator, kind);
                          if (p.composition) p.composition.enabled = false;
                        } else p.generator.kind = kind as Generator['kind'];
                      });
                    }}
                    options={Object.entries(generatorLabels).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                  />
                  {s.pattern.generator.kind === 'girih' ? (
                    <GirihPanel studio={s} />
                  ) : isAperiodic(s.pattern.generator) ? (
                    <AperiodicPanel studio={s} />
                  ) : s.pattern.generator.kind === 'motif' ? (
                    <div className="motif-preview">
                      <svg viewBox="-5 -5 80 65">
                        {s.pattern.sourceGeometry
                          .filter((g) => g.visible)
                          .map((g) => (
                            <path
                              key={g.id}
                              d={pathData(g)}
                              transform={`matrix(${g.transform.join(' ')})`}
                              fill={g.fill}
                              stroke={g.stroke}
                              strokeWidth={g.strokeWidth}
                            />
                          ))}
                      </svg>
                      <span>Tu geometría, en todas sus formas.</span>
                    </div>
                  ) : (
                    generatorKeys.slice(generatorPage * 4, (generatorPage + 1) * 4).map((key) => {
                      if (key === 'seed' && s.pattern.generator.distribution !== 'freeform')
                        return null;
                      if (key === 'staggerAxis')
                        return (
                          <Select
                            key={key}
                            label={tr('Escalonar')}
                            value={s.pattern.generator.staggerAxis}
                            onChange={(v) =>
                              updatePattern((p) => {
                                p.generator.staggerAxis = v as Generator['staggerAxis'];
                              })
                            }
                            options={[
                              { value: 'rows', label: tr('Filas') },
                              { value: 'columns', label: tr('Columnas') },
                            ]}
                          />
                        );
                      if (key === 'distribution')
                        return (
                          <Select
                            key={key}
                            label={tr('Distribución')}
                            value={s.pattern.generator.distribution}
                            onChange={(v) =>
                              updatePattern((p) => {
                                p.generator.distribution = v as Generator['distribution'];
                              })
                            }
                            options={[
                              { value: 'rectangular', label: tr('Rectangular') },
                              { value: 'circular', label: tr('Circular') },
                              { value: 'freeform', label: tr('Freeform · semilla') },
                            ]}
                          />
                        );
                      const [min, max, step] = ranges[key] ?? [0, 100, 1];
                      return (
                        <Field
                          key={key}
                          label={paramLabels[key] ?? key}
                          value={s.pattern.generator[key] as number}
                          min={min}
                          max={
                            s.pattern.generator.kind === 'penrose' && key === 'frequency' ? 7 : max
                          }
                          step={step}
                          integer={
                            ['count', 'rows', 'columns', 'seed'].includes(key) ||
                            (s.pattern.generator.kind === 'penrose' && key === 'frequency')
                          }
                          slider={key !== 'seed'}
                          onChange={(v) =>
                            updatePattern((p) => {
                              (p.generator as unknown as Record<string, unknown>)[key] = v;
                            })
                          }
                        />
                      );
                    })
                  )}
                  {generatorKeys.length > 4 && (
                    <div className="page-controls">
                      <button
                        disabled={!generatorPage}
                        onClick={() => setGeneratorPage(generatorPage - 1)}
                      >
                        Parámetros anteriores
                      </button>
                      <span>
                        {generatorPage + 1}/{Math.ceil(generatorKeys.length / 4)}
                      </span>
                      <button
                        disabled={(generatorPage + 1) * 4 >= generatorKeys.length}
                        onClick={() => setGeneratorPage(generatorPage + 1)}
                      >
                        Más parámetros
                      </button>
                    </div>
                  )}
                  {s.pattern.generator.kind === 'warp' && (
                    <p className="help-text">
                      Deforma el motivo antes de aplicar el grupo. Las repeticiones mantienen la
                      simetría y las traslaciones de la red.
                    </p>
                  )}
                  {s.pattern.generator.kind === 'warp' &&
                    s.pattern.generator.distribution === 'freeform' && (
                      <button
                        className="wide-button"
                        onClick={() =>
                          updatePattern((p) => {
                            p.generator.seed = Math.floor(Math.random() * 2147483647);
                          })
                        }
                      >
                        Nueva semilla
                      </button>
                    )}
                  {s.pattern.generator.kind === 'freeform' && (
                    <>
                      <p className="help-text">Instancias manuales del mismo motivo editable.</p>
                      <button
                        className="wide-button"
                        onClick={() =>
                          updatePattern((p) => {
                            const n = p.generator.placements.length;
                            p.generator.placements.push(translate(n * 20, (n % 2) * 15));
                          })
                        }
                      >
                        <Plus size={14} /> Agregar instancia
                      </button>
                      <div className="page-controls">
                        <button
                          disabled={!placementPage}
                          onClick={() => setPlacementPage(placementPage - 1)}
                        >
                          Instancia anterior
                        </button>
                        <span>
                          {Math.min(placementPage + 1, s.pattern.generator.placements.length)}/
                          {s.pattern.generator.placements.length}
                        </span>
                        <button
                          disabled={placementPage + 1 >= s.pattern.generator.placements.length}
                          onClick={() => setPlacementPage(placementPage + 1)}
                        >
                          Instancia siguiente
                        </button>
                      </div>
                      {s.pattern.generator.placements.map((m, i) => (
                        <div
                          className="free-placement"
                          key={i}
                          hidden={
                            i !== Math.min(placementPage, s.pattern.generator.placements.length - 1)
                          }
                        >
                          <span>{i + 1}</span>
                          <Field
                            label={`Instancia ${i + 1} X`}
                            value={m[4]}
                            onChange={(v) =>
                              updatePattern((p) => {
                                const next = [...p.generator.placements[i]];
                                next[4] = v;
                                p.generator.placements[i] = next as unknown as Matrix;
                              })
                            }
                          />
                          <Field
                            label={`Instancia ${i + 1} Y`}
                            value={m[5]}
                            onChange={(v) =>
                              updatePattern((p) => {
                                const next = [...p.generator.placements[i]];
                                next[5] = v;
                                p.generator.placements[i] = next as unknown as Matrix;
                              })
                            }
                          />
                          <button
                            title={tr('Eliminar instancia')}
                            onClick={() =>
                              s.requestDestructive('eliminar la instancia', () =>
                                updatePattern((p) => {
                                  p.generator.placements.splice(i, 1);
                                }),
                              )
                            }
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                  {s.pattern.generator.kind === 'penrose' && (
                    <p className="help-text">
                      Región finita aperiódica. No tiene una baldosa de traslación seamless.
                    </p>
                  )}
                  {s.pattern.generator.kind !== 'motif' && (
                    <button
                      className="wide-button"
                      onClick={() => {
                        const result = generate(s.pattern.generator, s.pattern.sourceGeometry),
                          shapes = (
                            result.aperiodic
                              ? sceneLayers(
                                  {
                                    generated: result,
                                    fills: [],
                                    instances: [],
                                    status: 'FINITE_NONPERIODIC',
                                    message: '',
                                  },
                                  s.pattern,
                                )
                              : [
                                  {
                                    kind: 'motif' as const,
                                    geometry: result.geometry,
                                    placements: result.placements,
                                  },
                                ]
                          ).flatMap((layer) => {
                            const geometry =
                                layer.kind === 'fill' ? [layer.geometry] : layer.geometry,
                              matrices =
                                layer.kind === 'fill'
                                  ? layer.matrices
                                  : (layer.placements ?? result.placements);
                            return matrices.flatMap((m) =>
                              geometry.map((g) => ({
                                ...structuredClone(g),
                                id: uid(),
                                transform: multiply(m, g.transform),
                              })),
                            );
                          });
                        if (shapes.length > 10000) {
                          s.setMessage(
                            'Más de 10.000 objetos. Reducí la cantidad antes de convertir.',
                          );
                          return;
                        }
                        updatePattern((p) => {
                          p.sourceGeometry = shapes;
                          p.generator.kind = 'motif';
                        });
                      }}
                    >
                      <Scissors size={14} /> Convertir generador a paths
                    </button>
                  )}
                </Section>
              </>
            )}

            {category === 'preferences' && (
              <>
                <ExperiencePrefs />
                <Section title={tr('VIEW')}>
                <details className="advanced-view">
                  <summary>{tr('Vista avanzada')}</summary>
                  <Toggle
                    label={tr('Fuente pura (edición avanzada)')}
                    checked={s.project.preferences.sourceView}
                    onChange={(value) =>
                      s.change((p) => {
                        p.preferences.sourceView = value;
                        if (value) p.preferences.split = false;
                      })
                    }
                  />
                  <p className="hint">
                    {tr('Editá los originales completos, incluso fuera de la celda. Útil para curvas que cruzan varias celdas y patrones sin repetición periódica.')}
                  </p>
                </details>
                <label className="text-field">
                  <span>{tr('Nombre del proyecto')}</span>
                  <input
                    aria-label={tr('Nombre del documento')}
                    value={s.project.metadata.name}
                    onChange={(e) =>
                      s.change((p) => {
                        p.metadata.name = e.target.value;
                      })
                    }
                  />
                </label>
                <div className="toggle-grid">
                <Toggle
                  label={tr('Ajustar a grilla')}
                  checked={s.project.preferences.snap}
                  onChange={(v) =>
                    s.change((p) => {
                      p.preferences.snap = v;
                    })
                  }
                />
                <Toggle
                  label={tr('Atracción entre nodos')}
                  checked={s.project.preferences.snapNodes ?? true}
                  onChange={(value) => s.updateViewPreferences({ snapNodes: value })}
                />
                </div>
                <Field
                  label={tr('Distancia de atracción a nodos')}
                  unit="px"
                  min={1}
                  max={40}
                  value={s.project.preferences.snapRadiusPx ?? 8}
                  onChange={(value) => s.updateViewPreferences({ snapRadiusPx: value })}
                />
                <div className="toggle-grid">
                <Toggle
                  label={tr('Guías detalladas')}
                  checked={s.project.preferences.guides}
                  onChange={(v) =>
                    s.change((p) => {
                      p.preferences.guides = v;
                      p.preferences.structureVisible = false;
                    })
                  }
                />
                <Toggle
                  label={tr('Región fundamental')}
                  checked={s.project.preferences.fundamental}
                  onChange={(v) =>
                    s.change((p) => {
                      p.preferences.fundamental = v;
                      p.preferences.guides = true;
                      p.preferences.structureVisible = false;
                    })
                  }
                />
                </div>
                <div className="toggle-grid">
                <Toggle
                  label={tr('Ejes de reflexión y deslizamiento')}
                  checked={s.project.preferences.axes}
                  onChange={(v) =>
                    s.change((p) => {
                      p.preferences.axes = v;
                      p.preferences.guides = true;
                      p.preferences.structureVisible = false;
                    })
                  }
                />
                <Toggle
                  label={tr('Centros de rotación')}
                  checked={s.project.preferences.centers}
                  onChange={(v) =>
                    s.change((p) => {
                      p.preferences.centers = v;
                      p.preferences.guides = true;
                      p.preferences.structureVisible = false;
                    })
                  }
                />
                </div>
                <div className="toggle-grid">
                <Toggle
                  label={tr('Inspeccionar uniones')}
                  checked={s.project.preferences.continuity}
                  onChange={(v) =>
                    s.change((p) => {
                      p.preferences.continuity = v;
                      p.preferences.guides = true;
                      p.preferences.structureVisible = false;
                    })
                  }
                />
                </div>
                <Select
                  label={tr('Unidades')}
                  value={u}
                  onChange={(v) =>
                    s.change((p) => {
                      p.documentUnits = v as typeof u;
                    })
                  }
                  options={['mm', 'cm', 'in', 'px']}
                />
                <label className="color-row">
                  {tr('Fondo del lienzo')}
                  <input
                    aria-label={tr('Fondo del lienzo')}
                    type="color"
                    value={s.project.preferences.background}
                    onChange={(e) =>
                      s.change((p) => {
                        p.preferences.background = e.target.value;
                      })
                    }
                  />
                </label>
              </Section>
              </>
            )}
          </>
        )}
      </div>
      <div className="panel-foot">
        <span>{tr('LOCAL FIRST')}</span>
        <span>{tr('Todo queda en tu navegador.')}</span>
      </div>
    </aside>
  );
}
