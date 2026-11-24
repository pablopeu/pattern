/**
 * Miniatura de publicación 1200×630 (PRD v3.1 §7).
 * Se genera en el navegador con los renderizadores existentes: euclidiano,
 * hiperbólico, esférico y artístico; nunca se suben capturas del editor.
 */
import type { Project } from '../app/model';
import type { Visualization } from '../visualization/model';
import { geodesicFaces } from '../sphere/geometry';
import { themedBackground } from '../app/experience';
import { drawSphere } from '../sphere/render';

const WIDTH = 1200,
  HEIGHT = 630;

function canvasOf(width = WIDTH, height = HEIGHT) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function svgImage(svg: string) {
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

export interface SharePreview {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Dibuja la creación tal como el usuario la estaba viendo, encuadrada en 1200×630.
 * Si el contenido no cabe en 100 KiB, escala progresivamente conservando el
 * aspecto; si aun así no cabe, devuelve null y se publica con la tarjeta genérica.
 */
export async function renderSharePreview(project: Project): Promise<SharePreview | null> {
  const visualization: Visualization | undefined = project.visualization,
    background = themedBackground(project.preferences.background ?? '#f7f3e8');
  for (const scale of [1, 0.875, 0.75, 0.625, 0.5]) {
    const width = Math.round(1200 * scale),
      height = Math.round(630 * scale),
      canvas = canvasOf(width, height),
      ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Canvas no disponible.');
    await drawCreation(ctx, width, height, visualization, project, background);
    const dataUrl = encodeBudget(canvas);
    if (dataUrl) return { dataUrl, width, height };
  }
  return null;
}

async function drawCreation(
  ctx: CanvasRenderingContext2D,
  WIDTH: number,
  HEIGHT: number,
  visualization: Visualization | undefined,
  project: Project,
  background: string,
) {
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (visualization?.kind === 'sphere') {
    const settings = structuredClone(visualization.settings),
      texture = await sphereTexture(project, visualization);
    drawSphere(ctx, {
      faces: geodesicFaces(settings.solid, settings.level),
      settings,
      width: WIDTH,
      height: HEIGHT,
      texture,
    });
  } else if (visualization) {
    const { deriveVisualizationInWorker } = await import('../visualization/worker-client.ts'),
      { svg } = await deriveVisualizationInWorker(project, visualization),
      image = await svgImage(svg);
    const scale = Math.min(WIDTH / image.width, HEIGHT / image.height) * 0.92;
    ctx.drawImage(
      image,
      (WIDTH - image.width * scale) / 2,
      (HEIGHT - image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
  } else {
    const { prepareExport } = await import('../export/svg.ts'),
      pattern = project.patterns[0],
      { svg } = prepareExport(project, {
        target: 'view',
        format: 'svg',
        representation: 'editable',
        width: 300,
        height: 300,
        dpi: 96,
        background,
        transparent: false,
        quality: 0.95,
        tolerance: 0.02,
        outlineStrokes: false,
        patternId: pattern.id,
      }),
      image = await svgImage(svg);
    const scale = Math.min(WIDTH / image.width, HEIGHT / image.height) * 0.92;
    ctx.drawImage(
      image,
      (WIDTH - image.width * scale) / 2,
      (HEIGHT - image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
  }
  // Marca discreta y nombre del estudio, escalados con la miniatura.
  const unit = WIDTH / 1200;
  ctx.fillStyle = 'rgba(20,26,20,0.78)';
  ctx.font = `600 ${Math.round(26 * unit)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('Patterns', Math.round(36 * unit), HEIGHT - Math.round(34 * unit));
  const name = project.metadata.name.trim();
  if (name) {
    ctx.textAlign = 'right';
    ctx.font = `500 ${Math.round(22 * unit)}px system-ui, sans-serif`;
    ctx.fillText(name.slice(0, 60), WIDTH - Math.round(36 * unit), HEIGHT - Math.round(34 * unit));
  }
}

async function sphereTexture(project: Project, visualization: Visualization) {
  if (visualization.kind !== 'sphere' || visualization.settings.mode !== 'artistic') return null;
  const { prepareExport } = await import('../export/svg.ts'),
    pattern =
      project.patterns.find((p) => p.id === visualization.source.patternId) ?? project.patterns[0],
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
    image = await svgImage(svg),
    canvas = canvasOf(512, 512);
  canvas.getContext('2d')!.drawImage(image, 0, 0, 512, 512);
  return canvas;
}

/** Ajusta la calidad JPEG para quedar dentro de 100 KiB (PRD §7.2). */
function encodeBudget(canvas: HTMLCanvasElement): string | null {
  for (const quality of [0.84, 0.72, 0.6, 0.5, 0.42, 0.35]) {
    const url = canvas.toDataURL('image/jpeg', quality),
      bytes = Math.ceil((url.length - url.indexOf(',') - 1) * 0.75);
    if (bytes <= 100 * 1024) return url;
  }
  return null;
}
