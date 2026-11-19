import { sceneLayers } from '../patterns/layers';
import { useFill } from '../fill/useFill';
import { TileEditor } from '../tiling/TileEditor';
import { tiledMarkup } from '../tiling/render';
import { tileBounds, tileBasis, tileFrame, tileWorldBounds } from '../tiling/tiles';
import { svgPath } from '../export/svg';
import { cachedStructure, structureMarkup } from '../symmetry/structure';
import { resolvePattern, symmetryOrigin, frameBounds } from '../symmetry/config';
import {
  chooseCapture,
  captureCandidates,
  hitCandidates,
  capturedPoint,
  identityCapture,
  type CaptureContext,
  type CaptureInstance,
} from './capture';
import {
  useState,
  useRef,
  useMemo,
  useEffect,
  useId,
  type PointerEvent as RPointerEvent,
} from 'react';
import { ZoomIn, ZoomOut, Maximize, Scan, Grid2X2, Hand, Eye, EyeOff } from 'lucide-react';
import type { Studio } from '../app/useStudio';
import { geometry, node, uid, type Geometry, type Node } from '../app/model';
import {
  IDENTITY,
  apply,
  inverse,
  multiply,
  translate,
  matrixString,
  sub,
  distance,
  type Matrix,
  type Point,
} from '../geometry/matrix';
import { pathData, simplifyPoints } from '../geometry/paths';
import { paperPath, scope, smoothNodes } from '../geometry/paper';
import { buildScene, type Scene } from '../patterns/engine';
import { lattice, latticeVectors, fundamentalDomain, type Bounds } from '../symmetry/groups';
import { symmetryGuides, verifyPeriodicity } from '../symmetry/guides';
import { geometryBounds, regionData, hasClosedGeometry } from '../application/clipping';

