/**
 * Miniatura de publicación 1200×630 (PRD v3.1 §7).
 * Se genera en el navegador con los renderizadores existentes: euclidiano,
 * hiperbólico, esférico y artístico; nunca se suben capturas del editor.
 */
import type { Project } from '../app/model';
import type { Visualization } from '../visualization/model';
import { geodesicFaces } from '../sphere/geometry';
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

/** Dibuja la creación tal como el usuario la estaba viendo, encuadrada en 1200×630. */
export async function renderSharePreview(project: Project): Promise<string> {
  const visualization: Visualization | undefined = project.visualization,
    background = project.preferences.background ?? '#f7f3e8',
    canvas = canvasOf(),
    ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Canvas no disponible.');
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
  // Marca discreta y nombre del estudio.
  ctx.fillStyle = 'rgba(20,26,20,0.78)';
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Patterns', 36, HEIGHT - 34);
  const name = project.metadata.name.trim();
  if (name) {
    ctx.textAlign = 'right';
    ctx.font = '500 22px system-ui, sans-serif';
    ctx.fillText(name.slice(0, 60), WIDTH - 36, HEIGHT - 34);
  }
  return encodeBudget(canvas);
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
function encodeBudget(canvas: HTMLCanvasElement): string {
  for (const quality of [0.84, 0.72, 0.6, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', quality),
      bytes = Math.ceil((url.length - url.indexOf(',') - 1) * 0.75);
    if (bytes <= 100 * 1024) return url;
  }
  throw Error('No se pudo generar una miniatura dentro de 100 KiB.');
}
