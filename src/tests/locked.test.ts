import { expect, it } from 'vitest';
import { geometry, node } from '../app/model';
import { editUnlocked } from '../editor/locked';
it('a locked object cannot be changed or removed; other objects remain editable', () => {
  const a = { ...geometry('path', [node(0, 0), node(10, 0)]), locked: true },
    b = geometry('path', [node(20, 0), node(30, 0)]),
    objects = [a, b],
    before = structuredClone(a);
  editUnlocked(objects, (gs) => {
    gs[0].nodes[0].x = 500;
    gs[0].stroke = '#ff0000';
    gs[1].nodes[0].x = 22;
  });
  expect(objects[0]).toEqual(before);
  expect(objects[1].nodes[0].x).toBe(22);
  editUnlocked(objects, (gs) => {
    gs.splice(0, 1);
  });
  expect(objects[0]).toEqual(before);
});
it('visibility and unlocking stay available, without accepting geometry edits in the same operation', () => {
  const a = { ...geometry('path', [node(0, 0), node(10, 0)]), locked: true },
    objects = [a];
  editUnlocked(objects, (gs) => {
    gs[0].visible = false;
    gs[0].locked = false;
    gs[0].nodes[0].x = 500;
  });
  expect(objects[0]).toMatchObject({ visible: false, locked: false });
  expect(objects[0].nodes[0].x).toBe(0);
  editUnlocked(objects, (gs) => {
    gs[0].nodes[0].x = 9;
  });
  expect(objects[0].nodes[0].x).toBe(9);
});
