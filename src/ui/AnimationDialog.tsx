import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Pause, Play, RotateCcw, Square, X } from 'lucide-react';
import type { Studio } from '../app/useStudio';
import { download } from '../persistence/storage';
import { Modal } from './Modal';
import { Field, Select } from './Controls';
import {
  availablePresets,
  defaultAnimation,
  frameTime,
  presetById,
  validateAnimation,
  type AnimationSettings,
} from '../animation/model';
import { drawAnimationFrame, makeCanvas, type FrameAssets } from '../animation/frames';
import { animationSchema } from '../animation/schema';
import { themedBackground } from '../app/experience';
import { geodesicFaces } from '../sphere/geometry';

import { tr , translateMessage } from '../i18n';
const PREVIEW = 520;
const SIZES = [
  { value: '1080x1080', label: '1080 × 1080' },
  { value: '1920x1080', label: '1920 × 1080' },
  { value: '1080x1920', label: '1080 × 1920' },
] as const;

export function AnimationDialog({ studio: s, onClose }: { studio: Studio; onClose: () => void }) {
  const viz = s.project.visualization,
    recursive = !!s.pattern.composition?.enabled,
    composition = s.pattern.composition,
    maxLevel = composition?.kind === 'recursive' ? Math.max(1, composition.depth) : 4,
    presets = availablePresets(viz, recursive),
    [settings, setSettings] = useState<AnimationSettings>(() => {
      const saved = s.project.animation;
      if (saved) {
        try {
          validateAnimation(saved, recursive);
          if (presets.some((p) => p.id === saved.preset)) return structuredClone(saved);
        } catch {
          /* documento previo inválido: se usa el preset por defecto */
        }
      }
      return defaultAnimation(viz, recursive);
    }),
    [position, setPosition] = useState(settings.position),
    [playing, setPlaying] = useState(false),
    [busy, setBusy] = useState(''),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(''),
    [size, setSize] = useState<(typeof SIZES)[number]['value']>('1080x1080'),
    [exportFormat, setExportFormat] = useState<'gif' | 'webm'>('gif'),
    canvasRef = useRef<HTMLCanvasElement | null>(null),
    assetsRef = useRef<FrameAssets>({}),
    [assetsReady, setAssetsReady] = useState(false),
    cancelRef = useRef(false),
    settingsRef = useRef(settings);
  settingsRef.current = settings;

  const background = viz && 'settings' in viz && 'background' in viz.settings
    ? (viz.settings.background as string)
    : s.project.preferences.background;
  const themedBack = themedBackground(background);

  // Recursos por preset: disco rasterizado una vez, malla esférica o revelado recursivo.
  useEffect(() => {
    let cancelled = false;
    assetsRef.current = {};
    setAssetsReady(false);
    void (async () => {
      try {
        const preset = settings.preset;
        if ((preset === 'disk-spin' || preset === 'artistic-spin') && viz) {
          const { deriveVisualizationInWorker } = await import('../visualization/worker-client.ts');
          const { svg } = await deriveVisualizationInWorker(s.projectRef.current, viz);
          const image = await svgToImage(svg);
          if (cancelled) return;
          const canvas = makeCanvas(1024, 1024),
            ctx = canvas.getContext('2d')!;
          ctx.drawImage(image, 0, 0, 1024, 1024);
          assetsRef.current = { disk: canvas };
        } else if (preset === 'sphere-spin' || preset === 'sphere-tilt') {
          if (viz?.kind === 'sphere')
            assetsRef.current = {
              faces: geodesicFaces(viz.settings.solid, viz.settings.level),
              texture:
                viz.settings.mode === 'artistic'
                  ? await flatTexture(s.projectRef.current, viz.source.patternId)
                  : null,
            };
        } else if (preset === 'recursive-levels') {
          assetsRef.current = {
            recursive: async (level: number) => {
              const project = structuredClone(s.projectRef.current),
                pattern = project.patterns.find((p) => p.composition?.enabled) ?? project.patterns[0];
              if (pattern.composition?.kind !== 'recursive') return null;
              pattern.composition.depth = Math.max(1, Math.min(level, maxLevel));
              const { prepareExport } = await import('../export/svg.ts');
              const { svg } = prepareExport(project, {
                target: 'view',
                format: 'svg',
                representation: 'editable',
                width: 220,
                height: 220,
                dpi: 96,
                background,
                transparent: false,
                quality: 0.95,
                tolerance: 0.02,
                outlineStrokes: false,
                patternId: pattern.id,
              });
              const image = await svgToImage(svg),
                canvas = makeCanvas(1024, 1024),
                ctx = canvas.getContext('2d')!;
              ctx.fillStyle = background;
              ctx.fillRect(0, 0, 1024, 1024);
              const scale = Math.min(1024 / image.width, 1024 / image.height);
              ctx.drawImage(
                image,
                (1024 - image.width * scale) / 2,
                (1024 - image.height * scale) / 2,
                image.width * scale,
                image.height * scale,
              );
              return canvas;
            },
          };
        }
        if (!cancelled) setAssetsReady(true);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setAssetsReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.preset]);

  const sphereSettings = viz?.kind === 'sphere' ? viz.settings : null;

  const drawPreview = useCallback(
    async (t: number, next: AnimationSettings) => {
      const canvas = canvasRef.current;
      if (!canvas || !assetsReady) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      try {
        await drawAnimationFrame(
          ctx,
          canvas.width,
          canvas.height,
          next.preset,
          t,
          next.direction,
          assetsRef.current,
          sphereSettings,
          background,
          maxLevel,
        );
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [assetsReady, sphereSettings, background, maxLevel],
  );

  useEffect(() => {
    void drawPreview(position, settings);
  }, [position, settings, drawPreview]);

  // Reproducción: el tiempo del cuadro sale del reloj, nunca de acumular transforms.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now() - position * settings.duration / Math.max(0.1, settings.speed);
    const tick = (now: number) => {
      const raw =
        settings.duration <= 0
          ? 1
          : ((now - start) * Math.max(0.1, settings.speed)) / settings.duration;
      let t: number;
      if (settings.loop === 'once') t = Math.min(1, raw);
      else if (settings.loop === 'pingpong') {
        const cycle = ((raw % 2) + 2) % 2;
        t = cycle <= 1 ? cycle : 2 - cycle;
      } else t = ((raw % 1) + 1) % 1;
      setPosition(t);
      if (settings.loop === 'once' && raw >= 1) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, settings.duration, settings.speed, settings.loop]);

  const commit = (next: AnimationSettings) => {
    if (!animationSchema.safeParse(next).success) return;
    s.change((p) => {
      p.animation = structuredClone(next);
    });
  };
  const update = (next: AnimationSettings) => {
    try {
      validateAnimation(next, recursive);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setError('');
    setSettings(next);
    commit(next);
  };
  const patch = (part: Partial<AnimationSettings>) => {
    const next = { ...settings, ...part };
    if (part.preset) next.position = 0;
    update(next);
    if (part.preset) setPosition(0);
  };
  const stop = () => {
    setPlaying(false);
    setPosition(0);
    setSettings((prev) => {
      const next = { ...prev, position: 0 };
      commit(next);
      return next;
    });
  };

  const exportAnimation = async () => {
    const next = settings;
    setError('');
    setProgress(0);
    cancelRef.current = false;
    setBusy(exportFormat === 'gif' ? 'Generando GIF…' : 'Grabando WebM…');
    try {
      const [w, h] = size.split('x').map(Number),
        total = Math.max(2, Math.min(600, Math.round((next.duration / 1000) * next.fps)));
      if (exportFormat === 'gif') {
        const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
        const canvas = makeCanvas(w, h),
          ctx = canvas.getContext('2d', { willReadFrequently: true })!,
          gif = GIFEncoder();
        for (let k = 0; k < total; k++) {
          if (cancelRef.current) throw Error('Exportación cancelada.');
          await drawAnimationFrame(
            ctx,
            w,
            h,
            next.preset,
            frameTime(next, k, total),
            next.direction,
            assetsRef.current,
            sphereSettings,
            themedBack,
            maxLevel,
          );
          const data = ctx.getImageData(0, 0, w, h).data,
            palette = quantize(data, 256, { format: 'rgb444' }),
            index = applyPalette(data, palette, 'rgb444');
          gif.writeFrame(index, w, h, {
            palette,
            delay: Math.round(1000 / next.fps),
            repeat: next.loop === 'once' ? -1 : 0,
          });
          setProgress((k + 1) / total);
          await new Promise((r) => setTimeout(r, 0));
        }
        gif.finish();
        const blob = new Blob([gif.bytesView()], { type: 'image/gif' });
        if (!blob.size) throw Error('El GIF quedó vacío; no se descarga.');
        download(blob, `${s.project.metadata.name || 'animacion'}.gif`);
      } else {
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
            ? 'video/webm;codecs=vp8'
            : 'video/webm';
        const canvas = makeCanvas(w, h),
          ctx = canvas.getContext('2d')!,
          stream = canvas.captureStream(next.fps),
          chunks: BlobPart[] = [],
          recorder = new MediaRecorder(stream, { mimeType: mime });
        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
        recorder.start();
        const delay = 1000 / next.fps;
        for (let k = 0; k < total; k++) {
          if (cancelRef.current) {
            recorder.stop();
            stream.getTracks().forEach((t) => t.stop());
            throw Error('Exportación cancelada.');
          }
          await drawAnimationFrame(
            ctx,
            w,
            h,
            next.preset,
            frameTime(next, k, total),
            next.direction,
            assetsRef.current,
            sphereSettings,
            themedBack,
            maxLevel,
          );
          setProgress((k + 1) / total);
          await new Promise((r) => setTimeout(r, delay));
        }
        recorder.stop();
        await stopped;
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mime.split(';')[0] });
        if (!blob.size) throw Error('El video quedó vacío; no se descarga.');
        download(blob, `${s.project.metadata.name || 'animacion'}.webm`);
      }
      setBusy('');
    } catch (e) {
      setBusy('');
      setError((e as Error).message);
    }
  };

  if (!presets.length)
    return (
      <Modal label={tr('Animación')} className="disk-dialog" onClose={onClose}>
        <header>
          <h2>{tr('Animación')}</h2>
          <button aria-label={tr('Cerrar animación')} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <p>No hay presets disponibles para este documento. Abrí una visualización o una composición recursiva.</p>
      </Modal>
    );

  return (
    <Modal label={tr('Animación')} className="disk-dialog" onClose={onClose}>
      <header>
        <div>
          <small>{tr('REPRODUCCIÓN DETERMINÍSTICA · NO ALTERA LA FUENTE')}</small>
          <h2>{tr('Animación')}</h2>
        </div>
        <button aria-label={tr('Cerrar animación')} onClick={onClose}>
          <X size={18} /> {tr('Cerrar')}
        </button>
      </header>
      <div className="disk-body">
        <section aria-label={tr('Controles de animación')}>
          <Select
            label={tr('Preset')}
            value={settings.preset}
            options={presets.map((p) => ({ value: p.id, label: tr(p.label) }))}
            onChange={(preset) => patch({ preset: preset as AnimationSettings['preset'] })}
          />
          <p className="help-text">{tr(presetById(settings.preset).description)}</p>
          <div className="disk-fields">
            <Field
              label={tr('Duración')}
              value={settings.duration}
              min={250}
              max={60000}
              step={250}
              unit="ms"
              onChange={(duration) => patch({ duration })}
            />
            <Select
              label={tr('FPS')}
              value={String(settings.fps)}
              options={[8, 12, 15, 24, 30].map((f) => ({ value: String(f), label: `${f} fps` }))}
              onChange={(fps) => patch({ fps: Number(fps) })}
            />
          </div>
          <div className="disk-fields">
            <Field
              label={tr('Velocidad')}
              value={settings.speed}
              min={0.1}
              max={4}
              step={0.1}
              onChange={(speed) => patch({ speed })}
            />
            <Select
              label={tr('Sentido')}
              value={settings.direction === 1 ? '1' : '-1'}
              options={[
                { value: '1', label: tr('Directo') },
                { value: '-1', label: tr('Inverso') },
              ]}
              onChange={(d) => patch({ direction: d === '1' ? 1 : -1 })}
            />
          </div>
          <Select
            label={tr('Loop')}
            value={settings.loop}
            options={[
              { value: 'loop', label: tr('Bucle') },
              { value: 'pingpong', label: tr('Ida y vuelta') },
              { value: 'once', label: tr('Una vez') },
            ]}
            onChange={(loop) => patch({ loop: loop as AnimationSettings['loop'] })}
          />
          <div className="animation-controls">
            <button aria-label={playing ? 'Pausa' : 'Reproducir'} onClick={() => setPlaying(!playing)}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? 'Pausa' : 'Play'}
            </button>
            <button aria-label={tr('Detener')} onClick={stop}>
              <Square size={15} /> Stop
            </button>
            <button
              aria-label={tr('Reiniciar')}
              onClick={() => {
                setPosition(0);
                setSettings((prev) => {
                  const next = { ...prev, position: 0 };
                  commit(next);
                  return next;
                });
              }}
            >
              <RotateCcw size={15} /> Reiniciar
            </button>
          </div>
          <Field
            label={tr('Línea temporal')}
            value={Number(position.toFixed(3))}
            min={0}
            max={1}
            step={0.001}
            slider
            onChange={(t) => {
              setPlaying(false);
              setPosition(t);
              setSettings((prev) => {
                const next = { ...prev, position: t };
                commit(next);
                return next;
              });
            }}
          />
          <Select
            label={tr('Resolución de exportación')}
            value={size}
            options={SIZES.map((x) => ({ value: x.value, label: x.label }))}
            onChange={(v) => setSize(v as typeof size)}
          />
          <div className="disk-fields">
            <Select
              label={tr('Formato')}
              value={exportFormat}
              options={[
                { value: 'gif', label: tr('GIF animado') },
                { value: 'webm', label: tr('WebM (video)') },
              ]}
              onChange={(f) => setExportFormat(f as 'gif' | 'webm')}
            />
            <button
              className="primary"
              style={{ alignSelf: 'end' }}
              disabled={!!busy || !assetsReady}
              onClick={() => void exportAnimation()}
            >
              <Download size={15} /> {tr('Exportar')}
            </button>
          </div>
          {!!busy && (
            <>
              <progress value={progress} max={1} aria-label={tr('Progreso de exportación')} />
              <button onClick={() => (cancelRef.current = true)}>{tr('Cancelar exportación')}</button>
            </>
          )}
          {error && (
            <p className="disk-error" role="alert">
              {translateMessage(error)}
            </p>
          )}
        </section>
        <section className="disk-preview" aria-label={tr('Vista previa de la animación')}>
          <p>
            {presetById(settings.preset).cyclic
              ? tr('Preset cíclico: el cuadro final coincide con el inicial.')
              : 'Preset no periódico: se reproduce una vez o de ida y vuelta, sin prometer bucle perfecto.'}
          </p>
          <div className="disk-image">
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              aria-label={tr('Cuadro de animación')}
            />
          </div>
          <p className="help-text">
            t = {position.toFixed(3)} · {settings.fps} fps · {settings.loop}
          </p>
        </section>
      </div>
    </Modal>
  );
}

async function svgToImage(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

async function flatTexture(project: import('../app/model').Project, patternId: string) {
  const { prepareExport } = await import('../export/svg.ts'),
    pattern = project.patterns.find((p) => p.id === patternId) ?? project.patterns[0],
    { svg } = prepareExport(project, {
      target: 'view',
      format: 'svg',
      representation: 'editable',
      width: 180,
      height: 180,
      dpi: 96,
      background: '#ffffff',
      transparent: false,
      quality: 0.95,
      tolerance: 0.02,
      outlineStrokes: false,
      patternId: pattern.id,
    }),
    image = await svgToImage(svg),
    canvas = makeCanvas(512, 512);
  canvas.getContext('2d')!.drawImage(image, 0, 0, 512, 512);
  return canvas;
}
