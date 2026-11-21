#!/usr/bin/env python3
"""LAN work dashboard and real Codex quota timer. No credentials leave this process."""
import argparse, datetime as dt, fcntl, hashlib, json, os, pathlib, subprocess, threading, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.runtime'
RUNTIME.mkdir(exist_ok=True, mode=0o700)
STATE = RUNTIME / 'usage.json'
FEEDBACK_WAKE = threading.Event()
FEEDBACK_WRITE = threading.Lock()
FEEDBACK_DELIVERY = threading.Lock()

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

def primary_reset(limits, now):
    """Use only the observed, unexpired five-hour reset for resuming work."""
    window = limits.get('primary') or {}
    reset = window.get('resets_at', 0)
    return reset + 60 if reset > now else None

def decision(limits, now):
    """Secondary quota alerts belong to Pablo; they never delay this cycle."""
    window = limits.get('primary') or {}
    return primary_reset(limits, now) if window.get('used_percent', 0) >= 90 else None

def primary_timer(timer, limits, now):
    # Migrate an older weekly timer without inventing a new quota or duplicating
    # a resume already sent. Explicit pending timers remain valid below90% usage.
    reset = primary_reset(limits, now)
    if reset and not timer.get('sent') and timer.get('resume_at', 0) > reset + 120:
        return dict(timer, resume_at=reset, reason='primary_reset', sent=False)
    return timer

def warn_secondary(thread_id, limits, now):
    window = limits.get('secondary') or {}
    path = RUNTIME / 'secondary-alert.json'
    if window.get('used_percent', 0) < 90 or window.get('resets_at', 0) <= now:
        if path.exists(): atomic_json(path, {})
        return
    previous = read_json(path, {})
    if previous.get('sent') and previous.get('resets_at') == window.get('resets_at'):
        return
    ok = queue(thread_id, 'Aviso de cupo secundario de Pattern Studio: queda10% o menos. Pablo decide si utiliza un banked reset. Este aviso no pausa automáticamente el trabajo ni posterga el timer: la pausa y reanudación automática se rigen exclusivamente por la ventana de5horas. No cambies el timer al reset semanal.')
    atomic_json(path, dict(resets_at=window.get('resets_at'), sent=ok))

def queue(thread_id, message, resume=False, accept_resume_warning=False):
    args = ['codex', 'queue', '--thread', thread_id, '--message', message]
    if resume: args.append('--resume')
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=60)
    event('queue', resume=resume, returncode=result.returncode, output=(result.stdout + result.stderr)[-2000:])
    # CLI may return zero with a resume warning: record it for inspection.
    return result.returncode == 0 and not (resume and not accept_resume_warning and 'warning' in result.stderr.lower())

def feedback_id(row):
    return row.get('id') or hashlib.sha256(json.dumps([row.get('time'), row.get('message')], ensure_ascii=False).encode()).hexdigest()

def feedback_rows():
    ledger = read_json(RUNTIME / 'feedback-delivery.json', {})
    return [dict(row, id=feedback_id(row), delivery=ledger.get(feedback_id(row), {}).get('status', 'pending'))
            for row in read_json_lines(RUNTIME / 'feedback.jsonl')]

def deliver_feedback(thread_id):
    # Serialize POST/poll/retry delivery. A successful queue is persisted before sending another row.
    with FEEDBACK_DELIVERY:
        path = RUNTIME / 'feedback-delivery.json'
        ledger = read_json(path, {})
        for row in read_json_lines(RUNTIME / 'feedback.jsonl'):
            key = feedback_id(row)
            previous = ledger.get(key, {})
            if previous.get('status') in ('queued', 'reviewed') or previous.get('retry_at', 0) > time.time(): continue
            # Always save feedback, but do not wake an exhausted primary cycle.
            # Expired telemetry never holds the queue past its real reset.
            if decision(read_json(RUNTIME / 'usage.json', {}), time.time()):
                if previous.get('status') != 'waiting_reset':
                    ledger[key] = dict(status='waiting_reset', updated_at=dt.datetime.now(dt.timezone.utc).isoformat(), retry_at=0)
                    atomic_json(path, ledger)
                    event('feedback_deferred', id=key)
                continue
            message = ('Feedback enviado desde el monitor LAN de Pattern Studio (' + str(row.get('time', '')) +
                       '). Incorporalo al trabajo en curso aunque no estés esperando el reset.\n\n' + str(row.get('message', '')))
            try:
                # A resume warning means the message was still queued (e.g. the turn is already active).
                ok = queue(thread_id, message, resume=True, accept_resume_warning=True)
            except Exception as error:
                event('feedback_error', id=key, error=str(error))
                ok = False
            ledger[key] = dict(status='queued' if ok else 'pending', updated_at=dt.datetime.now(dt.timezone.utc).isoformat(),
                               retry_at=0 if ok else time.time()+30)
            atomic_json(path, ledger)
            event('feedback_delivery', id=key, status=ledger[key]['status'])

def feedback_watch(thread_id):
    # Active feedback remains immediate; only an exhausted primary window gates delivery.
    while not (RUNTIME / 'STOP').exists():
        FEEDBACK_WAKE.clear()
        try: deliver_feedback(thread_id)
        except Exception as error: event('feedback_error', error=str(error))
        FEEDBACK_WAKE.wait(5)

