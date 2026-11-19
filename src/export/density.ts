/** Physical density metadata for browser-generated PNG/JPEG files. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function u32(value: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, value);
  return b;
}
function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let index = 0;
  for (const p of parts) {
    out.set(p, index);
    index += p.length;
  }
  return out;
}
export function pngDensity(bytes: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  const meter = Math.round(dpi / 0.0254),
    data = concat([new TextEncoder().encode('pHYs'), u32(meter), u32(meter), new Uint8Array([1])]),
    chunk = concat([u32(9), data, u32(crc32(data))]);
  const parts = [bytes.slice(0, 8)];
  let offset = 8,
    inserted = false;
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0),
      type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    if (type === 'IDAT' && !inserted) {
      parts.push(chunk);
      inserted = true;
    }
    if (type !== 'pHYs') parts.push(bytes.slice(offset, offset + length + 12));
    offset += length + 12;
  }
  return concat(parts);
}
export function jpegDensity(bytes: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes);
  let offset = 2;
  while (offset + 4 < out.length && out[offset] === 0xff) {
    const marker = out[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = (out[offset + 2] << 8) | out[offset + 3];
    if (
      marker === 0xe0 &&
      new TextDecoder().decode(out.slice(offset + 4, offset + 9)) === 'JFIF\0'
    ) {
      out[offset + 11] = 1;
      out[offset + 12] = (dpi >> 8) & 255;
      out[offset + 13] = dpi & 255;
      out[offset + 14] = (dpi >> 8) & 255;
      out[offset + 15] = dpi & 255;
      return out;
    }
    offset += length + 2;
  }
  // Valid standalone JFIF APP0 when the browser encoder omitted a JFIF header.
  const density = Math.round(dpi);
  return concat([
    out.slice(0, 2),
    new Uint8Array([
      255,
      224,
      0,
      16,
      74,
      70,
      73,
      70,
      0,
      1,
      1,
      1,
      density >> 8,
      density & 255,
      density >> 8,
      density & 255,
      0,
      0,
    ]),
    out.slice(2),
  ]);
}