interface Props {
  studio: Studio;
  editorOnly?: boolean;
  previewOnly?: boolean;
}
interface Drag {
  type: 'pan' | 'move' | 'node' | 'draw' | 'penhandle' | 'marquee' | 'origin' | 'orientation';
  capture?: CaptureContext;
  patternId?: string;
  start: Point;
  last?: Point;
  view?: Bounds;
  viewPixelWidth?: number;
  ids?: string[];
  transforms?: Map<string, Matrix>;
  matrix?: Matrix;
  id?: string;
  index?: number;
  handle?: 'node' | 'in' | 'out';
  baseNode?: Node;
  shape?: Geometry;
}
function safeScene(
  pattern: Studio['pattern'],
  bounds: Bounds,
): { scene: Scene | null; error: string } {
  try {
    return { scene: buildScene(pattern, bounds), error: '' };
  } catch (e) {
    return { scene: null, error: (e as Error).message };
  }
}
export function Canvas({ studio: s, editorOnly = false, previewOnly = false }: Props) {
  const activePattern = s.effectivePattern;
  const [view, setView] = useState<Bounds>({ x: -110, y: -100, width: 300, height: 240 }),
    [size, setSize] = useState({ width: 1000, height: 800 }),
    [cursor, setCursor] = useState<Point>({ x: 0, y: 0 }),
    [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null),
    container = useRef<HTMLDivElement>(null),
    drag = useRef<Drag | null>(null),
    pathDraft = useRef<{
      id: string;
      anchors: Node[];
      tool: string;
      mode: string;
      patternId: string;
      region: boolean;
      capture: CaptureContext;
    } | null>(null),
    space = useRef(false),
    lastPointer = useRef<Point>({ x: 0, y: 0 });
  const [captureLabel, setCaptureLabel] = useState(''),
    [captureCount, setCaptureCount] = useState(0);
  const alternatives = useRef<CaptureInstance[]>([]),
    captureContext = useRef<CaptureContext | null>(null);
  const prefix = useId().replace(/:/g, ''),
    scalePx = size.width / view.width;
  const actualView = useMemo(
    () => ({ ...view, height: (view.width * size.height) / size.width }),
    [view, size],
  );
  useEffect(() => {
    if (!container.current) return;
    let measuredWidth: number | undefined;
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      const width = Math.max(1, r.width);
      if (measuredWidth !== undefined && measuredWidth !== width) {
        const ratio = width / measuredWidth;
        setView((v) => ({ ...v, width: v.width * ratio }));
      }
      measuredWidth = width;
      setSize({ width, height: Math.max(1, r.height) });
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const structure = useMemo(
    () =>
      s.project.preferences.structureVisible &&
      !editorOnly &&
      s.mode !== 'apply' &&
      activePattern.generator.kind !== 'penrose' &&
      activePattern.symmetry.family !== 'none'
        ? cachedStructure(
            activePattern.symmetry,
            activePattern.tiling ? tileBounds(activePattern.tiling) : actualView,
          )
        : null,
    [
      s.project.preferences.structureVisible,
      editorOnly,
      s.mode,
      activePattern.symmetry,
      activePattern.generator.kind,
      activePattern.tiling,
      actualView,
    ],
  );
  const { scene, error } = useMemo(
    () => safeScene(activePattern, actualView),
    [activePattern, actualView],
  );
  const patternLayers = useMemo(
    () => s.visiblePatterns.map((pattern) => ({ pattern, ...safeScene(pattern, actualView) })),
    [s.visiblePatterns, actualView],
  );
  const fill = useFill(
    s,
    patternLayers.filter((l) => !!l.scene),
    actualView,
    s.tool === 'fill' && !previewOnly && s.mode !== 'apply',
  );
  const point = (event: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: p.x, y: p.y };
  };
  const snap = (p: Point): Point => {
    if (!s.project.preferences.snap) return p;
    const limit = 8 / scalePx;
    for (const g of s.objects)
      if (!s.selected.includes(g.id))
        for (const n of g.nodes) {
          const q = apply(g.transform, n);
          if (distance(p, q) < limit) return q;
        }
    const grid = 5;
    return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid };
  };
  const addShape = (g: Geometry) => {
    if (s.mode === 'apply' && !s.region) {
      const id = uid();
      s.change((p) => {
        p.regions.push({ id, name: `Perímetro ${p.regions.length + 1}`, geometry: [g] });
      }, true);
      s.setRegionId(id);
    } else if (s.mode === 'apply') s.editObjects((objects) => objects.push(g), true);
    else {
      s.change((p) => {
        const pat = p.patterns.find(
          (p) => p.id === (captureContext.current?.patternId ?? s.patternId),
        );
        if (pat) pat.sourceGeometry.push(g);
      }, true);
      s.commit();
    }
  };
  const updateShape = (id: string, recipe: (g: Geometry) => void) => {
    // Resolve region by shape ID as the first pointer event may precede a React render.
    s.change((p) => {
      const objects = [
        ...p.patterns.flatMap((p) => p.sourceGeometry),
        ...p.regions.flatMap((r) => r.geometry),
      ];
      const g = objects.find((g) => g.id === id);
      if (g) recipe(g);
    }, true);
  };
  const discardInvalidRegion = (id: string) => {
    const region = s.projectRef.current.regions.find((r) => r.geometry.some((g) => g.id === id)),
      shape = region?.geometry.find((g) => g.id === id);
    if (!shape || hasClosedGeometry(shape)) return;
    s.change((p) => {
      for (const r of p.regions) r.geometry = r.geometry.filter((g) => g.id !== id);
      p.regions = p.regions.filter((r) => r.geometry.length);
      p.applications = p.applications.filter((a) => p.regions.some((r) => r.id === a.regionId));
    }, true);
    if (region?.geometry.length === 1) s.setRegionId('');
    s.setSelected([]);
    s.setMessage(
      'El perímetro no encierra un área. Dibujá al menos tres puntos o una curva cerrada con área.',
    );
  };
  const finishPath = (closed = false) => {
    const draft = pathDraft.current;
    if (!draft) return;
    if (draft.anchors.length >= 2) {
      updateShape(draft.id, (g) => {
        g.nodes = structuredClone(draft.anchors);
        g.closed = closed || draft.region;
      });
      s.setSelected([draft.id]);
      if (draft.region) discardInvalidRegion(draft.id);
      if (draft.region) s.commit();
      else s.finishDrawing(draft.id);
    } else {
      s.change((p) => {
        for (const pat of p.patterns)
          pat.sourceGeometry = pat.sourceGeometry.filter((g) => g.id !== draft.id);
        for (const r of p.regions) r.geometry = r.geometry.filter((g) => g.id !== draft.id);
        p.regions = p.regions.filter((r) => r.geometry.length);
      }, true);
      if (draft.region) s.commit();
      else s.finishDrawing(draft.id, true);
    }
    captureContext.current = null;
    setCaptureLabel('');
    pathDraft.current = null;
    drag.current = null;
  };
  const cancelPath = () => {
    const draft = pathDraft.current;
    if (!draft) return;
    s.change((p) => {
      for (const pat of p.patterns)
        pat.sourceGeometry = pat.sourceGeometry.filter((g) => g.id !== draft.id);
      for (const r of p.regions) r.geometry = r.geometry.filter((g) => g.id !== draft.id);
      p.regions = p.regions.filter((r) => r.geometry.length);
    }, true);
    pathDraft.current = null;
    drag.current = null;
    s.finishDrawing(draft.id, true);
    captureContext.current = null;
    setCaptureLabel('');
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches('input,textarea,select')) return;
      if (
        e.key !== 'Escape' &&
        e.target instanceof HTMLElement &&
        e.target.matches('button,[role=option]')
      )
        return;
      if (e.code === 'Space') {
        space.current = true;
        e.preventDefault();
      }
      if (s.tool === 'fill' && !s.styleOpen) {
        if (e.key === 'Escape') {
          fill.cancel();
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          fill.cycle();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          fill.confirm();
          return;
        }
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        finishPath(e.shiftKey);
      }
      if (e.key === 'Escape') {
        if (s.styleOpen) return;
        if (pathDraft.current) cancelPath();
        else {
          s.setSelected([]);
          s.setTool('select');
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') space.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });
  useEffect(() => {
    const draft = pathDraft.current;
    if (
      draft &&
      (draft.tool !== s.tool ||
        draft.region !== (s.mode === 'apply') ||
        draft.patternId !== s.patternId)
    )
      finishPath(false);
  }, [s.tool, s.mode, s.patternId]); // Finish an existing path when changing context.
  const selectAcrossLayers = (event: RPointerEvent): boolean => {
    if (previewOnly || !['select', 'nodes'].includes(s.tool) || space.current || event.button !== 0)
      return false;
    const p = point(event);
    const selectableLayers = s.symmetryPreview
      ? s.project.patterns
          .filter((p) => p.visible)
          .map((p) => {
            const pattern = resolvePattern(p, s.project);
            return { pattern, ...safeScene(pattern, actualView) };
          })
      : patternLayers;
    s.setSymmetryPreview(null);
    for (const layer of [...selectableLayers].reverse()) {
      if (!layer.scene) continue;
      const candidates = captureCandidates(layer.pattern, layer.scene, p),
        hits = hitCandidates(layer.pattern, candidates, p, 7 / scalePx);
      if (!hits.length) continue;
      const chosen = hits[event.altKey && hits.length > 1 ? 1 : 0],
        shape = layer.pattern.sourceGeometry.find((g) => g.id === chosen.shapeId)!;
      let ids =
        s.patternId === layer.pattern.id && s.selected.includes(shape.id) ? s.selected : [shape.id];
      if (shape.groupId && !event.altKey)
        ids = layer.pattern.sourceGeometry
          .filter((g) => g.groupId === shape.groupId)
          .map((g) => g.id);
      if (event.shiftKey && s.patternId === layer.pattern.id)
        ids = [...new Set([...s.selected, ...ids])];
      event.stopPropagation();
      svgRef.current?.setPointerCapture(event.pointerId);
      s.setPatternId(layer.pattern.id);
      s.setSelected(ids);
      s.setInstance(chosen.matrix);
      s.setInstanceExplicit(true);
      alternatives.current = hits;
      setCaptureCount(hits.length);
      drag.current = {
        type: 'move',
        start: apply(chosen.inverse, p),
        ids,
        patternId: layer.pattern.id,
        transforms: new Map(
          layer.pattern.sourceGeometry
            .filter((g) => ids.includes(g.id))
            .map((g) => [g.id, g.transform]),
        ),
        matrix: chosen.matrix,
      };
      return true;
    }
    return false;
  };
  const selectInstance = (event: RPointerEvent, transform: Matrix, objects = s.objects) => {
    if (s.mode !== 'apply' && !editorOnly) {
      selectAcrossLayers(event);
      return;
    }
    if (previewOnly || !['select', 'nodes'].includes(s.tool) || space.current || event.button !== 0)
      return;
    const p = apply(inverse(transform), point(event));
    let hit: Geometry | undefined;
    for (const g of [...objects].reverse()) {
      if (!g.visible || g.locked) continue;
      const path = paperPath(g);
      try {
        const loc = path.getNearestPoint(new scope.Point(p.x, p.y));
        if (
          (g.fill !== 'none' && path.contains(new scope.Point(p.x, p.y))) ||
          (loc && distance(p, { x: loc.x, y: loc.y }) < Math.max(7 / scalePx, g.strokeWidth / 2))
        ) {
          hit = g;
          break;
        }
      } finally {
        path.remove();
      }
    }
    if (!hit) {
      if (scene?.generated.geometry.some((g) => g.id.startsWith('generated-')))
        s.setMessage(
          'Esta curva es paramétrica. Ajustá el generador o usá «Convertir generador a paths» para editar nodos.',
        );
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    let ids = s.selected.includes(hit.id) ? s.selected : [hit.id];
    if (hit.groupId && !event.altKey)
      ids = objects.filter((g) => g.groupId === hit!.groupId).map((g) => g.id);
    if (event.shiftKey)
      ids = s.selected.includes(hit.id)
        ? s.selected.filter((id) => id !== hit!.id)
        : [...s.selected, ...ids];
    s.setSelected([...new Set(ids)]);
    s.setInstance(transform);
    s.setInstanceExplicit(true);
    drag.current = {
      type: 'move',
      start: apply(inverse(transform), point(event)),
      ids,
      transforms: new Map(
        objects.filter((g) => ids.includes(g.id)).map((g) => [g.id, g.transform]),
      ),
      matrix: transform,
    };
  };
  const startNode = (
    event: RPointerEvent,
    id: string,
    index: number,
    handle: 'node' | 'in' | 'out',
  ) => {
    if (previewOnly) return;
    s.setNodeIndex(index);
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const shape = s.objects.find((g) => g.id === id)!;
    const matrix = multiply(s.instance, shape.transform);
    drag.current = {
      type: 'node',
      start: point(event),
      matrix,
      id,
      index,
      handle,
      baseNode: structuredClone(shape.nodes[index]),
    };
  };
  useEffect(() => {
    const draft = pathDraft.current;
    if (
      draft &&
      !s.project.patterns.some((p) => p.sourceGeometry.some((g) => g.id === draft.id)) &&
      !s.project.regions.some((r) => r.geometry.some((g) => g.id === draft.id))
    ) {
      pathDraft.current = null;
      captureContext.current = null;
      drag.current = null;
      setCaptureLabel('');
    }
  }, [s.project]);
  const willConfirmFill = (event: RPointerEvent<SVGSVGElement>) =>
    s.tool === 'fill' &&
    !!fill.preview &&
    !!fill.position &&
    distance(point(event), fill.position) < 2 / scalePx &&
    event.pointerType !== 'touch';
  const pointerDown = (event: RPointerEvent<SVGSVGElement>) => {
    if (event.button === 2) return;
    svgRef.current?.focus();
    s.setSymmetryPreview(null);
    const p = point(event);
    if (s.styleOpen && !s.project.preferences.stylePanelPinned && !willConfirmFill(event))
      s.setStyleOpen(false);
    lastPointer.current = p;
    if (event.button === 1 || space.current || s.tool === 'pan') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        type: 'pan',
        start: { x: event.clientX, y: event.clientY },
        view: { ...view },
        viewPixelWidth: size.width,
      };
      return;
    }
    if (previewOnly) return;
    if (s.tool === 'fill') {
      if (s.mode === 'apply') {
        s.setMessage('Fill trabaja sobre los conjuntos de Diseño.');
        return;
      }
      if (
        fill.preview &&
        fill.position &&
        distance(p, fill.position) < 2 / scalePx &&
        event.pointerType !== 'touch'
      )
        fill.confirm();
      else fill.query(p);
      return;
    }
    let q = snap(p);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (s.tool === 'select' || s.tool === 'nodes') {
      if (s.mode !== 'apply' && !editorOnly && selectAcrossLayers(event)) return;
      s.setSelected([]);
      s.setInstance(IDENTITY);
      drag.current = { type: 'marquee', start: p };
      return;
    }
    let capture = pathDraft.current?.capture;
    if (!capture) {
      if (s.mode === 'apply' || editorOnly || !scene)
        capture = identityCapture(s.patternId, p, s.tool);
      else {
        const capturePattern = s.symmetryPreview
          ? resolvePattern(s.pattern, s.project)
          : activePattern;
        const captureScene = s.symmetryPreview ? buildScene(capturePattern, actualView) : scene;
        const picked = chooseCapture(
          capturePattern,
          captureScene,
          p,
          7 / scalePx,
          s.instanceExplicit ? s.instance : undefined,
        );
        alternatives.current = picked.candidates;
        setCaptureCount(picked.candidates.length);
        capture = {
          patternId: s.patternId,
          tool: s.tool,
          instance: picked.candidates[event.altKey && picked.candidates.length > 1 ? 1 : 0],
        };
      }
    }
    captureContext.current = capture;
    q = capturedPoint(capture, q);
    s.setInstance(capture.instance.matrix);
    setCaptureLabel(
      `Captura fija · ${capture.instance.id === 'source' ? 'fuente' : capture.instance.matrix[0] * capture.instance.matrix[3] - capture.instance.matrix[1] * capture.instance.matrix[2] < 0 ? 'copia reflejada' : 'copia vinculada'}`,
    );
    if (s.tool === 'pen' || s.tool === 'polygon' || s.tool === 'region') {
      const current = pathDraft.current;
      if (
        current &&
        current.anchors.length >= 3 &&
        distance(q, current.anchors[0]) < 10 / scalePx
      ) {
        finishPath(true);
        return;
      }
      if (!current) {
        const g = { ...geometry('path', [node(q.x, q.y)], false), ...s.drawStyle };
        g.name = s.mode === 'apply' ? 'Perímetro' : 'Curva';
        if (s.mode === 'apply') g.fill = '#dce6d4';
        addShape(g);
        pathDraft.current = {
          id: g.id,
          anchors: [node(q.x, q.y)],
          tool: s.tool,
          mode: s.mode,
          patternId: s.patternId,
          region: s.mode === 'apply',
          capture,
        };
      } else {
        current.anchors.push(node(q.x, q.y));
        updateShape(current.id, (g) => {
          g.nodes = structuredClone(current.anchors);
        });
      }
      const draft = pathDraft.current!;
      drag.current = {
        type: 'penhandle',
        id: draft.id,
        index: draft.anchors.length - 1,
        start: q,
        capture: draft.capture,
      };
      return;
    }
    const kind = ['rectangle', 'ellipse'].includes(s.tool)
      ? (s.tool as 'rectangle' | 'ellipse')
      : 'path';
    const g = geometry(
      kind,
      [node(q.x, q.y), node(q.x, q.y)],
      kind !== 'path' || s.mode === 'apply',
    );
    Object.assign(g, s.drawStyle);
    if (kind !== 'path')
      g.parameters = { x: q.x, y: q.y, width: 0.1, height: 0.1, radius: 0, sides: 5 };
    if (s.mode === 'apply') g.fill = '#dce6d4';
    addShape(g);
    s.setSelected([g.id]);
    drag.current = { type: 'draw', start: q, id: g.id, shape: g, capture };
  };
  const pointerMove = (event: RPointerEvent<SVGSVGElement>) => {
    if (s.tool === 'fill' && !drag.current && !previewOnly) fill.query(point(event));
    const p = point(event);
    setCursor(p);
    lastPointer.current = p;
    const d = drag.current;
    if (!d) {
      if (pathDraft.current) {
        const draft = pathDraft.current;
        const q = capturedPoint(draft.capture, snap(p));
        updateShape(draft.id, (g) => {
          g.nodes = [...structuredClone(draft.anchors), node(q.x, q.y)];
        });
      }
      return;
    }
    if (d.type === 'origin') {
      const next = activePattern.tiling
        ? apply(inverse(tileFrame(activePattern.tiling)), snap(p))
        : snap(p);
      s.patchSymmetry(
        activePattern.symmetry.family === 'radial' ? { center: next } : { origin: next },
        true,
        true,
      );
      return;
    }
    if (d.type === 'orientation') {
      const origin = symmetryOrigin(activePattern.symmetry),
        q = activePattern.tiling ? apply(inverse(tileFrame(activePattern.tiling)), p) : p;
      let angle = (Math.atan2(q.y - origin.y, q.x - origin.x) * 180) / Math.PI;
      if (event.shiftKey) angle = Math.round(angle / 15) * 15;
      s.patchSymmetry({ orientation: angle }, true, true);
      return;
    }
    if (d.type === 'pan') {
      const ratio = d.view!.width / (d.viewPixelWidth ?? size.width);
      setView({
        ...d.view!,
        x: d.view!.x - (event.clientX - d.start.x) * ratio,
        y: d.view!.y - (event.clientY - d.start.y) * ratio,
      });
      return;
    }
    if (d.type === 'move') {
      const current = apply(inverse(d.matrix!), p),
        delta = sub(current, d.start);
      if (s.project.preferences.snap) {
        delta.x = Math.round(delta.x);
        delta.y = Math.round(delta.y);
      }
      s.change((project) => {
        const objects = [
          ...project.patterns.flatMap((p) => p.sourceGeometry),
          ...project.regions.flatMap((r) => r.geometry),
        ];
        for (const g of objects)
          if (d.ids!.includes(g.id)) {
            const m = d.transforms!.get(g.id)!;
            g.transform = multiply(translate(delta.x, delta.y), m);
          }
      }, true);
    }
    if (d.type === 'node') {
      const q = apply(inverse(d.matrix!), p);
      updateShape(d.id!, (g) => {
        const n = g.nodes[d.index!];
        if (d.handle === 'node') {
          const snapped = s.project.preferences.snap
            ? { x: Math.round(q.x), y: Math.round(q.y) }
            : q;
          n.x = snapped.x;
          n.y = snapped.y;
        } else {
          n[d.handle!] = sub(q, n);
          if (!event.altKey) {
            const other = d.handle === 'in' ? 'out' : 'in';
            n[other] = { x: -n[d.handle!].x, y: -n[d.handle!].y };
          }
        }
      });
    }
    if (d.type === 'draw') {
      const q = d.capture
        ? capturedPoint(d.capture, d.capture.tool === 'pencil' ? p : snap(p))
        : snap(p);
      updateShape(d.id!, (g) => {
        if (g.parameters) {
          g.parameters = {
            ...g.parameters,
            x: Math.min(d.start.x, q.x),
            y: Math.min(d.start.y, q.y),
            width: Math.max(0.01, Math.abs(q.x - d.start.x)),
            height: Math.max(0.01, Math.abs(q.y - d.start.y)),
          };
          if (event.shiftKey) g.parameters.height = g.parameters.width;
        } else if ((d.capture?.tool ?? s.tool) === 'pencil') {
          if (distance(g.nodes.at(-1)!, q) > 0.6 / scalePx) g.nodes.push(node(q.x, q.y));
        } else g.nodes = [node(d.start.x, d.start.y), node(q.x, q.y)];
      });
    }
    if (d.type === 'penhandle' && s.tool === 'pen') {
      const q = d.capture ? capturedPoint(d.capture, snap(p)) : snap(p),
        delta = sub(q, d.start),
        draft = pathDraft.current!;
      draft.anchors[d.index!].out = delta;
      draft.anchors[d.index!].in = { x: -delta.x, y: -delta.y };
      updateShape(d.id!, (g) => {
        g.nodes = structuredClone(draft.anchors);
      });
    }
    if (d.type === 'marquee') setMarquee({ start: d.start, end: p });
  };
  const pointerUp = (event: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.type === 'draw' && (d.capture?.tool ?? s.tool) === 'pencil')
      updateShape(d.id!, (g) => {
        g.nodes = smoothNodes(
          simplifyPoints(g.nodes, 0.25).map((p) => node(p.x, p.y)),
          g.closed,
        );
      });
    if (d.type === 'marquee' && marquee) {
      const lo = {
          x: Math.min(marquee.start.x, marquee.end.x),
          y: Math.min(marquee.start.y, marquee.end.y),
        },
        hi = {
          x: Math.max(marquee.start.x, marquee.end.x),
          y: Math.max(marquee.start.y, marquee.end.y),
        };
      s.setSelected(
        s.objects
          .filter((g) => {
            if (g.locked) return false;
            const b = geometryBounds([g]);
            return b.x >= lo.x && b.y >= lo.y && b.x + b.width <= hi.x && b.y + b.height <= hi.y;
          })
          .map((g) => g.id),
      );
      setMarquee(null);
    }
    if (d.type === 'draw' && s.mode === 'apply') discardInvalidRegion(d.id!);
    if (d.type === 'draw' && s.mode !== 'apply') s.finishDrawing(d.id!);
    else if (d.type !== 'penhandle' && d.type !== 'pan' && d.type !== 'marquee') s.commit();
    if (!pathDraft.current) {
      captureContext.current = null;
      setCaptureLabel('');
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const zoom = (
    factor: number,
    center: Point = {
      x: actualView.x + actualView.width / 2,
      y: actualView.y + actualView.height / 2,
    },
  ) =>
    setView((v) => {
      const width = Math.max(10, Math.min(10000, v.width * factor)),
        f = width / v.width;
      return {
        ...v,
        width,
        x: center.x + (v.x - center.x) * f,
        y: center.y + (v.y - center.y) * f,
      };
    });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoom(Math.exp(e.deltaY * 0.002), point(e));
      else
        setView((v) => ({
          ...v,
          x: v.x + (e.deltaX * v.width) / size.width,
          y: v.y + (e.deltaY * v.width) / size.width,
        }));
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  });
  const fit = (patternView = false) => {
    let b: Bounds;
    if (s.mode === 'apply' && s.region) b = geometryBounds(s.region.geometry);
    else if (patternView && activePattern.tiling && activePattern.generator.kind !== 'penrose')
      b = tileWorldBounds(activePattern.tiling);
    else if (patternView && activePattern.symmetry.family === 'wallpaper') {
      const cell = frameBounds(activePattern.symmetry);
      b = {
        x: cell.x - cell.width,
        y: cell.y - cell.height,
        width: cell.width * 3,
        height: cell.height * 3,
      };
    } else if (activePattern.generator.kind === 'penrose')
      b = {
        x: -activePattern.generator.radius,
        y: -activePattern.generator.radius,
        width: activePattern.generator.radius * 2,
        height: activePattern.generator.radius * 2,
      };
    else b = geometryBounds(s.objects);
    const width = Math.max(b.width + 30, ((b.height + 30) * size.width) / size.height);
    setView({
      x: b.x + b.width / 2 - width / 2,
      y: b.y + b.height / 2 - (width * size.height) / size.width / 2,
      width,
      height: (width * size.height) / size.width,
    });
  };
  const renderShape = (g: Geometry) => (
    <g key={g.id} dangerouslySetInnerHTML={{ __html: svgPath(g) }} />
  );
  const selectCached = (e: RPointerEvent, sc: Scene, placement: Matrix) => {
    if (s.mode !== 'apply') {
      selectAcrossLayers(e);
      return;
    }
    if (previewOnly || !['select', 'nodes'].includes(s.tool) || space.current || e.button !== 0)
      return;
    const p = point(e),
      shapes = [...s.objects]
        .reverse()
        .filter((g) => g.visible && !g.locked)
        .map((g) => ({ g, path: paperPath(g) }));
    try {
      for (const instance of [...sc.instances].reverse())
        for (const place of [...sc.generated.placements].reverse()) {
          const matrix = multiply(placement, multiply(instance.matrix, place)),
            q = apply(inverse(matrix), p),
            paperPoint = new scope.Point(q.x, q.y);
          for (const { g, path } of shapes) {
            if (!path.bounds.expand(14 / scalePx).contains(paperPoint)) continue;
            const near = path.getNearestPoint(paperPoint);
            if (
              (g.fill !== 'none' && path.contains(paperPoint)) ||
              (near &&
                distance(q, { x: near.x, y: near.y }) < Math.max(7 / scalePx, g.strokeWidth / 2))
            ) {
              selectInstance(e, matrix);
              return;
            }
          }
        }
    } finally {
      shapes.forEach((x) => x.path.remove());
    }
  };
  const renderPatternBody = (
    sc: Scene,
    id: string,
    placement: Matrix = IDENTITY,
    interactive = true,
    pat = activePattern,
    decorations = true,
  ) => {
    if (sc.tiling) {
      const underlay =
        decorations &&
        s.project.preferences.structureVisible &&
        s.mode !== 'apply' &&
        !editorOnly &&
        pat.id === activePattern.id
          ? structureMarkup(
              cachedStructure(pat.symmetry, tileBounds(sc.tiling.definition)),
              s.project.preferences.structureOpacity,
              scalePx,
            )
          : '';
      return (
        <g
          data-tiled-pattern={pat.id}
          onPointerDown={interactive ? (e) => selectAcrossLayers(e) : undefined}
          dangerouslySetInnerHTML={{
            __html: tiledMarkup(
              sc,
              svgPath,
              id,
              placement,
              decorations && sc.tiling.definition.showOutline,
              underlay,
            ),
          }}
        />
      );
    }
    const count = sc.instances.length * sc.generated.placements.length;
    if (count > 18000)
      return (
        <text x={view.x + 10} y={view.y + 15} fontSize={4}>
          Demasiadas instancias. Aumentá la celda o acercá la vista.
        </text>
      );
    if (
      count * sc.generated.geometry.length > 15000 &&
      pat.symmetry.family === 'wallpaper' &&
      !sc.generated.finite
    ) {
      const basis = lattice(pat.symmetry),
        inv = inverse(basis),
        corners = [
          { x: 0, y: 0 },
          { x: basis[0], y: basis[1] },
          { x: basis[2], y: basis[3] },
          { x: basis[0] + basis[2], y: basis[1] + basis[3] },
        ];
      const tile = buildScene(pat, {
        x: Math.min(...corners.map((p) => p.x)),
        y: Math.min(...corners.map((p) => p.y)),
        width: Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x)),
        height: Math.max(...corners.map((p) => p.y)) - Math.min(...corners.map((p) => p.y)),
      });
      const ids = new Set(sc.generated.geometry.map((g) => g.id));
      tile.generated.geometry = tile.generated.geometry.filter((g) => ids.has(g.id));
      return (
        <>
          <defs>
            <g id={id}>{sc.generated.geometry.map(renderShape)}</g>
            <pattern
              id={`${id}-repeat`}
              width={1}
              height={1}
              patternUnits="userSpaceOnUse"
              patternTransform={matrixString(multiply(placement, basis))}
            >
              <g transform={matrixString(inv)}>
                {tile.instances.map((i) => (
                  <g key={i.id}>
                    {tile.generated.placements.map((m, k) => (
                      <use
                        key={k}
                        href={`#${id}`}
                        transform={matrixString(multiply(i.matrix, m))}
                      />
                    ))}
                  </g>
                ))}
              </g>
            </pattern>
          </defs>
          <rect
            data-cached-pattern="true"
            x={actualView.x}
            y={actualView.y}
            width={actualView.width}
            height={actualView.height}
            fill={`url(#${id}-repeat)`}
            onPointerDown={interactive ? (e) => selectCached(e, sc, placement) : undefined}
          />
        </>
      );
    }
    return (
      <>
        <defs>
          <g id={id}>{sc.generated.geometry.map(renderShape)}</g>
        </defs>
        {sc.instances.map((i) => (
          <g key={i.id}>
            {sc.generated.placements.map((m, k) => {
              const matrix = multiply(placement, multiply(i.matrix, m));
              return (
                <use
                  key={k}
                  href={`#${id}`}
                  transform={matrixString(matrix)}
                  onPointerDown={interactive ? (e) => selectInstance(e, matrix) : undefined}
                  className={interactive ? 'pattern-instance' : ''}
                />
              );
            })}
          </g>
        ))}
      </>
    );
  };
  const renderPattern = (
    sc: Scene,
    id: string,
    placement: Matrix = IDENTITY,
    interactive = true,
    pat = activePattern,
  ) => {
    let decorated = false;
    return (
      <>
        {sceneLayers(sc, pat).map((layer, index) => {
          if (layer.kind === 'fill')
            return (
              <g
                key={layer.geometry.id}
                data-fill-region={layer.geometry.id}
                onPointerDown={interactive ? (e) => selectAcrossLayers(e) : undefined}
              >
                {layer.matrices.map((m, i) => (
                  <g key={i} transform={matrixString(multiply(placement, m))}>
                    {renderShape(layer.geometry)}
                  </g>
                ))}
              </g>
            );
          const decorations = !decorated;
          decorated = true;
          return (
            <g key={'motif-' + index}>
              {renderPatternBody(
                { ...sc, generated: { ...sc.generated, geometry: layer.geometry } },
                index === 0 ? id : id + '-' + index,
                placement,
                interactive,
                pat,
                decorations,
              )}
            </g>
          );
        })}
      </>
    );
  };
  const selectedShapes = s.objects.filter((g) => s.selected.includes(g.id) && g.visible);
  const [a, b] = latticeVectors(activePattern.symmetry);
  const sym = activePattern.symmetry;
  const domain = useMemo(
    () => fundamentalDomain(sym),
    [
      sym.family,
      sym.group,
      sym.width,
      sym.height,
      sym.angle,
      sym.origin.x,
      sym.origin.y,
      sym.orientation,
    ],
  );
  const mathGuides = useMemo(
    () => symmetryGuides(sym),
    [
      sym.family,
      sym.group,
      sym.width,
      sym.height,
      sym.angle,
      sym.sectors,
      sym.center.x,
      sym.center.y,
      sym.origin.x,
      sym.origin.y,
      sym.orientation,
    ],
  );
  const inspection = useMemo(
    () => verifyPeriodicity(activePattern),
    [sym, activePattern.generator.kind],
  );
  const applications = useMemo(
    () =>
      s.project.applications.map((app) => {
        const region = s.project.regions.find((r) => r.id === app.regionId),
          pat = app.linked
            ? s.project.patterns.find((p) => p.id === app.patternId)
            : app.frozenPattern;
        if (!region || !pat) return null;
        const inv = inverse(app.placementTransform),
          corners = [
            { x: actualView.x, y: actualView.y },
            { x: actualView.x + actualView.width, y: actualView.y },
            { x: actualView.x, y: actualView.y + actualView.height },
            { x: actualView.x + actualView.width, y: actualView.y + actualView.height },
          ].map((p) => apply(inv, p));
        const bounds = {
          x: Math.min(...corners.map((p) => p.x)),
          y: Math.min(...corners.map((p) => p.y)),
          width: Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x)),
          height: Math.max(...corners.map((p) => p.y)) - Math.min(...corners.map((p) => p.y)),
        };
        const effective = resolvePattern(pat, s.project);
        return {
          app,
          region,
          pattern: effective,
          data: regionData(region),
          ...safeScene(effective, bounds),
        };
      }),
    [s.project, actualView],
  );
  return (
    <div
      className={`canvas-container ${editorOnly ? 'source-canvas' : ''} ${previewOnly ? 'preview-canvas' : ''}`}
      ref={container}
    >
      {s.mode !== 'apply' && !previewOnly && (captureLabel || s.instanceExplicit) && (
        <div className="capture-indicator">
          <span>{captureLabel || 'Instancia seleccionada'}</span>
          <button
            disabled={!!captureLabel || captureCount < 2}
            onClick={() => {
              const current = alternatives.current.findIndex((c) =>
                  c.matrix.every((n, i) => Math.abs(n - s.instance[i]) < 1e-8),
                ),
                next = alternatives.current[(current + 1) % alternatives.current.length];
              if (next) {
                s.setInstance(next.matrix);
                s.setInstanceExplicit(true);
              }
            }}
          >
            Otra instancia ({captureCount})
          </button>
        </div>
      )}
      {s.project.preferences.split && (
        <div className="view-label">
          {editorOnly ? 'GEOMETRÍA FUENTE' : 'VISTA DEL PATRÓN'}
          <span>{editorOnly ? 'Editable' : 'Sincronizada'}</span>
        </div>
      )}
      {s.tool === 'fill' && !previewOnly && (
        <div className="fill-actions" role="status">
          <span>{fill.status}</span>
          <button disabled={!fill.preview || fill.busy} onClick={fill.confirm}>
            Confirmar relleno
          </button>
          <button disabled={fill.count < 2} onClick={fill.cycle}>
            Otra región ({fill.count ? fill.index + 1 : 0}/{fill.count})
          </button>
          <button onClick={fill.cancel}>Cancelar cálculo</button>
        </div>
      )}
      <svg
        ref={svgRef}
        className={`studio-canvas tool-${s.tool}`}
        tabIndex={0}
        viewBox={`${actualView.x} ${actualView.y} ${actualView.width} ${actualView.height}`}
        style={{ background: s.project.preferences.background }}
        onPointerDownCapture={(event) => {
          if (s.styleOpen && !s.project.preferences.stylePanelPinned && !willConfirmFill(event))
            s.setStyleOpen(false);
        }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onDoubleClick={() => {
          if (pathDraft.current) {
            const d = pathDraft.current;
            if (d.anchors.length > 2 && distance(d.anchors.at(-1)!, d.anchors.at(-2)!) < 1)
              d.anchors.pop();
            finishPath(s.mode === 'apply');
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={editorOnly ? 'Editor de geometría' : 'Lienzo de patrones'}
      >
        <defs>
          <pattern id={`${prefix}-grid`} width={5} height={5} patternUnits="userSpaceOnUse">
            <circle cx={0} cy={0} r={0.22} fill="#bdcbbd" />
          </pattern>
        </defs>
        {s.project.preferences.grid && (
          <rect
            x={actualView.x}
            y={actualView.y}
            width={actualView.width}
            height={actualView.height}
            fill={`url(#${prefix}-grid)`}
            pointerEvents="none"
          />
        )}
        {structure && !scene?.tiling && (
          <g
            aria-label="Estructura matemática de simetría"
            pointerEvents="none"
            dangerouslySetInnerHTML={{
              __html: structureMarkup(structure, s.project.preferences.structureOpacity, scalePx),
            }}
          />
        )}
        {s.mode !== 'apply' &&
          scene &&
          (editorOnly ? (
            <g onPointerDown={(e) => selectInstance(e, IDENTITY)}>
              {s.objects
                .filter((g) => g.fillRegion && g.fillRegion.scope !== 'source' && g.visible)
                .map(renderShape)}
              {scene.generated.geometry.map(renderShape)}
            </g>
          ) : (
            <>
              {patternLayers.map((layer) => {
                if (!layer.scene) return null;
                const sym = layer.pattern.symmetry,
                  single =
                    s.project.preferences.repetitionView === 'single' &&
                    !layer.scene.generated.finite &&
                    (!!layer.scene.tiling || ['wallpaper', 'frieze'].includes(sym.family));
                const tile = layer.scene.tiling?.definition;
                const basis = tile ? tileBasis(tile) : lattice(sym),
                  o = sym.origin,
                  reach = 2 * Math.hypot(actualView.width, actualView.height),
                  length = Math.hypot(basis[0], basis[1]),
                  normal = { x: (-basis[1] / length) * reach, y: (basis[0] / length) * reach };
                const points = tile
                  ? [
                      { x: 0, y: 0 },
                      { x: basis[0], y: basis[1] },
                      { x: basis[0] + basis[2], y: basis[1] + basis[3] },
                      { x: basis[2], y: basis[3] },
                    ].map((p) => apply(tileFrame(tile), p))
                  : sym.family === 'frieze'
                    ? [
                        { x: o.x - normal.x, y: o.y - normal.y },
                        { x: o.x + basis[0] - normal.x, y: o.y + basis[1] - normal.y },
                        { x: o.x + basis[0] + normal.x, y: o.y + basis[1] + normal.y },
                        { x: o.x + normal.x, y: o.y + normal.y },
                      ]
                    : [
                        o,
                        { x: o.x + basis[0], y: o.y + basis[1] },
                        { x: o.x + basis[0] + basis[2], y: o.y + basis[1] + basis[3] },
                        { x: o.x + basis[2], y: o.y + basis[3] },
                      ];
                const clip = `${prefix}-cell-${layer.pattern.id}`;
                return (
                  <g key={layer.pattern.id} data-pattern-id={layer.pattern.id}>
                    {single && (
                      <defs>
                        <clipPath id={clip}>
                          <polygon points={points.map((p) => `${p.x},${p.y}`).join(' ')} />
                        </clipPath>
                      </defs>
                    )}
                    <g
                      data-single-cell={single || undefined}
                      clipPath={single ? `url(#${clip})` : undefined}
                    >
                      {renderPattern(
                        layer.scene,
                        `${prefix}-motif-${layer.pattern.id}`,
                        IDENTITY,
                        true,
                        layer.pattern,
                      )}
                    </g>
                  </g>
                );
              })}
            </>
          ))}
        {s.mode === 'apply' &&
          applications.map((entry, i) =>
            entry && entry.scene ? (
              <g key={entry.app.id}>
                {s.project.preferences.outside && (
                  <g opacity={0.15} pointerEvents="none">
                    {renderPattern(
                      entry.scene,
                      `${prefix}-outside-${i}`,
                      entry.app.placementTransform,
                      false,
                      entry.pattern,
                    )}
                  </g>
                )}
                <defs>
                  <clipPath id={`${prefix}-region-${i}`}>
                    <path d={entry.data} clipRule="evenodd" />
                  </clipPath>
                </defs>
                <g clipPath={`url(#${prefix}-region-${i})`}>
                  {renderPattern(
                    entry.scene,
                    `${prefix}-app-${i}`,
                    entry.app.placementTransform,
                    false,
                    entry.pattern,
                  )}
                </g>
                {entry.app.showOutline && (
                  <path
                    d={entry.data}
                    fill="none"
                    stroke="#627d58"
                    strokeWidth={0.4}
                    pointerEvents="none"
                  />
                )}
              </g>
            ) : null,
          )}
        {s.mode === 'apply' &&
          s.project.regions.map((region) => (
            <g key={region.id} opacity={region.id === s.regionId ? 1 : 0.4}>
              {region.geometry
                .filter((g) => g.visible)
                .map((g) => (
                  <path
                    key={g.id}
                    d={pathData(g)}
                    transform={matrixString(g.transform)}
                    fill="transparent"
                    fillRule={g.fillRule}
                    stroke={region.id === s.regionId ? '#527744' : '#a2ad9e'}
                    strokeWidth={0.5}
                    strokeDasharray={region.id === s.regionId ? undefined : '2 2'}
                    onPointerDown={(e) => {
                      s.setRegionId(region.id);
                      selectInstance(e, IDENTITY, region.geometry);
                    }}
                  />
                ))}
            </g>
          ))}
        {!s.project.preferences.structureVisible &&
          s.project.preferences.guides &&
          !editorOnly &&
          s.mode !== 'apply' &&
          activePattern.symmetry.family === 'wallpaper' &&
          activePattern.generator.kind !== 'penrose' && (
            <g pointerEvents="none">
              <path
                d={`M${sym.origin.x} ${sym.origin.y}l${a.x} ${a.y}l${b.x} ${b.y}l${-a.x} ${-a.y}Z`}
                fill="none"
                stroke="#79976b"
                strokeWidth={0.35}
                strokeDasharray="2 1.5"
              />
              <circle cx={sym.origin.x} cy={sym.origin.y} r={0.8} fill="#59764d" />
              <text
                x={sym.origin.x + a.x / 2}
                y={sym.origin.y + a.y / 2 - 2}
                fill="#648154"
                fontSize={2.8}
              >
                a
              </text>
              <text
                x={sym.origin.x + b.x / 2 - 3}
                y={sym.origin.y + b.y / 2}
                fill="#648154"
                fontSize={2.8}
              >
                b
              </text>
            </g>
          )}
        {!s.project.preferences.structureVisible &&
          s.project.preferences.guides &&
          !editorOnly &&
          s.mode !== 'apply' &&
          sym.family === 'frieze' &&
          activePattern.generator.kind !== 'penrose' && (
            <g pointerEvents="none" aria-label="Traslación del friso en una dirección">
              <line
                x1={sym.origin.x}
                y1={sym.origin.y}
                x2={sym.origin.x + a.x}
                y2={sym.origin.y + a.y}
                stroke="#79976b"
                strokeWidth={0.35}
                strokeDasharray="2 1.5"
              />
              <text
                x={sym.origin.x + a.x / 2}
                y={sym.origin.y + a.y / 2 - 2}
                fill="#648154"
                fontSize={2.8}
              >
                a · período del friso
              </text>
            </g>
          )}
        {!s.project.preferences.structureVisible &&
          s.project.preferences.guides &&
          !editorOnly &&
          s.mode !== 'apply' &&
          activePattern.generator.kind !== 'penrose' &&
          activePattern.symmetry.family === 'radial' && (
            <g pointerEvents="none" stroke="#79976b" strokeWidth={0.3} strokeDasharray="2 2">
              {Array.from({ length: activePattern.symmetry.sectors }, (_, i) => {
                const t =
                    (i * 2 * Math.PI) / activePattern.symmetry.sectors +
                    (activePattern.symmetry.orientation * Math.PI) / 180,
                  c = activePattern.symmetry.center;
                return (
                  <line
                    key={i}
                    x1={c.x}
                    y1={c.y}
                    x2={c.x + Math.cos(t) * 80}
                    y2={c.y + Math.sin(t) * 80}
                  />
                );
              })}
            </g>
          )}
        {!s.project.preferences.structureVisible &&
          s.project.preferences.guides &&
          !editorOnly &&
          activePattern.generator.kind !== 'penrose' &&
          s.mode !== 'apply' && (
            <g pointerEvents="none">
              {s.project.preferences.fundamental && domain.length > 0 && (
                <path
                  d={domain.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('') + 'Z'}
                  fill="#a1bd7020"
                  stroke="#94b073"
                  strokeWidth={0.4}
                  strokeDasharray="1 1"
                />
              )}
              {s.project.preferences.axes &&
                mathGuides.axes.map((axis, i) => {
                  const length = Math.max(actualView.width, actualView.height);
                  return (
                    <line
                      key={i}
                      x1={axis.origin.x - axis.direction.x * length}
                      y1={axis.origin.y - axis.direction.y * length}
                      x2={axis.origin.x + axis.direction.x * length}
                      y2={axis.origin.y + axis.direction.y * length}
                      stroke={axis.glide ? '#b7a271' : '#95a97c'}
                      strokeWidth={0.3}
                      strokeDasharray={axis.glide ? '3 2 1 2' : '3 2'}
                    />
                  );
                })}
              {s.project.preferences.centers &&
                mathGuides.centers.map((c, i) => (
                  <g key={i}>
                    <circle
                      cx={c.point.x}
                      cy={c.point.y}
                      r={1.2}
                      fill="#f7faf0"
                      stroke="#8aa26d"
                      strokeWidth={0.3}
                    />
                    <text x={c.point.x + 2} y={c.point.y + 1} fontSize={2.5} fill="#7c9360">
                      {c.order}
                    </text>
                  </g>
                ))}
              {s.project.preferences.continuity &&
                activePattern.symmetry.family === 'wallpaper' &&
                scene?.instances
                  .filter(
                    (v, i, arr) =>
                      i ===
                      arr.findIndex((o) => o.cell[0] === v.cell[0] && o.cell[1] === v.cell[1]),
                  )
                  .slice(0, 300)
                  .map((i) => (
                    <path
                      key={i.id}
                      d={`M${sym.origin.x} ${sym.origin.y}l${a.x} ${a.y}l${b.x} ${b.y}l${-a.x} ${-a.y}Z`}
                      transform={matrixString(
                        translate(
                          i.cell[0] * a.x + i.cell[1] * b.x,
                          i.cell[0] * a.y + i.cell[1] * b.y,
                        ),
                      )}
                      fill="none"
                      stroke="#a6af75"
                      strokeWidth={0.3}
                      strokeDasharray="2 1"
                    />
                  ))}
            </g>
          )}
        {!previewOnly &&
          selectedShapes.map((shape) => (
            <g
              data-editing-handles="true"
              key={shape.id}
              transform={matrixString(multiply(s.instance, shape.transform))}
            >
              <path
                d={pathData(shape)}
                fill="none"
                stroke="#82a357"
                strokeWidth={1.4 / scalePx}
                pointerEvents="none"
              />
              {s.tool === 'nodes' && shape.kind === 'path'
                ? shape.nodes.map((n, i) => (
                    <g key={i}>
                      <g stroke="#86a367" strokeWidth={0.8 / scalePx}>
                        {(['in', 'out'] as const).map((handle) => (
                          <g key={handle}>
                            {(n[handle].x !== 0 || n[handle].y !== 0) && (
                              <>
                                <line
                                  x1={n.x}
                                  y1={n.y}
                                  x2={n.x + n[handle].x}
                                  y2={n.y + n[handle].y}
                                />
                                <circle
                                  aria-label={`Tangente ${handle} ${i + 1}`}
                                  cx={n.x + n[handle].x}
                                  cy={n.y + n[handle].y}
                                  r={3.5 / scalePx}
                                  fill="#f9fcf5"
                                  onPointerDown={(e) => startNode(e, shape.id, i, handle)}
                                />
                              </>
                            )}
                          </g>
                        ))}
                      </g>
                      <rect
                        aria-label={`Nodo ${i + 1}`}
                        x={n.x - 3.5 / scalePx}
                        y={n.y - 3.5 / scalePx}
                        width={7 / scalePx}
                        height={7 / scalePx}
                        rx={1 / scalePx}
                        fill="#f9fcf5"
                        stroke="#557f39"
                        strokeWidth={1.2 / scalePx}
                        onPointerDown={(e) => startNode(e, shape.id, i, 'node')}
                      />
                    </g>
                  ))
                : null}
            </g>
          ))}
        {s.mode !== 'apply' &&
          !editorOnly &&
          activePattern.symmetry.family !== 'none' &&
          activePattern.generator.kind !== 'penrose' &&
          s.project.preferences.guides && (
            <g
              transform={
                activePattern.tiling ? matrixString(tileFrame(activePattern.tiling)) : undefined
              }
            >
              <line
                x1={symmetryOrigin(activePattern.symmetry).x}
                y1={symmetryOrigin(activePattern.symmetry).y}
                x2={
                  symmetryOrigin(activePattern.symmetry).x +
                  Math.cos((activePattern.symmetry.orientation * Math.PI) / 180) * 22
                }
                y2={
                  symmetryOrigin(activePattern.symmetry).y +
                  Math.sin((activePattern.symmetry.orientation * Math.PI) / 180) * 22
                }
                stroke="#89a36b"
                strokeWidth={0.4}
              />
              <circle
                data-symmetry-origin="true"
                aria-label="Mover origen de simetría"
                className="origin-handle"
                pointerEvents={['select', 'nodes'].includes(s.tool) ? 'all' : 'none'}
                cx={symmetryOrigin(activePattern.symmetry).x}
                cy={symmetryOrigin(activePattern.symmetry).y}
                r={4 / scalePx}
                fill="#edf4df"
                stroke="#779355"
                strokeWidth={1 / scalePx}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = { type: 'origin', start: point(e) };
                }}
              />
              <circle
                aria-label="Orientar red de simetría"
                className="orientation-handle"
                pointerEvents={['select', 'nodes'].includes(s.tool) ? 'all' : 'none'}
                cx={
                  symmetryOrigin(activePattern.symmetry).x +
                  Math.cos((activePattern.symmetry.orientation * Math.PI) / 180) * 22
                }
                cy={
                  symmetryOrigin(activePattern.symmetry).y +
                  Math.sin((activePattern.symmetry.orientation * Math.PI) / 180) * 22
                }
                r={3 / scalePx}
                fill="#f6f9ef"
                stroke="#9eae8d"
                strokeWidth={1 / scalePx}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = { type: 'orientation', start: point(e) };
                }}
              />
            </g>
          )}
        {!editorOnly && !previewOnly && <TileEditor studio={s} scale={scalePx} />}
        {marquee && (
          <rect
            x={Math.min(marquee.start.x, marquee.end.x)}
            y={Math.min(marquee.start.y, marquee.end.y)}
            width={Math.abs(marquee.end.x - marquee.start.x)}
            height={Math.abs(marquee.end.y - marquee.start.y)}
            fill="#90ae6220"
            stroke="#6e8d50"
            strokeWidth={0.4}
            pointerEvents="none"
          />
        )}
        {s.tool === 'fill' && fill.preview && (
          <path
            data-fill-preview="true"
            d={fill.preview.pathData}
            fill={s.project.drawingStyle.fill === 'none' ? '#75a287' : s.project.drawingStyle.fill}
            fillOpacity={0.35}
            fillRule="evenodd"
            stroke="#315f48"
            strokeWidth={1.5 / scalePx}
            strokeDasharray={`${4 / scalePx} ${3 / scalePx}`}
            pointerEvents="none"
          />
        )}
      </svg>
      {s.project.preferences.continuity && (
        <div className="continuity-report">
          <strong>{inspection.valid ? 'Uniones de la red' : 'Inspección de continuidad'}</strong>
          <span>{inspection.message}</span>
        </div>
      )}
      {error && <div className="canvas-warning">{error}</div>}
      {structure?.limited && (
        <div className="canvas-warning">
          Estructura reducida por densidad. Acercá el zoom para ver todos los elementos.
        </div>
      )}
      {scene?.generated.geometry.length === 0 && s.mode !== 'apply' && (
        <div className="empty-canvas">
          <span>Todo empieza con una línea.</span>
          <small>Elegí una herramienta y dibujá. El patrón aparece mientras trazás.</small>
        </div>
      )}
      {s.mode === 'apply' && !s.project.regions.length && (
        <div className="empty-canvas">
          <span>Dale un lugar a tu patrón.</span>
          <small>Dibujá un perímetro cerrado o importá un SVG.</small>
        </div>
      )}
      <div className="canvas-floats">
        <button title="Alejar" aria-label="Alejar" onClick={() => zoom(1.25)}>
          <ZoomOut size={17} />
        </button>
        <span>{Math.round((scalePx / 3.779527559) * 100)}%</span>
        <button title="Acercar" aria-label="Acercar" onClick={() => zoom(0.8)}>
          <ZoomIn size={17} />
        </button>
        <i />
        <button title="Ajustar contenido" aria-label="Ajustar contenido" onClick={() => fit()}>
          <Maximize size={17} />
        </button>
        <button
          title="Restablecer vista"
          aria-label="Restablecer vista"
          onClick={() => setView({ x: -110, y: -100, width: 300, height: 240 })}
        >
          <Scan size={17} />
        </button>
        <button aria-label="Ajustar al patrón" title="Ajustar al patrón" onClick={() => fit(true)}>
          <Scan size={17} />
        </button>
        <i />
        {!editorOnly && s.mode !== 'apply' && (
          <>
            <button
              aria-label="Mostrar/Ocultar estructura de simetría"
              title="Mostrar/Ocultar estructura de simetría"
              aria-pressed={s.project.preferences.structureVisible}
              className={s.project.preferences.structureVisible ? 'active' : ''}
              onClick={() =>
                s.change((p) => {
                  p.preferences.structureVisible = !p.preferences.structureVisible;
                })
              }
            >
              <span aria-hidden="true">◇</span>
            </button>
            {s.project.preferences.structureVisible && (
              <label className="structure-opacity" title="Opacidad de la estructura">
                Opacidad
                <input
                  type="range"
                  aria-label="Opacidad de la estructura"
                  min=".03"
                  max=".8"
                  step=".01"
                  value={s.project.preferences.structureOpacity}
                  onChange={(e) =>
                    s.change((p) => {
                      p.preferences.structureOpacity = Number(e.target.value);
                    })
                  }
                />
              </label>
            )}
          </>
        )}
        <button
          title="Grilla"
          aria-label="Mostrar grilla"
          className={s.project.preferences.grid ? 'active' : ''}
          onClick={() =>
            s.change((p) => {
              p.preferences.grid = !p.preferences.grid;
            })
          }
        >
          <Grid2X2 size={17} />
        </button>
        <button
          title="Guías detalladas · inspección individual"
          aria-label="Mostrar guías"
          onClick={() =>
            s.change((p) => {
              p.preferences.guides = !p.preferences.guides;
              p.preferences.structureVisible = false;
            })
          }
        >
          {s.project.preferences.guides ? <Eye size={17} /> : <EyeOff size={17} />}
        </button>
      </div>
      <div className="coordinate">
        <Hand size={12} /> Espacio + arrastrar · Ctrl + rueda para zoom{' '}
        <span>
          {cursor.x.toFixed(1)}, {cursor.y.toFixed(1)} mm
        </span>
      </div>
    </div>
  );
}
