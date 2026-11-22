import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawn } from 'node:child_process';
export async function staticServer(directory, prefix = '/') {
  const root = resolve(directory);
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!path.startsWith(prefix)) {
        res.writeHead(404);
        res.end();
        return;
      }
      const suffix = path.slice(prefix.length) || 'index.html';
      const target = resolve(root, suffix.endsWith('/') ? suffix + 'index.html' : suffix);
      if (!target.startsWith(root + '/')) {
        res.writeHead(403);
        res.end();
        return;
      }
      const bytes = await readFile(target);
      const type =
        {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.ico': 'image/x-icon',
          '.svg': 'image/svg+xml',
          '.json': 'application/json',
          '.webmanifest': 'application/manifest+json',
        }[extname(target)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((ok, no) => {
    server.once('error', no);
    server.listen(0, '127.0.0.1', ok);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}${prefix}`,
    close: () => {
      server.closeAllConnections();
      return new Promise((ok) => server.close(ok));
    },
  };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [, , directory, prefix, report, artifacts] = process.argv;
  const server = await staticServer(directory, prefix);
  try {
    const child = spawn(
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', '--workers=2', `--output=${artifacts}`],
      {
        env: {
          ...process.env,
          TEST_STATIC: '1',
          TEST_BASE_URL: server.url,
          QA_PLAYWRIGHT_REPORT: report,
        },
        stdio: 'inherit',
      },
    );
    process.exitCode = await new Promise((ok, no) => {
      child.on('error', no);
      child.on('exit', (code) => ok(code ?? 1));
    });
  } finally {
    await server.close();
  }
}
