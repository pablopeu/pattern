import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function ftpDirectory(value) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error('FTP_FOLDER debe indicar una subcarpeta dentro de public_html.');
  }
  const parts = value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .split('/');
  if (parts[0] === 'public_html') parts.shift();
  if (
    !parts.length ||
    parts.some((part) => !part || part === '.' || part === '..' || part.includes('\\'))
  ) {
    throw new Error('FTP_FOLDER debe indicar una subcarpeta dentro de public_html.');
  }
  return `public_html/${parts.join('/')}/`;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    for (const key of ['FTP_HOST', 'FTP_USERNAME', 'FTP_PASSWORD', 'FTP_FOLDER']) {
      if (!process.env[key]) throw new Error(`Falta el secret ${key}.`);
    }
    const directory = ftpDirectory(process.env.FTP_FOLDER);
    if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT no está disponible.');
    appendFileSync(process.env.GITHUB_OUTPUT, `server-dir=${directory}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
