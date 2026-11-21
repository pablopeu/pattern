// Rebuild our12 mirror-cell definitions from edge reflections and declared interior groups.
// Node24 used for QA; --write explicitly updates the frozen version1 data.
import { readFileSync, writeFileSync } from 'node:fs';
import { apply, multiply, inverse, rotate, reflect, IDENTITY } from '../src/geometry/matrix.ts';
const s = Math.sqrt(3),
  ids = [19, 35, 48, 60, 63, 65, 70, 75, 80, 87, 89, 92];
const eq = (a, b) => a.every((n, i) => Math.abs(n - b[i]) < 1e-6);
const key = (points) =>
  points
    .map((p) => [Math.round(p.x * 1e6), Math.round(p.y * 1e6)])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map((p) => p.join(','))
    .join('/');
function spec(id) {
  let v,
    h = [IDENTITY];
  if (id === 19)
    v = Array.from({ length: 6 }, (_, i) => ({
      x: Math.cos((i * Math.PI) / 3),
      y: Math.sin((i * Math.PI) / 3),
    }));
  else if (id === 35)
    v = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1.5, y: s / 2 },
      { x: 0.5, y: s / 2 },
    ];
  else if (id === 80)
    v = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
  else if (id >= 87)
    v = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.5, y: s / 2 },
    ];
  else {
    const r = [48, 60, 65].includes(id) ? 1.2 : 1;
    v = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: r },
      { x: 0, y: r },
    ];
  }
  const center = {
    x: v.reduce((s, p) => s + p.x, 0) / v.length,
    y: v.reduce((s, p) => s + p.y, 0) / v.length,
  };
  const cyclic = (n) => Array.from({ length: n }, (_, i) => rotate((i * 360) / n, center));
  const dihedral = (n, angle) => {
    const c = cyclic(n);
    return [...c, ...c.map((m) => multiply(m, reflect(angle, center)))];
  };
  if (id === 19) h = dihedral(3, 0);
  if (id === 35) h = dihedral(1, 120);
  if (id === 60) h = cyclic(2);
  if (id === 63) h = cyclic(4);
  if (id === 65) h = dihedral(1, 90);
  if (id === 70) h = dihedral(1, 45);
  if (id === 75) h = dihedral(2, 45);
  if (id === 89) h = cyclic(3);
  if (id === 92) h = dihedral(1, 90);
  const group =
    id === 19 || id === 35 || id === 87 || id === 89
      ? 6
      : id === 48 || id === 60 || id === 65
        ? 4
        : id === 92
          ? 12
          : 8;
  return { v, h, center, group };
}
const records = [];
for (const id of ids) {
  const { v, h, center, group } = spec(id),
    refl = v.map((p, i) => {
      const q = v[(i + 1) % v.length];
      return reflect((Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI, p);
    });
  const states = [IDENTITY],
    map = new Map([[key(v), IDENTITY]]);
  let conflicts = 0;
  for (let index = 0; index < states.length; index++) {
    const m = states[index];
    for (const r of refl) {
      const next = multiply(m, r),
        c = apply(next, center);
      if (Math.abs(c.x) > 7 || Math.abs(c.y) > 7) continue;
      const k = key(v.map((p) => apply(next, p))),
        prev = map.get(k);
      if (prev) {
        if (!h.some((op) => eq(multiply(inverse(prev), next), op))) conflicts++;
      } else {
        map.set(k, next);
        states.push(next);
      }
    }
    if (states.length > 10000) throw Error('nonfinite');
  }
  const vectors = new Map();
  for (const m of states)
    for (const op of h) {
      const t = multiply(m, op);
      if (
        t.slice(0, 4).every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-6) &&
        Math.hypot(t[4], t[5]) > 1e-5
      )
        vectors.set(`${Math.round(t[4] * 1e6)},${Math.round(t[5] * 1e6)}`, { x: t[4], y: t[5] });
    }
  const vs = [...vectors.values()].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)),
    area = Math.abs(
      v.reduce(
        (sum, p, i) => sum + p.x * v[(i + 1) % v.length].y - p.y * v[(i + 1) % v.length].x,
        0,
      ) / 2,
    ),
    na = group / h.length;
  let best,
    score = Infinity;
  for (const a of vs)
    for (const b of vs) {
      const d = a.x * b.y - a.y * b.x,
        value = Math.hypot(a.x, a.y) + Math.hypot(b.x, b.y);
      if (Math.abs(d - area * na) < 1e-6 && value < score - 1e-7) {
        score = value;
        best = [a.x, a.y, b.x, b.y, 0, 0];
      }
    }
  if (!best) throw Error('missing basis ' + id);
  const inv = inverse(best),
    aspects = new Map();
  for (const m of states) {
    const q = apply(m, center),
      c = apply(inv, { x: q.x - center.x, y: q.y - center.y }),
      x = Math.floor(c.x + 1e-7),
      y = Math.floor(c.y + 1e-7),
      t = apply(best, { x, y });
    const reduced = [m[0], m[1], m[2], m[3], m[4] - t.x, m[5] - t.y],
      k = key(v.map((p) => apply(reduced, p)));
    if (!aspects.has(k)) aspects.set(k, reduced);
  }
  const lin = new Set();
  for (const m of states)
    for (const op of h)
      lin.add(
        multiply(m, op)
          .slice(0, 4)
          .map((n) => Math.round(n * 1e6))
          .join(','),
      );
  const order = [...aspects.values()].sort((a, b) =>
    eq(a, IDENTITY)
      ? -1
      : eq(b, IDENTITY)
        ? 1
        : key(v.map((p) => apply(a, p))).localeCompare(key(v.map((p) => apply(b, p)))),
  );
  const masters = [48, 60, 65].includes(id) ? [0, 1, 0, 1] : id === 80 ? [0, 1, 0] : v.map(() => 0);
  records.push({
    type: id,
    rectangle: [48, 60, 65].includes(id),
    vertices: v,
    stabilizer: h,
    basis: best,
    aspects: order,
    masters,
    pointOrder: group,
  });
  if (conflicts || lin.size !== group || aspects.size !== na)
    throw Error('Invalid marked construction IH' + id);
  console.log(
    'IH' + id,
    'cycles closed;',
    na,
    'aspects;',
    group,
    'point operations; stabilizer',
    h.length,
  );
}

const serialized =
  JSON.stringify(
    records,
    (_, v) => (typeof v === 'number' ? (Math.abs(v) < 1e-12 ? 0 : +v.toFixed(12)) : v),
    2,
  ) + '\n';
const target = 'src/isohedral/marked-data.json';
if (process.argv.includes('--write')) writeFileSync(target, serialized);
else if (
  JSON.stringify(JSON.parse(readFileSync(target, 'utf8'))) !==
  JSON.stringify(JSON.parse(serialized))
)
  throw Error('Frozen marked definitions differ; inspect before --write.');
else console.log('All12 frozen definitions reproduce exactly.');
