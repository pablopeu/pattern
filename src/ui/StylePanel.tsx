import { useEffect, useState } from 'react';
import { Pin, X, SlidersHorizontal } from 'lucide-react';
import type { Studio } from '../app/useStudio';
import { uid } from '../app/model';
import {
  defaultDrawingStyle,
  drawingStyle,
  hexColor,
  linePatterns,
  linePatternName,
  mixedStyle,
  profile,
  profileWidth,
  type DrawingStyle,
  type ProfileKind,
  type StyleField,
} from '../app/styles';
import { fromMM, toMM } from '../geometry/matrix';
import { Field, Select, Toggle } from './Controls';

function Paint({
  label,
  value,
  opacity,
  mixed,
  onChange,
}: {
  label: string;
  value: string;
  opacity: number;
  mixed: boolean;
  onChange: (color: string, alpha?: number) => void;
}) {
  const [text, setText] = useState(value),
    [error, setError] = useState('');
  useEffect(() => {
    setText(mixed ? '' : value);
    setError('');
  }, [value, mixed]);
  const accept = () => {
    if (text === value || (mixed && text === '')) return;
    if (text.trim().toLowerCase() === 'none') {
      onChange('none');
      setError('');
      return;
    }
    const parsed = hexColor(text);
    if (!parsed) {
      setError('HEX inválido: usá 3, 4, 6 u 8 dígitos.');
      return;
    }
    onChange(
      parsed.color,
      [4, 8].includes(text.trim().replace(/^#/, '').length) ? parsed.alpha : undefined,
    );
    setText(parsed.color);
    setError('');
  };
  return (
    <div className="paint-control">
      <label>
        {label}
        {mixed && <small> Mixto</small>}
      </label>
      <div className="paint-inputs">
        <input
          type="color"
          aria-label={`Color de ${label.toLowerCase()}`}
          value={hexColor(value)?.color ?? '#233b2d'}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          aria-label={`HEX de ${label.toLowerCase()}`}
          placeholder={mixed ? 'Mixto' : '#RRGGBB'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={accept}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              accept();
              e.currentTarget.blur();
            }
            if (e.key === 'Escape' && text !== value) {
              e.stopPropagation();
              setText(value);
              setError('');
            }
          }}
        />
        <button onClick={() => onChange(value === 'none' ? '#233b2d' : 'none')}>
          {value === 'none' ? 'Activar ' + label.toLowerCase() : 'Sin ' + label.toLowerCase()}
        </button>
      </div>
      {value !== 'none' && opacity < 1 && <small>Alfa {Math.round(opacity * 100)}%</small>}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
export function StyleControls({
  studio: s,
  target = 'selection',
}: {
  studio: Studio;
  target?: 'selection' | 'current';
}) {
  const selected = s.objects.filter((g) => s.selected.includes(g.id)),
    { value: v, mixed } = mixedStyle(
      target === 'selection' ? selected : [],
      s.project.drawingStyle,
    ),
    patch = (p: Partial<DrawingStyle>) => s.applyStyle(p, target),
    u = s.project.documentUnits,
    [dash, setDash] = useState(v.strokeDash.join(' ')),
    [dashError, setDashError] = useState(''),
    [paintTarget, setPaintTarget] = useState<'stroke' | 'fill'>('fill');
  useEffect(() => setDash(v.strokeDash.join(' ')), [JSON.stringify(v.strokeDash)]);
  const numeric = (
    key: StyleField,
    label: string,
    min: number,
    max: number,
    step: number,
    slider = false,
  ) => (
    <div className={mixed.has(key) ? 'style-mixed' : ''} key={key}>
      <Field
        label={label}
        value={v[key] as number}
        min={min}
        max={max}
        step={step}
        slider={slider}
        onChange={(n) => patch({ [key]: n })}
      />
      {mixed.has(key) && <small>Mixto · editar aplica sólo este atributo</small>}
    </div>
  );
  const palette = s.project.palette,
    frequent = [
      '#233b2d',
      '#000000',
      '#ffffff',
      '#ef4444',
      '#f59e0b',
      '#eab308',
      '#22c55e',
      '#06b6d4',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
      '#a16207',
    ];
  const updateProfile = (index: number, changes: Partial<{ at: number; width: number }>) => {
    const p = structuredClone(v.strokeProfile);
    p.kind = 'custom';
    Object.assign(p.points[index], changes);
    patch({ strokeProfile: p });
  };
  return (
    <div className="style-controls">
      <Paint
        label="Trazo"
        value={v.stroke}
        opacity={v.strokeOpacity}
        mixed={mixed.has('stroke')}
        onChange={(stroke, alpha) =>
          patch({ stroke, ...(alpha !== undefined ? { strokeOpacity: alpha } : {}) })
        }
      />
      <div className={mixed.has('strokeWidth') ? 'style-mixed' : ''}>
        <Field
          label="Grosor de trazo"
          value={fromMM(v.strokeWidth, u)}
          unit={u}
          min={0}
          max={fromMM(50, u)}
          step={fromMM(0.1, u)}
          slider
          onChange={(n) => patch({ strokeWidth: toMM(n, u) })}
        />
        {mixed.has('strokeWidth') && <small>Mixto</small>}
      </div>
      {numeric('strokeOpacity', 'Opacidad de trazo', 0, 1, 0.01, true)}
      <Select
        label="Extremos del trazo"
        value={mixed.has('strokeCap') ? 'mixed' : v.strokeCap}
        options={[
          ...(mixed.has('strokeCap') ? [{ value: 'mixed', label: 'Mixto' }] : []),
          { value: 'round', label: 'Redondos' },
          { value: 'butt', label: 'Rectos' },
          { value: 'square', label: 'Cuadrados' },
        ]}
        onChange={(n) => patch({ strokeCap: n as DrawingStyle['strokeCap'] })}
      />
      <Select
        label="Uniones del trazo"
        value={mixed.has('strokeJoin') ? 'mixed' : v.strokeJoin}
        options={[
          ...(mixed.has('strokeJoin') ? [{ value: 'mixed', label: 'Mixto' }] : []),
          { value: 'round', label: 'Redondas' },
          { value: 'miter', label: 'En inglete' },
          { value: 'bevel', label: 'En bisel' },
        ]}
        onChange={(n) => patch({ strokeJoin: n as DrawingStyle['strokeJoin'] })}
      />
      {numeric('miterLimit', 'Límite de inglete', 1, 100, 0.5)}
      <Select
        label="Estilo de línea"
        value={mixed.has('strokeDash') ? 'mixed' : linePatternName(v.strokeDash)}
        options={[
          ...(mixed.has('strokeDash') ? [{ value: 'mixed', label: 'Mixto' }] : []),
          { value: 'solid', label: 'Continua' },
          { value: 'dotted', label: 'Punteada' },
          { value: 'dashed', label: 'Discontinua' },
          { value: 'dashdot', label: 'Guion y punto' },
          { value: 'long', label: 'Guiones largos' },
          { value: 'custom', label: 'Personalizada' },
        ]}
        onChange={(n) => {
          if (n in linePatterns)
            patch({ strokeDash: [...linePatterns[n as keyof typeof linePatterns]] });
          else if (n === 'custom') setDash(v.strokeDash.join(' '));
        }}
      />
      <label className="select-field">
        <span>Secuencia en mm</span>
        <input
          aria-label="Secuencia de guiones"
          value={dash}
          onChange={(e) => setDash(e.target.value)}
          onBlur={() => {
            const parts = dash.trim()
              ? dash
                  .trim()
                  .split(/[ ,;]+/)
                  .map(Number)
              : [];
            if (
              parts.some((n) => !Number.isFinite(n) || n < 0) ||
              parts.length > 64 ||
              (parts.length && parts.reduce((a, b) => a + b, 0) < 0.001)
            ) {
              setDashError('Longitudes no negativas; período mínimo 0,001 mm.');
              return;
            }
            setDashError('');
            patch({ strokeDash: parts });
          }}
        />
      </label>
      {dashError && <small role="alert">{dashError}</small>}
      {numeric('strokeDashOffset', 'Fase de guiones (mm)', -10000, 10000, 0.1)}
      <Select
        label="Perfil de grosor"
        value={mixed.has('strokeProfile') ? 'mixed' : v.strokeProfile.kind}
        options={[
          ...(mixed.has('strokeProfile') ? [{ value: 'mixed', label: 'Mixto' }] : []),
          { value: 'uniform', label: 'Uniforme' },
          { value: 'taper-start', label: 'Afinar inicio' },
          { value: 'taper-end', label: 'Afinar final' },
          { value: 'taper-both', label: 'Afinar extremos' },
          { value: 'custom', label: 'Personalizado' },
        ]}
        onChange={(n) =>
          patch({
            strokeProfile:
              n === 'custom' ? { ...v.strokeProfile, kind: 'custom' } : profile(n as ProfileKind),
          })
        }
      />
      <svg
        className="profile-preview"
        viewBox="0 0 240 70"
        role="img"
        aria-label="Curva del perfil de grosor"
      >
        <path
          d={
            'M0 35 ' +
            Array.from(
              { length: 121 },
              (_, i) => `L${i * 2} ${35 - profileWidth(v.strokeProfile, i / 120) * 8}`,
            ).join(' ') +
            ' ' +
            Array.from(
              { length: 121 },
              (_, i) => `L${240 - i * 2} ${35 + profileWidth(v.strokeProfile, 1 - i / 120) * 8}`,
            ).join(' ') +
            ' Z'
          }
          fill="#55765b"
        />
        <path d="M0 35H240" stroke="#b3c5b5" strokeDasharray="3 3" />
        {v.strokeProfile.points.map((p, i) => (
          <circle
            key={i}
            cx={p.at * 240}
            cy={35 - p.width * 8}
            r="4"
            fill="#233b2d"
            tabIndex={0}
            role="slider"
            aria-label={`Control de perfil ${i + 1}`}
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={p.width}
            style={{ cursor: 'grab', touchAction: 'none' }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              s.beginGesture();
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const svg = e.currentTarget.ownerSVGElement!,
                ctm = svg.getScreenCTM();
              if (!ctm) return;
              const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
              const at =
                i === 0
                  ? 0
                  : i === v.strokeProfile.points.length - 1
                    ? 1
                    : Math.max(
                        v.strokeProfile.points[i - 1].at + 0.001,
                        Math.min(v.strokeProfile.points[i + 1].at - 0.001, q.x / 240),
                      );
              updateProfile(i, { at, width: Math.max(0, Math.min(4, (35 - q.y) / 8)) });
            }}
            onPointerUp={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
              s.endGesture();
            }}
            onPointerCancel={() => s.endGesture()}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                updateProfile(i, {
                  width: Math.max(0, Math.min(4, p.width + (e.key === 'ArrowUp' ? 0.05 : -0.05))),
                });
              }
            }}
          />
        ))}
      </svg>
      {v.strokeProfile.kind === 'custom' && (
        <div className="profile-points">
          {v.strokeProfile.points.map((p, i) => (
            <div key={i}>
              <Field
                label={`Posición ${i + 1}`}
                value={p.at}
                min={i === 0 ? 0 : v.strokeProfile.points[i - 1].at + 0.001}
                max={
                  i === v.strokeProfile.points.length - 1
                    ? 1
                    : v.strokeProfile.points[i + 1].at - 0.001
                }
                step={0.01}
                onChange={(at) => {
                  if (i > 0 && i < v.strokeProfile.points.length - 1) updateProfile(i, { at });
                }}
              />
              <Field
                label={`Ancho ${i + 1}`}
                value={p.width}
                min={0}
                max={4}
                step={0.05}
                onChange={(width) => updateProfile(i, { width })}
              />
              {i > 0 && i < v.strokeProfile.points.length - 1 && (
                <button
                  aria-label={`Eliminar punto ${i + 1}`}
                  onClick={() =>
                    patch({
                      strokeProfile: {
                        ...v.strokeProfile,
                        points: v.strokeProfile.points.filter((_, k) => k !== i),
                      },
                    })
                  }
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => {
              const p = structuredClone(v.strokeProfile);
              if (p.points.length >= 64) return;
              let k = 0;
              for (let i = 1; i < p.points.length - 1; i++)
                if (p.points[i + 1].at - p.points[i].at > p.points[k + 1].at - p.points[k].at)
                  k = i;
              const at = (p.points[k].at + p.points[k + 1].at) / 2;
              p.points.splice(k + 1, 0, { at, width: profileWidth(p, at) });
              patch({ strokeProfile: p });
            }}
          >
            Agregar punto al perfil
          </button>
        </div>
      )}
      <hr />
      <Paint
        label="Relleno"
        value={v.fill}
        opacity={v.fillOpacity}
        mixed={mixed.has('fill')}
        onChange={(fill, alpha) =>
          patch({ fill, ...(alpha !== undefined ? { fillOpacity: alpha } : {}) })
        }
      />
      {numeric('fillOpacity', 'Opacidad de relleno', 0, 1, 0.01, true)}
      <Select
        label="Regla de relleno"
        value={mixed.has('fillRule') ? 'mixed' : v.fillRule}
        options={[
          ...(mixed.has('fillRule') ? [{ value: 'mixed', label: 'Mixto' }] : []),
          { value: 'evenodd', label: 'Par / impar (huecos)' },
          { value: 'nonzero', label: 'No cero (orientación)' },
        ]}
        onChange={(fillRule) => patch({ fillRule: fillRule as DrawingStyle['fillRule'] })}
      />
      {numeric('opacity', 'Opacidad', 0, 1, 0.01, true)}
      <div className="button-row">
        <button
          onClick={() =>
            patch({
              stroke: v.fill,
              fill: v.stroke,
              strokeOpacity: v.fillOpacity,
              fillOpacity: v.strokeOpacity,
            })
          }
        >
          Intercambiar trazo y relleno
        </button>
        <button onClick={() => patch(defaultDrawingStyle())}>Restablecer estilo</button>
      </div>
      <hr />
      <Select
        label="Aplicar color de paleta a"
        value={paintTarget}
        options={[
          { value: 'stroke', label: 'Trazo' },
          { value: 'fill', label: 'Relleno' },
        ]}
        onChange={(n) => setPaintTarget(n as 'stroke' | 'fill')}
      />
      {[
        ['Frecuentes', frequent],
        ['Recientes', palette.recent],
        ['Favoritos', palette.favorites],
        ['Proyecto', palette.colors],
      ].map(([name, colors]) => (
        <div key={name as string} className="palette-group">
          <small>{name}</small>
          <div className="palette-swatches">
            {(colors as string[]).map((color) => (
              <button
                key={color}
                title={color}
                aria-label={`${name} ${color}`}
                style={{ background: color }}
                onClick={() => patch({ [paintTarget]: color })}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="button-row">
        {(['favorites', 'colors'] as const).map((key) => (
          <button
            key={key}
            disabled={v[paintTarget] === 'none'}
            onClick={() =>
              s.change((p) => {
                const color = hexColor(v[paintTarget])?.color;
                if (!color) return;
                const list = p.palette[key];
                if (list.includes(color)) p.palette[key] = list.filter((c) => c !== color);
                else p.palette[key] = [...list, color].slice(-(key === 'colors' ? 128 : 64));
              })
            }
          >
            {palette[key].includes(v[paintTarget]) ? 'Quitar de' : 'Agregar a'}{' '}
            {key === 'colors' ? 'proyecto' : 'favoritos'}
          </button>
        ))}
      </div>
    </div>
  );
}
export function StyleIndicator({ studio: s }: { studio: Studio }) {
  const { value: v, mixed } = s.styleContext;
  return (
    <button
      className="style-indicator"
      aria-label="Abrir panel de estilos"
      aria-expanded={s.styleOpen}
      onClick={() => s.setStyleOpen(!s.styleOpen)}
      title="Estilo vigente o selección · abrir panel derecho"
    >
      <SlidersHorizontal size={15} />
      <span
        className="style-chip"
        title={mixed.has('stroke') ? 'Trazo mixto' : v.stroke === 'none' ? 'Sin trazo' : v.stroke}
        style={{
          background: mixed.has('stroke')
            ? 'repeating-linear-gradient(45deg,#eee 0 3px,#888 3px 6px)'
            : v.stroke === 'none'
              ? 'linear-gradient(135deg,transparent 45%,#a35454 46% 54%,transparent 55%)'
              : v.stroke,
        }}
      />
      <span>
        {mixed.has('strokeWidth')
          ? 'Mixto'
          : `${Number(fromMM(v.strokeWidth, s.project.documentUnits).toFixed(2))} ${s.project.documentUnits}`}
      </span>
      <span
        className="style-chip"
        title={mixed.has('fill') ? 'Relleno mixto' : v.fill === 'none' ? 'Sin relleno' : v.fill}
        style={{
          background: mixed.has('fill')
            ? 'repeating-linear-gradient(45deg,#eee 0 3px,#888 3px 6px)'
            : v.fill === 'none'
              ? 'linear-gradient(135deg,transparent 45%,#a35454 46% 54%,transparent 55%)'
              : v.fill,
        }}
      />
      <span aria-label="Patrón de línea vigente">
        {mixed.has('strokeDash')
          ? '?'
          : { solid: '—', dotted: '···', dashed: '– –', dashdot: '–·', long: '──', custom: '≋' }[
              linePatternName(v.strokeDash)
            ]}
      </span>
      {mixed.size > 0 && <small>Mixto</small>}
      <span className="indicator-detail">
        {mixed.size
          ? 'Mixto'
          : {
              solid: 'Continua',
              dotted: 'Puntos',
              dashed: 'Guiones',
              dashdot: 'Guion y punto',
              long: 'Largos',
              custom: 'Personalizada',
            }[linePatternName(v.strokeDash)]}{' '}
        · {s.styleTarget === 'selection' && s.styleSelection.length ? 'Selección' : 'Vigente'}
      </span>
    </button>
  );
}
export function StylePanel({ studio: s }: { studio: Studio }) {
  const [name, setName] = useState(''),
    [presetId, setPresetId] = useState('');
  const preset = s.project.stylePresets.find((p) => p.id === presetId),
    { value, mixed } = s.styleContext;
  useEffect(() => {
    if (!s.styleOpen) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        s.setStyleOpen(false);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [s.styleOpen]);
  if (!s.styleOpen) return null;
  return (
    <aside className="style-panel" aria-label="Panel de estilos">
      <header>
        <strong>Estilos</strong>
        <div className="panel-style-summary">
          <StyleIndicator studio={s} />
        </div>
        <button
          aria-label="Fijar panel de estilos"
          aria-pressed={s.project.preferences.stylePanelPinned}
          className={s.project.preferences.stylePanelPinned ? 'active' : ''}
          onClick={() =>
            s.updateViewPreferences({ stylePanelPinned: !s.project.preferences.stylePanelPinned })
          }
        >
          <Pin size={17} />
        </button>
        <button aria-label="Cerrar panel de estilos" onClick={() => s.setStyleOpen(false)}>
          <X size={18} />
        </button>
      </header>
      <div className="style-panel-body">
        <Select
          label="Editar estilo de"
          value={s.styleTarget}
          options={[
            {
              value: 'selection',
              label: s.styleSelection.length
                ? `Selección (${s.styleSelection.length})`
                : 'Vigente (sin selección)',
            },
            { value: 'current', label: 'Vigente · nuevos objetos' },
          ]}
          onChange={(v) => s.setStyleTarget(v as 'selection' | 'current')}
        />
        <Toggle
          label="Edición de selección actualiza estilo vigente"
          checked={s.project.preferences.styleDefaultsFollowSelection}
          onChange={(v) => s.updateViewPreferences({ styleDefaultsFollowSelection: v })}
        />
        {!!mixed.size && (
          <p className="style-note">
            Selección mixta. Cada control modifica únicamente su atributo.
          </p>
        )}
        <StyleControls studio={s} target={s.styleTarget} />
        <hr />
        <strong>Fill · caras vectoriales</strong>
        <Toggle
          label="Nuevos rellenos vinculados a sus límites"
          checked={s.project.preferences.fillLinkedDefault}
          onChange={(v) => s.updateViewPreferences({ fillLinkedDefault: v })}
        />
        <Field
          label="Tolerancia de cierre de Fill"
          unit="mm"
          value={s.project.preferences.fillCloseTolerance}
          min={0}
          max={5}
          step={0.01}
          onChange={(v) => s.updateViewPreferences({ fillCloseTolerance: v })}
        />
        <small>
          {s.project.preferences.fillCloseTolerance > 0
            ? 'Cierre aproximado explícito. No modifica los límites originales.'
            : 'Cierre exacto: tolerancia numérica de 0,000001 mm.'}
        </small>
        {s.styleSelection
          .filter((g) => g.fillRegion)
          .map((g) => (
            <div className="style-note" key={g.id}>
              <strong>{g.name}</strong>
              <p>
                {g.fillRegion!.scope === 'orbit'
                  ? `Órbita concreta · ${g.fillRegion!.orbitMatrices.length} copias`
                  : g.fillRegion!.scope === 'tile'
                    ? 'Interior de tesela'
                    : 'Fuente canónica'}{' '}
                ·{' '}
                {g.fillRegion!.status === 'stale'
                  ? 'Vínculo desactualizado'
                  : g.fillRegion!.linked
                    ? 'Vinculado'
                    : 'Fijo'}
              </p>
              {g.fillRegion!.reason && <p>{g.fillRegion!.reason}</p>}
              <div className="button-row">
                <button
                  disabled={g.locked || !!s.recalculatingId}
                  onClick={() => s.recalculateFill(g.id)}
                >
                  Recalcular y vincular región
                </button>
                {s.recalculatingId === g.id && (
                  <button onClick={s.cancelRecalculation}>Cancelar actualización</button>
                )}
              </div>
              <Toggle
                label={`Vincular ${g.name}`}
                checked={g.fillRegion!.linked}
                onChange={(linked) =>
                  s.change((p) => {
                    const shape = p.patterns
                      .flatMap((p) => p.sourceGeometry)
                      .find((x) => x.id === g.id);
                    if (shape?.fillRegion) {
                      shape.fillRegion.linked = linked;
                      shape.fillRegion.status = linked ? 'linked' : 'fixed';
                      shape.fillRegion.reason = linked
                        ? undefined
                        : 'Contorno fijado explícitamente.';
                    }
                  })
                }
              />
            </div>
          ))}

        <hr />
        <strong>Presets de estilo</strong>
        <Select
          label="Preset de estilo"
          value={presetId}
          options={[
            { value: '', label: 'Elegir preset' },
            ...s.project.stylePresets.map((p) => ({ value: p.id, label: p.name })),
          ]}
          onChange={(id) => {
            setPresetId(id);
            setName(s.project.stylePresets.find((p) => p.id === id)?.name ?? '');
          }}
        />
        <input
          aria-label="Nombre del preset de estilo"
          value={name}
          maxLength={120}
          placeholder="Nombre del estilo"
          onChange={(e) => setName(e.target.value)}
        />
        <div className="button-row">
          <button
            disabled={!name.trim() || mixed.size > 0 || s.project.stylePresets.length >= 128}
            onClick={() => {
              const id = uid();
              s.change((p) =>
                p.stylePresets.push({ id, name: name.trim(), style: drawingStyle(value) }),
              );
              setPresetId(id);
            }}
          >
            Guardar nuevo
          </button>
          <button
            disabled={!preset}
            onClick={() => preset && s.applyStyle(drawingStyle(preset.style))}
          >
            Aplicar preset
          </button>
          <button
            disabled={!preset || !name.trim()}
            onClick={() =>
              s.change((p) => {
                const v = p.stylePresets.find((p) => p.id === presetId);
                if (v) v.name = name.trim();
              })
            }
          >
            Renombrar
          </button>
          <button
            disabled={!preset || s.project.stylePresets.length >= 128}
            onClick={() => {
              if (!preset) return;
              const id = uid();
              s.change((p) =>
                p.stylePresets.push({
                  ...structuredClone(preset),
                  id,
                  name: (preset.name + ' copia').slice(0, 120),
                }),
              );
              setPresetId(id);
              setName((preset.name + ' copia').slice(0, 120));
            }}
          >
            Duplicar preset
          </button>
          <button
            disabled={!preset || mixed.size > 0}
            onClick={() =>
              s.change((p) => {
                const v = p.stylePresets.find((p) => p.id === presetId);
                if (v) v.style = drawingStyle(value);
              })
            }
          >
            Actualizar valores
          </button>
          <button
            disabled={!preset}
            onClick={() => {
              s.change((p) => {
                p.stylePresets = p.stylePresets.filter((p) => p.id !== presetId);
              });
              setPresetId('');
            }}
          >
            Eliminar preset
          </button>
        </div>
      </div>
    </aside>
  );
}
