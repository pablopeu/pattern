/** Real application exporters -> independent Python/CairoSVG/Pillow/ezdxf checks. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const artifacts = await page.evaluate(async () => {
    const { newProject, newPattern, geometry, node, uid } = await import('/src/app/model.ts'),
      { profile } = await import('/src/app/styles.ts'),
      { prepareExport } = await import('/src/export/svg.ts'),
      { exportDXF } = await import('/src/export/dxf.ts'),
      { rasterize } = await import('/src/export/raster.ts'),
      { buildScene } = await import('/src/patterns/engine.ts'),
      { resolvePattern, freezePattern } = await import('/src/symmetry/config.ts'),
      { collectFillInputs, createFaceFill, createTileFill, immediateFillCandidates } = await import(
        '/src/fill/service.ts'
      ),
      { buildArrangement, facesAt } = await import('/src/fill/planar.ts'),
      { newTiling, constrainTiling } = await import('/src/tiling/tiles.ts'),
      { translate, scale, rotate, apply, IDENTITY } = await import('/src/geometry/matrix.ts');
    const base = {
      target: 'view',
      format: 'svg',
      representation: 'editable',
      width: 80,
      height: 60,
      dpi: 200,
      background: '#ffffff',
      transparent: true,
      quality: 0.92,
      tolerance: 0.02,
      outlineStrokes: true,
    };
    const encode = async (blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (const n of bytes) binary += String.fromCharCode(n);
      return btoa(binary);
    };
    const addFace = (p, targetId, view, point, color, fillOpacity = 1) => {
      const layers = p.patterns
          .filter((p) => p.visible)
          .map((raw) => {
            const pattern = resolvePattern(raw, p);
            return { pattern, scene: buildScene(pattern, view) };
          }),
        inputs = collectFillInputs(layers, view),
        arrangement = buildArrangement(inputs),
        face = facesAt(arrangement, point)[0],
        layer = layers.find((l) => l.pattern.id === targetId);
      if (!face || !layer) throw Error('Fixture sin cara válida');
      const fill = createFaceFill(p, layer.pattern, layer.scene, face, arrangement, inputs, {
        ...p.drawingStyle,
        fill: color,
        fillOpacity,
        fillRule: 'nonzero',
      });
      p.patterns.find((p) => p.id === targetId).sourceGeometry.unshift(fill);
      return fill;
    };
    const cases = [];
    const strokes = newProject(),
      sp = strokes.patterns[0],
      curve = {
        ...geometry('compound'),
        pathData: 'M-30 -15C-15 -30 0 0 10 -15C20 -30 30 -5 30 -15',
        stroke: '#254cc5',
        strokeWidth: 2.4,
        strokeOpacity: 0.7,
        opacity: 0.85,
        strokeDash: [5, 2, 0, 2],
        strokeProfile: {
          version: 1,
          kind: 'custom',
          points: [
            { at: 0, width: 0.25 },
            { at: 0.25, width: 1.6 },
            { at: 0.6, width: 0.6 },
            { at: 1, width: 0.15 },
          ],
        },
      },
      dash = {
        ...geometry('path', [node(-30, 10), node(-12, 22), node(5, 10), node(28, 22)]),
        stroke: '#147b52',
        strokeWidth: 1.2,
        strokeDash: [3, 1.5],
        strokeDashOffset: -1.25,
        strokeCap: 'butt',
        strokeJoin: 'bevel',
      },
      dots = {
        ...geometry('path', [node(-25, 0), node(25, 0)]),
        stroke: '#9541b5',
        strokeWidth: 1.5,
        strokeDash: [0, 2.5],
        strokeCap: 'round',
      };
    sp.sourceGeometry = [curve, dash, dots];
    const len = Math.hypot(18, 12),
      along = (d) => ({ x: -30 + (18 * d) / len, y: 10 + (12 * d) / len });
    cases.push({
      name: 'strokes',
      project: strokes,
      options: { ...base, patternId: sp.id },
      checks: [
        { point: along(2), kind: 'green' },
        { point: along(5), kind: 'white' },
        ...Array.from({ length: 20 }, (_, i) => ({
          point: { x: -25 + i * 2.5, y: 0 },
          kind: 'purple',
        })),
        { point: { x: -21.25, y: 0 }, kind: 'white' },
        { point: { x: 25, y: 0 }, kind: 'white' },
      ],
      colors: ['blue', 'green', 'purple'],
    });
    const scaled = structuredClone(strokes),
      scaledPattern = scaled.patterns[0];
    scaled.mainSymmetry = {
      ...scaled.mainSymmetry,
      family: 'wallpaper',
      group: 'p1',
      width: 200,
      height: 160,
    };
    scaledPattern.generator.kind = 'freeform';
    scaledPattern.generator.placements = [scale(4, 4)];
    cases.push({
      name: 'scaled-template',
      project: scaled,
      options: { ...base, width: 160, height: 120, patternId: scaledPattern.id },
      checks: [],
      colors: ['blue', 'green', 'purple'],
    });
    const planar = newProject(),
      fp = planar.patterns[0];
    fp.sourceGeometry = [
      'M-30 -20L30 -20',
      'M30 -20L30 20',
      'M30 20L-30 20',
      'M-30 20L-30 -20',
    ].map((pathData) => ({ ...geometry('compound'), pathData, strokeWidth: 0.5 }));
    fp.sourceGeometry.push({
      ...geometry('ellipse', [], true),
      parameters: { x: -10, y: -8, width: 20, height: 16, radius: 0, sides: 4 },
      strokeWidth: 0.5,
    });
    addFace(
      planar,
      fp.id,
      { x: -40, y: -30, width: 80, height: 60 },
      { x: -20, y: 0 },
      '#db5434',
      0.65,
    );
    cases.push({
      name: 'planar-holes',
      project: planar,
      options: { ...base, patternId: fp.id },
      checks: [
        { point: { x: -20, y: 0 }, kind: 'coral' },
        { point: { x: 0, y: 0 }, kind: 'white' },
      ],
      colors: ['coral'],
      holeClearance: 7.4,
    });
    const orbit = newProject(),
      a = orbit.patterns[0],
      b = newPattern();
    orbit.patterns.push(b);
    a.generator.kind = 'freeform';
    a.generator.placements = [IDENTITY, translate(45, 0)];
    a.sourceGeometry = ['M-20 -10L20 -10', 'M-20 10L20 10'].map((pathData) => ({
      ...geometry('compound'),
      pathData,
      strokeWidth: 0.5,
    }));
    b.sourceGeometry = [-20, 20, 25, 65].map((x) => ({
      ...geometry('path', [node(x, -10), node(x, 10)]),
      strokeWidth: 0.5,
    }));
    const orbitFill = addFace(
      orbit,
      a.id,
      { x: -40, y: -25, width: 130, height: 50 },
      { x: 0, y: 0 },
      '#3f9b77',
    );
    if (orbitFill.fillRegion.scope !== 'orbit' || orbitFill.fillRegion.orbitMatrices.length !== 2)
      throw Error('Fixture sin dos regiones de órbita');
    cases.push({
      name: 'orbit-composition',
      project: orbit,
      options: { ...base, width: 120, scope: 'composition', patternId: a.id },
      checks: [
        { point: { x: 0, y: 0 }, kind: 'teal' },
        { point: { x: 45, y: 0 }, kind: 'teal' },
        { point: { x: 22.5, y: 0 }, kind: 'white' },
      ],
      colors: ['teal'],
    });
    const tiles = newProject(),
      tp = tiles.patterns[0];
    tp.tiling = newTiling('hexagon');
    tp.tiling.width = 40;
    tp.tiling.origin = { x: 5, y: -7 };
    tp.tiling.rotation = 12;
    tp.tiling.edges[0][1].y = 0.025;
    tp.tiling.edges[0][1].in = { x: -0.08, y: -0.01 };
    tp.tiling.edges[0][1].out = { x: 0.08, y: 0.01 };
    tp.tiling = constrainTiling(tp.tiling);
    tp.symmetryMode = 'own';
    tp.symmetry = {
      ...tp.symmetry,
      family: 'radial',
      group: 'Cn',
      sectors: 3,
      center: { x: 15, y: 15 },
    };
    tp.sourceGeometry = [
      {
        ...geometry('compound'),
        pathData: 'M0 10C10 5 20 18 28 10',
        stroke: '#135c9a',
        strokeWidth: 1.1,
        strokeProfile: profile('taper-both'),
      },
    ];
    const tileView = { x: -50, y: -40, width: 100, height: 80 },
      tileEffective = resolvePattern(tp, tiles),
      tileScene = buildScene(tileEffective, tileView),
      tileCandidate = immediateFillCandidates([{ pattern: tileEffective, scene: tileScene }], {
        x: 10,
        y: 10,
      }).find((c) => c.kind === 'tile');
    if (!tileCandidate) throw Error('Sin tesela en fixture');
    tp.sourceGeometry.unshift(
      createTileFill(tiles, tp, tileCandidate, {
        ...tiles.drawingStyle,
        fill: '#d6b785',
        fillOpacity: 0.6,
      }),
    );
    cases.push({
      name: 'curved-tile-fill',
      project: tiles,
      options: { ...base, width: 100, height: 80, patternId: tp.id },
      checks: [],
      colors: ['brown', 'blue'],
    });
    const frozen = structuredClone(planar),
      frozenPattern = freezePattern(frozen.patterns[0], frozen.mainSymmetry),
      regionId = uid(),
      applicationId = uid(),
      mask = {
        ...geometry('rectangle', [], true),
        parameters: { x: -35, y: -25, width: 70, height: 50, radius: 0, sides: 4 },
      };
    frozen.regions = [{ id: regionId, name: 'Máscara', geometry: [mask] }];
    frozen.applications = [
      {
        id: applicationId,
        name: 'Snapshot v22',
        patternId: frozenPattern.id,
        regionId,
        linked: false,
        frozenPattern,
        placementTransform: rotate(17),
        showOutline: false,
      },
    ];
    frozen.patterns[0].sourceGeometry = [];
    frozen.mainSymmetry = { ...frozen.mainSymmetry, family: 'wallpaper', group: 'p4g' };
    cases.push({
      name: 'frozen-fill',
      project: frozen,
      options: { ...base, target: 'application', applicationId, patternId: frozen.patterns[0].id },
      checks: [
        { point: apply(rotate(17), { x: -20, y: 0 }), kind: 'coral' },
        { point: { x: 0, y: 0 }, kind: 'white' },
      ],
      colors: ['coral'],
      holeClearance: 7.4,
    });
    const output = [];
    for (const entry of cases) {
      const editable = prepareExport(entry.project, entry.options),
        expanded = prepareExport(entry.project, { ...entry.options, representation: 'expanded' }),
        png = await rasterize(
          editable.svg,
          editable.bounds.width,
          editable.bounds.height,
          200,
          'png',
          0.92,
          '#ffffff',
          true,
        ),
        jpeg = await rasterize(
          editable.svg,
          editable.bounds.width,
          editable.bounds.height,
          200,
          'jpeg',
          0.92,
          '#ffffff',
          false,
        );
      output.push({
        name: entry.name,
        editable: editable.svg,
        expanded: expanded.svg,
        dxf: exportDXF(expanded.geometries, 0.02),
        png: await encode(png),
        jpeg: await encode(jpeg),
        metadata: {
          name: entry.name,
          bounds: editable.bounds,
          dpi: 200,
          tolerance: 0.02,
          checks: entry.checks,
          colors: entry.colors,
          holeClearance: entry.holeClearance,
        },
      });
    }
    return output;
  });
  const folder = '.runtime/exports/v22';
  await mkdir(folder, { recursive: true });
  for (const file of artifacts) {
    await writeFile(`${folder}/${file.name}-editable.svg`, file.editable);
    await writeFile(`${folder}/${file.name}-expanded.svg`, file.expanded);
    await writeFile(`${folder}/${file.name}.dxf`, file.dxf);
    for (const ext of ['png', 'jpeg'])
      await writeFile(`${folder}/${file.name}.${ext}`, Buffer.from(file[ext], 'base64'));
  }
  await writeFile(
    `${folder}/manifest.json`,
    JSON.stringify(
      artifacts.map((f) => f.metadata),
      null,
      2,
    ),
  );
  console.log(`v2.2 artifacts: ${artifacts.length} scenarios in ${folder}`);
} finally {
  await browser.close();
}
