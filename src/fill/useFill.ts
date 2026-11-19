import { useEffect, useRef, useState } from 'react';
import type { Studio } from '../app/useStudio';
import type { Bounds } from '../symmetry/groups';
import type { Point } from '../geometry/matrix';
import type { Geometry } from '../app/model';
import { createTileFill, type FillLayer, type FillCandidate } from './service';
export function useFill(s: Studio, layers: FillLayer[], bounds: Bounds, enabled: boolean) {
  const worker = useRef<Worker | null>(null),
    ready = useRef(false),
    queryBusy = useRef(false),
    latest = useRef<Point | null>(null),
    queryId = useRef(0),
    pendingCreate = useRef(false),
    live = useRef({ s, layers, bounds, enabled });
  live.current = { s, layers, bounds, enabled };
  const [candidates, setCandidates] = useState<FillCandidate[]>([]),
    [index, setIndex] = useState(0),
    [position, setPosition] = useState<Point | null>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('');
  const key = enabled
    ? JSON.stringify([
        bounds,
        s.project.preferences.fillCloseTolerance,
        layers.map((l) => [
          l.pattern.id,
          l.pattern.symmetry,
          l.pattern.generator,
          l.pattern.placementTransform,
          l.pattern.tiling,
          l.pattern.sourceGeometry.map((g) => [
            g.id,
            g.kind,
            g.nodes,
            g.pathData,
            g.parameters,
            g.transform,
            g.closed,
            g.visible,
            g.locked,
          ]),
        ]),
      ])
    : '';
  const applyCreated = (g: Geometry, patternId: string) => {
    const { s } = live.current;
    let existingId = '';
    s.change((p) => {
      const pat = p.patterns.find((p) => p.id === patternId);
      if (!pat) return;
      const existing = pat.sourceGeometry.find(
        (old) =>
          old.fillRegion?.faceKey === g.fillRegion?.faceKey &&
          old.fillRegion?.context === g.fillRegion?.context,
      );
      if (existing) {
        existing.fill = g.fill;
        existing.fillOpacity = g.fillOpacity;
        existing.fillRule = g.fillRule;
        existing.opacity = g.opacity;
        existingId = existing.id;
      } else {
        pat.sourceGeometry.unshift(g);
        existingId = g.id;
      }
    });
    s.setPatternId(patternId);
    s.setSelected([existingId]);
    s.setMessage(
      g.fillRegion?.scope === 'orbit'
        ? 'Relleno vectorial creado con órbita concreta verificada.'
        : 'Relleno vectorial creado.',
    );
  };
  const query = (p: Point) => {
    latest.current = p;
    if (!enabled) return;
    if (!worker.current) start();
    if (ready.current && !queryBusy.current) {
      queryBusy.current = true;
      worker.current?.postMessage({ type: 'query', point: p, id: ++queryId.current });
    }
  };
  const start = () => {
    const state = live.current;
    if (!state.enabled) return;
    worker.current?.terminate();
    ready.current = false;
    queryBusy.current = false;
    pendingCreate.current = false;
    setBusy(true);
    setStatus('Calculando caras vectoriales…');
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e) => {
      if (worker.current !== w) return;
      const r = e.data;
      if (r.type === 'ready') {
        ready.current = true;
        setBusy(false);
        setStatus(
          `${r.faces} caras · ${r.curves} curvas${r.approximate ? ' · cierre aproximado explícito' : ''}`,
        );
        if (latest.current) query(latest.current);
      }
      if (r.type === 'preview' && r.id === queryId.current) {
        setCandidates(r.candidates);
        setIndex(0);
        setPosition(r.point);
        queryBusy.current = false;
        if (latest.current && (latest.current.x !== r.point.x || latest.current.y !== r.point.y))
          query(latest.current);
      }
      if (r.type === 'created') {
        pendingCreate.current = false;
        setBusy(false);
        applyCreated(r.geometry, r.patternId);
        if (!live.current.s.project.preferences.stylePanelPinned)
          live.current.s.setStyleOpen(false);
      }
      if (r.type === 'error') {
        queryBusy.current = false;
        pendingCreate.current = false;
        setBusy(false);
        setStatus(r.message);
        live.current.s.setMessage(r.message);
      }
    };
    w.onerror = () => {
      setBusy(false);
      setStatus('No se pudo ejecutar el cálculo vectorial.');
    };
    w.postMessage({
      type: 'build',
      layers: state.layers,
      bounds: state.bounds,
      tolerance: state.s.project.preferences.fillCloseTolerance,
    });
  };
  useEffect(() => {
    setCandidates([]);
    setPosition(null);
    if (!enabled) latest.current = null;
    if (enabled) start();
    else {
      worker.current?.terminate();
      worker.current = null;
      ready.current = false;
      setBusy(false);
    }
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, [key, enabled]);
  const preview = candidates[index] ?? null;
  const confirm = () => {
    if (!preview || pendingCreate.current) return;
    const style = s.project.drawingStyle;
    if (style.fill === 'none') {
      s.setStyleTarget('current');
      s.setStyleOpen(true);
      s.setMessage('Elegí un color sólido de relleno para usar Fill.');
      return;
    }
    if (preview.kind !== 'face' && !s.project.preferences.stylePanelPinned) s.setStyleOpen(false);
    if (preview.kind === 'object') {
      s.change((p) => {
        const g = p.patterns
          .find((p) => p.id === preview.patternId)
          ?.sourceGeometry.find((g) => g.id === preview.shapeId);
        if (g && !g.locked) {
          g.fill = style.fill;
          g.fillOpacity = style.fillOpacity;
          g.fillRule = style.fillRule;
        }
      });
      s.setPatternId(preview.patternId);
      s.setSelected([preview.shapeId]);
      s.setMessage('Color aplicado al objeto cerrado.');
    } else if (preview.kind === 'tile') {
      const target = s.project.patterns.find((p) => p.id === preview.patternId);
      if (target) {
        s.setPatternId(target.id);
        const g = createTileFill(s.project, target, preview, style);
        let found = false;
        s.change((p) => {
          const pat = p.patterns.find((p) => p.id === target.id)!;
          const old = pat.sourceGeometry.find((g) => g.fillRegion?.faceKey === `tile/${target.id}`);
          if (old) {
            old.fill = style.fill;
            old.fillOpacity = style.fillOpacity;
            old.fillRule = style.fillRule;
            found = true;
          } else pat.sourceGeometry.unshift(g);
        });
        s.setSelected([
          found
            ? s.projectRef.current.patterns
                .find((p) => p.id === target.id)!
                .sourceGeometry.find((g) => g.fillRegion?.faceKey === `tile/${target.id}`)!.id
            : g.id,
        ]);
      }
    } else {
      pendingCreate.current = true;
      setBusy(true);
      worker.current?.postMessage({
        type: 'create',
        project: s.projectRef.current,
        patternId: s.patternId,
        faceKey: preview.face.key,
        style,
      });
    }
  };
  const cancel = () => {
    worker.current?.terminate();
    worker.current = null;
    ready.current = false;
    queryBusy.current = false;
    pendingCreate.current = false;
    setBusy(false);
    setCandidates([]);
    setPosition(null);
    setStatus('Cálculo cancelado. Mové el puntero para volver a previsualizar.');
  };
  return {
    preview,
    position,
    busy,
    status,
    count: candidates.length,
    index,
    query,
    confirm,
    cancel,
    cycle: () => setIndex((i) => (i + 1) % Math.max(1, candidates.length)),
  };
}
