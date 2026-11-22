import { editUnlocked } from '../editor/locked';
import { patchSymmetryFrame } from '../symmetry/frame';
import { useDestructiveAction } from './destructive-action';
import { axesFingerprint } from '../fill/service';
import {
  withWorkPreferences,
  rememberWorkPreferenceChanges,
  readWorkPreferences,
  saveWorkPreferences,
  captureWorkPreferences,
} from './work-preferences';
import { enforceJunctions, remapJunctions } from '../editor/junctions';
import {
  styleFields,
  drawingStyle,
  mixedStyle,
  styleIssue,
  hexColor,
  type DrawingStyle,
} from './styles';
import { constrainTiling, type TilingDefinition } from '../tiling/tiles';
import { tilingIssue } from '../tiling/validate';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { hasClosedGeometry } from '../application/clipping';
import { History } from '../editor/history';
import { autosave, recover } from '../persistence/storage';
import { newStudy, type Symmetry } from './model';
import {
  resolvePattern,
  changeSymmetry as applySymmetryChoice,
  resolveSymmetry,
  symmetryId,
  adaptToCell,
  type SymmetryChoice,
  type SymmetryPreview,
} from '../symmetry/config';
import { uid, type Project, type Geometry } from './model';
import { IDENTITY, multiply, type Matrix } from '../geometry/matrix';
export type Mode = 'edit' | 'pattern' | 'apply';
export type Tool =
  | 'select'
  | 'nodes'
  | 'pen'
  | 'pencil'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'fill'
  | 'region'
  | 'pan';
export type StylePage =
  | 'colors'
  | 'stroke'
  | 'profile'
  | 'fill'
  | 'palette'
  | 'presets'
  | 'object'
  | 'options';
