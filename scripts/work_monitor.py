#!/usr/bin/env python3
"""LAN work dashboard and real Codex quota timer. No credentials leave this process."""
import argparse, datetime as dt, fcntl, json, os, pathlib, subprocess, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.runtime'
RUNTIME.mkdir(exist_ok=True, mode=0o700)
STATE = RUNTIME / 'usage.json'

def atomic_json(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    tmp.replace(path)

def read_json(path, default):
    try: return json.loads(path.read_text())
    except (OSError, ValueError): return default

def event(kind, **data):
    with (RUNTIME / 'monitor-events.jsonl').open('a') as handle:
        handle.write(json.dumps(dict(time=dt.datetime.now(dt.timezone.utc).isoformat(), event=kind, **data), ensure_ascii=False) + '\n')

def read_limits(path):
    latest = None
    with path.open('rb') as handle:
        handle.seek(max(0, path.stat().st_size - 2_000_000))
        for line in handle:
            try: row = json.loads(line)
            except (ValueError, UnicodeDecodeError): continue
            limits = row.get('payload', {}).get('rate_limits')
            if limits:
                latest = dict(limits=limits, observed_at=row.get('timestamp'))
    return latest

def decision(limits, now):
    """Only act on unexpired, observed windows. Do not invent a fresh quota."""
    low = []
    for name in ('primary', 'secondary'):
        w = limits.get(name) or {}
        if w.get('used_percent', 0) >= 90 and w.get('resets_at', 0) > now:
            low.append(w['resets_at'])
    return max(low) + 60 if low else None

def queue(thread_id, message, resume=False):
    args = ['codex', 'queue', '--thread', thread_id, '--message', message]
    if resume: args.append('--resume')
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=60)
    event('queue', resume=resume, returncode=result.returncode, output=(result.stdout + result.stderr)[-2000:])
    # CLI may return zero with a resume warning: record it for inspection.
    return result.returncode == 0 and not (resume and 'warning' in result.stderr.lower())

def watch(thread_id, session):
    timer_file = RUNTIME / 'timer.json'
    timer = read_json(timer_file, {})
    while not (RUNTIME / 'STOP').exists() and not (RUNTIME / 'PROJECT_COMPLETE').exists():
        try:
            sample = read_limits(session)
            if sample:
                now = time.time()
                limits = sample['limits']
                resume_at = decision(limits, now)
                state = dict(updated_at=dt.datetime.now(dt.timezone.utc).isoformat(), observed_at=sample['observed_at'],
                             primary=limits.get('primary'), secondary=limits.get('secondary'),
                             threshold_remaining=10, status='working', resume_at=timer.get('resume_at'),
                             resume_result=timer.get('result'))
                if resume_at:
                    state['status'] = 'winding_down'
                    if timer.get('resume_at') != resume_at:
                        timer = dict(resume_at=resume_at, sent=False, close_requested=False)
                        atomic_json(timer_file, timer)
                        event('timer_scheduled', resume_at=resume_at)
                    if not timer.get('close_requested'):
                        ok = queue(thread_id, 'Monitor de cupo de Pattern Studio: queda 10% o menos en una ventana vigente. Terminá el incremento actual, ejecutá los checks necesarios, actualizá docs/CONTINUITY.md y docs/PROGRESS.md, hacé commit local y finalizá el turno. Hay un timer de reanudación después del reset real; no inicies otro incremento.')
                        timer['close_requested'] = ok
                        atomic_json(timer_file, timer)
                    state['resume_at'] = timer['resume_at']
                if timer.get('resume_at') and not timer.get('sent') and now >= timer['resume_at']:
                    ok = queue(thread_id, 'Reanudación programada por Pablo tras el reset del cupo. Continuá el PRD de /home/pablo/pattern. Leé AGENTS.md, docs/CONTINUITY.md, docs/PROGRESS.md, feedback y estado Git. Comprobá el uso real antes de continuar y no dupliques servicios. Implementá, verificá, documentá y hacé commits locales hasta completar los criterios pendientes.', resume=True)
                    timer.update(sent=True, result='requested' if ok else 'resume_failed_inspect_events')
                    atomic_json(timer_file, timer)
                    state['status'] = 'resume_requested' if ok else 'resume_failed'
                if timer.get('resume_at') and not timer.get('sent') and now < timer['resume_at'] and not resume_at:
                    state['status'] = 'waiting_reset'
                atomic_json(STATE, state)
        except Exception as error:
            event('monitor_error', error=str(error))
        time.sleep(20)
    event('stopped')

def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, text=True, capture_output=True, timeout=5).stdout.strip()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/status':
            body = dict(usage=read_json(STATE, {}), commits=git('log', '-10', '--format=%h %ad %s', '--date=iso-strict'),
                        changes=git('status', '--short'), progress=(ROOT / 'docs/PROGRESS.md').read_text(),
                        feedback=read_json_lines(RUNTIME / 'feedback.jsonl')[-20:])
            self.reply(200, json.dumps(body, ensure_ascii=False).encode(), 'application/json')
        elif self.path in ('/', '/index.html'):
            self.reply(200, (ROOT / 'scripts/dashboard.html').read_bytes(), 'text/html; charset=utf-8')
        else: self.reply(404, b'Not found', 'text/plain')
    def do_POST(self):
        if self.path != '/api/feedback': return self.reply(404, b'Not found', 'text/plain')
        # Accept only same-origin browser submissions (or non-browser local clients).
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host', ''):
            return self.reply(403, b'Origin rejected', 'text/plain')
        try:
            length = int(self.headers.get('Content-Length', 0))
            if not 0 < length <= 10000: raise ValueError('Tamaño inválido')
            data = json.loads(self.rfile.read(length))
            message = str(data.get('message', '')).strip()
            if not message: raise ValueError('Escribí tu feedback')
            row = dict(time=dt.datetime.now(dt.timezone.utc).isoformat(), message=message)
            with (RUNTIME / 'feedback.jsonl').open('a') as handle: handle.write(json.dumps(row, ensure_ascii=False) + '\n')
            self.reply(201, b'{"ok":true}', 'application/json')
        except (ValueError, TypeError): self.reply(400, b'{"error":"Feedback invalido"}', 'application/json')
    def reply(self, status, body, content_type):
        self.send_response(status); self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store'); self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *args): pass

def read_json_lines(path):
    if not path.exists(): return []
    result = []
    for line in path.read_text().splitlines():
        try: result.append(json.loads(line))
        except ValueError: continue
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--thread', default=os.getenv('CODEX_THREAD_ID'))
    parser.add_argument('--port', type=int, default=4174)
    parser.add_argument('--status', action='store_true')
    args = parser.parse_args()
    if args.status:
        print(json.dumps(read_json(STATE, {'status': 'not_running'}), ensure_ascii=False, indent=2))
        raise SystemExit(0)
    lock = (RUNTIME / 'monitor.lock').open('w')
    try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError: raise SystemExit('Monitor ya activo')
    if not args.thread: raise SystemExit('Falta --thread o CODEX_THREAD_ID')
    paths = list(pathlib.Path.home().joinpath('.codex/sessions').rglob('*' + args.thread + '*.jsonl'))
    if len(paths) != 1: raise SystemExit('No se identificó un registro de sesión único')
    server = ThreadingHTTPServer(('0.0.0.0', args.port), Handler)
    threading.Thread(target=watch, args=(args.thread, paths[0]), daemon=True).start()
    event('started', thread=args.thread, port=args.port)
    server.serve_forever()
