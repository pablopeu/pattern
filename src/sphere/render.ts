/**
 * Render Canvas 2D de la esfera derivada (PRD v3.0 §11.3).
 * Proyección ortográfica, ocultamiento de caras traseras y sombreado lambertiano
 * opcional. En modo artístico la textura plana se muestrea con la proyección
 * inversa por píxel; es una deformación visual, no una simetría esférica.
 */
import { faceNormal, faceColorIndex, type SolidFace } from './geometry';
import type { SphereSettings } from './model';

type Vec3 = [number, number, number];

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(color: string, factor: number): string {
  const [r, g, b] = rgb(color).map((v) =>
    Math.max(0, Math.min(255, Math.round(v * factor))),
  ) as [number, number, number];
  return `rgb(${r} ${g} ${b})`;
}
function rotated(p: Vec3, yawDeg: number, pitchDeg: number): Vec3 {
  const y = (yawDeg * Math.PI) / 180,
    x = (pitchDeg * Math.PI) / 180,
    cy = Math.cos(y),
    sy = Math.sin(y),
    cx = Math.cos(x),
    sx = Math.sin(x),
    x1 = p[0] * cy + p[2] * sy,
    z1 = -p[0] * sy + p[2] * cy,
    y2 = p[1] * cx - z1 * sx,
    z2 = p[1] * sx + z1 * cx;
  return [x1, y2, z2];
}

export interface SphereRenderInput {
  faces: SolidFace[];
  settings: SphereSettings;
  width: number;
  height: number;
  /** Textura plana para el modo artístico (lado cuadrado). */
  texture?: CanvasImageSource | null;
}

/** Dibuja la esfera completa en el contexto dado. Determinístico para igual entrada. */
export function drawSphere(ctx: CanvasRenderingContext2D, input: SphereRenderInput) {
  const { settings, width, height } = input,
    r = (Math.min(width, height) / 2) * 0.92 * settings.view.zoom,
    cx = width / 2,
    cy = height / 2;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = settings.background;
  ctx.fillRect(0, 0, width, height);
  if (settings.mode === 'artistic' && input.texture) {
    drawTextureSphere(ctx, input);
    ctx.restore();
    return;
  }
  const light: Vec3 = [-0.35, 0.45, 0.82],
    normalizer = Math.hypot(...light),
    L: Vec3 = [light[0] / normalizer, light[1] / normalizer, light[2] / normalizer],
    projected = input.faces
      .map((face) => {
        const vs = face.vertices.map((v) => rotated(v, settings.view.yaw, settings.view.pitch)),
          n = faceNormal(face.vertices),
          nr = rotated(n, settings.view.yaw, settings.view.pitch),
          z = vs.reduce((a, v) => a + v[2], 0) / vs.length;
        return { face, vs, nr, z, fill: settings.palette[faceColorIndex(face, settings.palette.length)] };
      })
      .sort((a, b) => a.z - b.z);
  for (const item of projected) {
    // Descarte trasero por vértices: una cara grande puede tener el centro detrás
    // y aún asomar por delante del contorno visible.
    if (item.vs.every((v) => v[2] <= 0)) continue;
    const lambert = Math.max(0, item.nr[0] * L[0] + item.nr[1] * L[1] + item.nr[2] * L[2]),
      fill = settings.lighting ? shade(item.fill, 0.55 + 0.45 * lambert) : item.fill;
    ctx.beginPath();
    item.vs.forEach((v, i) => {
      const x = cx + v[0] * r,
        y = cy - v[1] * r;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (settings.borders) {
      ctx.strokeStyle = 'rgba(20,24,20,0.55)';
      ctx.lineWidth = Math.max(0.4, r * 0.004);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTextureSphere(ctx: CanvasRenderingContext2D, input: SphereRenderInput) {
  const { settings, width, height, texture } = input,
    r = (Math.min(width, height) / 2) * 0.92 * settings.view.zoom,
    cx = width / 2,
    cy = height / 2,
    size = Math.max(1, Math.ceil(r * 2)),
    image = document.createElement('canvas');
  image.width = image.height = size;
  const ictx = image.getContext('2d');
  if (!ictx || !texture) return;
  const out = ictx.createImageData(size, size),
    src = document.createElement('canvas');
  src.width = src.height = 512;
  const sctx = src.getContext('2d');
  if (!sctx) return;
  sctx.drawImage(texture, 0, 0, 512, 512);
  const tex = sctx.getImageData(0, 0, 512, 512).data;
  const light: Vec3 = [-0.35, 0.45, 0.82],
    normalizer = Math.hypot(...light),
    L: Vec3 = [light[0] / normalizer, light[1] / normalizer, light[2] / normalizer];
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5 - size / 2) / (size / 2),
        y = (size / 2 - py - 0.5) / (size / 2),
        d2 = x * x + y * y;
      if (d2 > 1) continue;
      const z = Math.sqrt(1 - d2);
      // Rotación inversa: la esfera gira yaw/pitch respecto de la textura fija.
      const inv = rotated([x, y, z], -settings.view.yaw, -settings.view.pitch),
        lon = Math.atan2(inv[0], inv[2]),
        lat = Math.asin(Math.max(-1, Math.min(1, inv[1]))),
        u = Math.min(511, Math.max(0, Math.floor(((lon + Math.PI) / (2 * Math.PI)) * 512))),
        v = Math.min(511, Math.max(0, Math.floor(((Math.PI / 2 - lat) / Math.PI) * 512))),
        si = (v * 512 + u) * 4,
        lambert = Math.max(0.35, x * L[0] + y * L[1] + z * L[2]),
        k = settings.lighting ? 0.5 + 0.5 * lambert : 1,
        oi = (py * size + px) * 4;
      out.data[oi] = Math.min(255, tex[si] * k);
      out.data[oi + 1] = Math.min(255, tex[si + 1] * k);
      out.data[oi + 2] = Math.min(255, tex[si + 2] * k);
      out.data[oi + 3] = 255;
    }
  ictx.putImageData(out, 0, 0);
  ctx.drawImage(image, cx - size / 2, cy - size / 2);
}