export function useStudio() {
  const inlineNodes = useRef(false);
  const interactionActive = useRef(false);
  const [interactionVersion, setInteractionVersion] = useState(0);
  const finishInteraction = useCallback(() => {
    interactionActive.current = false;
    setInteractionVersion((n) => n + 1);
  }, []);
  const styleRequest = useRef<StylePage | null>(null);
  const [tileTab, setTileTab] = useState<'shape' | 'placement' | 'edge' | 'tangents'>('shape');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [stylePage, setStylePage] = useState<StylePage>('colors'),
    [objectTab, setObjectTab] = useState<'shape' | 'transform' | 'nodes' | 'actions'>('shape');
  const [tileEditing, setTileEditing] = useState(false),
    [tileEdge, setTileEdge] = useState(0),
    [tileNode, setTileNode] = useState(1);
  const [project, setProject] = useState<Project>(() => withWorkPreferences(newStudy(), true)),
    ref = useRef(project),
    history = useRef(new History(project)),
    hydrated = useRef(false),
    gesture = useRef(false);
  const destructive = useDestructiveAction(ref);
  const [loaded, setLoaded] = useState(false),
    [saved, setSaved] = useState('Recuperando…'),
    [message, setMessage] = useState(''),
    [mode, setMode] = useState<Mode>('edit'),
    [tool, setActiveTool] = useState<Tool>('pencil');
  const [symmetryPreview, setSymmetryPreview] = useState<SymmetryPreview | null>(null),
    [galleryTarget, setGalleryTarget] = useState<'pattern' | 'project'>('pattern');
  const [instanceExplicit, setInstanceExplicit] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false),
    [styleTarget, setStyleTarget] = useState<'selection' | 'current'>('selection');
  // Tool activation is also an explicit request to reopen its controls.
  // Keeping this in the action handles repeated clicks, shortcuts and commands.
  const setTool = useCallback((next: Tool, options: { inline?: boolean } = {}) => {
    inlineNodes.current = next === 'nodes' && !!options.inline;
    setActiveTool(next);
    if (next === 'fill') {
      setStyleTarget('current');
      setStylePage('fill');
      setStyleOpen(true);
    } else if (next === 'pencil') {
      setStylePage('stroke');
      setStyleOpen(true);
    } else if (next === 'nodes' && !options.inline) {
      setStylePage('object');
      setStyleTarget('selection');
      setStyleOpen(true);
    }
  }, []);
  const [nodeIndex, setNodeIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]),
    [instance, setInstance] = useState<Matrix>(IDENTITY),
    [patternId, setPatternId] = useState(project.patterns[0].id),
    [regionId, setRegionId] = useState(''),
    [applicationId, setApplicationId] = useState('');
  const [compositionRequest, setCompositionRequest] = useState(0);
  const openComposition = useCallback(() => setCompositionRequest((value) => value + 1), []);
  const [viewFit, setViewFit] = useState(0);
  const requestFit = useCallback(() => setViewFit((value) => value + 1), []);
  const [viewReset, setViewReset] = useState(0);
  // Camera state belongs to the session, not the document or undo history.
  const [viewScale, setViewScale] = useState<{ scale: number; sender: string }>({
    scale: 7.559055118,
    sender: '',
  });
  const [revision, setRevision] = useState(0),
    [fileSaved, setFileSaved] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const replace = useCallback((p: Project) => {
    ref.current = p;
    setProject(p);
  }, []);
  const change = useCallback(
    (recipe: (p: Project) => void, transient = false, options: { derived?: boolean } = {}) => {
      const next = structuredClone(ref.current);
      next.schemaVersion = 7;
      recipe(next);
      rememberWorkPreferenceChanges(ref.current, next);
      for (const pat of next.patterns)
        enforceJunctions(
          pat.sourceGeometry,
          ref.current.patterns.find((p) => p.id === pat.id)?.sourceGeometry ?? [],
        );
      for (const region of next.regions)
        enforceJunctions(
          region.geometry,
          ref.current.regions.find((r) => r.id === region.id)?.geometry ?? [],
        );
      for (const pat of next.patterns)
        for (const g of pat.sourceGeometry) {
          const old = ref.current.patterns
            .find((p) => p.id === pat.id)
            ?.sourceGeometry.find((x) => x.id === g.id);
          if (
            !options.derived &&
            g.fillRegion?.linked &&
            old &&
            JSON.stringify([old.nodes, old.pathData, old.parameters, old.transform]) !==
              JSON.stringify([g.nodes, g.pathData, g.parameters, g.transform])
          ) {
            g.fillRegion.linked = false;
            g.fillRegion.status = 'fixed';
            g.fillRegion.reason = 'Contorno editado manualmente; vínculo desactivado.';
          }
        }

      if (next.preferences.styleDefaultsFollowSelection) {
        const before = [
            ...ref.current.patterns.flatMap((p) => p.sourceGeometry),
            ...ref.current.regions.flatMap((r) => r.geometry),
          ],
          after = [
            ...next.patterns.flatMap((p) => p.sourceGeometry),
            ...next.regions.flatMap((r) => r.geometry),
          ];
        for (const key of styleFields) {
          const changed = after.filter(
            (g) =>
              selectedRef.current.includes(g.id) &&
              before.some(
                (old) => old.id === g.id && JSON.stringify(old[key]) !== JSON.stringify(g[key]),
              ),
          );
          if (
            changed.length &&
            changed.every((g) => JSON.stringify(g[key]) === JSON.stringify(changed[0][key]))
          )
            Object.assign(next.drawingStyle, { [key]: structuredClone(changed[0][key]) });
        }
      }
      if (
        next.visualization &&
        !next.patterns.some((pat) => pat.id === next.visualization!.source.patternId)
      )
        delete next.visualization;
      next.metadata.updatedAt = new Date().toISOString();
      replace(next);
      setFileSaved(false);
      if (!transient && !gesture.current) {
        history.current.commit(next);
        setRevision((n) => n + 1);
      }
    },
    [replace],
  );
  const commit = useCallback(() => {
    history.current.commit(ref.current);
    setRevision((n) => n + 1);
  }, []);
  const load = useCallback(
    (p: Project, options: { fresh?: boolean } = {}) => {
      interactionActive.current = false;
      p = withWorkPreferences(p, !!options.fresh);
      if (options.fresh) {
        setActiveTool('pencil');
        setStyleTarget('current');
        setStylePage('stroke');
        setViewReset((value) => value + 1);
      }
      if (hydrated.current) void autosave(ref.current).catch(() => {});
      history.current.reset(p);
      replace(p);
      setTileEditing(false);
      setTileEdge(0);
      setTileNode(1);
      setPatternId(p.patterns[0].id);
      setRegionId(p.regions[0]?.id ?? '');
      setApplicationId(p.applications[0]?.id ?? '');
      setSelected([]);
      setInstance(IDENTITY);
      setInstanceExplicit(false);
      setSymmetryPreview(null);
      setRevision((n) => n + 1);
      setFileSaved(true);
    },
    [replace],
  );
  useEffect(() => {
    if (!project.patterns.some((p) => p.id === patternId)) {
      setPatternId(project.patterns[0].id);
      setSelected([]);
      setInstance(IDENTITY);
      setInstanceExplicit(false);
    }
    if (regionId && !project.regions.some((r) => r.id === regionId))
      setRegionId(project.regions[0]?.id ?? '');
    if (applicationId && !project.applications.some((a) => a.id === applicationId))
      setApplicationId(project.applications[0]?.id ?? '');
  }, [project.patterns, project.regions, project.applications, patternId, regionId, applicationId]);
  useEffect(() => {
    let live = true;
    recover()
      .then((p) => {
        if (live && p) {
          if (!readWorkPreferences()) saveWorkPreferences(captureWorkPreferences(p));
          load(p);
        } else if (live) {
          setViewReset((value) => value + 1);
        }
      })
      .catch((e) => {
        if (live) setMessage(`No se pudo recuperar el autosave: ${e.message}`);
      })
      .finally(() => {
        if (live) {
          hydrated.current = true;
          setLoaded(true);
        }
      });
    return () => {
      live = false;
    };
  }, [load]);
  useEffect(() => {
    if (!loaded) return;
    if (project.regions.some((r) => r.geometry.some((g) => !hasClosedGeometry(g)))) {
      setSaved('Trazo en curso');
      return;
    }
    setSaved('Guardando…');
    const timer = setTimeout(() => {
      autosave(project)
        .then(() => setSaved('Guardado local'))
        .catch((e) => {
          setSaved('Error de guardado');
          setMessage(`El almacenamiento local falló: ${e.message}. Guardá un archivo JSON.`);
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [project, loaded]);
  useEffect(() => {
    const start = (e: PointerEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type === 'range') gesture.current = true;
    };
    const end = () => {
      if (gesture.current) {
        gesture.current = false;
        commit();
      }
    };
    document.addEventListener('pointerdown', start, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    return () => {
      document.removeEventListener('pointerdown', start, true);
      document.removeEventListener('pointerup', end, true);
      document.removeEventListener('pointercancel', end, true);
    };
  }, [commit]);
  const beginGesture = () => {
    gesture.current = true;
  };
  const endGesture = () => {
    if (gesture.current) {
      gesture.current = false;
      commit();
    }
  };
  const recalcWorker = useRef<Worker | null>(null),
    [recalculatingId, setRecalculatingId] = useState('');
  const cancelRecalculation = () => {
    recalcWorker.current?.terminate();
    recalcWorker.current = null;
    setRecalculatingId('');
  };
  useEffect(() => {
    cancelRecalculation();
    return () => {
      recalcWorker.current?.terminate();
    };
  }, [project.metadata.id]);
  const recalculateFill = (shapeId: string, attempt = 0) => {
    cancelRecalculation();
    const fingerprint = axesFingerprint(ref.current),
      worker = new Worker(new URL('../fill/worker.ts', import.meta.url), { type: 'module' });
    recalcWorker.current = worker;
    setRecalculatingId(shapeId);
    const fail = (message: string) => {
      if (recalcWorker.current !== worker) return;
      setMessage(message);
      cancelRecalculation();
    };
    worker.onmessage = (e) => {
      if (recalcWorker.current !== worker) return;
      if (e.data.type === 'error') {
        fail(e.data.message);
        return;
      }
      if (e.data.type !== 'recalculated') return;
      if (axesFingerprint(ref.current) !== fingerprint) {
        // El worker de vínculos pudo reescribir contornos mientras calculábamos.
        // Nunca aplicar resultados viejos: reintentar una vez sobre la geometría nueva.
        worker.terminate();
        if (recalcWorker.current === worker) recalcWorker.current = null;
        if (attempt < 2) recalculateFill(shapeId, attempt + 1);
        else fail('La geometría cambió durante el cálculo. El contorno se conservó; podés reintentar.');
        return;
      }
      const result = e.data.geometry as Geometry;
      change(
        (p) => {
          for (const pat of p.patterns) {
            const index = pat.sourceGeometry.findIndex((g) => g.id === shapeId);
            if (index < 0) continue;
            const current = pat.sourceGeometry[index];
            pat.sourceGeometry[index] = {
              ...result,
              ...drawingStyle(current),
              id: current.id,
              name: current.name,
              groupId: current.groupId,
              visible: current.visible,
              locked: current.locked,
            };
          }
        },
        false,
        { derived: true },
      );
      if (result.fillRegion) {
        setInstance(result.fillRegion.captureMatrix);
        setInstanceExplicit(true);
      }
      setMessage('Región recalculada y vinculada a los límites actuales.');
      cancelRecalculation();
    };
    worker.onerror = () =>
      fail('No se pudo actualizar el relleno. Su contorno anterior se conserva.');
    worker.postMessage({ type: 'recalculate', project: ref.current, shapeId, matrix: instance });
  };
  const linkedCompleted = useRef('');
  useEffect(() => {
    if (
      !loaded ||
      !ref.current.patterns.some((p) => p.sourceGeometry.some((g) => g.fillRegion?.linked))
    )
      return;
    const fingerprint = axesFingerprint(ref.current);
    if (linkedCompleted.current === fingerprint) return;
    const worker = new Worker(new URL('../fill/worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      if (!['links', 'error'].includes(e.data.type) || axesFingerprint(ref.current) !== fingerprint)
        return;
      linkedCompleted.current = fingerprint;
      const patches =
        e.data.type === 'links'
          ? new Map<string, Geometry>(e.data.patches)
          : new Map(
              ref.current.patterns
                .flatMap((p) => p.sourceGeometry)
                .filter((g) => g.fillRegion?.linked)
                .map((g) => [
                  g.id,
                  {
                    ...g,
                    fillRegion: {
                      ...g.fillRegion!,
                      status: 'stale' as const,
                      reason:
                        'No se pudo recalcular: ' +
                        e.data.message +
                        '. Contorno anterior conservado.',
                    },
                  },
                ]),
            );
      if (e.data.type === 'error')
        setMessage(
          'No se pudieron actualizar los vínculos; se conservaron los contornos anteriores.',
        );
      const amend = (p: Project) => {
        if (axesFingerprint(p) !== fingerprint) return p;
        const out = structuredClone(p);
        for (const pat of out.patterns)
          for (const g of pat.sourceGeometry) {
            const update = patches.get(g.id);
            if (update)
              Object.assign(g, {
                nodes: update.nodes,
                pathData: update.pathData,
                kind: update.kind,
                parameters: update.parameters,
                closed: update.closed,
                fillRegion: update.fillRegion,
              });
          }
        return out;
      };
      history.current.mapStates(amend);
      replace(amend(ref.current));
      worker.terminate();
    };
    worker.onerror = () =>
      worker.onmessage?.({
        data: { type: 'error', message: 'Fallo del worker vectorial' },
      } as MessageEvent);
    worker.postMessage({ type: 'links', project: ref.current });
    return () => worker.terminate();
  }, [revision, loaded, replace]);
  const undo = useCallback(() => {
    replace(withWorkPreferences(history.current.undo()));
    setSelected((ids) =>
      ids.filter(
        (id) =>
          ref.current.patterns.some((p) => p.sourceGeometry.some((g) => g.id === id)) ||
          ref.current.regions.some((r) => r.geometry.some((g) => g.id === id)),
      ),
    );
    setInstance(IDENTITY);
    setInstanceExplicit(false);
    setSymmetryPreview(null);
    setRevision((n) => n + 1);
    setFileSaved(false);
  }, [replace]);
  const redo = useCallback(() => {
    replace(withWorkPreferences(history.current.redo()));
    setSelected((ids) =>
      ids.filter(
        (id) =>
          ref.current.patterns.some((p) => p.sourceGeometry.some((g) => g.id === id)) ||
          ref.current.regions.some((r) => r.geometry.some((g) => g.id === id)),
      ),
    );
    setInstance(IDENTITY);
    setInstanceExplicit(false);
    setSymmetryPreview(null);
    setRevision((n) => n + 1);
    setFileSaved(false);
  }, [replace]);
  const pattern = project.patterns.find((p) => p.id === patternId) ?? project.patterns[0];
  const effectivePattern = useMemo(
    () => resolvePattern(pattern, project, symmetryPreview),
    [pattern, project.mainSymmetry, project.mainSymmetryProfiles, symmetryPreview],
  );
  const visiblePatterns = useMemo(
    () =>
      project.patterns
        .filter((p) => p.visible)
        .map((p) => resolvePattern(p, project, symmetryPreview)),
    [project.patterns, project.mainSymmetry, project.mainSymmetryProfiles, symmetryPreview],
  );
  const confirmedSymmetry = resolveSymmetry(pattern, project.mainSymmetry);
  const symmetryTarget = galleryTarget === 'project' ? null : pattern.id;
  const changeSymmetryChoice = useCallback(
    (choice: SymmetryChoice) => {
      const current =
        galleryTarget === 'project'
          ? ref.current.mainSymmetry
          : resolveSymmetry(
              ref.current.patterns.find((p) => p.id === pattern.id)!,
              ref.current.mainSymmetry,
            );
      setSymmetryPreview(null);
      if (symmetryId(current) === symmetryId(choice)) return;
      change((p) => applySymmetryChoice(p, symmetryTarget, choice));
      setInstance(IDENTITY);
      setInstanceExplicit(false);
    },
    [change, galleryTarget, pattern.id, symmetryTarget],
  );
  const patchSymmetry = useCallback(
    (patch: Partial<Symmetry>, transient = false, activeOnly = false) => {
      let delta: Matrix | undefined;
      change((p) => {
        const target = activeOnly ? pattern.id : symmetryTarget;
        delta = patchSymmetryFrame(p, target, patch).get(pattern.id);
      }, transient);
      if (delta && mode !== 'apply' && !ref.current.preferences.sourceView)
        setInstance((previous) => multiply(delta!, previous));
    },
    [change, symmetryTarget, pattern.id, mode],
  );
  const setSymmetryMode = useCallback(
    (value: 'own' | 'inherit' | 'free') => {
      setSymmetryPreview(null);
      change((p) => {
        const pat = p.patterns.find((x) => x.id === pattern.id)!;
        if (pat.symmetryMode === 'own')
          pat.symmetryProfiles[symmetryId(pat.symmetry)] = structuredClone(pat.symmetry);
        if (
          pat.symmetryMode === 'inherit' &&
          value === 'own' &&
          !Object.keys(pat.symmetryProfiles).length
        )
          pat.symmetry = structuredClone(p.mainSymmetry);
        pat.symmetryMode = value;
      });
      setInstance(IDENTITY);
      setInstanceExplicit(false);
    },
    [change, pattern.id],
  );
  const editTiling = useCallback(
    (recipe: (t: TilingDefinition) => void, transient = false) => {
      const current = ref.current.patterns.find((p) => p.id === pattern.id)?.tiling;
      if (current?.kind === 'isohedral') {
        const candidate = structuredClone(current);
        recipe(candidate);
        const constrained = constrainTiling(candidate),
          issue = tilingIssue(constrained);
        if (issue) {
          setMessage(issue);
          return;
        }
        change((p) => {
          p.patterns.find((p) => p.id === pattern.id)!.tiling = constrained;
        }, transient);
        return;
      }
      change((p) => {
        const pat = p.patterns.find((x) => x.id === pattern.id)!;
        if (!pat.tiling) return;
        recipe(pat.tiling);
        pat.tiling = constrainTiling(pat.tiling);
      }, transient);
    },
    [change, pattern.id],
  );
  const adaptPattern = useCallback(
    () =>
      change((p) => {
        const pat = p.patterns.find((x) => x.id === pattern.id)!;
        pat.placementTransform = adaptToCell(pat, p.mainSymmetry);
      }),
    [change, pattern.id],
  );
  const finishDrawing = useCallback((id: string, cancel = false) => {
    const source = ref.current.patterns.flatMap((p) => p.sourceGeometry).find((g) => g.id === id);
    history.current.mapStates((old) => {
      if (!old.patterns.some((p) => p.sourceGeometry.some((g) => g.id === id))) return old;
      const next = structuredClone(old);
      for (const p of next.patterns)
        p.sourceGeometry = p.sourceGeometry.flatMap((g) =>
          g.id !== id
            ? [g]
            : cancel || !source
              ? []
              : [
                  {
                    ...g,
                    nodes: structuredClone(source.nodes),
                    closed: source.closed,
                    parameters: source.parameters ? structuredClone(source.parameters) : undefined,
                  },
                ],
        );
      next.metadata.updatedAt = ref.current.metadata.updatedAt;
      return next;
    });
    history.current.commit(ref.current);
    setRevision((n) => n + 1);
  }, []);
  const region = project.regions.find((r) => r.id === regionId);
  const application = project.applications.find((a) => a.id === applicationId);
  const objects = mode === 'apply' ? (region?.geometry ?? []) : pattern.sourceGeometry;
  const styleSelection = objects.filter((g) => !g.locked && selected.includes(g.id)),
    styleContext =
      styleTarget === 'selection' && styleSelection.length
        ? mixedStyle(styleSelection, project.drawingStyle)
        : mixedStyle([], project.drawingStyle),
    drawStyle = project.drawingStyle;
  const applyStyle = useCallback(
    (patch: Partial<DrawingStyle>, target: 'selection' | 'current' = styleTarget) => {
      const chosen =
        target === 'selection' ? objects.filter((g) => !g.locked && selected.includes(g.id)) : [];
      for (const old of chosen.length ? chosen : [ref.current.drawingStyle]) {
        const issue = styleIssue({ ...drawingStyle(old), ...patch });
        if (issue) {
          setMessage(issue);
          return;
        }
      }
      change((p) => {
        if (chosen.length) {
          const ids = new Set(chosen.map((g) => g.id));
          for (const g of [
            ...p.patterns.flatMap((p) => p.sourceGeometry),
            ...p.regions.flatMap((r) => r.geometry),
          ])
            if (ids.has(g.id)) Object.assign(g, structuredClone(patch));
          if (patch.fill && patch.fill !== 'none')
            for (const pattern of p.patterns)
              if (
                pattern.tiling?.colors?.enabled &&
                pattern.sourceGeometry.some((g) => ids.has(g.id) && g.fillRegion?.kind === 'tile')
              )
                pattern.tiling.colors.palette[0] = patch.fill;
        } else Object.assign(p.drawingStyle, structuredClone(patch));
        for (const key of ['stroke', 'fill'] as const) {
          const color = patch[key];
          if (color && color !== 'none') {
            const parsed = hexColor(color);
            if (parsed)
              p.palette.recent = [
                parsed.color,
                ...p.palette.recent.filter((c) => c !== parsed.color),
              ].slice(0, 24);
          }
        }
      });
    },
    [change, objects, selected, styleTarget],
  );
  const updateViewPreferences = useCallback(
    (patch: Partial<Project['preferences']>) => {
      rememberWorkPreferenceChanges(ref.current, {
        ...ref.current,
        preferences: { ...ref.current.preferences, ...patch },
      });
      history.current.mapStates((p) => ({ ...p, preferences: { ...p.preferences, ...patch } }));
      replace({ ...ref.current, preferences: { ...ref.current.preferences, ...patch } });
    },
    [replace],
  );
  useEffect(() => {
    setStyleOpen(project.preferences.stylePanelPinned);
    setStyleTarget('selection');
  }, [project.metadata.id]);
  const editObjects = useCallback(
    (recipe: (shapes: Geometry[]) => void, transient = false) =>
      change((p) => {
        const r = p.regions.find((r) => r.id === regionId);
        const pat = p.patterns.find((x) => x.id === patternId) ?? p.patterns[0];
        editUnlocked(mode === 'apply' ? (r?.geometry ?? []) : pat.sourceGeometry, recipe);
      }, transient),
    [change, regionId, patternId, mode],
  );
  const deleteSelected = useCallback(() => {
    if (!selected.length) return;
    if (
      mode === 'apply' &&
      region &&
      region.geometry.every((s) => !s.locked && selected.includes(s.id))
    ) {
      change((p) => {
        p.regions = p.regions.filter((r) => r.id !== regionId);
        p.applications = p.applications.filter((a) => a.regionId !== regionId);
      });
      setRegionId('');
    } else
      editObjects((shapes) => {
        for (let i = shapes.length - 1; i >= 0; i--)
          if (selected.includes(shapes[i].id)) shapes.splice(i, 1);
      });
    setSelected([]);
  }, [change, editObjects, selected, mode, region, regionId]);
  const duplicate = useCallback(() => {
    const ids: string[] = [],
      groups = new Map<string, string>();
    editObjects((shapes) => {
      const copies: Geometry[] = [],
        before: Geometry[] = [];
      for (const shape of shapes.filter((s) => selected.includes(s.id))) {
        const g = structuredClone(shape);
        g.id = uid();
        if (g.groupId) {
          if (!groups.has(g.groupId)) groups.set(g.groupId, uid());
          g.groupId = groups.get(g.groupId);
        }
        g.name += ' copia';
        before.push(structuredClone(g));
        g.transform = [
          ...g.transform.slice(0, 4),
          g.transform[4] + 5,
          g.transform[5] + 5,
        ] as unknown as Matrix;
        copies.push(g);
        ids.push(g.id);
      }
      remapJunctions(copies);
      enforceJunctions(copies, before);
      shapes.push(...copies);
    });
    setSelected(ids);
  }, [selected, editObjects]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches('input,textarea,select,button,[role=option]') ||
          e.target.isContentEditable)
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicate();
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(objects.filter((s) => !s.locked).map((s) => s.id));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (!mod) {
        const shortcuts: Record<string, Tool> = {
          v: 'select',
          a: 'nodes',
          p: 'pen',
          b: 'pencil',
          l: 'line',
          r: 'rectangle',
          e: 'ellipse',
          h: 'pan',
          f: 'fill',
        };
        if (shortcuts[e.key.toLowerCase()]) setTool(shortcuts[e.key.toLowerCase()]);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [undo, redo, duplicate, deleteSelected, objects]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 12000);
    return () => clearTimeout(timer);
  }, [message]);
  return {
    styleRequest,
    tileTab,
    setTileTab,
    catalogOpen,
    setCatalogOpen,
    stylePage,
    setStylePage,
    objectTab,
    setObjectTab,
    styleOpen,
    setStyleOpen,
    styleTarget,
    setStyleTarget,
    beginGesture,
    interactionActive,
    interactionVersion,
    finishInteraction,
    endGesture,
    styleContext,
    styleSelection,
    applyStyle,
    updateViewPreferences,
    recalculateFill,
    cancelRecalculation,
    recalculatingId,
    viewReset,
    viewFit,
    compositionRequest,
    openComposition,
    requestFit,
    viewScale,
    setViewScale,
    tileEditing,
    setTileEditing,
    tileEdge,
    setTileEdge,
    tileNode,
    setTileNode,
    editTiling,
    effectivePattern,
    visiblePatterns,
    confirmedSymmetry,
    symmetryPreview,
    setSymmetryPreview,
    galleryTarget,
    setGalleryTarget,
    changeSymmetryChoice,
    patchSymmetry,
    setSymmetryMode,
    adaptPattern,
    instanceExplicit,
    setInstanceExplicit,
    finishDrawing,
    drawStyle,
    nodeIndex,
    setNodeIndex,
    project,
    projectRef: ref,
    change,
    commit,
    load,
    loaded,
    saved,
    message,
    setMessage,
    mode,
    setMode,
    tool,
    inlineNodes,
    setTool,
    selected,
    setSelected,
    instance,
    setInstance,
    patternId,
    setPatternId,
    regionId,
    setRegionId,
    applicationId,
    setApplicationId,
    pattern,
    region,
    application,
    objects,
    editObjects,
    undo,
    redo,
    deleteSelected,
    ...destructive,
    duplicate,
    canUndo: history.current.canUndo,
    canRedo: history.current.canRedo,
    revision,
    fileSaved,
    setFileSaved,
  };
}
export type Studio = ReturnType<typeof useStudio>;
