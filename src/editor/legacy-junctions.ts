import type { Project, Symmetry } from '../app/model';
import { cosets, lattice } from '../symmetry/groups';
import { resolveSymmetry } from '../symmetry/config';
import { IDENTITY, apply, inverse, multiply, translate, type Matrix } from '../geometry/matrix';
/** Recover the narrow legacy case where a rigid grid edit left an old junction
 * gauge behind. Only an unchanged, plain periodic motif with a saved old Fill
 * context is evidence. Current consistent joins, arbitrary frames, locked paths,
 * different groups/cell sizes and generator/composition/tile instances are skipped.
 */
export function repairLegacyJunctionFrames(project: Project): number {
  let repaired = 0;
  for (const pattern of project.patterns) {
    const sym = resolveSymmetry(pattern, project.mainSymmetry);
    if (
      !['wallpaper', 'frieze'].includes(sym.family) ||
      pattern.tiling ||
      pattern.composition?.enabled ||
      pattern.generator.kind !== 'motif' ||
      pattern.generator.placements.length !== 1 ||
      pattern.generator.placements[0].some((n, i) => Math.abs(n - IDENTITY[i]) > 1e-10)
    )
      continue;
    const evidence = pattern.sourceGeometry.some((g) => {
      if (!g.fillRegion?.linked) return false;
      try {
        const row = JSON.parse(g.fillRegion.context).find(
            (r: { id: string }) => r.id === pattern.id,
          ),
          old = row?.symmetry as Symmetry | undefined;
        return (
          old &&
          old.family === sym.family &&
          old.group === sym.group &&
          old.width === sym.width &&
          old.height === sym.height &&
          old.angle === sym.angle &&
          JSON.stringify(row.placement) === JSON.stringify(pattern.placementTransform) &&
          (old.orientation !== sym.orientation ||
            old.origin?.x !== sym.origin.x ||
            old.origin?.y !== sym.origin.y)
        );
      } catch {
        return false;
      }
    });
    if (!evidence) continue;
    const groups = new Map<
      string,
      { g: (typeof pattern.sourceGeometry)[number]; index: number }[]
    >();
    for (const g of pattern.sourceGeometry)
      for (const [index, n] of g.nodes.entries())
        if (n.junction) {
          const a = groups.get(n.junction.id) ?? [];
          a.push({ g, index });
          groups.set(n.junction.id, a);
        }
    const P = pattern.placementTransform,
      invP = inverse(P),
      basis = lattice(sym),
      invBasis = inverse(basis),
      ops = cosets(sym),
      limit = Math.min(sym.width, sym.height) * 0.05;
    for (const members of groups.values()) {
      if (members.length < 2 || members.some((m) => m.g.locked)) continue;
      const anchor = members[0],
        an = anchor.g.nodes[anchor.index],
        A = an.junction!.instance,
        invA = inverse(A),
        point = apply(multiply(A, anchor.g.transform), an),
        patches: { member: typeof anchor; matrix: Matrix }[] = [];
      let valid = true,
        changed = false;
      for (const member of members.slice(1)) {
        const n = member.g.nodes[member.index],
          relative = multiply(invA, n.junction!.instance),
          q = multiply(P, multiply(relative, invP));
        let best: Matrix | undefined,
          error = Infinity;
        for (const op of ops) {
          if (q.slice(0, 4).some((v, i) => Math.abs(v - op[i]) > 1e-8)) continue;
          const v = apply(invBasis, { x: q[4] - op[4], y: q[5] - op[5] }),
            offset = apply(basis, { x: Math.round(v.x), y: Math.round(v.y) }),
            candidate = multiply(translate(offset.x, offset.y), op),
            distance = Math.hypot(q[4] - candidate[4], q[5] - candidate[5]);
          if (distance < error) {
            error = distance;
            best = candidate;
          }
        }
        if (!best || error > limit) {
          valid = false;
          break;
        }
        changed ||= error > 1e-7;
        patches.push({ member, matrix: multiply(A, multiply(invP, multiply(best, P))) });
      }
      if (!valid || !changed) continue;
      for (const { member, matrix } of patches) {
        const n = member.g.nodes[member.index];
        n.junction!.instance = matrix;
        Object.assign(n, apply(inverse(multiply(matrix, member.g.transform)), point));
      }
      repaired++;
    }
  }
  return repaired;
}
