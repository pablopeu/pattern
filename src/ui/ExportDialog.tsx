import { useState, useEffect, useRef } from 'react';
import { X, Download, LoaderCircle, FileCode2 } from 'lucide-react';
import type { Studio } from '../app/useStudio';
import { type ExportOptions, type ExportResult } from '../export/svg';
import { rasterize } from '../export/raster';
import { download } from '../persistence/storage';
import { rectangularCell } from '../symmetry/groups';
import { Field, Select, Toggle } from './Controls';
export function ExportDialog({ studio: s, onClose }: { studio: Studio; onClose: () => void }) {
  const [options, setOptions] = useState<ExportOptions>({
    scope: s.project.patterns.filter((p) => p.visible).length > 1 ? 'composition' : 'pattern',
    target: s.mode === 'apply' && s.application ? 'application' : 'view',
    format: 'svg',
    representation: 'editable',
    width: 200,
    height: 150,
    dpi: 150,
    background: '#f8faf5',
    transparent: true,
    quality: 0.92,
    tolerance: 0.05,
    outlineStrokes: true,
    patternId: s.pattern.id,
    applicationId: s.applicationId,
  });
  const [result, setResult] = useState<(ExportResult & { dxf?: string }) | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [progress, setProgress] = useState(0),
    [downloading, setDownloading] = useState(false),
    [cancelled, setCancelled] = useState(false);
  const worker = useRef<Worker | null>(null),
    rasterController = useRef<AbortController | null>(null);
  useEffect(() => () => rasterController.current?.abort(), []);
  const set = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => {
    rasterController.current?.abort();
    setDownloading(false);
    setCancelled(false);
    setOptions((o) => ({ ...o, [key]: value }));
  };
  useEffect(() => {
    if (cancelled) return;
    setBusy(true);
    setError('');
    setProgress(0);
    setResult(null);
    const timer = setTimeout(() => {
      try {
        const w = new Worker(new URL('../export/worker.ts', import.meta.url), { type: 'module' });
        worker.current = w;
        w.onmessage = (e) => {
          if (e.data.error) {
            setError(e.data.error);
            setBusy(false);
            w.terminate();
          } else if (e.data.result) {
            setResult(e.data.result);
            setBusy(false);
            w.terminate();
          } else setProgress(e.data.progress);
        };
        w.onerror = (e) => {
          setError(`Falló el procesamiento de exportación: ${e.message}`);
          setBusy(false);
          w.terminate();
        };
        w.postMessage({ project: s.project, options });
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      worker.current?.terminate();
    };
  }, [options, s.project, cancelled]);
  const cancel = () => {
    rasterController.current?.abort();
    setDownloading(false);
    worker.current?.terminate();
    setBusy(false);
    setCancelled(true);
    setError('Exportación cancelada. Cambiá una opción para volver a calcular.');
  };
  const exportFile = async () => {
    if (!result) return;
    setDownloading(true);
    rasterController.current = new AbortController();
    try {
      const filename = s.project.metadata.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'patron';
      if (options.format === 'svg') download(result.svg, filename + '.svg', 'image/svg+xml');
      else if (options.format === 'dxf')
        download(result.dxf!, filename + '.dxf', 'application/dxf');
      else
        download(
          await rasterize(
            result.svg,
            result.bounds.width,
            result.bounds.height,
            options.dpi,
            options.format,
            options.quality,
            options.background,
            options.transparent,
            rasterController.current.signal,
          ),
          filename + '.' + (options.format === 'jpeg' ? 'jpg' : 'png'),
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };
  const rect = rectangularCell(s.confirmedSymmetry);
  return (
    <div
      className="modal-shade"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Exportar patrón"
      >
        <header>
          <div>
            <span className="eyebrow">DE LA IDEA AL ARCHIVO</span>
            <h2>Exportar tu diseño</h2>
          </div>
          <button aria-label="Cerrar exportación" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="export-body">
          <div className="export-options">
            <Select
              label="Contenido"
              value={options.scope ?? 'pattern'}
              onChange={(v) => set('scope', v as 'pattern' | 'composition')}
              options={[
                { value: 'composition', label: 'Composición visible' },
                { value: 'pattern', label: 'Conjunto activo' },
              ]}
            />
            <Select
              label="Qué exportar"
              value={options.target}
              onChange={(v) => set('target', v as ExportOptions['target'])}
              options={[
                { value: 'view', label: 'Región finita' },
                { value: 'tile', label: 'Celda rectangular seamless' },
                { value: 'lattice', label: 'Celda de red · geometría real' },
                { value: 'fundamental', label: 'Región fundamental del grupo' },
                ...(s.project.applications.length
                  ? [{ value: 'application', label: 'Patrón aplicado' }]
                  : []),
              ]}
            />
            {options.target === 'application' && (
              <Select
                label="Aplicación a exportar"
                value={options.applicationId ?? ''}
                onChange={(v) => set('applicationId', v)}
                options={s.project.applications.map((a) => ({ value: a.id, label: a.name }))}
              />
            )}
            <Select
              label="Formato"
              value={options.format}
              onChange={(v) => set('format', v as ExportOptions['format'])}
              options={[
                { value: 'svg', label: 'SVG · vectorial' },
                { value: 'png', label: 'PNG · transparente' },
                { value: 'jpeg', label: 'JPEG · imagen' },
                { value: 'dxf', label: 'DXF · líneas y polilíneas' },
              ]}
            />
            {options.format === 'svg' && (
              <Select
                label="Representación"
                value={options.representation}
                onChange={(v) => set('representation', v as ExportOptions['representation'])}
                options={[
                  { value: 'editable', label: 'Instancias reutilizables' },
                  { value: 'expanded', label: 'Geometría expandida' },
                ]}
              />
            )}
            {options.target === 'view' && (
              <div className="two-fields">
                <Field
                  label="Ancho de exportación"
                  value={options.width}
                  min={1}
                  max={2000}
                  unit="mm"
                  onChange={(v) => set('width', v)}
                />
                <Field
                  label="Alto de exportación"
                  value={options.height}
                  min={1}
                  max={2000}
                  unit="mm"
                  onChange={(v) => set('height', v)}
                />
              </div>
            )}
            {['png', 'jpeg'].includes(options.format) && (
              <>
                <Field
                  label="Resolución"
                  value={options.dpi}
                  unit="DPI"
                  min={36}
                  max={1200}
                  onChange={(v) => set('dpi', v)}
                />
                {options.format === 'jpeg' && (
                  <Field
                    label="Calidad JPEG"
                    value={options.quality}
                    min={0.1}
                    max={1}
                    step={0.05}
                    slider
                    onChange={(v) => set('quality', v)}
                  />
                )}
              </>
            )}
            {options.format !== 'dxf' && (
              <>
                {options.format !== 'jpeg' && (
                  <Toggle
                    label="Fondo transparente"
                    checked={options.transparent}
                    onChange={(v) => set('transparent', v)}
                  />
                )}
                {(!options.transparent || options.format === 'jpeg') && (
                  <label className="color-row">
                    Color de fondo
                    <input
                      aria-label="Color de fondo de exportación"
                      type="color"
                      value={options.background}
                      onChange={(e) => set('background', e.target.value)}
                    />
                  </label>
                )}
              </>
            )}
            {(options.representation === 'expanded' || options.format === 'dxf') && (
              <>
                <Field
                  label="Tolerancia de aproximación"
                  value={options.tolerance}
                  min={0.001}
                  max={1}
                  step={0.01}
                  unit="mm"
                  onChange={(v) => set('tolerance', v)}
                />
                {options.target === 'application' && (
                  <Toggle
                    label="Convertir trazos a contornos"
                    checked={options.outlineStrokes}
                    onChange={(v) => set('outlineStrokes', v)}
                  />
                )}
              </>
            )}
            {!rect && s.confirmedSymmetry.family === 'wallpaper' && (
              <p className="math-notice">
                La red oblicua no tiene una celda rectangular verificada. Exportá su celda de red o
                una región finita; no se deforma para simular continuidad.
              </p>
            )}
            {options.format === 'dxf' && (
              <p className="help-text">
                DXF 2D en milímetros. Bézier subdivididas con tolerancia física; coordenada Y hacia
                arriba. No transporta rellenos.
              </p>
            )}
          </div>
          <div className="export-preview">
            <div className="export-preview-image">
              {result ? (
                <img
                  alt="Previsualización de exportación"
                  src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(result.svg)}
                />
              ) : (
                <div className="export-placeholder">
                  <FileCode2 size={36} />
                  <span>{busy ? 'Preparando geometría…' : 'Sin previsualización'}</span>
                </div>
              )}
              {(busy || downloading) && (
                <div className="processing">
                  <LoaderCircle className="spin" size={22} />
                  {downloading ? 'Generando imagen…' : `${Math.round(progress * 100)}%`}{' '}
                  <button onClick={cancel}>Cancelar</button>
                </div>
              )}
            </div>
            <div className="export-summary">
              {result && (
                <>
                  <span>
                    {result.bounds.width.toFixed(2)} × {result.bounds.height.toFixed(2)} mm
                  </span>
                  <span>
                    {options.format === 'svg' || options.format === 'dxf'
                      ? `${(((options.format === 'dxf' ? result.dxf?.length : result.svg.length) ?? 0) / 1024) | 0} KB aprox.`
                      : `${Math.round((result.bounds.width / 25.4) * options.dpi)} × ${Math.round((result.bounds.height / 25.4) * options.dpi)} px`}
                  </span>
                </>
              )}
            </div>
            {result?.warnings.map((w) => (
              <p key={w} className="math-notice">
                {w}
              </p>
            ))}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
        <footer>
          <span>Vector real. Sin recursos externos.</span>
          <button
            className="primary-button"
            disabled={busy || !result || downloading}
            onClick={exportFile}
          >
            <Download size={16} />
            {downloading ? 'Generando imagen…' : 'Descargar archivo'}
          </button>
        </footer>
      </section>
    </div>
  );
}
