import { z } from 'zod';
import type { Project } from './model';

export const WORK_PREFERENCES_KEY = 'patterns.work-preferences.v1';
const preferencesSchema = z
  .object({
    styleDefaultsFollowSelection: z.boolean(),
    stylePanelPinned: z.boolean(),
    fillCloseTolerance: z.number().min(0).max(5),
    fillLinkedDefault: z.boolean(),
    grid: z.boolean(),
    snap: z.boolean(),
    snapNodes: z.boolean(),
    snapRadiusPx: z.number().min(1).max(40),
    background: z.string().regex(/^#[\da-fA-F]{6}$/),
    fundamental: z.boolean(),
    axes: z.boolean(),
    centers: z.boolean(),
    continuity: z.boolean(),
    outside: z.boolean(),
  })
  .partial();
const schema = z.object({
  version: z.literal(1),
  preferences: preferencesSchema,
  units: z.enum(['mm', 'cm', 'in', 'px']),
});
type WorkPreferences = z.infer<typeof schema>;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const keys = Object.keys(preferencesSchema.shape) as (keyof WorkPreferences['preferences'])[];
export function captureWorkPreferences(p: Project): WorkPreferences {
  return {
    version: 1,
    units: p.documentUnits,
    preferences: Object.fromEntries(keys.map((k) => [k, p.preferences[k]])),
  };
}
export function readWorkPreferences(storage?: StorageLike): WorkPreferences | null {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(WORK_PREFERENCES_KEY);
    return raw ? schema.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function saveWorkPreferences(value: WorkPreferences, storage?: StorageLike): void {
  try {
    const store = storage ?? globalThis.localStorage,
      text = JSON.stringify(schema.parse(value));
    if (store && store.getItem(WORK_PREFERENCES_KEY) !== text)
      store.setItem(WORK_PREFERENCES_KEY, text);
  } catch {
    /* The portable document/autosave still works when localStorage is unavailable. */
  }
}
/** Only explicit changes update the profile; loading an example never replaces it. */
export function rememberWorkPreferenceChanges(
  before: Project,
  next: Project,
  storage?: StorageLike,
): void {
  const changed = keys.filter((k) => before.preferences[k] !== next.preferences[k]);
  if (!changed.length && before.documentUnits === next.documentUnits) return;
  const profile = readWorkPreferences(storage) ?? captureWorkPreferences(before);
  for (const key of changed) Object.assign(profile.preferences, { [key]: next.preferences[key] });
  if (before.documentUnits !== next.documentUnits) profile.units = next.documentUnits;
  saveWorkPreferences(profile, storage);
}
export function withWorkPreferences(p: Project, fresh = false, storage?: StorageLike): Project {
  const profile = readWorkPreferences(storage);
  if (!profile) return p;
  return {
    ...p,
    documentUnits: profile.units,
    preferences: {
      ...p.preferences,
      ...profile.preferences,
      // Artwork/file background is document content; a fresh study uses the user's last choice.
      background: fresh
        ? (profile.preferences.background ?? p.preferences.background)
        : p.preferences.background,
    },
  };
}
