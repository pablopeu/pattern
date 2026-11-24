import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { englishPhrases } from '../i18n/en-phrases';

/** Toda frase tr('...') del código debe tener traducción en el diccionario. */
function collect(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) collect(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path);
  }
  return out;
}
describe('cobertura de traducciones por frase', () => {
  it('no hay frases tr() sin traducción', () => {
    const missing: string[] = [];
    for (const file of collect('src/ui').concat(collect('src/app'), collect('src/share'))) {
      if (file.includes('/i18n/')) continue;
      const text = readFileSync(file, 'utf8');
      for (const [, phrase] of text.matchAll(/\btr\(\s*'((?:[^'\\]|\\.)*)'/g)) {
        const clean = phrase.replace(/\\'/g, "'");
        if (!(clean in englishPhrases)) missing.push(`${file}: ${clean}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
