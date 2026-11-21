import { deriveArtisticDiskInWorker } from '../artistic/worker-client';
import { artisticDiskSVG, type ArtisticDiskRepresentation } from '../artistic/disk';
import { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, Save, Square, X } from 'lucide-react';
import type { Studio } from '../app/useStudio';
import {
  defaultVisualization,
  changeVisualizationKind,
  type Visualization,
  type PoincareVisualization,
  type ArtisticVisualization,
} from '../visualization/model';
import { visualizationSchema } from '../visualization/schema';
import { deriveProjectDiskInWorker } from '../hyperbolic/worker-client';
import { diskPreviewSVG } from '../hyperbolic/representation';
import type { ProjectDiskRepresentation } from '../hyperbolic/flat-source';
import { download } from '../persistence/storage';
import { rasterize } from '../export/raster';
import { Field, Select, Toggle } from './Controls';
import { Modal } from './Modal';

export function DiskDialog({
  studio: s,
  onClose,
  onSave,
}: {
  studio: Studio;
  onClose: () => void;
  onSave: () => void;
}) {
  const [record, setRecord] = useState<Visualization>(() =>
      structuredClone(s.project.visualization ?? defaultVisualization(s.project, s.pattern.id)),
    ),
    [output, setOutput] = useState<{
      disk: ProjectDiskRepresentation | ArtisticDiskRepresentation;
      record: Visualization;
      svg: string;
    } | null>(null),
    [preview, setPreview] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dpi, setDpi] = useState(150),
    [exporting, setExporting] = useState(false);
  const controller = useRef<AbortController | null>(null),
    rasterController = useRef<AbortController | null>(null),
    mounted = useRef(true);
  const validation = visualizationSchema.safeParse(record),
    dirty = JSON.stringify(output?.record ?? s.project.visualization) !== JSON.stringify(record);
  type AllSettings = PoincareVisualization['settings'] & ArtisticVisualization['settings'];
  const setting = <K extends keyof AllSettings>(key: K, value: AllSettings[K]) =>
    setRecord((r) => {
      const next = structuredClone(r);
      Object.assign(next.settings, { [key]: value });
      return next;
    });
  const center = (axis: 'x' | 'y', value: number) => {
    const c = { ...record.settings.view.center, [axis]: value },
      norm = Math.hypot(c.x, c.y),
      limit = record.kind === 'poincare' ? 0.9 : 2;
    if (norm > limit) {
      c.x *= (limit * (1 - 1e-12)) / norm;
      c.y *= (limit * (1 - 1e-12)) / norm;
    }
    setting('view', { ...record.settings.view, center: c });
  };
  const run = async (next: Visualization) => {
    const checked = visualizationSchema.safeParse(next);
    if (!checked.success) {
      setError(checked.error.issues[0].message);
      return;
    }
    controller.current?.abort();
    rasterController.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError('');
    setOutput(null);
    const snapshot = structuredClone(next);
    s.change((p) => {
      p.visualization = snapshot;
    });
    try {
      const publish = (
        disk: ProjectDiskRepresentation | ArtisticDiskRepresentation,
        svg: string,
      ) => {
        if (!current.signal.aborted && mounted.current) setOutput({ disk, record: snapshot, svg });
      };
      if (snapshot.kind === 'poincare') {
        const disk = await deriveProjectDiskInWorker(
          s.projectRef.current,
          snapshot.source.patternId,
          snapshot.source.selection,
          snapshot.settings,
          current.signal,
        );
        publish(disk, diskPreviewSVG(disk, snapshot.showStructure));
      } else {
        const disk = await deriveArtisticDiskInWorker(
          s.projectRef.current,
          snapshot.source.patternId,
          snapshot.source.selection,
          {
            ...snapshot.settings,
            angle: snapshot.settings.view.angle,
            center: snapshot.settings.view.center,
          },
          current.signal,
        );
        publish(disk, artisticDiskSVG(disk));
      }
    } catch (e) {
      if (mounted.current && controller.current === current)
        setError(
          (e as Error).name === 'AbortError'
            ? 'Cálculo cancelado. La fuente está intacta.'
            : (e as Error).message,
        );
    } finally {
      if (mounted.current && controller.current === current) setBusy(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void run(record);
    return () => {
      mounted.current = false;
      controller.current?.abort();
      rasterController.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!output) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(new Blob([output.svg], { type: 'image/svg+xml' }));
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [output]);
  const exportImage = async (format: 'svg' | 'png' | 'jpeg') => {
    if (!output || busy || dirty) return;
    const file =
        (s.project.metadata.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'estudio') +
        (output.record.kind === 'poincare' ? '-poincare' : '-disco-artistico'),
      job = new AbortController();
    rasterController.current = job;
    setExporting(true);
    setError('');
    try {
      if (format === 'svg') download(output.svg, file + '.svg', 'image/svg+xml');
      else {
        const diameter = output.record.settings.radiusMm * 2;
        const blob = await rasterize(
          output.svg,
          diameter,
          diameter,
          dpi,
          format,
          0.95,
          '#ffffff',
          format === 'png',
          job.signal,
        );
        job.signal.throwIfAborted();
        download(blob, file + (format === 'png' ? '.png' : '.jpg'));
      }
    } catch (e) {
      if (mounted.current)
        setError(
          (e as Error).name === 'AbortError' ? 'Exportación cancelada.' : (e as Error).message,
        );
    } finally {
      if (mounted.current) setExporting(false);
    }
  };
  const selection = record.source.selection,
    artistic = record.kind === 'artistic-disk';
  return (
    <Modal
      label={artistic ? 'Visualización artística' : 'Visualización de Poincaré'}
      className="disk-modal"
      onClose={onClose}
    >
      <header className="disk-header">
        <div>
          <span className="eyebrow">VISTA DERIVADA · FUENTE PLANA EDITABLE</span>
          <h2>{artistic ? 'Disco artístico' : 'Disco de Poincaré'}</h2>
        </div>
        <button aria-label="Volver a la fuente" onClick={onClose} autoFocus>
          <X size={19} />
          Volver a la fuente
        </button>
      </header>
      <div className="disk-body">
        <section className="disk-controls" aria-label="Opciones de visualización">
          <Select
            label="Modalidad"
            value={record.kind}
            options={[
              { value: 'poincare', label: 'Poincaré geométrico' },
              { value: 'artistic-disk', label: 'Disco artístico · deformación' },
            ]}
            onChange={(kind) =>
              s.change((p) => {
                p.visualization = changeVisualizationKind(p, record, kind as Visualization['kind']);
              })
            }
          />
          <Select
            label="Conjunto fuente"
            value={record.source.patternId}
            options={s.project.patterns.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(id) => setRecord((r) => ({ ...r, source: { ...r.source, patternId: id } }))}
          />
          <Select
            label="Región fuente"
            value={selection.target}
            options={[
              { value: 'lattice', label: 'Una celda de red' },
              { value: 'tile', label: 'Celda rectangular seamless' },
              { value: 'fundamental', label: 'Dominio fundamental' },
              { value: 'view', label: 'Ventana finita' },
            ]}
            onChange={(target) =>
              setRecord((r) => ({
                ...r,
                source: {
                  ...r.source,
                  selection:
                    target === 'view'
                      ? { target, bounds: { x: -50, y: -50, width: 100, height: 100 } }
                      : { target: target as 'tile' | 'lattice' | 'fundamental' },
                },
              }))
            }
          />
          {selection.target === 'view' && (
            <div className="disk-fields">
              {(['x', 'y', 'width', 'height'] as const).map((key) => (
                <Field
                  key={key}
                  label={
                    {
                      x: 'Ventana X',
                      y: 'Ventana Y',
                      width: 'Ancho fuente',
                      height: 'Alto fuente',
                    }[key]
                  }
                  value={selection.bounds[key]}
                  min={key === 'width' || key === 'height' ? 0.1 : -10000}
                  max={10000}
                  step={1}
                  unit="mm"
                  onChange={(v) =>
                    setRecord((r) => ({
                      ...r,
                      source: {
                        ...r.source,
                        selection: { target: 'view', bounds: { ...selection.bounds, [key]: v } },
                      },
                    }))
                  }
                />
              ))}
            </div>
          )}
          <div className="disk-fields">
            {record.kind === 'poincare' && (
              <>
                <Field
                  label="Lados p"
                  value={record.settings.p}
                  min={3}
                  max={12}
                  integer
                  onChange={(v) => setting('p', v)}
                />
                <Field
                  label="Celdas por vértice q"
                  value={record.settings.q}
                  min={3}
                  max={12}
                  integer
                  onChange={(v) => setting('q', v)}
                />
              </>
            )}
            <Field
              label="Radio del disco"
              value={record.settings.radiusMm}
              min={1}
              max={2000}
              unit="mm"
              onChange={(v) => setting('radiusMm', v)}
            />
            <Field
              label="Precisión de proyección"
              value={record.settings.toleranceMm}
              min={0.001}
              max={1}
              step={0.005}
              unit="mm"
              onChange={(v) => setting('toleranceMm', v)}
            />
            {record.kind === 'poincare' && (
              <>
                <Field
                  label="Profundidad"
                  value={record.settings.depth}
                  min={0}
                  max={8}
                  integer
                  onChange={(v) => setting('depth', v)}
                />
                <Field
                  label="Máximo de celdas"
                  value={record.settings.maxCells}
                  min={1}
                  max={4096}
                  integer
                  step={10}
                  onChange={(v) => setting('maxCells', v)}
                />
              </>
            )}
          </div>
          {record.kind === 'artistic-disk' && (
            <Field
              label="Compresión radial"
              value={record.settings.compression}
              min={0.1}
              max={64}
              step={0.1}
              slider
              sliderMax={12}
              onChange={(v) => setting('compression', v)}
            />
          )}
          <Field
            label="Orientación del disco"
            value={(record.settings.view.angle * 180) / Math.PI}
            min={-180}
            max={180}
            unit="°"
            slider
            onChange={(v) =>
              setting('view', { ...record.settings.view, angle: (v * Math.PI) / 180 })
            }
          />
          <Field
            label="Centro horizontal"
            value={record.settings.view.center.x}
            min={artistic ? -2 : -0.9}
            max={artistic ? 2 : 0.9}
            step={0.01}
            slider
            onChange={(v) => center('x', v)}
          />
          <Field
            label="Centro vertical"
            value={record.settings.view.center.y}
            min={artistic ? -2 : -0.9}
            max={artistic ? 2 : 0.9}
            step={0.01}
            slider
            onChange={(v) => center('y', v)}
          />
          {record.kind === 'poincare' && (
            <Toggle
              label="Estructura geodésica"
              checked={record.showStructure}
              onChange={(v) =>
                setRecord((r) => (r.kind === 'poincare' ? { ...r, showStructure: v } : r))
              }
            />
          )}
          {!validation.success && (
            <p className="disk-error" role="alert">
              {validation.error.issues[0].message}
            </p>
          )}
          <button
            className="primary"
            disabled={!validation.success || exporting}
            onClick={() => void run(record)}
          >
            <RotateCcw size={16} />
            {busy ? 'Reiniciar cálculo' : 'Actualizar vista'}
          </button>
          {busy && (
            <button onClick={() => controller.current?.abort()}>
              <Square size={14} />
              Cancelar cálculo
            </button>
          )}
        </section>
        <section className="disk-preview" aria-label="Vista derivada no editable" aria-busy={busy}>
          <p>
            {artistic
              ? 'Deformación radial artística · ARTISTIC. Simetrías y correspondencia de bordes sin garantía.'
              : 'Teselación geométrica {p,q}. Motivo adaptado; correspondencia de bordes no garantizada.'}
          </p>
          <div className="disk-image">
            {preview && (
              <img
                src={preview}
                alt={
                  artistic
                    ? 'Disco artístico derivado de la fuente plana'
                    : 'Disco de Poincaré derivado de la fuente plana'
                }
                draggable={false}
              />
            )}
            {busy && (
              <span className="disk-loading" role="status">
                Preparando fuente y proyectando…
              </span>
            )}
          </div>
          {dirty && (
            <p role="status">
              Cambiaste opciones. Actualizá la vista para ver y exportar el resultado.
            </p>
          )}
          {error && (
            <p className="disk-error" role="alert">
              {error}
            </p>
          )}
          {output && (
            <details className="disk-report">
              <summary>
                {'cells' in output.disk
                  ? `${output.disk.cells.length} celdas`
                  : `${output.disk.contours.length} pinturas`}{' '}
                · {output.disk.report.resources.segments.toLocaleString('es')} segmentos
              </summary>
              {'cells' in output.disk && output.record.kind === 'poincare' ? (
                <>
                  <p>
                    Modelo {'{' + output.record.settings.p + ',' + output.record.settings.q + '}'}{' '}
                    de curvatura−1. Parche finito; {output.disk.report.resources.omitted} celdas
                    omitidas por detalle.
                  </p>
                  <p>
                    Límites:{' '}
                    {Object.entries(output.disk.report.resources.limited)
                      .filter(([, v]) => v)
                      .map(
                        ([key]) =>
                          ({ depth: 'profundidad', budget: 'celdas', numeric: 'numérico' })[key],
                      )
                      .join(', ') || 'ninguno'}
                    .
                  </p>
                </>
              ) : (
                <p>
                  ARTISTIC · Compresión radial del dibujo plano. Conserva la fuente para editar y
                  regenerar.
                </p>
              )}
              <p>
                Cota del mapeo: {output.disk.report.numeric.curveProjectionBoundMm.toFixed(5)}mm.
                Preparación por recorte/contorneado numérico; esa cota no certifica el proceso
                completo.
              </p>
              {('cells' in output.disk
                ? output.disk.flatSource.warnings
                : output.disk.report.source.warnings
              ).map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </details>
          )}
          <div className="disk-export">
            <Field
              label="Resolución de imagen"
              value={dpi}
              min={24}
              max={1200}
              step={1}
              integer
              unit="DPI"
              onChange={setDpi}
            />
            {(['svg', 'png', 'jpeg'] as const).map((format) => (
              <button
                key={format}
                disabled={!output || busy || dirty || exporting}
                onClick={() => void exportImage(format)}
              >
                <Download size={15} />
                {format.toUpperCase()}
              </button>
            ))}
            {exporting && (
              <button onClick={() => rasterController.current?.abort()}>
                Cancelar exportación
              </button>
            )}
          </div>
          <p className="disk-note">
            Diámetro {record.settings.radiusMm * 2}mm. PNG transparente; JPEG con fondo blanco. El
            proyecto guarda la fuente y los parámetros para regenerar.
          </p>
        </section>
      </div>
      <footer className="disk-footer">
        <button onClick={onClose}>Editar fuente plana</button>
        <button disabled={dirty || !validation.success} onClick={onSave}>
          <Save size={16} />
          Guardar estudio
        </button>
      </footer>
    </Modal>
  );
}
