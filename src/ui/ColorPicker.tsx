import { useEffect, useRef, useState } from 'react';
import { hexHSV, hsvHex } from './color';
import { tr } from '../i18n';
export function ColorPicker({
  value,
  onChange,
  onStart,
  onEnd,
}: {
  value: string;
  onChange: (color: string) => void;
  onStart: () => void;
  onEnd: () => void;
}) {
  const hsv = hexHSV(value),
    [hue, setHue] = useState(hsv.h),
    ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hsv.s > 0) setHue(hsv.h);
  }, [hsv.h, hsv.s]);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  const pick = (x: number, y: number) => {
    const r = ref.current!.getBoundingClientRect();
    onChange(
      hsvHex(
        hue,
        Math.max(0, Math.min(1, (x - r.left) / r.width)),
        Math.max(0, Math.min(1, 1 - (y - r.top) / r.height)),
      ),
    );
  };
  return (
    <div className="inline-color-picker">
      <div
        ref={ref}
        className="color-plane"
        role="slider"
        tabIndex={0}
        aria-label={tr('Selector de relleno')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`Saturación ${Math.round(hsv.s * 100)}%, brillo ${Math.round(hsv.v * 100)}%`}
        style={{
          background: `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hue} 100% 50%))`,
        }}
        onPointerDown={(e) => {
          e.currentTarget.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          onStart();
          pick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
            onEnd();
          }
        }}
        onPointerCancel={onEnd}
        onKeyDown={(e) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
          e.preventDefault();
          onChange(
            hsvHex(
              hue,
              Math.max(
                0,
                Math.min(
                  1,
                  hsv.s + (e.key === 'ArrowRight' ? 0.02 : e.key === 'ArrowLeft' ? -0.02 : 0),
                ),
              ),
              Math.max(
                0,
                Math.min(
                  1,
                  hsv.v + (e.key === 'ArrowUp' ? 0.02 : e.key === 'ArrowDown' ? -0.02 : 0),
                ),
              ),
            ),
          );
        }}
      >
        <span
          className="color-position"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <input
        type="range"
        className="color-hue"
        aria-label={tr('Tono de relleno')}
        min={0}
        max={359}
        step={1}
        value={Math.round(hue)}
        onChange={(e) => {
          const h = Number(e.target.value);
          setHue(h);
          onChange(hsvHex(h, hsv.s, hsv.v));
        }}
      />
    </div>
  );
}
