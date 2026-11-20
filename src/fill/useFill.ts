import { useEffect, useRef, useState } from 'react';
import type { Studio } from '../app/useStudio';
import type { Bounds } from '../symmetry/groups';
import type { Point } from '../geometry/matrix';
import type { Geometry } from '../app/model';
import type { DrawingStyle } from '../app/styles';
import { hasFillInk, createTileFill, type FillLayer, type FillCandidate } from './service';
interface FillClick {
  point: Point;
  style: DrawingStyle;
  preferredKey?: string;
  inputKey: string;
}
export function useFill(s: Studio, layers: FillLayer[], bounds: Bounds, enabled: boolean) {
  const worker = useRef<Worker | null>(null),
    ready = useRef(false),
    queryBusy = useRef(false),
    latest = useRef<Point | null>(null),
    queryId = useRef(0),
    pendingCreate = useRef(false),
    clicks = useRef<FillClick[]>([]),
    applied = useRef(0),
    live = useRef({ s, layers, bounds, enabled });
  live.current = { s, layers, bounds, enabled };
  const [candidates, setCandidates] = useState<FillCandidate[]>([]),
    [index, setIndex] = useState(0),
    [position, setPosition] = useState<Point | null>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('');
  const inputKey = JSON.stringify([
    s.project.preferences.fillCloseTolerance,
    layers.map((l) => [
      l.pattern.id,
      l.pattern.symmetry,
      l.pattern.generator,
      l.pattern.placementTransform,
      l.pattern.tiling,
      l.pattern.sourceGeometry
        .filter((g) => !g.fillRegion)
        .map((g) => [
          g.id,
          g.kind,
          g.nodes,
          g.pathData,
          g.parameters,
          g.transform,
          g.closed,
          g.visible,
          g.locked,
          g.fillRule,
          hasFillInk(g),
        ]),
    ]),
  ]);
  const currentInput = useRef(inputKey);
  currentInput.current = inputKey;
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
            g.fillRule,
            hasFillInk(g),
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
      if (existing?.locked) return;
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
    if (!existingId) return;
    s.setPatternId(patternId);
    s.setSelected([existingId]);
    if (g.fillRegion) {
      s.setInstance(g.fillRegion.captureMatrix);
      s.setInstanceExplicit(true);
    }
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
    if (ready.current && !queryBusy.current && !pendingCreate.current) {
      queryBusy.current = true;
      worker.current?.postMessage({
        type: 'query',
        point: clicks.current[0]?.point ?? p,
        id: ++queryId.current,
      });
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
        if (clicks.current[0]) query(clicks.current[0].point);
        else if (latest.current) query(latest.current);
      }
      if (r.type === 'preview' && r.id === queryId.current) {
        setCandidates(r.candidates);
        setIndex(0);
        setPosition(r.point);
        queryBusy.current = false;
        const click = clicks.current[0];
        if (
          click &&
          click.inputKey === currentInput.current &&
          click.point.x === r.point.x &&
          click.point.y === r.point.y
        ) {
          const candidate =
            r.candidates.find((c: FillCandidate) => c.key === click.preferredKey) ??
            r.candidates[0];
          if (candidate) applyCandidate(candidate, click.style);
          else {
            finishClick();
            live.current.s.setMessage('No hay una región cerrada en ese punto.');
          }
        } else if (click) query(click.point);
        else if (
          latest.current &&
          (latest.current.x !== r.point.x || latest.current.y !== r.point.y)
        )
          query(latest.current);
      }
      if (r.type === 'created') {
        pendingCreate.current = false;
        setBusy(false);
        const click = clicks.current.shift();
        if (click?.inputKey === currentInput.current) {
          applied.current++;
          applyCreated(r.geometry, r.patternId);
        }
        setCandidates([]);
        if (clicks.current[0]) query(clicks.current[0].point);
        if (!live.current.s.project.preferences.stylePanelPinned)
          live.current.s.setStyleOpen(false);
      }
      if (r.type === 'error') {
        queryBusy.current = false;
        pendingCreate.current = false;
        setBusy(false);
        clicks.current = [];
        setStatus(r.message);
        live.current.s.setMessage(r.message);
      }
    };
    w.onerror = () => {
      setBusy(false);
      pendingCreate.current = false;
      clicks.current = [];
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
    clicks.current = clicks.current.filter((click) => click.inputKey === inputKey);
    if (!enabled) clicks.current = [];
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
  const finishClick = () => {
    clicks.current.shift();
    applied.current++;
    setCandidates([]);
    if (clicks.current[0]) query(clicks.current[0].point);
  };
  const applyCandidate = (preview: FillCandidate, style: DrawingStyle) => {
    const { s } = live.current;
    if (preview.kind !== 'face') finishClick();
    if (preview.kind !== 'face' && !s.project.preferences.stylePanelPinned) s.setStyleOpen(false);
    if (preview.kind === 'object') {
      const current = s.projectRef.current.patterns
        .find((p) => p.id === preview.patternId)
        ?.sourceGeometry.find((g) => g.id === preview.shapeId);
      if (!current || current.locked) return;
      if (
        current.fill !== style.fill ||
        current.fillOpacity !== style.fillOpacity ||
        current.fillRule !== style.fillRule
      )
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
      s.setInstance(preview.matrix);
      s.setInstanceExplicit(true);
      s.setMessage('Color aplicado al objeto cerrado.');
    } else if (preview.kind === 'tile') {
      const target = s.project.patterns.find((p) => p.id === preview.patternId);
      if (target) {
        const previous = s.projectRef.current.patterns
          .find((p) => p.id === target.id)
          ?.sourceGeometry.find((g) => g.fillRegion?.faceKey === `tile/${target.id}`);
        if (previous?.locked) return;
        if (
          previous &&
          previous.fill === style.fill &&
          previous.fillOpacity === style.fillOpacity &&
          previous.fillRule === style.fillRule
        ) {
          s.setPatternId(target.id);
          s.setSelected([previous.id]);
          s.setInstance(preview.matrix);
          s.setInstanceExplicit(true);
          return;
        }
        s.setPatternId(target.id);
        s.setInstance(preview.matrix);
        s.setInstanceExplicit(true);
        const g = createTileFill(s.project, target, preview, style);
        let found = false;
        s.change((p) => {
          const pat = p.patterns.find((p) => p.id === target.id)!;
          const old = pat.sourceGeometry.find((g) => g.fillRegion?.faceKey === `tile/${target.id}`);
          if (old?.locked) return;
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
  const applyAt = (point: Point) => {
    const { s } = live.current;
    const style = s.project.drawingStyle;
    if (style.fill === 'none') {
      s.setStyleTarget('current');
      s.setStyleOpen(true);
      s.setMessage('Elegí un color sólido de relleno para usar Fill.');
      return;
    }
    if (clicks.current.length >= 32) {
      s.setMessage('Esperá a que se apliquen los rellenos pendientes.');
      return;
    }
    clicks.current.push({
      point,
      style: structuredClone(style),
      inputKey: currentInput.current,
      preferredKey:
        position && Math.hypot(point.x - position.x, point.y - position.y) < 1e-6
          ? preview?.key
          : undefined,
    });
    query(point);
  };
  const confirm = () => {
    if (position) applyAt(position);
  };
  const cancel = () => {
    clicks.current = [];
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
    applyAt,
    applied: applied.current,
    cancel,
    cycle: () => setIndex((i) => (i + 1) % Math.max(1, candidates.length)),
  };
}
