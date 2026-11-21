import type { Studio } from '../app/useStudio';
import { createTileFill } from '../fill/service';
import { drawingStyle } from '../app/styles';
import { Field, Toggle } from './Controls';
const defaults = ['#c78046', '#e3c792', '#71978c', '#ab6652', '#253f45', '#c5ccaf'];
export function TileColors({ studio: s }: { studio: Studio }) {
  const tile = s.pattern.tiling!,
    body = s.pattern.sourceGeometry.find((g) => g.fillRegion?.kind === 'tile'),
    palette = tile.colors?.palette ?? [
      body?.fill && body.fill !== 'none' ? body.fill : defaults[0],
      defaults[1],
    ];
  const edit = (fn: (palette: string[]) => void, enabled = tile.colors?.enabled ?? false) =>
    s.change((p) => {
      const pattern = p.patterns.find((p) => p.id === s.patternId)!,
        t = pattern.tiling!;
      t.version = 2;
      t.colors ??= { enabled: false, palette: [...palette] };
      t.colors.enabled = enabled;
      fn(t.colors.palette);
      const existing = pattern.sourceGeometry.find((g) => g.fillRegion?.kind === 'tile');
      if (existing) existing.fill = t.colors.palette[0];
      else if (enabled)
        pattern.sourceGeometry.unshift(
          createTileFill(
            p,
            pattern,
            {
              kind: 'tile',
              key: 'tile',
              patternId: pattern.id,
              pathData: '',
              matrix: [1, 0, 0, 1, 0, 0],
              z: 0,
            },
            drawingStyle({ fill: t.colors.palette[0] }),
          ),
        );
    });
  return (
    <div className="tile-color-controls">
      <Toggle
        label="Alternar colores de tesela"
        checked={tile.colors?.enabled ?? false}
        onChange={(enabled) => edit(() => {}, enabled)}
      />
      <Field
        label="Colores por ciclo"
        integer
        min={2}
        max={6}
        value={palette.length}
        onChange={(count) =>
          edit((colors) => {
            while (colors.length < count) colors.push(defaults[colors.length]);
            colors.length = count;
          })
        }
      />
      <div className="tile-palette">
        {palette.map((color, index) => (
          <label key={index}>
            Color {index + 1}
            <input
              type="color"
              aria-label={`Color de tesela ${index + 1}`}
              value={color}
              onChange={(e) =>
                edit((colors) => {
                  colors[index] = e.target.value;
                })
              }
            />
          </label>
        ))}
      </div>
      <p className="help-text">
        La celda repetible incluye el período de color: {tile.colors?.enabled ? palette.length : 1}{' '}
        × {tile.colors?.enabled ? palette.length : 1} celdas geométricas.
      </p>
    </div>
  );
}
