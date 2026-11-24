import { describe, expect, it } from 'vitest';
import {
  detectLanguage,
  experienceDefaults,
  parseExperience,
  resolveLanguage,
  resolveTheme,
} from '../app/experience';
import { en } from '../i18n/en';
import { es } from '../i18n/es';

describe('experiencia: idioma, tema y modo', () => {
  it('detecta es-*/en-* y cae a inglés para el resto', () => {
    expect(detectLanguage({ languages: ['es-AR', 'en-US'] })).toBe('es');
    expect(detectLanguage({ languages: ['es-ES'] })).toBe('es');
    expect(detectLanguage({ languages: ['en-US'] })).toBe('en');
    expect(detectLanguage({ languages: ['en-GB', 'es'] })).toBe('en');
    expect(detectLanguage({ languages: ['pt-BR'] })).toBe('en');
    expect(detectLanguage({ languages: ['fr-FR'] })).toBe('en');
    expect(detectLanguage({})).toBe('en');
    expect(detectLanguage({ language: 'es-419' })).toBe('es');
  });
  it('respeta la elección manual sobre el navegador', () => {
    expect(resolveLanguage('es', { languages: ['en-US'] })).toBe('es');
    expect(resolveLanguage('en', { languages: ['es-AR'] })).toBe('en');
    expect(resolveLanguage('auto', { languages: ['es-AR'] })).toBe('es');
  });
  it('valida y completa preferencias corruptas', () => {
    expect(parseExperience(null)).toEqual(experienceDefaults);
    expect(parseExperience({ language: 'xx', theme: 'blue', uiMode: 'pro' })).toEqual(
      experienceDefaults,
    );
    expect(
      parseExperience({ language: 'en', theme: 'dark', uiMode: 'advanced' }),
    ).toEqual({ language: 'en', theme: 'dark', uiMode: 'advanced' });
  });
  it('resuelve el tema automático con prefers-color-scheme', () => {
    expect(resolveTheme('light', () => true)).toBe('light');
    expect(resolveTheme('dark', () => false)).toBe('dark');
    expect(resolveTheme('auto', () => true)).toBe('dark');
    expect(resolveTheme('auto', () => false)).toBe('light');
  });
  it('los catálogos ES/EN cubren exactamente las mismas claves y ninguna vacía', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const value of Object.values(en)) expect(value.trim().length).toBeGreaterThan(0);
    for (const value of Object.values(es)) expect(value.trim().length).toBeGreaterThan(0);
  });
});
