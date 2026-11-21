import { finiteGenerator } from '../aperiodic/model';
import { useRef, type PointerEvent } from 'react';
import type { Studio } from '../app/useStudio';
import { tileFrame, edgeFrame, tileEdges, isohedralDefinition } from './tiles';
import { isohedralConstraints, isohedralLayout } from '../isohedral/engine';
import { apply, inverse, multiply, matrixString, type Point } from '../geometry/matrix';
import { pathData } from '../geometry/paths';
import { geometry } from '../app/model';
export function TileEditor({ studio: s, scale }: { studio: Studio; scale: number }) {
  const drag = useRef<{ edge: number; index: number; handle: 'node' | 'in' | 'out' } | null>(null),
    t = s.pattern.tiling;
  if (!t || !s.tileEditing || s.mode === 'apply' || finiteGenerator(s.pattern.generator))
    return null;
  const constraints = t.isohedral ? isohedralConstraints(isohedralDefinition(t)) : [],
    parts = t.isohedral ? isohedralLayout(isohedralDefinition(t), t.width).parts : [],
    frame = tileFrame(t),
    point = (e: PointerEvent<SVGElement>): Point => {
      const svg = e.currentTarget.ownerSVGElement!;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
      return { x: p.x, y: p.y };
    };
  const start = (
    e: PointerEvent<SVGElement>,
    edge: number,
    index: number,
    handle: 'node' | 'in' | 'out',
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { edge, index, handle };
    s.setTileEdge(edge);
    s.setTileNode(index);
  };
  const move = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const q = apply(inverse(multiply(frame, edgeFrame(t, d.edge))), point(e));
    s.editTiling((tile) => {
      const n = tile.edges[d.edge][d.index];
      if (d.handle === 'node') {
        n.x = q.x;
        n.y = q.y;
      } else n[d.handle] = { x: q.x - n.x, y: q.y - n.y };
    }, true);
  };
  const end = (e: PointerEvent<SVGGElement>) => {
    if (!drag.current) return;
    e.stopPropagation();
    drag.current = null;
    s.commit();
  };
  return (
    <g
      data-tile-editor="true"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {tileEdges(t).map((nodes, i) => (
        <path
          key={i}
          d={pathData({ ...geometry('path', nodes), transform: frame })}
          transform={matrixString(frame)}
          fill="none"
          stroke={(parts[i]?.master ?? i) === s.tileEdge ? '#ba884c' : '#9cae9e'}
          strokeWidth={(parts[i]?.master ?? i) === s.tileEdge ? 2 : 1}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ))}
      {t.edges.map((edge, e) => {
        if (constraints[e] === 'straight') return null;
        const m = multiply(frame, edgeFrame(t, e));
        return edge.map((n, i) => {
          const p = apply(m, n),
            selected = e === s.tileEdge && i === s.tileNode,
            endpoint = i === 0 || (i === edge.length - 1 && constraints[e] !== 'mirror');
          return (
            <g key={`${e}-${i}`}>
              {selected &&
                (['in', 'out'] as const)
                  .filter(
                    (h) => !(h === 'in' && i === 0) && !(h === 'out' && i === edge.length - 1),
                  )
                  .map((h) => {
                    const v = n[h],
                      ghost = Math.hypot(v.x, v.y) < 1e-8,
                      local = {
                        x: n.x + (ghost ? (h === 'in' ? -0.08 : 0.08) : v.x),
                        y: n.y + (ghost ? 0 : v.y),
                      },
                      q = apply(m, local);
                    return (
                      <g key={h}>
                        <line
                          x1={p.x}
                          y1={p.y}
                          x2={q.x}
                          y2={q.y}
                          stroke="#b99969"
                          strokeWidth={1 / scale}
                          pointerEvents="none"
                        />
                        <circle
                          aria-label={`Tangente ${h} de borde ${e + 1}.${i + 1}`}
                          cx={q.x}
                          cy={q.y}
                          r={3.5 / scale}
                          stroke="#b28a4f"
                          fill={ghost ? '#fff9ed' : '#d4b37e'}
                          strokeWidth={1 / scale}
                          onPointerDown={(event) => start(event, e, i, h)}
                        />
                      </g>
                    );
                  })}
              <rect
                aria-label={`Nodo de borde ${e + 1}.${i + 1}`}
                x={p.x - 3.5 / scale}
                y={p.y - 3.5 / scale}
                width={7 / scale}
                height={7 / scale}
                fill={selected ? '#d3a45a' : endpoint ? '#dee7d7' : '#fffcf5'}
                stroke="#9f7b43"
                strokeWidth={1 / scale}
                onPointerDown={(event) => {
                  if (endpoint) {
                    event.stopPropagation();
                    s.setTileEdge(e);
                    s.setTileNode(i);
                  } else start(event, e, i, 'node');
                }}
              />
            </g>
          );
        });
      })}
    </g>
  );
}
