import {
  apply,
  linearScaleBound,
  multiply,
  rotate,
  scale,
  translate,
  type Matrix,
} from '../geometry/matrix';
import type { Bounds } from '../symmetry/groups';
import type { Composition, CompositionNode, CompositionReport } from './model';
import {
  affinePower,
  cycle,
  flip,
  motif,
  over,
  quartet,
  scaled,
  shifted,
  transform,
  turn,
} from './functional';

export const MAX_COMPOSITION_INSTANCES = 4096;
const MAX_NODES = 60000;
const square = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

export function compositionIssue(c: Composition): string | null {
  const finite = (v: number) => Number.isFinite(v);
  if (c.version !== 1 || !['recursive', 'spiral'].includes(c.kind))
    return 'Composición no compatible.';
  if (
    ![
      c.size,
      c.minSize,
      c.center.x,
      c.center.y,
      c.sourceFrame.x,
      c.sourceFrame.y,
      c.sourceFrame.width,
      c.sourceFrame.height,
    ].every(finite) ||
    c.size < 5 ||
    c.size > 1000 ||
    c.minSize < 0.02 ||
    c.minSize > 10 ||
    c.sourceFrame.width <= 0 ||
    c.sourceFrame.height <= 0
  )
    return 'Marco o detalle mínimo de composición inválido.';
  if (
    !c.palette.length ||
    c.palette.length > 16 ||
    c.palette.some((color) => !/^#[0-9a-fA-F]{6}$/.test(color))
  )
    return 'La paleta de composición debe contener entre1 y16 colores HEX.';
  if (!finite(c.angle) || Math.abs(c.angle) > 360) return 'Ángulo de composición inválido.';
  if (c.kind === 'recursive') {
    if (
      !['square-limit', 'quadrants', 'branching'].includes(c.recipe) ||
      !Number.isInteger(c.depth) ||
      c.depth < 0 ||
      c.depth > 6 ||
      !finite(c.ratio) ||
      c.ratio < 0.2 ||
      c.ratio > 0.8
    )
      return 'Receta o profundidad recursiva inválida.';
  } else if (
    !['discrete', 'logarithmic', 'rosette', 'fixed-point'].includes(c.recipe) ||
    !Number.isInteger(c.count) ||
    c.count < 1 ||
    c.count > 256 ||
    !finite(c.ratio) ||
    c.ratio < 0.5 ||
    c.ratio > 1.2 ||
    ![-1, 1].includes(c.direction) ||
    !Number.isInteger(c.arms) ||
    c.arms < 1 ||
    c.arms > 12 ||
    !finite(c.offset.x) ||
    !finite(c.offset.y) ||
    Math.abs(c.offset.x) > 500 ||
    Math.abs(c.offset.y) > 500
  )
    return 'Parámetros de semejanza inválidos.';
  return null;
}

export function compositionTree(c: Composition): CompositionNode {
  const issue = compositionIssue(c);
  if (issue) throw Error(issue);
  if (c.kind === 'recursive') {
    const leaf = (level: number, orientation = 0) => {
      const m = motif(level);
      return turn(c.mirror && level % 2 ? flip(m) : m, orientation + c.angle * level);
    };
    if (c.recipe === 'square-limit') {
      const nodes = [shifted(scaled(cycle(leaf(0)), 0.5), 0.25, 0.25)];
      for (let level = 1; level <= c.depth; level++) {
        // Dyadic square rings converge to the boundary; no periodic-tiling claim.
        const inner = 1 - 2 ** -level,
          outer = 1 - 2 ** -(level + 1),
          cell = (outer - inner) / 2,
          count = Math.round(outer / cell),
          start = (1 - outer) / 2;
        for (let row = 0; row < count; row++)
          for (let col = 0; col < count; col++) {
            if (row && col && row !== count - 1 && col !== count - 1) continue;
            const angle = row === 0 ? 0 : col === count - 1 ? 90 : row === count - 1 ? 180 : 270;
            nodes.push(
              shifted(scaled(leaf(level, angle), cell), start + col * cell, start + row * cell),
            );
          }
      }
      return { ...over(...nodes), operator: 'subdivide' };
    }
    const recurse = (remaining: number, level: number): CompositionNode => {
      if (!remaining) return leaf(level);
      if (c.recipe === 'quadrants') {
        const child = recurse(remaining - 1, level + 1);
        return quartet(
          child,
          turn(child, c.angle + 90),
          c.mirror ? flip(child) : turn(child, 270),
          turn(child, 180),
          c.ratio,
        );
      }
      const child = recurse(remaining - 1, level + 1);
      return over(
        shifted(scaled(leaf(level), 0.28), 0.36, 0.62),
        shifted(scaled(turn(child, -30 + c.angle), c.ratio), 0, 0),
        shifted(
          scaled(c.mirror ? flip(child) : turn(child, 30 - c.angle), c.ratio),
          1 - c.ratio,
          0,
        ),
      );
    };
    return recurse(c.depth, 0);
  }
  const leaves: CompositionNode[] = [],
    arms = c.recipe === 'rosette' ? c.arms : 1;
  const theta = c.angle * c.direction;
  const step = multiply(
    translate(c.offset.x / c.size, c.offset.y / c.size),
    multiply(
      rotate(theta, { x: 0.5, y: 0.5 }),
      multiply(translate(0.5, 0.5), multiply(scale(c.ratio), translate(-0.5, -0.5))),
    ),
  );
  let truncated = false;
  for (let arm = 0; arm < arms; arm++)
    for (let i = 0; i < c.count; i++) {
      const factor = c.ratio ** i;
      // Stop numerically tiny or huge branches before building singular matrices.
      if (factor > 10000) {
        truncated = true;
        break;
      }
      if (factor * c.size * 0.14 < c.minSize) break;
      const base = c.mirror && i % 2 ? flip(motif(i)) : motif(i);
      let matrix: Matrix;
      if (c.recipe === 'logarithmic' || c.recipe === 'rosette') {
        const angle = theta * i + (arm * 360) / arms,
          radians = (angle * Math.PI) / 180;
        matrix = multiply(
          translate(
            0.5 + 0.34 * factor * Math.cos(radians) + (i * c.offset.x) / c.size,
            0.5 + 0.34 * factor * Math.sin(radians) + (i * c.offset.y) / c.size,
          ),
          multiply(rotate(angle + 90), multiply(scale(0.14 * factor), translate(-0.5, -0.5))),
        );
      } else {
        const start = multiply(translate(0.77, 0.5), multiply(scale(0.14), translate(-0.5, -0.5)));
        matrix = multiply(affinePower(step, i), start);
      }
      leaves.push(transform('subdivide', matrix, base));
    }
  return { ...over(...leaves), truncated };
}

export function sourceNormalization(c: Composition): Matrix {
  const source = c.sourceFrame;
  return multiply(
    translate(0.5, 0.5),
    multiply(
      scale(1 / Math.max(source.width, source.height)),
      translate(-source.x - source.width / 2, -source.y - source.height / 2),
    ),
  );
}

export function compileComposition(
  c: Composition,
  options: {
    bounds?: Bounds;
    contentBounds?: Bounds;
    minSize?: number;
    maxInstances?: number;
  } = {},
): CompositionReport {
  const root = compositionTree(c),
    source = c.sourceFrame,
    normalize = sourceNormalization(c),
    world = multiply(translate(c.center.x - c.size / 2, c.center.y - c.size / 2), scale(c.size));
  const content = options.contentBounds,
    corners = content
      ? [
          { x: content.x, y: content.y },
          { x: content.x + content.width, y: content.y },
          { x: content.x + content.width, y: content.y + content.height },
          { x: content.x, y: content.y + content.height },
        ]
      : square;
  const report: CompositionReport = {
    leaves: [],
    nodes: [],
    culled: 0,
    detailOmitted: 0,
    limited: !!root.truncated,
    validity: 'EXACT',
    periodicity: 'FINITE_NONPERIODIC',
  };
  const limit = Math.min(
      MAX_COMPOSITION_INSTANCES,
      options.maxInstances ?? MAX_COMPOSITION_INSTANCES,
    ),
    minSize = Math.max(c.minSize, options.minSize ?? 0);
  let eligible = 0;
  const visit = (node: CompositionNode, parent: Matrix, id: string) => {
    if (report.nodes.length >= MAX_NODES) {
      report.limited = true;
      return;
    }
    const matrix = multiply(parent, node.matrix);
    report.nodes.push({
      id,
      operator: node.operator,
      matrix,
      level: node.level,
      children: node.children.map((_, i) => `${id}/${i}`),
    });
    if (node.source) {
      const a = matrix[0] * matrix[3] - matrix[1] * matrix[2];
      if (
        Math.min(Math.hypot(matrix[0], matrix[1]), Math.hypot(matrix[2], matrix[3])) < minSize ||
        Math.abs(a) / Math.max(source.width, source.height) ** 2 < 1e-8
      ) {
        report.detailOmitted++;
        return;
      }
      // Choose the same finite prefix before viewport culling at every camera position.
      if (eligible++ >= limit) {
        report.limited = true;
        return;
      }
      if (options.bounds) {
        const points = corners.map((p) => apply(matrix, p)),
          b = options.bounds;
        if (
          Math.max(...points.map((p) => p.x)) < b.x ||
          Math.min(...points.map((p) => p.x)) > b.x + b.width ||
          Math.max(...points.map((p) => p.y)) < b.y ||
          Math.min(...points.map((p) => p.y)) > b.y + b.height
        ) {
          report.culled++;
          return;
        }
      }
      const placement = multiply(matrix, normalize);
      if (!placement.every(Number.isFinite) || linearScaleBound(placement) > 1e6) {
        report.limited = true;
        return;
      }
      report.leaves.push({ id, matrix: placement, level: node.level });
    } else node.children.forEach((child, i) => visit(child, matrix, `${id}/${i}`));
  };
  visit(root, world, 'composition');
  return report;
}
