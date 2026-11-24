/**
 * Preferencias de experiencia (PRD v4.0 §8): idioma, tema y modo de interfaz.
 * Viven en localStorage del navegador, nunca en el documento artístico ni en
 * `Project.preferences`. Cambiarlas no crea undo, no marca el estudio como
 * modificado y no dispara guardados.
 */
export type LanguagePreference = 'auto' | 'es' | 'en';
export type ThemePreference = 'auto' | 'light' | 'dark';
export type UiMode = 'simple' | 'advanced';
export type Locale = 'es' | 'en';

export interface ExperiencePreferences {
  language: LanguagePreference;
  theme: ThemePreference;
  uiMode: UiMode;
}

export const experienceDefaults: ExperiencePreferences = {
  language: 'auto',
  theme: 'auto',
  uiMode: 'simple',
};

const STORAGE_KEY = 'pattern.experience.v1';

const languages: LanguagePreference[] = ['auto', 'es', 'en'];
const themes: ThemePreference[] = ['auto', 'light', 'dark'];
const modes: UiMode[] = ['simple', 'advanced'];

export function parseExperience(raw: unknown): ExperiencePreferences {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    language: languages.includes(value.language as LanguagePreference)
      ? (value.language as LanguagePreference)
      : experienceDefaults.language,
    theme: themes.includes(value.theme as ThemePreference)
      ? (value.theme as ThemePreference)
      : experienceDefaults.theme,
    uiMode: modes.includes(value.uiMode as UiMode)
      ? (value.uiMode as UiMode)
      : experienceDefaults.uiMode,
  };
}

let current: ExperiencePreferences | null = null;
const listeners = new Set<() => void>();

export function loadExperience(): ExperiencePreferences {
  if (current) return current;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    current = raw ? parseExperience(JSON.parse(raw)) : { ...experienceDefaults };
  } catch {
    current = { ...experienceDefaults };
  }
  return current;
}

export function saveExperience(next: ExperiencePreferences) {
  current = parseExperience(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* sin almacenamiento: la sesión conserva los valores en memoria */
  }
  listeners.forEach((listener) => listener());
}

export function subscribeExperience(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Detección inicial (PRD §2.2): es* → es; en* → en; resto → en. */
export function detectLanguage(input: {
  languages?: readonly string[];
  language?: string;
}): Locale {
  const candidates = [...(input.languages ?? []), input.language ?? ''].filter(Boolean);
  for (const candidate of candidates) {
    const primary = candidate.toLowerCase().split('-')[0];
    if (primary === 'es') return 'es';
    if (primary === 'en') return 'en';
  }
  return 'en';
}

export function resolveLanguage(
  preference: LanguagePreference,
  navigatorLike: { languages?: readonly string[]; language?: string } = typeof navigator ===
  'undefined'
    ? {}
    : navigator,
): Locale {
  if (preference === 'es' || preference === 'en') return preference;
  return detectLanguage(navigatorLike);
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: () => boolean = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)')?.matches,
): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference;
  return prefersDark() ? 'dark' : 'light';
}

/** Aplica tema e idioma al documento: sólo presentación, jamás al lienzo. */
export function applyExperience(preferences: ExperiencePreferences) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement,
    locale = resolveLanguage(preferences.language),
    theme = resolveTheme(preferences.theme);
  root.lang = locale;
  root.dataset.theme = theme;
  root.dataset.uiMode = preferences.uiMode;
  applyMessageLocale(locale);
}

let messageLocale: Locale = 'es';
export function applyMessageLocale(locale: Locale) {
  messageLocale = locale;
}
export function currentMessageLocale(): Locale {
  return messageLocale;
}


/** Fondo claro predeterminado de un estudio nuevo. */
export const lightDefaultBackground = '#f8faf5';
/** Lienzo oscuro cuando el tema es oscuro y el fondo es el predeterminado claro. */
export const darkCanvasBackground = '#1b211c';
export const darkStroke = '#e7eee1';
export const darkFill = '#a9cfe0';
export const lightGridDot = '#000000';
export const darkGridDot = '#7d917d';

export function isDarkTheme(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme)
    return document.documentElement.dataset.theme === 'dark';
  return resolveTheme(loadExperience().theme) === 'dark';
}

/**
 * Fondo efectivo del lienzo: el tema lo oscurece sólo cuando el estudio usa el
 * fondo predeterminado. Un fondo elegido por el usuario se respeta siempre
 * (PRD v4.0 §3.5; ajuste pedido por Pablo para el área de trabajo oscura).
 */
export function themedBackground(background: string): string {
  return isDarkTheme() && background.toLowerCase() === lightDefaultBackground
    ? darkCanvasBackground
    : background;
}

/** Estilo para geometría nueva: los defaults claros se aclaran aún más en oscuro. */
export function themedDrawingStyle<T extends { stroke: string; fill: string }>(style: T): T {
  if (!isDarkTheme()) return style;
  return {
    ...style,
    stroke: style.stroke.toLowerCase() === '#233b2d' ? darkStroke : style.stroke,
    fill: style.fill.toLowerCase() === '#3b82f6' ? darkFill : style.fill,
  };
}

export function themedGridDot(): string {
  return isDarkTheme() ? darkGridDot : lightGridDot;
}
