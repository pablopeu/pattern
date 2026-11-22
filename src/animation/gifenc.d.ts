/** Tipos mínimos para gifenc (MIT), usado solo en la exportación GIF del cliente. */
declare module 'gifenc' {
  export interface GifFrameOptions {
    palette?: number[][];
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    dispose?: number;
  }
  export interface GifEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, options?: GifFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
    bytesView(): Uint8Array<ArrayBuffer>;
  }
  export function GIFEncoder(options?: { auto?: boolean }): GifEncoderInstance;
  export function quantize(
    rgba: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): number[][];
  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: number[][],
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;
}
