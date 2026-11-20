import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ftpDirectory } from './prepare-ftp.mjs';

test('folder names and optional trailing slashes target the same hosting subdirectory', () => {
  for (const input of ['pattern', 'pattern/', 'public_html/pattern', '/public_html/pattern/']) {
    assert.equal(ftpDirectory(input), 'public_html/pattern/');
  }
  assert.equal(ftpDirectory('sites/pattern'), 'public_html/sites/pattern/');
  assert.equal(ftpDirectory(' pattern '), 'public_html/pattern/');
});

test('missing folders, traversal and output injection cannot select another destination', () => {
  for (const input of [
    undefined,
    '',
    '/',
    'public_html',
    'public_html/',
    '.',
    '../other',
    'public_html/../other',
    'a//b',
    'a\\b',
    'pattern\nserver-dir=/',
  ]) {
    assert.throws(() => ftpDirectory(input));
  }
});

test('the CLI writes the normalized directory to the Actions output without logging secrets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pattern-ftp-'));
  try {
    const output = join(dir, 'output');
    const env = {
      ...process.env,
      FTP_HOST: 'host.invalid',
      FTP_USERNAME: 'private-user',
      FTP_PASSWORD: 'private-password',
      FTP_FOLDER: 'pattern',
      GITHUB_OUTPUT: output,
    };
    const result = spawnSync(process.execPath, ['scripts/prepare-ftp.mjs'], {
      env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, 'utf8'), 'server-dir=public_html/pattern/\n');
    assert.equal(result.stdout + result.stderr, '');
    const missing = spawnSync(process.execPath, ['scripts/prepare-ftp.mjs'], {
      env: { ...env, FTP_PASSWORD: '' },
      encoding: 'utf8',
    });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Falta el secret FTP_PASSWORD/);
    assert.ok(!missing.stderr.includes('private-user'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
