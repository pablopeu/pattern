import { describe, expect, it } from 'vitest';
import {
  themedBackground,
  themedDrawingStyle,
  themedGridDot,
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

describe('lienzo y defaults según el tema', () => {
  const withTheme = (theme: string | undefined, run: () => void) => {
    const prev = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = theme
      ? { documentElement: { dataset: { theme } } }
      : undefined;
    try {
      run();
    } finally {
      (globalThis as { document?: unknown }).document = prev;
    }
  };
  it('oscurece el lienzo sólo con el fondo predeterminado', () => {
    withTheme('dark', () => {
      expect(themedBackground('#f8faf5')).toBe('#1b211c');
      expect(themedBackground('#ffffff')).toBe('#ffffff');
      expect(themedBackground('#112233')).toBe('#112233');
    });
    withTheme('light', () => expect(themedBackground('#f8faf5')).toBe('#f8faf5'));
  });
  it('aclara los defaults de trazo y relleno sólo en oscuro', () => {
    withTheme('dark', () => {
      expect(themedDrawingStyle({ stroke: '#233b2d', fill: '#3b82f6' })).toEqual({
        stroke: '#e7eee1',
        fill: '#a9cfe0',
      });
      expect(themedDrawingStyle({ stroke: '#ff0000', fill: 'none' })).toEqual({
        stroke: '#ff0000',
        fill: 'none',
      });
      expect(themedGridDot()).toBe('#7d917d');
    });
    withTheme('light', () => {
      expect(themedDrawingStyle({ stroke: '#233b2d', fill: '#3b82f6' })).toEqual({
        stroke: '#233b2d',
        fill: '#3b82f6',
      });
      expect(themedGridDot()).toBe('#000000');
    });
  });
});