def watch(thread_id, session):
    timer_file = RUNTIME / 'timer.json'
    timer = read_json(timer_file, {})
    while not (RUNTIME / 'STOP').exists():
        if (RUNTIME/'PROJECT_COMPLETE').exists():
            completed=read_json(STATE,{})
            if completed.get('status')!='complete':
                completed.update(status='complete',resume_at=None)
                atomic_json(STATE,completed)
                timer={};atomic_json(timer_file,timer)
                event('project_complete')
            time.sleep(20)
            continue
        try:
            sample = read_limits(session)
            if sample:
                now = time.time()
                limits = sample['limits']
                adjusted = primary_timer(timer, limits, now)
                if adjusted != timer:
                    timer = adjusted
                    atomic_json(timer_file, timer)
                    event('timer_primary_reset', resume_at=timer['resume_at'])
                warn_secondary(thread_id, limits, now)
                resume_at = decision(limits, now)
                state = dict(updated_at=dt.datetime.now(dt.timezone.utc).isoformat(), observed_at=sample['observed_at'],
                             primary=limits.get('primary'), secondary=limits.get('secondary'),
                             threshold_remaining=10, cycle_window='primary', secondary_policy='notify_only', status='working', resume_at=timer.get('resume_at'),
                             resume_result=timer.get('result'))
                if resume_at:
                    state['status'] = 'winding_down'
                    if not timer.get('resume_at') or abs(timer['resume_at']-resume_at)>120:
                        timer = dict(resume_at=resume_at, sent=False, close_requested=bool(timer.get('close_requested') and not timer.get('sent')))
                        atomic_json(timer_file, timer)
                        event('timer_scheduled', resume_at=resume_at)
                    if not timer.get('close_requested'):
                        ok = queue(thread_id, 'Monitor de cupo de Pattern Studio: queda 10% o menos en la ventana de5horas vigente. Terminá el incremento actual, ejecutá los checks necesarios, actualizá docs/CONTINUITY.md y docs/PROGRESS.md, hacé commit local y finalizá el turno. Hay un timer de reanudación después del reset real; no inicies otro incremento.')
                        timer['close_requested'] = ok
                        atomic_json(timer_file, timer)
                    state['resume_at'] = timer['resume_at']
                if timer.get('resume_at') and not timer.get('sent') and now >= timer['resume_at']:
                    ok = queue(thread_id, 'Reanudación programada por Pablo tras el reset del cupo. Continuá prd_v3.0.txt de /home/pablo/pattern, incluidos sus ejemplos. Leé AGENTS.md, docs/CONTINUITY.md, docs/PROGRESS.md, feedback y estado Git. Comprobá el uso real antes de continuar y no dupliques servicios. El ciclo automático vigila la ventana de5horas; el secundario sólo avisa y Pablo decide banked resets. Implementá, verificá, documentá y hacé commits locales hasta completar los criterios pendientes.', resume=True)
                    timer.update(sent=True, result='requested' if ok else 'resume_failed_inspect_events')
                    atomic_json(timer_file, timer)
                    state['status'] = 'resume_requested' if ok else 'resume_failed'
                if timer.get('resume_at') and not timer.get('sent') and now < timer['resume_at'] and not resume_at:
                    state['status'] = 'waiting_reset'
                atomic_json(STATE, state)
        except Exception as error:
            event('monitor_error', error=str(error))
        time.sleep(20)
    state=read_json(STATE,{})
    state['status']='complete' if (RUNTIME/'PROJECT_COMPLETE').exists() else 'stopped'
    state['resume_at']=None
    atomic_json(STATE,state)
    event('stopped',status=state['status'])

def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, text=True, capture_output=True, timeout=5).stdout.strip()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/status':
            body = dict(usage=read_json(STATE, {}), commits=git('log', '-10', '--format=%h %ad %s', '--date=iso-strict'),
                        changes=git('status', '--short'), progress=(ROOT / 'docs/PROGRESS.md').read_text(),
                        feedback=feedback_rows()[-20:])
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
            row = dict(id=uuid.uuid4().hex, time=dt.datetime.now(dt.timezone.utc).isoformat(), message=message)
            with FEEDBACK_WRITE:
                with (RUNTIME / 'feedback.jsonl').open('a') as handle: handle.write(json.dumps(row, ensure_ascii=False) + '\n')
            FEEDBACK_WAKE.set()
            self.reply(201, json.dumps(dict(ok=True, id=row['id'])).encode(), 'application/json')
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
        try:
            row = json.loads(line)
            if isinstance(row, dict): result.append(row)
        except ValueError: continue
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--thread', default=os.getenv('CODEX_THREAD_ID') or ((RUNTIME/'thread-id').read_text().strip() if (RUNTIME/'thread-id').exists() else None))
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
    (RUNTIME/'thread-id').write_text(args.thread)
    (RUNTIME/'thread-id').chmod(0o600)
    paths = list(pathlib.Path(os.getenv('CODEX_HOME',str(pathlib.Path.home()/'.codex'))).joinpath('sessions').rglob('*' + args.thread + '*.jsonl'))
    if len(paths) != 1: raise SystemExit('No se identificó un registro de sesión único')
    server = ThreadingHTTPServer(('0.0.0.0', args.port), Handler)
    threading.Thread(target=watch, args=(args.thread, paths[0]), daemon=True).start()
    threading.Thread(target=feedback_watch, args=(args.thread,), daemon=True).start()
    event('started', thread=args.thread, port=args.port)
    server.serve_forever()
