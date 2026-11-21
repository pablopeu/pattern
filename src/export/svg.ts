import { profile, drawingStyle } from '../app/styles';
import { sceneLayers } from '../patterns/layers';
import { strokeRegion } from '../geometry/stroke-outline';
import {
  tileRectangularCell,
  tileBasis,
  tileFrame,
  tileContours,
  tileInstances,
} from '../tiling/tiles';
import { materializeTiling } from '../tiling/materialize';
import { tiledMarkup } from '../tiling/render';
import { resolvePattern, commonRectangularCell, symmetryOrigin } from '../symmetry/config';
import {
  geometry,
  type Application,
  type Geometry,
  type Pattern,
  type Project,
  type Region,
} from '../app/model';
import { IDENTITY, matrixString, multiply, inverse, type Matrix } from '../geometry/matrix';
import { pathData, hasFillBoundary } from '../geometry/paths';
import { buildScene, expandedTransforms, sceneScaleBound } from '../patterns/engine';
import { geometryBounds, clipGeometry, regionData } from '../application/clipping';
import {
  rectangularCell,
  latticeVectors,
  fundamentalDomain,
  type Bounds,
} from '../symmetry/groups';
export interface ExportOptions {
  includeTileOutlines?: boolean;
  scope?: 'pattern' | 'composition';
  target: 'view' | 'tile' | 'lattice' | 'fundamental' | 'application';
  format: 'svg' | 'png' | 'jpeg' | 'dxf';
  representation: 'editable' | 'expanded';
  width: number;
  height: number;
  dpi: number;
  background: string;
  transparent: boolean;
  quality: number;
  tolerance: number;
  outlineStrokes: boolean;
  patternId: string;
  applicationId?: string;
}
export interface ExportResult {
  svg: string;
  geometries: Geometry[];
  bounds: Bounds;
  warnings: string[];
}
export const escapeXML = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
export function svgPath(shape: Geometry): string {
  return svgPathAtTolerance(shape, 0.02);
}
const previewCache = new Map<string, string>();
let previewCacheBytes = 0;
/** Preview may show a clearly marked axis; strict export never uses this fallback. */
export function previewSVGPath(shape: Geometry): string {
  return previewSVGPathAtTolerance(shape, 0.02);
}
export function previewSVGPathAtTolerance(shape: Geometry, tolerance: number): string {
  if (
    (shape.strokeProfile.kind === 'uniform' && !shape.strokeDash.includes(0)) ||
    shape.stroke === 'none' ||
    shape.strokeWidth <= 0
  )
    return svgPathAtTolerance(shape, tolerance);
  const key = JSON.stringify([
      shape.id,
      tolerance,
      pathData(shape),
      shape.transform,
      drawingStyle(shape),
    ]),
    cached = previewCache.get(key);
  if (cached !== undefined) return cached;
  let markup: string;
  try {
    markup = svgPathAtTolerance(shape, tolerance);
  } catch (error) {
    const message =
      'Contorno no disponible: ' + (error as Error).message + ' Eje provisional en naranja.';
    const axis = {
      ...shape,
      stroke: '#b86b20',
      strokeWidth: 0.6,
      strokeDash: [],
      strokeDashOffset: 0,
      strokeProfile: profile(),
    };
    markup = `<g data-stroke-error="${escapeXML(message)}" data-stroke-error-shape="${escapeXML(shape.id)}"><title>${escapeXML(message)}</title>${svgPath(axis)}</g>`;
  }
  const bytes = key.length + markup.length;
  while (previewCache.size && (previewCache.size >= 32 || previewCacheBytes + bytes > 8000000)) {
    const oldest = previewCache.keys().next().value!;
    previewCacheBytes -= oldest.length + previewCache.get(oldest)!.length;
    previewCache.delete(oldest);
  }
  if (bytes <= 8000000) {
    previewCache.set(key, markup);
    previewCacheBytes += bytes;
  }
  return markup;
}
export function svgPathAtTolerance(shape: Geometry, tolerance: number): string {
  if (!hasFillBoundary(shape) && shape.fill !== 'none')
    return svgPathAtTolerance({ ...shape, fill: 'none' }, tolerance);
  if (
    (shape.strokeProfile.kind !== 'uniform' || shape.strokeDash.includes(0)) &&
    shape.stroke !== 'none' &&
    shape.strokeWidth > 0
  ) {
    return (
      svgPathAtTolerance({ ...shape, stroke: 'none' }, tolerance) +
      svgPathAtTolerance(strokeRegion(shape, IDENTITY, tolerance), tolerance)
    );
  }
  return `<path d="${escapeXML(pathData(shape))}" transform="${matrixString(shape.transform)}" fill="${escapeXML(shape.fill)}" stroke="${escapeXML(shape.stroke)}" stroke-width="${shape.strokeWidth}" stroke-dasharray="${shape.strokeDash.length ? shape.strokeDash.join(' ') : 'none'}" stroke-dashoffset="${shape.strokeDashOffset}" opacity="${shape.opacity}" fill-opacity="${shape.fillOpacity}" stroke-opacity="${shape.strokeOpacity}" stroke-linecap="${shape.strokeCap}" stroke-linejoin="${shape.strokeJoin}" stroke-miterlimit="${shape.miterLimit}" fill-rule="${shape.fillRule}"/>`;
}
export function svgDocument(content: string, bounds: Bounds, background?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${bounds.width}mm" height="${bounds.height}mm" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}"><title>Pattern Studio 2D</title>${background ? `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${escapeXML(background)}"/>` : ''}${content}</svg>`;
}
function preparePatternExport(
  project: Project,
  options: ExportOptions,
  onProgress?: (n: number) => void,
  customBounds?: Bounds,
): ExportResult {
  const renderPath = (g: Geometry) => svgPathAtTolerance(g, options.tolerance);
  let pattern: Pattern | undefined = project.patterns.find((p) => p.id === options.patternId),
    region: Region | undefined,
    application: Application | undefined;
  let placement: Matrix = IDENTITY;
  if (options.target === 'application') {
    const appId = options.applicationId;
    application = project.applications.find((a) => a.id === appId);
    if (!application) throw Error('Seleccioná una aplicación existente.');
    const selected = application;
    region = project.regions.find((r) => r.id === selected.regionId);
    pattern = selected.linked
      ? project.patterns.find((p) => p.id === selected.patternId)
      : selected.frozenPattern;
    placement = application.placementTransform;
  }
  if (!pattern) throw Error('No se encontró el patrón.');
  pattern = resolvePattern(pattern, project);
  const tiling =
    pattern.generator.kind !== 'penrose' && !pattern.composition?.enabled
      ? pattern.tiling
      : undefined;
  let bounds: Bounds = customBounds ?? {
    x: -options.width / 2,
    y: -options.height / 2,
    width: options.width,
    height: options.height,
  };
  let latticeMask = '';
  if (pattern.composition?.enabled && ['tile', 'lattice', 'fundamental'].includes(options.target))
    throw Error('La composición es finita; exportá una región, no una celda periódica.');
  if (region) bounds = geometryBounds(region.geometry);
  if (options.target === 'tile') {
    const cell = tiling ? tileRectangularCell(tiling) : rectangularCell(pattern.symmetry);
    if (!cell || pattern.generator.kind === 'penrose')
      throw Error(
        'Este patrón no tiene una celda rectangular seamless. Elegí celda de red o región finita.',
      );
    bounds = { x: 0, y: 0, ...cell };
  }
  if (options.target === 'lattice') {
    if (
      (!tiling && pattern.symmetry.family !== 'wallpaper') ||
      pattern.generator.kind === 'penrose'
    )
      throw Error('Este patrón no tiene una celda de traslación bidimensional.');
    const basis = tiling ? multiply(tileFrame(tiling), tileBasis(tiling)) : null;
    const [a, b] = basis
        ? [
            { x: basis[0], y: basis[1] },
            { x: basis[2], y: basis[3] },
          ]
        : latticeVectors(pattern.symmetry),
      o = tiling ? tiling.origin : symmetryOrigin(pattern.symmetry);
    const xs = [o.x, o.x + a.x, o.x + b.x, o.x + a.x + b.x],
      ys = [o.y, o.y + a.y, o.y + b.y, o.y + a.y + b.y];
    bounds = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
    latticeMask = `M${o.x} ${o.y}l${a.x} ${a.y}l${b.x} ${b.y}l${-a.x} ${-a.y}Z`;
  }
  if (options.target === 'fundamental') {
    if (tiling)
      throw Error(
        'La simetría del motivo es local a la tesela. Exportá celda de red o región finita.',
      );
    if (pattern.symmetry.family !== 'wallpaper' || pattern.generator.kind === 'penrose')
      throw Error('Esta composición no tiene una región fundamental periódica.');
    const points = fundamentalDomain(pattern.symmetry),
      xs = points.map((p) => p.x),
      ys = points.map((p) => p.y);
    bounds = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
    latticeMask = points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('') + 'Z';
  }
  // Transform all viewport corners, not just the diagonal, for rotated applications.
  const inv = inverse(placement),
    corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x, y: bounds.y + bounds.height },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ].map((p) => ({
      x: inv[0] * p.x + inv[2] * p.y + inv[4],
      y: inv[1] * p.x + inv[3] * p.y + inv[5],
    }));
  const visible = {
    x: Math.min(...corners.map((p) => p.x)),
    y: Math.min(...corners.map((p) => p.y)),
    width: Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x)),
    height: Math.max(...corners.map((p) => p.y)) - Math.min(...corners.map((p) => p.y)),
  };
  const expanded = options.representation === 'expanded' || options.format === 'dxf';
  const scene = buildScene(
      expanded && tiling
        ? materializeTiling(pattern, visible, options.outlineStrokes, options.tolerance)
        : pattern,
      visible,
    ),
    transforms = expandedTransforms(scene),
    geometries: Geometry[] = [];
  const cropShape = geometry('compound', [], true);
  cropShape.pathData =
    latticeMask || `M${bounds.x} ${bounds.y}h${bounds.width}v${bounds.height}h${-bounds.width}Z`;
  const cropRegion: Region = region ?? {
    id: 'export-crop',
    name: 'Límite de exportación',
    geometry: [cropShape],
  };
  const total =
    transforms.length * scene.generated.geometry.length +
    scene.fills.reduce((n, f) => n + f.matrices.length, 0);
  if (total > 150000)
    throw Error('La exportación excede 150.000 trazados. Aumentá la celda o reducí la región.');
  const warnings: string[] = [];
  if (!tiling && scene.status !== 'PERIODIC_SEAMLESS') warnings.push(scene.message);
  if (pattern.symmetry.family === 'frieze')
    warnings.push(
      'Friso: sólo repite en una dirección. Esta exportación es una región finita, no una baldosa bidimensional.',
    );
  if (options.target === 'fundamental')
    warnings.push(
      'Región fundamental: requiere las operaciones del grupo para reconstruir el patrón; no es una baldosa rectangular de traslación.',
    );
  const motifTolerance = options.tolerance / sceneScaleBound(scene, placement),
    renderMotifPath = (g: Geometry) => svgPathAtTolerance(g, motifTolerance);
  const layers = sceneLayers(scene, pattern);
  if (expanded) {
    let count = 0;
    for (const layer of layers) {
      if (layer.kind === 'fill') {
        for (const m of layer.matrices)
          geometries.push(
            ...clipGeometry(
              layer.geometry,
              cropRegion,
              multiply(placement, m),
              options.outlineStrokes,
              options.tolerance,
            ),
          );
      } else
        for (const t of layer.placements
          ? scene.instances.flatMap((i) => layer.placements!.map((m) => multiply(i.matrix, m)))
          : transforms)
          for (const shape of layer.geometry) {
            geometries.push(
              ...clipGeometry(
                shape,
                cropRegion,
                multiply(placement, t),
                options.outlineStrokes,
                options.tolerance,
              ),
            );
            if (++count % 100 === 0) onProgress?.(count / total);
          }
    }
  }
  if (expanded && tiling && options.includeTileOutlines)
    for (const contour of tileContours(tiling, tileInstances(tiling, visible)))
      geometries.push(...clipGeometry(contour, cropRegion, placement, false, options.tolerance));
  const mask = region ? regionData(region) : latticeMask,
    motifDefs: string[] = [];
  let decorated = false;
  const renderLayer = (layer: (typeof layers)[number], index: number): string => {
    if (layer.kind === 'fill')
      return layer.matrices
        .map((m) =>
          renderPath({
            ...layer.geometry,
            transform: multiply(multiply(placement, m), layer.geometry.transform),
          }),
        )
        .join('');
    const subset = {
        ...scene,
        generated: {
          ...scene.generated,
          geometry: layer.geometry,
          placements: layer.placements ?? scene.generated.placements,
        },
      },
      id = index === 0 ? 'motif' : 'motif-' + index,
      decorations = !decorated;
    decorated = true;
    if (scene.tiling)
      return tiledMarkup(
        subset,
        renderMotifPath,
        index === 0 ? 'export-tile' : 'export-tile-' + index,
        placement,
        decorations && (options.includeTileOutlines ?? false),
        '',
        true,
      );
    const layerTransforms = layer.placements
      ? scene.instances.flatMap((i) => layer.placements!.map((m) => multiply(i.matrix, m)))
      : transforms;
    if (pattern.symmetry.family === 'none' && !pattern.composition?.enabled)
      return layerTransforms
        .flatMap((t) =>
          layer.geometry.map((shape) =>
            renderPath({ ...shape, transform: multiply(multiply(placement, t), shape.transform) }),
          ),
        )
        .join('');
    motifDefs.push(`<g id="${id}">${layer.geometry.map(renderMotifPath).join('')}</g>`);
    return layerTransforms
      .map(
        (t) =>
          `<use href="#${id}" xlink:href="#${id}" transform="${matrixString(multiply(placement, t))}"/>`,
      )
      .join('');
  };
  let content = expanded ? geometries.map(renderPath).join('') : layers.map(renderLayer).join('');
  const defs = `<defs>${motifDefs.join('')}${mask ? `<clipPath id="region"><path d="${escapeXML(mask)}" clip-rule="evenodd"/></clipPath>` : ''}</defs>`;
  // Expanded applications contain real intersections and no masks/definitions.
  if (options.target === 'tile' && !expanded && !scene.tiling) {
    content = `${defs}<defs><pattern id="tile" patternUnits="userSpaceOnUse" width="${bounds.width}" height="${bounds.height}">${content}</pattern></defs><rect width="${bounds.width}" height="${bounds.height}" fill="url(#tile)"/>`;
  } else if (mask && !expanded) content = `${defs}<g clip-path="url(#region)">${content}</g>`;
  else if (
    !expanded &&
    !scene.tiling &&
    options.target !== 'tile' &&
    (pattern.symmetry.family !== 'none' || pattern.composition?.enabled)
  )
    content = defs + content;
  if (region && application?.showOutline) {
    const outlines: Geometry[] = [
      {
        ...region.geometry[0],
        kind: 'compound',
        pathData: regionData(region),
        transform: IDENTITY,
        fill: 'none',
      },
    ];
    content += outlines.map(renderPath).join('');
    if (expanded) geometries.push(...outlines);
  }
  const metadata = {
    units: 'mm',
    symmetry: pattern.symmetry,
    status: tiling ? 'PERIODIC_SEAMLESS' : scene.status,
    ...(tiling ? { tiling, motifSymmetry: 'local-to-tile' } : {}),
    algorithmVersion: pattern.generator.version,
    ...(pattern.composition?.enabled
      ? {
          composition: pattern.composition,
          validity: { affineTransforms: 'EXACT', tessellation: 'UNVERIFIED' },
          example: project.metadata.example,
        }
      : {}),
  };
  content = `<metadata>${escapeXML(JSON.stringify(metadata))}</metadata>` + content;
  return {
    svg: svgDocument(content, bounds, options.transparent ? undefined : options.background),
    geometries,
    bounds,
    warnings,
  };
}

/** Exports always resolve confirmed state; UI hover is never an input. */
export function prepareExport(
  project: Project,
  options: ExportOptions,
  onProgress?: (n: number) => void,
): ExportResult {
  if (options.scope !== 'composition' || options.target === 'application')
    return preparePatternExport(project, options, onProgress);
  const patterns = project.patterns.filter((p) => p.visible).map((p) => resolvePattern(p, project));
  if (!patterns.length) throw Error('La composición no tiene conjuntos visibles.');
  if (patterns.length === 1)
    return preparePatternExport(
      { ...project, patterns },
      { ...options, scope: 'pattern', patternId: patterns[0].id },
      onProgress,
    );
  if (options.target === 'fundamental')
    throw Error(
      'Una composición de grupos distintos no tiene un dominio fundamental común verificado. Exportá una región finita o elegí un conjunto.',
    );
  const cell = commonRectangularCell(patterns);
  let bounds: Bounds = {
    x: -options.width / 2,
    y: -options.height / 2,
    width: options.width,
    height: options.height,
  };
  if (options.target === 'tile' || options.target === 'lattice') {
    if (!cell)
      throw Error(
        'Los conjuntos no tienen una celda seamless común verificada. Exportá una región finita.',
      );
    bounds = { x: 0, y: 0, ...cell };
  }
  const results = patterns.map((pat, i) =>
    preparePatternExport(
      { ...project, patterns: [pat] },
      { ...options, target: 'view', scope: 'pattern', patternId: pat.id, transparent: true },
      (n) => onProgress?.((i + n) / patterns.length),
      bounds,
    ),
  );
  const content = results
    .map((r, i) => {
      const start = r.svg.indexOf('>', r.svg.indexOf('<svg')) + 1;
      return r.svg
        .slice(start, r.svg.lastIndexOf('</svg>'))
        .replace(
          /(id="|href="#|xlink:href="#|url\(#)([\w-]+)/g,
          (_, prefix: string, id: string) => prefix + `set-${i}-` + id,
        );
    })
    .join('');
  return {
    svg: svgDocument(content, bounds, options.transparent ? undefined : options.background),
    bounds,
    geometries: results.flatMap((r) => r.geometries),
    warnings: [
      ...new Set([
        ...results.flatMap((r) => r.warnings),
        ...(!cell
          ? [
              'Composición de conjuntos independientes: no hay periodicidad bidimensional común verificada.',
            ]
          : []),
      ]),
    ],
  };
}
