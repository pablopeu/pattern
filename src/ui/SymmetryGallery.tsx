import { finiteGenerator } from '../aperiodic/model';
import { Modal } from './Modal';
import { X, Star } from 'lucide-react';
import { sceneLayers } from '../patterns/layers';
import { tiledMarkup } from '../tiling/render';
import { tileBounds, tileWorldBounds } from '../tiling/tiles';
import { cachedStructure, structureMarkup, rotationOrder } from '../symmetry/structure';
import { useEffect, useMemo, useRef, useState, memo } from 'react';
import type { Studio } from '../app/useStudio';
import type { Symmetry, Pattern } from '../app/model';
import { generate } from '../generators';
import { buildScene, sceneScaleBound } from '../patterns/engine';
import { svgDocument, previewSVGPath, previewSVGPathAtTolerance } from '../export/svg';
import { IDENTITY, matrixString, multiply, translate } from '../geometry/matrix';
import {
  cosets,
  latticeVectors,
  groupDescriptions,
  friezeDescriptions,
  type Bounds,
} from '../symmetry/groups';
import {
  symmetryCatalog,
  symmetryId,
  resolvePattern,
  candidateSymmetry,
  frameBounds,
  type SymmetryChoice,
} from '../symmetry/config';
import { Field, Select, Toggle } from './Controls';
import { tr } from '../i18n';
export function previewSVG(
  pattern: Pattern,
  bounds: Bounds,
  prepared?: ReturnType<typeof generate>,
  structure = false,
): string {
  const scene = buildScene(pattern, bounds, prepared),
    tolerance = 0.02 / sceneScaleBound(scene),
    renderMotif = (g: import('../app/model').Geometry) => previewSVGPathAtTolerance(g, tolerance);
  let decorated = false;
  const content = sceneLayers(scene, pattern)
    .map((layer, index) => {
      if (layer.kind === 'fill')
        return layer.matrices
          .map((m) =>
            previewSVGPath({ ...layer.geometry, transform: multiply(m, layer.geometry.transform) }),
          )
          .join('');
      const decorations = !decorated;
      decorated = true;
      const subset = { ...scene, generated: { ...scene.generated, geometry: layer.geometry } };
      if (scene.tiling)
        return tiledMarkup(
          subset,
          renderMotif,
          'preview-tile-' + index,
          IDENTITY,
          decorations && scene.tiling.definition.showOutline,
          decorations && structure
            ? structureMarkup(
                cachedStructure(pattern.symmetry, tileBounds(scene.tiling.definition)),
                0.15,
                0.7,
              )
            : '',
        );
      const id = 'preview-motif-' + index,
        refs = scene.instances
          .flatMap((i) =>
            scene.generated.placements.map(
              (m) => `<use href="#${id}" transform="${matrixString(multiply(i.matrix, m))}"/>`,
            ),
          )
          .join('');
      return `${decorations && structure && !finiteGenerator(pattern.generator) ? structureMarkup(cachedStructure(pattern.symmetry, bounds), 0.15, 0.7) : ''}<defs><g id="${id}">${layer.geometry.map(renderMotif).join('')}</g></defs>${refs}`;
    })
    .join('');
  return svgDocument(content, bounds, '#f8faf5');
}
const MathematicalIcon = memo(function MathematicalIcon({ choice }: { choice: SymmetryChoice }) {
  const matrices = useMemo(() => {
    if (choice.family === 'none') return [[1, 0, 0, 1, 0, 0] as const];
    const sym: Symmetry = {
      ...choice,
      width: 30,
      height: 30,
      angle: 90,
      sectors: 8,
      center: { x: 15, y: 15 },
      origin: { x: 0, y: 0 },
      orientation: 0,
    };
    const base = cosets(sym),
      [a, b] = latticeVectors(sym);
    return sym.family === 'radial'
      ? base
      : [-1, 0, 1].flatMap((x) =>
          (sym.family === 'frieze' ? [0] : [-1, 0, 1]).flatMap((y) =>
            base.map((m) => multiply(translate(a.x * x + b.x * y, a.y * x + b.y * y), m)),
          ),
        );
  }, [choice.family, choice.group]);
  return (
    <svg
      className="mathematical-icon"
      viewBox={choice.family === 'frieze' ? '-4 -18 38 38' : '-4 -4 38 38'}
      aria-hidden="true"
    >
      {matrices.map((m, i) => (
        <path key={i} d="M4 5L11 7L8 13Z" transform={matrixString(m)} fill="currentColor" />
      ))}
    </svg>
  );
});
export function SymmetryGallery({
  studio: s,
  section = 'parameters',
}: {
  studio: Studio;
  section?: 'parameters' | 'placement';
}) {
  const [capturing, setCapturing] = useState(false),
    [expanded, setExpanded] = [s.catalogOpen, s.setCatalogOpen],
    [page, setPage] = useState(0),
    [pageSize, setPageSize] = useState(28),
    [recent, setRecent] = useState<string[]>(() => {
      try {
        return JSON.parse(sessionStorage.getItem('pattern-symmetry-recent') ?? '[]')
          .filter((id: unknown) => typeof id === 'string')
          .slice(0, 4);
      } catch {
        return [];
      }
    }),
    [favorites, setFavorites] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem('pattern-symmetry-favorites') ?? '[]')
          .filter((id: unknown) => typeof id === 'string')
          .slice(0, 27);
      } catch {
        return [];
      }
    });
  useEffect(() => {
    const resize = () => setPageSize(innerWidth >= 1000 ? 28 : innerWidth >= 650 ? 12 : 6);
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const closeGallery = () => {
    setExpanded(false);
    s.setSymmetryPreview(null);
  };
  const choose = (choice: SymmetryChoice) => {
    s.changeSymmetryChoice(choice);
    const key = symmetryId(choice);
    setRecent((old) => [key, ...old.filter((id) => id !== key)].slice(0, 4));
  };
  const favorite = (key: string) =>
    setFavorites((old) => {
      const next = old.includes(key) ? old.filter((id) => id !== key) : [...old, key];
      try {
        localStorage.setItem('pattern-symmetry-favorites', JSON.stringify(next));
      } catch {
        /* optional preference */
      }
      return next;
    });
  useEffect(() => {
    try {
      sessionStorage.setItem('pattern-symmetry-recent', JSON.stringify(recent));
    } catch {
      /* optional preference */
    }
  }, [recent]);
  const completedSignature = useRef('');
  useEffect(() => {
    const start = (e: PointerEvent) => {
      if (
        e.target instanceof Element &&
        (e.target.closest('.studio-canvas') || e.target.matches('input[type=range]'))
      )
        setCapturing(true);
    };
    const end = () => setCapturing(false);
    document.addEventListener('pointerdown', start, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    window.addEventListener('blur', end);
    return () => {
      document.removeEventListener('pointerdown', start, true);
      document.removeEventListener('pointerup', end, true);
      document.removeEventListener('pointercancel', end, true);
      window.removeEventListener('blur', end);
    };
  }, []);
  const [family, setFamily] = useState('all'),
    [comparison, setComparison] = useState('physical'),
    [previews, setPreviews] = useState<Record<string, { url: string; revision: number }>>({}),
    [metrics, setMetrics] = useState({ pending: false, completed: 0, totalMs: 0 });
  useEffect(() => {
    setPage(0);
  }, [family, pageSize]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]),
    revision = useRef(0),
    previewSignature = useMemo(
      () =>
        JSON.stringify({
          pattern: s.pattern,
          main: s.project.mainSymmetry,
          mainProfiles: s.project.mainSymmetryProfiles,
          comparison,
          structure: s.project.preferences.structureVisible,
          target: s.galleryTarget,
        }),
      [
        s.pattern,
        s.project.mainSymmetry,
        s.project.mainSymmetryProfiles,
        comparison,
        s.project.preferences.structureVisible,
        s.galleryTarget,
      ],
    );
  const confirmed = s.galleryTarget === 'project' ? s.project.mainSymmetry : s.confirmedSymmetry;
  const target =
    s.galleryTarget === 'project' || s.pattern.symmetryMode === 'inherit' ? 'project' : 'pattern';
  const profiles =
    target === 'project' ? s.project.mainSymmetryProfiles : s.pattern.symmetryProfiles;
  const choices = symmetryCatalog.filter((c) => family === 'all' || c.family === family);
  useEffect(() => {
    if (capturing || previewSignature === completedSignature.current) return;
    let cancelled = false,
      id: number | undefined;
    const idle = (fn: () => void) => {
      id = window.setTimeout(fn, 12);
    };
    const timer = window.setTimeout(() => {
      completedSignature.current = '';
      const token = ++revision.current,
        start = performance.now();
      let prepared: ReturnType<typeof generate>;
      try {
        prepared = generate(
          s.pattern.generator,
          s.pattern.sourceGeometry.filter((g) => !g.fillRegion),
        );
      } catch {
        setMetrics({ pending: false, completed: 0, totalMs: performance.now() - start });
        return;
      }
      let index = 0;
      setMetrics({ pending: true, completed: 0, totalMs: 0 });
      const next = () => {
        if (cancelled) return;
        const choice = symmetryCatalog[index++],
          key = symmetryId(choice);
        try {
          const resolved = resolvePattern(s.pattern, s.project, {
            target,
            patternId: s.pattern.id,
            choice,
          });
          const frame =
            comparison === 'cell' && resolved.tiling
              ? tileWorldBounds(resolved.tiling)
              : comparison === 'cell' && choice.family === 'wallpaper'
                ? frameBounds(resolved.symmetry)
                : { x: -60, y: -45, width: 120, height: 90 };
          const svg = previewSVG(resolved, frame, prepared, s.project.preferences.structureVisible);
          if (!cancelled)
            setPreviews((old) => ({
              ...old,
              [key]: {
                url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
                revision: token,
              },
            }));
        } catch {
          /* Keep the last valid miniature if a complexity limit is reached. */
        }
        if (cancelled) return;
        setMetrics({
          pending: index < symmetryCatalog.length,
          completed: index,
          totalMs: performance.now() - start,
        });
        if (index < symmetryCatalog.length) idle(next);
        else completedSignature.current = previewSignature;
      };
      idle(next);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (id !== undefined) clearTimeout(id);
    };
  }, [previewSignature, capturing]);
  const hover = (choice: SymmetryChoice) =>
    s.setSymmetryPreview({ target, patternId: s.pattern.id, choice });
  const rotationCount = Math.max(
    1,
    ...cosets(confirmed)
      .filter((m) => m[0] * m[3] - m[1] * m[2] > 0)
      .map((m) =>
        rotationOrder(m) === 2 && Math.abs(m[0] - 1) < 1e-7 && Math.abs(m[3] - 1) < 1e-7
          ? 1
          : rotationOrder(m),
      ),
  );
  const fineOrientation = Math.round((18 / rotationCount) * 10) / 10;
  const previewCurrent = s.symmetryPreview
    ? candidateSymmetry(confirmed, profiles, s.symmetryPreview.choice)
    : confirmed;
  return (
    <details
      className="symmetry-gallery"
      open
      data-preview-revision={revision.current}
      data-preview-pending={metrics.pending}
      data-preview-completed={metrics.completed}
      data-preview-ms={metrics.totalMs.toFixed(1)}
    >
      <summary>
        <span>
          {s.pattern.tiling && !finiteGenerator(s.pattern.generator)
            ? 'SIMETRÍA DEL MOTIVO'
            : tr('SIMETRÍA VIVA')}
        </span>
        <strong>
          {confirmed.family === 'none'
            ? 'Libre'
            : confirmed.group === 'Cn' || confirmed.group === 'Dn'
              ? confirmed.group[0] + confirmed.sectors
              : confirmed.group}
        </strong>
      </summary>
      <div className="gallery-controls">
        <Select
          label={tr('Cambiar simetría en')}
          value={s.galleryTarget}
          onChange={(v) => {
            s.setSymmetryPreview(null);
            s.setGalleryTarget(v as 'pattern' | 'project');
          }}
          options={[
            { value: 'pattern', label: tr('Este conjunto') },
            { value: 'project', label: tr('Compartida') },
          ]}
        />
        <Select
          label={tr('Repetición de este conjunto')}
          value={s.pattern.symmetryMode}
          onChange={(v) => s.setSymmetryMode(v as 'own' | 'inherit' | 'free')}
          options={[
            { value: 'own', label: tr('Propia') },
            { value: 'inherit', label: tr('Compartida') },
            { value: 'free', label: tr('Sin repetir') },
          ]}
        />
      </div>
      <div className="compact-symmetry">
        <div className="symmetry-explore-actions">
          <button className="wide-button primary-soft" onClick={() => setExpanded(true)}>
            {tr('Explorar todas las simetrías')} · 27
          </button>
          <button
            className="favorite-current"
            aria-label={tr('Favorito actual {group}', { group: confirmed.group })}
            aria-pressed={favorites.includes(symmetryId(confirmed))}
            title={tr('Agregar o quitar la simetría actual de favoritos')}
            onClick={() => favorite(symmetryId(confirmed))}
          >
            <Star
              size={16}
              fill={favorites.includes(symmetryId(confirmed)) ? 'currentColor' : 'none'}
            />
          </button>
        </div>
        {(['recent', 'favorites'] as const)
          .filter((kind) => kind === 'recent' || favorites.length > 0)
          .map((kind) => (
            <div className="symmetry-shortcuts" key={kind}>
              <small>{kind === 'recent' ? tr('Recientes') : tr('Favoritos')}</small>
              {(kind === 'recent' ? recent : favorites).slice(0, 4).map((key) => {
                const choice = symmetryCatalog.find((c) => symmetryId(c) === key);
                return (
                  choice && (
                    <button
                      key={key}
                      title={`${choice.family} ${choice.group}`}
                      onMouseEnter={() => hover(choice)}
                      onMouseLeave={() => s.setSymmetryPreview(null)}
                      onClick={() => choose(choice)}
                    >
                      {choice.group === 'none' ? 'Libre' : choice.group}
                    </button>
                  )
                );
              })}
              {!(kind === 'recent' ? recent : favorites).length && <span>—</span>}
            </div>
          ))}
      </div>
      {expanded && (
        <Modal label={tr('Catálogo de simetrías')} className="symmetry-modal" onClose={closeGallery}>
          <header>
            <h2>{tr('Explorá las simetrías')}</h2>
            <button aria-label={tr('Cerrar catálogo')} onClick={closeGallery}>
              <X size={20} />
            </button>
          </header>
          <div className="gallery-filters">
            <Select
              label={tr('Sistema')}
              value={family}
              onChange={setFamily}
              options={[
                { value: 'all', label: tr('Todos') },
                { value: 'wallpaper', label: tr('Plano · 17 grupos') },
                { value: 'frieze', label: tr('Friso · 7 grupos') },
                { value: 'radial', label: tr('Radial · Cn / Dn') },
                { value: 'none', label: tr('Libre') },
              ]}
            />
            <Select
              label={tr('Encuadre de miniaturas')}
              value={comparison}
              onChange={setComparison}
              options={[
                { value: 'physical', label: tr('120 × 90 mm') },
                { value: 'cell', label: tr('Por celda') },
              ]}
            />
          </div>
          <div
            className="dynamic-symmetry-grid"
            role="group"
            aria-label={tr('Galería de simetrías')}
            data-preview-pending={metrics.pending}
            data-preview-ms={metrics.totalMs.toFixed(1)}
            data-preview-completed={metrics.completed}
          >
            {choices.slice(page * pageSize, (page + 1) * pageSize).map((choice, i) => {
              const key = symmetryId(choice),
                p = previews[key],
                label =
                  choice.family === 'none'
                    ? 'Libre'
                    : choice.family === 'radial'
                      ? choice.group[0] + candidateSymmetry(confirmed, profiles, choice).sectors
                      : choice.group;
              return (
                <div className="gallery-card" key={key}>
                  <button
                    ref={(el) => {
                      buttons.current[i] = el;
                    }}
                    type="button"
                    aria-pressed={symmetryId(confirmed) === key}
                    aria-label={
                      choice.family === 'none'
                        ? tr('Simetría Libre')
                        : choice.family === 'frieze'
                          ? tr('Friso {group}', { group: choice.group })
                          : tr('Simetría {group}', { group: choice.group })
                    }
                    data-symmetry-id={key}
                    data-preview-revision={p?.revision ?? 0}
                    onMouseEnter={() => hover(choice)}
                    onMouseLeave={() => s.setSymmetryPreview(null)}
                    onFocus={() => hover(choice)}
                    onBlur={() => s.setSymmetryPreview(null)}
                    onClick={() => choose(choice)}
                    onKeyDown={(e) => {
                      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                        e.preventDefault();
                        const step =
                          e.key === 'ArrowLeft'
                            ? -1
                            : e.key === 'ArrowRight'
                              ? 1
                              : e.key === 'ArrowUp'
                                ? -3
                                : 3;
                        const count = Math.min(pageSize, choices.length - page * pageSize);
                        buttons.current[(i + step + count) % count]?.focus();
                      }
                    }}
                    title={
                      choice.family === 'none'
                        ? tr('Sin transformaciones de grupo')
                        : tr(
                            (choice.family === 'frieze' ? friezeDescriptions : groupDescriptions)[
                              choice.group
                            ],
                          )
                    }
                  >
                    <div className="drawing-thumbnail">
                      {p ? (
                        <img alt={tr('Dibujo con {family} {label}', { family: choice.family, label })} src={p.url} />
                      ) : (
                        <span>{tr('Sin trazos')}</span>
                      )}
                    </div>
                    <span className="gallery-caption">
                      <MathematicalIcon choice={choice} />
                      <span>
                        {label}
                        <small>
                          {choice.family === 'frieze'
                            ? tr('friso')
                            : choice.family === 'none'
                              ? tr('sin repetir')
                              : choice.family === 'radial'
                                ? tr('radial')
                                : tr('plano')}
                        </small>
                      </span>
                    </span>
                  </button>
                  <button
                    className="favorite-symmetry"
                    aria-label={tr('Favorito {family} {group}', { family: choice.family, group: choice.group })}
                    aria-pressed={favorites.includes(key)}
                    onClick={() => favorite(key)}
                    title={tr('Marcar como favorito')}
                  >
                    <Star size={13} fill={favorites.includes(key) ? 'currentColor' : 'none'} />
                  </button>
                </div>
              );
            })}
          </div>
          {choices.length > pageSize && (
            <div className="page-controls">
              <button disabled={!page} onClick={() => setPage(page - 1)}>
                Anterior
              </button>
              <span>
                {page + 1} / {Math.ceil(choices.length / pageSize)}
              </span>
              <button
                disabled={(page + 1) * pageSize >= choices.length}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
          <p className="help-text">
            Hover previsualiza; clic confirma y permite seguir comparando. Escape vuelve al editor.
          </p>
        </Modal>
      )}
      <div className="gallery-details">
        <p className="help-text" role="status">
          {s.symmetryPreview
            ? `Previsualización · ${previewCurrent.group === 'none' ? 'Libre' : previewCurrent.group} · clic para confirmar`
            : tr('Hover previsualiza · clic confirma.')}
        </p>
        {finiteGenerator(s.pattern.generator) ? (
          <p className="math-notice">
            Esta es una región finita. La repetición del grupo permanece desactivada; el dibujo
            fuente se conserva.
          </p>
        ) : (
          <>
            {confirmed.family !== 'none' && section === 'parameters' && (
              <>
                <details
                  className="symmetry-frame-controls"
                  name={`symmetry-options-${s.pattern.id}`}
                >
                  <summary>{tr('Orientación y origen')}</summary>
                  <div className="compact-fields">
                    <Field
                      label={tr('Orientación de red')}
                      value={confirmed.orientation}
                      min={-180}
                      max={180}
                      unit="°"
                      slider
                      sliderMin={-fineOrientation}
                      sliderMax={fineOrientation}
                      step={0.1}
                      onChange={(v) => s.patchSymmetry({ orientation: v })}
                    />
                    <div className="two-fields">
                      {(['x', 'y'] as const).map((axis) => (
                        <Field
                          key={axis}
                          label={`${confirmed.family === 'radial' ? 'Centro' : 'Origen'} ${axis.toUpperCase()}`}
                          value={
                            confirmed.family === 'radial'
                              ? confirmed.center[axis]
                              : confirmed.origin[axis]
                          }
                          unit="mm"
                          step={0.1}
                          slider
                          sliderMin={-confirmed.width}
                          sliderMax={confirmed.width}
                          onChange={(v) =>
                            s.patchSymmetry(
                              confirmed.family === 'radial'
                                ? { center: { ...confirmed.center, [axis]: v } }
                                : { origin: { ...confirmed.origin, [axis]: v } },
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                </details>
                <details
                  className="symmetry-size-controls"
                  name={`symmetry-options-${s.pattern.id}`}
                  open
                >
                  <summary>{tr('Tamaño de red')}</summary>
                  <div className="compact-fields">
                    {confirmed.family === 'radial' ? (
                      <Field
                        integer
                        label={tr('Sectores')}
                        value={confirmed.sectors}
                        min={2}
                        max={64}
                        onChange={(v) => s.patchSymmetry({ sectors: v })}
                      />
                    ) : (
                      <>
                        <Field
                          label={tr('Ancho de celda')}
                          value={confirmed.width}
                          min={5}
                          max={200}
                          unit="mm"
                          onChange={(v) => s.patchSymmetry({ width: v })}
                        />
                        {!/^p[346]/.test(confirmed.group) && (
                          <Field
                            label={tr('Alto de celda')}
                            value={confirmed.height}
                            min={5}
                            max={200}
                            unit="mm"
                            onChange={(v) => s.patchSymmetry({ height: v })}
                          />
                        )}{' '}
                        {confirmed.family === 'wallpaper' &&
                          ['p1', 'p2'].includes(confirmed.group) && (
                            <Field
                              label={tr('Ángulo de red')}
                              value={confirmed.angle}
                              min={15}
                              max={165}
                              unit="°"
                              onChange={(v) => s.patchSymmetry({ angle: v })}
                            />
                          )}
                      </>
                    )}
                  </div>
                </details>
              </>
            )}
          </>
        )}
        {section === 'placement' && (
          <div className="compact-fields">
            {' '}
            <button className="wide-button" onClick={s.adaptPattern}>
              {s.pattern.tiling ? 'Adaptar motivo a tesela' : 'Adaptar a celda · conservar fuente'}
            </button>
            <button
              className="wide-button"
              onClick={() =>
                s.change((p) => {
                  const pat = p.patterns.find((p) => p.id === s.pattern.id)!;
                  pat.placementTransform = [1, 0, 0, 1, 0, 0];
                })
              }
            >
              Restablecer colocación del motivo
            </button>
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
          </div>
        )}
      </div>
    </details>
  );
}
