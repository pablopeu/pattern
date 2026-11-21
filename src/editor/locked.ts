import type { Geometry } from '../app/model';
/** Editing/reordering cannot mutate or remove a locked object. Its visibility
 * and lock switch remain usable directly from the object list. */
export function editUnlocked(objects: Geometry[], recipe: (shapes: Geometry[]) => void): void {
  const locked = objects.flatMap((g, index) =>
    g.locked ? [{ index, g: structuredClone(g) }] : [],
  );
  recipe(objects);
  for (const old of locked) {
    const index = objects.findIndex((g) => g.id === old.g.id);
    if (index < 0) objects.splice(Math.min(old.index, objects.length), 0, old.g);
    else {
      const { visible, locked } = objects[index];
      objects[index] = { ...old.g, visible, locked };
    }
  }
}
