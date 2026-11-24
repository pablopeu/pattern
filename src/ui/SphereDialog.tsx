import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { Studio } from '../app/useStudio';
import { download } from '../persistence/storage';
import { Modal } from './Modal';
import { Field, Select, Toggle } from './Controls';
import { defaultSphereSettings, validateSphereSettings, type SphereSettings } from '../sphere/model';
import { geodesicFaces, solids, type SolidFace } from '../sphere/geometry';
import { drawSphere } from '../sphere/render';
import { visualizationSchema } from '../visualization/schema';
import type { SphereVisualization } from '../visualization/model';

import { tr , translateMessage } from '../i18n';
const PREVIEW = 520;

/** Vista esférica derivada: nunca toca la fuente plana (PRD v3.0 §11). */
export function SphereDialog({
  studio: s,
  onClose,
  onSave,
}: {
  studio: Studio;
  onClose: () => void;
  onSave: () => void;
}) {
  const current = s.project.visualization,
    [settings, setSettings] = useState<SphereSettings>(() =>
      structuredClone(
        current?.kind === 'sphere' ? current.settings : defaultSphereSettings(),
      ),
    ),
    [error, setError] = useState(''),
    [spinning, setSpinning] = useState(false),
    [exporting, setExporting] = useState(false),
    canvasRef = useRef<HTMLCanvasElement | null>(null),
    textureRef = useRef<CanvasImageSource | null>(null),
    [textureReady, setTextureReady] = useState(false),
    spinRef = useRef<number | null>(null);

  const faces = useMemo<SolidFace[]>(() => {
    try {
      return geodesicFaces(settings.solid, settings.level);
    } catch (e) {
      setError((e as Error).message);
      return [];
    }
  }, [settings.solid, settings.level]);

  // Fuente plana para la textura artística: se rasteriza una vez por conjunto.
  const patternId = current?.source.patternId;
  useEffect(() => {
    let cancelled = false;
    textureRef.current = null;
    setTextureReady(false);
    if (settings.mode !== 'artistic') {
      setTextureReady(true);
      return;
    }
    void (async () => {
      try {
        const { prepareExport } = await import('../export/svg.ts');
        const project = s.projectRef.current,
          pattern = project.patterns.find((p) => p.id === patternId) ?? project.patterns[0],
          size = 180;
        const svg = prepareExport(project, {
          target: 'view',
          format: 'svg',
          representation: 'editable',
          width: size,
          height: size,
          dpi: 96,
          background: '#ffffff',
          transparent: false,
          quality: 0.95,
          tolerance: 0.02,
          outlineStrokes: false,
          patternId: pattern.id,
        }).svg;
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          if (cancelled) return;
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 512;
          canvas.getContext('2d')?.drawImage(image, 0, 0, 512, 512);
          textureRef.current = canvas;
          setTextureReady(true);
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.mode, patternId, s.projectRef]);

  const draw = useCallback(
    (next: SphereSettings) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      try {
        drawSphere(ctx, {
          faces,
          settings: next,
          width: canvas.width,
          height: canvas.height,
          texture: textureRef.current,
        });
        setError('');
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [faces],
  );

  useEffect(() => {
    if (settings.mode === 'geodesic' || textureReady) draw(settings);
  }, [settings, faces, draw, textureReady]);

  // Giro continuo: sólo vista; al detenerlo se persiste la orientación final.
  useEffect(() => {
    if (!spinning) return;
    let frame = 0,
      last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      setSettings((prev) => ({
        ...prev,
        view: { ...prev.view, yaw: prev.view.yaw + prev.view.spin * dt * 0.03 },
      }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    spinRef.current = frame;
    return () => cancelAnimationFrame(frame);
  }, [spinning]);

  const commit = (next: SphereSettings) => {
    const snapshot: SphereVisualization = {
      version: 1,
      kind: 'sphere',
      active: true,
      source: structuredClone(
        current?.source ?? { patternId: s.pattern.id, selection: { target: 'view', bounds: { x: -50, y: -50, width: 100, height: 100 } } },
      ),
      settings: structuredClone(next),
    };
    s.change((p) => {
      if (visualizationSchema.safeParse(snapshot).success) p.visualization = snapshot;
    });
  };
  const update = (next: SphereSettings) => {
    try {
      validateSphereSettings(next);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setSettings(next);
    commit(next);
  };
  const patch = (part: Partial<SphereSettings>) => update({ ...settings, ...part });

  const exportPNG = async () => {
    setExporting(true);
    try {
      const size = 1400,
        canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Canvas no disponible.');
      drawSphere(ctx, {
        faces,
        settings,
        width: size,
        height: size,
        texture: textureRef.current,
      });
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(Error('PNG no disponible.'))), 'image/png'),
      );
      await download(blob, (s.project.metadata.name || 'esfera') + '.png');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal label={tr('Visualización esférica')} className="disk-dialog" onClose={onClose}>
      <header>
        <div>
          <small>{tr('VISTA DERIVADA · FUENTE PLANA EDITABLE')}</small>
          <h2>{tr('Esfera')}</h2>
        </div>
        <button aria-label={tr('Volver a la fuente')} onClick={onClose}>
          <X size={18} /> {tr('Volver a la fuente')}
        </button>
      </header>
      <div className="disk-body">
        <section aria-label={tr('Opciones de la esfera')}>
          <Select
            label={tr('Modo')}
            value={settings.mode}
            options={[
              { value: 'geodesic', label: tr('Teselación geodésica · sólidos') },
              { value: 'artistic', label: tr('Textura artística sobre esfera') },
            ]}
            onChange={(mode) => patch({ mode: mode as SphereSettings['mode'] })}
          />
          {settings.mode === 'geodesic' && (
            <>
              <Select
                label={tr('Sólido')}
                value={settings.solid}
                options={solids.map((s0) => ({ value: s0.kind, label: s0.label }))}
                onChange={(solid) => patch({ solid: solid as SphereSettings['solid'] })}
              />
              <Field
                label={tr('Nivel geodésico')}
                value={settings.level}
                min={0}
                max={4}
                integer
                onChange={(level) => patch({ level })}
              />
              <Toggle
                label={tr('Bordes de teselas')}
                checked={settings.borders}
                onChange={(borders) => patch({ borders })}
              />
            </>
          )}
          <Field
            label={tr('Orientación horizontal')}
            value={Math.round(settings.view.yaw)}
            min={-180}
            max={180}
            step={1}
            slider
            onChange={(yaw) => patch({ view: { ...settings.view, yaw } })}
          />
          <Field
            label={tr('Orientación vertical')}
            value={Math.round(settings.view.pitch)}
            min={-90}
            max={90}
            step={1}
            slider
            onChange={(pitch) => patch({ view: { ...settings.view, pitch } })}
          />
          <Field
            label={tr('Zoom')}
            value={settings.view.zoom}
            min={0.3}
            max={3}
            step={0.05}
            slider
            onChange={(zoom) => patch({ view: { ...settings.view, zoom } })}
          />
          <Select
            label={tr('Dirección de giro')}
            value={settings.view.spin === 1 ? 'cw' : 'ccw'}
            options={[
              { value: 'cw', label: tr('Horario') },
              { value: 'ccw', label: tr('Antihorario') },
            ]}
            onChange={(spin) =>
              patch({ view: { ...settings.view, spin: spin === 'cw' ? 1 : -1 } })
            }
          />
          <Toggle
            label={tr('Girar esfera')}
            checked={spinning}
            onChange={(value) => {
              setSpinning(value);
              if (!value) commit(settings);
            }}
          />
          <Toggle
            label={tr('Iluminación')}
            checked={settings.lighting}
            onChange={(lighting) => patch({ lighting })}
          />
          <label className="sphere-background">
            Fondo
            <input
              type="color"
              aria-label={tr('Fondo de la esfera')}
              value={settings.background}
              onChange={(e) => patch({ background: e.target.value })}
            />
          </label>
          {error && (
            <p className="disk-error" role="alert">
              {translateMessage(error)}
            </p>
          )}
          <button className="primary" disabled={exporting} onClick={() => void exportPNG()}>
            <Download size={16} /> {tr('PNG de alta calidad')}
          </button>
        </section>
        <section className="disk-preview" aria-label={tr('Vista esférica no editable')}>
          <p>
            {settings.mode === 'geodesic'
              ? tr('Modelo geométrico: {solid} proyectado a la esfera y subdividido geodésicamente (nivel {level}). Proyección ortográfica derivada; no es un modelo 3D editable.', { solid: tr(solids.find((x) => x.kind === settings.solid)?.label ?? ''), level: settings.level })
              : 'Deformación artística de la fuente plana sobre la esfera: no implica simetría esférica exacta.'}
          </p>
          <div className="disk-image">
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              aria-label={tr('Esfera derivada de la fuente plana')}
            />
          </div>
          <p className="help-text">
            {settings.mode === 'geodesic'
              ? tr('{n} caras proyectadas · paleta por cara base', { n: faces.length })
              : 'Textura muestreada por proyección inversa, 512×512'}
          </p>
        </section>
      </div>
      <footer>
        <button onClick={onClose}>{tr('Editar fuente plana')}</button>
        <button onClick={onSave}>{tr('Guardar estudio')}</button>
      </footer>
    </Modal>
  );
}
