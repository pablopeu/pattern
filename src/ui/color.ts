export function hsvHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return '#' + f(5) + f(3) + f(1);
}
export function hexHSV(hex: string): { h: number; s: number; v: number } {
  const raw = /^#[\da-f]{6}$/i.test(hex) ? hex : '#3b82f6',
    [r, g, b] = [1, 3, 5].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255),
    hi = Math.max(r, g, b),
    lo = Math.min(r, g, b),
    d = hi - lo;
  let h = d === 0 ? 0 : hi === r ? ((g - b) / d) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s: hi ? d / hi : 0, v: hi };
}
