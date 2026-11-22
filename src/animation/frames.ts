/**
 * Evaluación de cuadros de animación (PRD v3.0 §13.4, §14.1).
 * Cada cuadro se dibuja desde su tiempo normalizado; nada se acumula.
 */
import { drawSphere } from '../sphere/render';
import { geodesicFaces, type SolidFace } from '../sphere/geometry';
import type { SphereSettings } from '../sphere/model';
import { directionalAngle, frameState, type AnimationPreset } from './model';

export interface FrameAssets {
  /** Disco de Poincaré o disco artístico ya rasterizado (se rota por cuadro). */
  disk?: HTMLCanvasElement | null;
  faces?: SolidFace[];
  texture?: CanvasImageSource | null;
  recursive?: (level: number) => Promise<HTMLCanvasElement | null>;
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Dibuja el cuadro t∈[0,1] del preset sobre un canvas 2D. */
export async function drawAnimationFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  preset: AnimationPreset,
  t: number,
  direction: 1 | -1,
  assets: FrameAssets,
  sphere: SphereSettings | null,
  background: string,
  maxLevel = 4,
): Promise<void> {
  const state = frameState(preset, t, maxLevel);
  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  if (preset === 'disk-spin' || preset === 'artistic-spin') {
    if (assets.disk) {
      ctx.translate(width / 2, height / 2);
      ctx.rotate((directionalAngle(state, direction) * Math.PI) / 180);
      const size = Math.min(width, height);
      ctx.drawImage(assets.disk, -size / 2, -size / 2, size, size);
    }
  } else if (preset === 'sphere-spin' || preset === 'sphere-tilt') {
    if (sphere) {
      const base = structuredClone(sphere);
      base.background = background;
      if (preset === 'sphere-spin')
        base.view.yaw = base.view.yaw + directionalAngle(state, direction);
      else base.view.pitch = Math.max(-89, Math.min(89, base.view.pitch + state.pitch));
      drawSphere(ctx, {
        faces: assets.faces ?? geodesicFaces(base.solid, base.level),
        settings: base,
        width,
        height,
        texture: assets.texture ?? null,
      });
    }
  } else if (preset === 'recursive-levels' && assets.recursive) {
    const image = await assets.recursive(state.level);
    if (image) {
      const scale = Math.min(width / image.width, height / image.height);
      ctx.drawImage(
        image,
        (width - image.width * scale) / 2,
        (height - image.height * scale) / 2,
        image.width * scale,
        image.height * scale,
      );
    }
  }
  ctx.restore();
}
