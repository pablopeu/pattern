import { useCallback, useSyncExternalStore } from 'react';
import {
  applyExperience,
  detectLanguage,
  loadExperience,
  resolveLanguage,
  resolveTheme,
  saveExperience,
  subscribeExperience,
  type ExperiencePreferences,
  type LanguagePreference,
  type Locale,
  type ThemePreference,
  type UiMode,
} from '../app/experience';
import { en } from './en';
import { es, type MessageKey } from './es';

export type { MessageKey } from './es';
export type { Locale, LanguagePreference, ThemePreference, UiMode } from '../app/experience';

const catalogs: Record<Locale, Record<MessageKey, string>> = { es, en };

export function message(key: MessageKey, params?: Record<string, string | number>): string {
  const preferences = loadExperience(),
    locale = resolveLanguage(preferences.language);
  let text = catalogs[locale][key] ?? es[key] ?? key;
  if (params)
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

/** Diccionario explícito para mensajes técnicos existentes de validadores/servicios. */
export function translateMessage(text: string): string {
  const preferences = loadExperience(),
    locale = resolveLanguage(preferences.language);
  if (locale === 'es') return text;
  return englishMessages[text] ?? text;
}

const englishMessages: Record<string, string> = {};

/** Hook de UI: idioma/tema/modo + traducción con re-render inmediato. */
export function useI18n() {
  return useSyncExternalStore(
    subscribeExperience,
    () => loadExperience(),
    () => loadExperience(),
  );
}

export function useExperienceActions() {
  const setPreferences = useCallback((patch: Partial<ExperiencePreferences>) => {
    const next = { ...loadExperience(), ...patch };
    saveExperience(next);
    applyExperience(next);
  }, []);
  return {
    setPreferences,
    setLanguage: (language: LanguagePreference) => setPreferences({ language }),
    setTheme: (theme: ThemePreference) => setPreferences({ theme }),
    setUiMode: (uiMode: UiMode) => setPreferences({ uiMode }),
  };
}

export { detectLanguage, resolveLanguage, resolveTheme };
