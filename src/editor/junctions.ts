import { uid, type Geometry, type Node } from '../app/model';
import { apply, inverse, multiply, distance, type Matrix } from '../geometry/matrix';

export interface NodeRef {
  id: string;
  index: number;
  instance: Matrix;
}
type Member = { g: Geometry; n: Node };
function groups(objects: Geometry[]): Map<string, Member[]> {
  const result = new Map<string, Member[]>();
  for (const g of objects)
    for (const n of g.nodes)
      if (n.junction) {
        const members = result.get(n.junction.id) ?? [];
        members.push({ g, n });
        result.set(n.junction.id, members);
      }
  return result;
}
const frame = ({ g, n }: Member) => multiply(n.junction!.instance, g.transform);
const position = (m: Member) => apply(frame(m), m.n);

/** Each membership stores an instance frame, so a join survives edits in another copy. */
export function joinNodes(objects: Geometry[], moving: NodeRef, target: NodeRef): boolean {
  const a = objects.find((g) => g.id === moving.id),
    b = objects.find((g) => g.id === target.id),
    na = a?.nodes[moving.index],
    nb = b?.nodes[target.index];
  if (!a || !b || !na || !nb || a.locked || b.locked || (a === b && moving.index === target.index))
    return false;
  if (na.junction && na.junction.id === nb.junction?.id) return false;
  const old = na.junction,
    targetId = nb.junction?.id ?? uid(),
    targetFrame = nb.junction?.instance ?? target.instance,
    displayToGroup = multiply(targetFrame, inverse(target.instance)),
    nextFrame = multiply(displayToGroup, moving.instance),
    point = apply(multiply(target.instance, b.transform), nb);
  Object.assign(na, apply(inverse(multiply(moving.instance, a.transform)), point));
  if (old) {
    const rebase = multiply(nextFrame, inverse(old.instance));
    for (const { n } of groups(objects).get(old.id) ?? [])
      n.junction = { id: targetId, instance: multiply(rebase, n.junction!.instance) };
  }
  nb.junction ??= { id: targetId, instance: targetFrame };
  na.junction = { id: targetId, instance: nextFrame };
  delete na.detached;
  delete nb.detached;
  // A merged group may have moved its old members: make every endpoint agree now.
  const anchor = apply(multiply(targetFrame, b.transform), nb);
  for (const m of groups(objects).get(targetId) ?? [])
    Object.assign(m.n, apply(inverse(frame(m)), anchor));
  return true;
}

/** Propagate a changed endpoint/geometry transform through its persistent junction. */
export function enforceJunctions(objects: Geometry[], previous: Geometry[]): void {
  const old = new Map(previous.map((g) => [g.id, g]));
  for (const members of groups(objects).values()) {
    const changed = members.filter(({ g, n }) => {
      const before = old.get(g.id),
        index = g.nodes.indexOf(n),
        other = before?.nodes[index];
      return (
        !!before &&
        !!other &&
        (n.x !== other.x ||
          n.y !== other.y ||
          JSON.stringify(g.transform) !== JSON.stringify(before.transform))
      );
    });
    if (!changed.length) continue;
    const anchor = members.find((m) => m.g.locked) ?? changed[0],
      p = position(anchor);
    for (const m of members) if (!m.g.locked) Object.assign(m.n, apply(inverse(frame(m)), p));
  }
}
export function junctionIssue(objects: Geometry[]): string | null {
  for (const members of groups(objects).values()) {
    const p = position(members[0]);
    if (members.some((m) => distance(position(m), p) > 1e-6))
      return 'Unión de nodos inconsistente.';
  }
  return null;
}
export function detachNode(objects: Geometry[], id: string, index: number): void {
  const g = objects.find((g) => g.id === id);
  if (g && !g.locked && g.nodes[index]) {
    delete g.nodes[index].junction;
    g.nodes[index].detached = true;
  }
}
export function remapJunctions(objects: Geometry[]): void {
  const ids = new Map<string, string>();
  for (const g of objects)
    for (const n of g.nodes)
      if (n.junction) {
        if (!ids.has(n.junction.id)) ids.set(n.junction.id, uid());
        n.junction.id = ids.get(n.junction.id)!;
      }
}
