import { useCallback, useRef, useState } from 'react';
import type { Project } from './model';
export function hasProjectWork(p: Project): boolean {
  return (
    p.regions.some((r) => r.geometry.length > 0) ||
    p.applications.length > 0 ||
    p.patterns.some(
      (pattern) =>
        pattern.sourceGeometry.length > 0 ||
        !!pattern.tiling ||
        !!pattern.composition?.enabled ||
        pattern.generator.kind !== 'motif',
    )
  );
}
export interface DestructiveAction {
  label: string;
  run: () => void;
}
export function useDestructiveAction(project: { current: Project }) {
  const [pendingAction, setPendingAction] = useState<DestructiveAction | null>(null),
    pending = useRef<DestructiveAction | null>(null);
  const cancelDestructive = useCallback(() => {
    pending.current = null;
    setPendingAction(null);
  }, []);
  const requestDestructive = useCallback(
    (label: string, run: () => void) => {
      if (!hasProjectWork(project.current)) {
        run();
        return;
      }
      const action = { label, run };
      pending.current = action;
      setPendingAction(action);
    },
    [project],
  );
  const continueDestructive = useCallback(
    (expected: DestructiveAction | null = pending.current) => {
      if (!expected || pending.current !== expected) return;
      pending.current = null;
      setPendingAction(null);
      expected.run();
    },
    [],
  );
  return { pendingAction, requestDestructive, cancelDestructive, continueDestructive };
}
