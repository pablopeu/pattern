import { sceneLayers } from '../patterns/layers';
import { tiledMarkup } from '../tiling/render';
import { tileBounds, tileWorldBounds } from '../tiling/tiles';
import { cachedStructure, structureMarkup } from '../symmetry/structure';
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
      return `${decorations && structure && pattern.generator.kind !== 'penrose' ? structureMarkup(cachedStructure(pattern.symmetry, bounds), 0.15, 0.7) : ''}<defs><g id="${id}">${layer.geometry.map(renderMotif).join('')}</g></defs>${refs}`;
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
export function SymmetryGallery({ studio: s }: { studio: Studio }) {
  const [capturing, setCapturing] = useState(false);
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
  const previewCurrent = s.symmetryPreview
    ? candidateSymmetry(confirmed, profiles, s.symmetryPreview.choice)
    : confirmed;
  return (
    <details className="symmetry-gallery" open>
      <summary>
        <span>
          {s.pattern.tiling && s.pattern.generator.kind !== 'penrose'
            ? 'SIMETRÍA DEL MOTIVO'
            : 'SIMETRÍA VIVA'}
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
          label="Editar simetría de"
          value={s.galleryTarget}
          onChange={(v) => {
            s.setSymmetryPreview(null);
            s.setGalleryTarget(v as 'pattern' | 'project');
          }}
          options={[
            { value: 'pattern', label: 'Conjunto activo' },
            { value: 'project', label: 'Composición principal' },
          ]}
        />
        <Select
          label="Simetría del conjunto"
          value={s.pattern.symmetryMode}
          onChange={(v) => s.setSymmetryMode(v as 'own' | 'inherit' | 'free')}
          options={[
            { value: 'own', label: 'Propia' },
            { value: 'inherit', label: 'Heredar principal' },
            { value: 'free', label: 'Libre independiente' },
          ]}
        />
        <div className="gallery-filters">
          <Select
            label="Sistema"
            value={family}
            onChange={setFamily}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'none', label: 'Libre' },
              { value: 'wallpaper', label: 'Plano · 17 grupos' },
              { value: 'frieze', label: 'Friso · 7 grupos' },
              { value: 'radial', label: 'Radial · Cn / Dn' },
            ]}
          />
          <Select
            label="Encuadre de miniaturas"
            value={comparison}
            onChange={setComparison}
            options={[
              { value: 'physical', label: '120 × 90 mm' },
              { value: 'cell', label: 'Por celda' },
            ]}
          />
        </div>
      </div>
      <div
        className="dynamic-symmetry-grid"
        role="group"
        aria-label="Galería de simetrías"
        data-preview-pending={metrics.pending}
        data-preview-ms={metrics.totalMs.toFixed(1)}
        data-preview-completed={metrics.completed}
      >
        {choices.map((choice, i) => {
          const key = symmetryId(choice),
            p = previews[key],
            label =
              choice.family === 'none'
                ? 'Libre'
                : choice.family === 'radial'
                  ? choice.group[0] + candidateSymmetry(confirmed, profiles, choice).sectors
                  : choice.group;
          return (
            <button
              key={key}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              aria-pressed={symmetryId(confirmed) === key}
              aria-label={
                choice.family === 'none'
                  ? 'Simetría Libre'
                  : choice.family === 'frieze'
                    ? `Friso ${choice.group}`
                    : `Simetría ${choice.group}`
              }
              data-symmetry-id={key}
              data-preview-revision={p?.revision ?? 0}
              onMouseEnter={() => hover(choice)}
              onMouseLeave={() => s.setSymmetryPreview(null)}
              onFocus={() => hover(choice)}
              onBlur={() => s.setSymmetryPreview(null)}
              onClick={() => s.changeSymmetryChoice(choice)}
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
                  buttons.current[(i + step + choices.length) % choices.length]?.focus();
                }
              }}
              title={
                choice.family === 'none'
                  ? 'Sin transformaciones de grupo'
                  : (choice.family === 'frieze' ? friezeDescriptions : groupDescriptions)[
                      choice.group
                    ]
              }
            >
              <div className="drawing-thumbnail">
                {p ? (
                  <img alt={`Dibujo con ${choice.family} ${label}`} src={p.url} />
                ) : (
                  <span>Sin trazos</span>
                )}
              </div>
              <span className="gallery-caption">
                <MathematicalIcon choice={choice} />
                <span>
                  {label}
                  <small>
                    {choice.family === 'frieze'
                      ? 'friso'
                      : choice.family === 'none'
                        ? 'sin repetir'
                        : choice.family === 'radial'
                          ? 'radial'
                          : 'plano'}
                  </small>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="gallery-details">
        <p className="help-text" role="status">
          {s.symmetryPreview
            ? `Previsualización · ${previewCurrent.group === 'none' ? 'Libre' : previewCurrent.group} · clic para confirmar`
            : 'Pasá el cursor para explorar; clic para confirmar. Tu herramienta sigue activa.'}
        </p>
        {s.pattern.generator.kind === 'penrose' ? (
          <p className="math-notice">
            Penrose es una región aperiódica finita. La repetición del grupo permanece desactivada;
            el dibujo fuente se conserva.
          </p>
        ) : (
          <>
            {confirmed.family !== 'none' && (
              <>
                <Field
                  label="Orientación de red"
                  value={confirmed.orientation}
                  min={-180}
                  max={180}
                  unit="°"
                  onChange={(v) => s.patchSymmetry({ orientation: v })}
                />
                <div className="two-fields">
                  {(['x', 'y'] as const).map((axis) => (
                    <Field
                      key={axis}
                      label={`Origen ${axis.toUpperCase()}`}
                      value={
                        confirmed.family === 'radial'
                          ? confirmed.center[axis]
                          : confirmed.origin[axis]
                      }
                      unit="mm"
                      step={0.1}
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
                {confirmed.family === 'radial' ? (
                  <Field
                    integer
                    label="Sectores"
                    value={confirmed.sectors}
                    min={2}
                    max={64}
                    slider
                    onChange={(v) => s.patchSymmetry({ sectors: v })}
                  />
                ) : (
                  <>
                    <Field
                      label="Ancho de celda"
                      value={confirmed.width}
                      min={5}
                      max={200}
                      unit="mm"
                      slider
                      onChange={(v) => s.patchSymmetry({ width: v })}
                    />
                    {!/^p[346]/.test(confirmed.group) && (
                      <Field
                        label="Alto de celda"
                        value={confirmed.height}
                        min={5}
                        max={200}
                        unit="mm"
                        slider
                        onChange={(v) => s.patchSymmetry({ height: v })}
                      />
                    )}{' '}
                    {confirmed.family === 'wallpaper' && ['p1', 'p2'].includes(confirmed.group) && (
                      <Field
                        label="Ángulo de red"
                        value={confirmed.angle}
                        min={15}
                        max={165}
                        unit="°"
                        slider
                        onChange={(v) => s.patchSymmetry({ angle: v })}
                      />
                    )}
                  </>
                )}
                <button className="wide-button" onClick={s.adaptPattern}>
                  {s.pattern.tiling
                    ? 'Adaptar motivo a tesela'
                    : 'Adaptar a celda · conservar fuente'}
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
              </>
            )}
          </>
        )}
        <Toggle
          label="Guías detalladas"
          checked={s.project.preferences.guides}
          onChange={(v) =>
            s.change((p) => {
              p.preferences.guides = v;
              p.preferences.structureVisible = false;
            })
          }
        />
      </div>
    </details>
  );
}
