import { apply, multiply, rotate, translate } from '../geometry/matrix';
import { describe, it, expect } from 'vitest';
import { girihStrands, solveWeave, type Strand } from '../girih/weave';
import { girihRosette, girihGrid, girihStar } from '../girih/patch';
import { weaveRibbons } from '../girih/ribbons';
import { paperPath, scope } from '../geometry/paper';
const line = (id: string, points: [number, number][], closed = false): Strand => ({
  id,
  points: points.map(([x, y]) => ({ x, y })),
  closed,
});
describe('entrelazado topológico y bandas vectoriales', () => {
  it('cruce real opuesto, fase reversible y hueco booleano en la banda inferior', () => {
    const strands = [
        line('a', [
          [-4, 0],
          [4, 0],
        ]),
        line('b', [
          [0, -4],
          [0, 4],
        ]),
      ],
      result = solveWeave(strands),
      flipped = solveWeave(strands, 1);
    expect(result.valid).toBe(true);
    expect(result.crossings).toHaveLength(1);
    const incidences = result.crossings[0].incidences;
    expect(incidences[0].over).not.toBe(incidences[1].over);
    expect(flipped.crossings[0].incidences.map((i) => i.over)).toEqual(
      incidences.map((i) => !i.over),
    );
    const bands = weaveRibbons(strands, result, 0.6, 0.1, ['#884422', '#225588']);
    for (const inc of incidences) {
      const path = paperPath(bands[inc.strand]);
      expect(path.contains(new scope.Point(0, 0))).toBe(inc.over);
      path.remove();
    }
  });
  it('alterna sobre la hebra completa y no confunde tangencias con cruces', () => {
    const result = solveWeave([
      line('a', [
        [-2, 0],
        [2, 0],
      ]),
      ...[-1, 0, 1].map((x, i) =>
        line(`b${i}`, [
          [x, -2],
          [x, 2],
        ]),
      ),
    ]);
    expect(result.valid).toBe(true);
    expect(result.crossings).toHaveLength(3);
    const over = result.crossings
      .map((c) => c.incidences.find((i) => i.strand === 0)!)
      .sort((a, b) => a.arc - b.arc)
      .map((i) => i.over);
    expect(over[0]).not.toBe(over[1]);
    expect(over[1]).not.toBe(over[2]);
    expect(
      solveWeave([
        line('a', [
          [-1, 1],
          [0, 0],
          [1, 1],
        ]),
        line('b', [
          [-1, -1],
          [0, 0],
          [1, -1],
        ]),
      ]).crossings,
    ).toHaveLength(0);
  });
  it('mover y girar conserva la relación de cada cruce sin intercambiar fases', () => {
    const strands = girihStrands(girihGrid(3, 3)),
      matrix = multiply(translate(17, -13), rotate(73)),
      a = solveWeave(strands),
      b = solveWeave(strands.map((s) => ({ ...s, points: s.points.map((p) => apply(matrix, p)) })));
    const signature = (w: ReturnType<typeof solveWeave>) =>
      w.crossings
        .flatMap((c) =>
          c.incidences.map((i) => `${strands[i.strand].id}/${i.arc.toFixed(6)}/${i.over}`),
        )
        .sort();
    expect(signature(a)).toEqual(signature(b));
  });
  it('ciclo impar informa conflicto; sólo el corte explícito permite dibujar la excepción', () => {
    const strands = [
        line(
          'triangle',
          [
            [0, 3],
            [-3, -2],
            [3, -2],
          ],
          true,
        ),
        line('a', [
          [0, 0],
          [0, 5],
        ]),
        line('b', [
          [0, 0],
          [-5, -3],
        ]),
        line('c', [
          [0, 0],
          [5, -3],
        ]),
      ],
      strict = solveWeave(strands),
      cut = solveWeave(strands, 0, true);
    expect(strict.crossings).toHaveLength(3);
    expect(strict.valid).toBe(false);
    expect(strict.conflicts.length).toBeGreaterThan(0);
    expect(cut.valid).toBe(true);
    expect(cut.breaks).toBe(strict.conflicts.length);
    expect(cut.crossings.every((c) => c.incidences[0].over !== c.incidences[1].over)).toBe(true);
  });
  it('autocruce con dos incidencias y cruce triple/solapamiento distinguidos', () => {
    const eight = solveWeave([
      line(
        'eight',
        [
          [-2, -2],
          [2, 2],
          [-2, 2],
          [2, -2],
        ],
        true,
      ),
    ]);
    expect(eight.crossings).toHaveLength(1);
    expect(eight.valid).toBe(true);
    const ribbons = weaveRibbons(
      [
        line(
          'eight',
          [
            [-2, -2],
            [2, 2],
            [-2, 2],
            [2, -2],
          ],
          true,
        ),
      ],
      eight,
      0.4,
      0.1,
      ['#447788'],
    );
    expect(
      ribbons.some((g) => {
        const p = paperPath(g),
          inside = p.contains(new scope.Point(0, 0));
        p.remove();
        return inside;
      }),
    ).toBe(true);
    const triple = solveWeave([
      line('a', [
        [-2, 0],
        [2, 0],
      ]),
      line('b', [
        [0, -2],
        [0, 2],
      ]),
      line('c', [
        [-2, -2],
        [2, 2],
      ]),
    ]);
    expect(triple.valid).toBe(false);
    expect(triple.ambiguous).toHaveLength(1);
    expect(
      solveWeave([
        line('a', [
          [-2, 0],
          [2, 0],
        ]),
        line('b', [
          [-1, 0],
          [1, 0],
        ]),
      ]).overlaps,
    ).toBeGreaterThan(0);
  });
  it('estrella de cinco rombos verifica costuras y cruces', () => {
    const tiles = girihStar(),
      strands = girihStrands(tiles),
      strict = solveWeave(strands),
      cut = solveWeave(strands, 0, true);
    expect(strict.valid).toBe(true);
    expect(strict.crossings).toHaveLength(5);
    expect(cut.valid).toBe(true);
    expect(cut.breaks).toBe(0);
  });
  for (const name of ['rosette', 'grid'] as const)
    it(`${name}: costuras entre teselas y restricciones globales`, () => {
      const strands = girihStrands(name === 'rosette' ? girihRosette() : girihGrid(3, 3)),
        result = solveWeave(strands, 0, true);
      expect(strands.length).toBeGreaterThan(4);
      expect(result.ambiguous).toEqual([]);
      expect(result.overlaps).toBe(0);
      expect(result.crossings.length).toBeGreaterThan(5);
      expect(result.valid).toBe(true);
      expect(result.crossings.every((c) => c.incidences[0].over !== c.incidences[1].over)).toBe(
        true,
      );
    });
});
