import { test, expect, type Page } from '@playwright/test';
import { context } from './navigation';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
async function assertJoined(page: Page) {
  const result = await page.evaluate(async () => {
    const { recover } = await import('/src/persistence/storage.ts'),
      { cosets } = await import('/src/symmetry/groups.ts'),
      { apply, multiply, distance } = await import('/src/geometry/matrix.ts');
    const p = await recover(),
      pat = p.patterns[0],
      s = pat.symmetryMode === 'inherit' ? p.mainSymmetry : pat.symmetry,
      ops = cosets(s),
      [a, b] = pat.sourceGeometry.filter((g) => !g.fillRegion),
      ma = multiply(ops[0], pat.placementTransform),
      mb = multiply(ops[1], pat.placementTransform);
    return {
      gaps: [
        distance(apply(ma, a.nodes[0]), apply(mb, b.nodes[1])),
        distance(apply(ma, a.nodes[1]), apply(mb, b.nodes[0])),
      ],
      fill: pat.sourceGeometry.find((g) => g.fillRegion)?.fillRegion?.status,
    };
  });
  expect(Math.max(...result.gaps)).toBeLessThan(1e-7);
  expect(result.fill).toBe('linked');
}
for (const width of [1440, 390])
  test(`dos Bézier snapeadas en P3 siguen cerradas/rellenas al mover origen y red ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    await model(page);
    const fixture = await page.evaluate(async () => {
      const { newStudy, geometry, node } = await import('/src/app/model.ts'),
        { cosets } = await import('/src/symmetry/groups.ts'),
        { apply, inverse, IDENTITY } = await import('/src/geometry/matrix.ts'),
        { joinNodes } = await import('/src/editor/junctions.ts'),
        { resolvePattern } = await import('/src/symmetry/config.ts'),
        { buildScene } = await import('/src/patterns/engine.ts'),
        { collectFillInputs, createFaceFill } = await import('/src/fill/service.ts'),
        { buildArrangement, facesAt } = await import('/src/fill/planar.ts'),
        { autosave } = await import('/src/persistence/storage.ts');
      const p = newStudy(),
        pat = p.patterns[0],
        mb = cosets(p.mainSymmetry)[1],
        inv = inverse(mb),
        a = geometry('path', [node(10, 7), node(25, 7)]),
        first = apply(inv, { x: 25, y: 7 }),
        last = apply(inv, { x: 10, y: 7 }),
        b = geometry('path', [node(first.x, first.y), node(last.x, last.y)]);
      a.nodes[0].out = { x: 5, y: -10 };
      a.nodes[1].in = { x: -5, y: -10 };
      const c = apply(inv, { x: 20, y: 17 }),
        d = apply(inv, { x: 15, y: 17 });
      b.nodes[0].out = { x: c.x - first.x, y: c.y - first.y };
      b.nodes[1].in = { x: d.x - last.x, y: d.y - last.y };
      a.fill = b.fill = 'none';
      pat.sourceGeometry = [a, b];
      joinNodes(
        pat.sourceGeometry,
        { id: b.id, index: 0, instance: mb },
        { id: a.id, index: 1, instance: IDENTITY },
      );
      joinNodes(
        pat.sourceGeometry,
        { id: b.id, index: 1, instance: mb },
        { id: a.id, index: 0, instance: IDENTITY },
      );
      const bounds = { x: -35, y: -35, width: 90, height: 90 },
        effective = resolvePattern(pat, p),
        scene = buildScene(effective, bounds),
        inputs = collectFillInputs([{ pattern: effective, scene }], bounds),
        arrangement = buildArrangement(inputs),
        face = facesAt(arrangement, { x: 17.5, y: 7 })[0];
      if (!face) throw Error('Fixture did not close');
      pat.sourceGeometry.unshift(
        createFaceFill(p, effective, scene, face, arrangement, inputs, {
          ...p.drawingStyle,
          fill: '#3b82f6',
        }),
      );
      await autosave(p);
      return { id: p.metadata.id, source: pat.sourceGeometry.filter((g) => !g.fillRegion) };
    });
    await page.reload();
    await expect.poll(async () => (await model(page))?.metadata.id).toBe(fixture.id);
    await assertJoined(page);
    await context(page, 'Simetrías');
    for (const [label, value] of [
      ['Origen X', '8'],
      ['Origen Y', '-7'],
      ['Orientación de red', '23'],
    ]) {
      await page.getByLabel(label, { exact: true }).fill(value);
      await expect
        .poll(async () => {
          const p = (await model(page))!;
          return label === 'Orientación de red'
            ? p.mainSymmetry.orientation
            : p.mainSymmetry.origin[label.endsWith('X') ? 'x' : 'y'];
        })
        .toBe(Number(value));
      await assertJoined(page);
    }
    let p = (await model(page))!;
    expect(p.patterns[0].sourceGeometry.filter((g) => !g.fillRegion)).toEqual(fixture.source);
    const pixel = await page.evaluate(async () => {
      const { recover } = await import('/src/persistence/storage.ts'),
        { prepareExport } = await import('/src/export/svg.ts'),
        { apply } = await import('/src/geometry/matrix.ts');
      const p = await recover(),
        pat = p.patterns[0],
        point = apply(pat.placementTransform, { x: 17.5, y: 7 }),
        result = prepareExport(p, {
          target: 'view',
          format: 'svg',
          representation: 'editable',
          width: 200,
          height: 150,
          dpi: 96,
          background: '#fff',
          transparent: true,
          quality: 0.9,
          tolerance: 0.02,
          outlineStrokes: true,
          patternId: pat.id,
        }),
        doc = new DOMParser().parseFromString(result.svg, 'image/svg+xml'),
        svg = doc.documentElement;
      svg.setAttribute('viewBox', `${point.x - 1} ${point.y - 1} 2 2`);
      svg.setAttribute('width', '256');
      svg.setAttribute('height', '256');
      const image = new Image();
      image.src =
        'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      return [...ctx.getImageData(128, 128, 1, 1).data];
    });
    expect(pixel).toEqual([59, 130, 246, 255]);
    if (width === 390)
      await page.getByRole('button', { name: 'Cerrar panel izquierdo', exact: true }).click();
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await model(page);
    await assertJoined(page);
    await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
    await model(page);
    await assertJoined(page);
    await page.reload();
    p = (await model(page))!;
    await assertJoined(page);
    expect(p.patterns[0].sourceGeometry.filter((g) => !g.fillRegion)).toEqual(fixture.source);
  });
