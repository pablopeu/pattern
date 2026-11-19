#!/usr/bin/env python3
"""Start/inspect/stop only Pattern Studio's own LAN services."""
import argparse, os, pathlib, signal, socket, subprocess, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'.runtime';RUNTIME.mkdir(exist_ok=True)
SERVICES={'app':(['npm','run','dev'],4173),'monitor':(['python3','scripts/work_monitor.py'],4174)}
def owned_pid(name):
 try:
  pid=int((RUNTIME/(name+'.pid')).read_text())
  if pathlib.Path('/proc',str(pid),'cwd').resolve()!=ROOT:return None
  cmd=pathlib.Path('/proc',str(pid),'cmdline').read_text()
  if (name=='app' and 'npm' not in cmd)or(name=='monitor' and 'work_monitor.py' not in cmd):return None
  return pid
 except (OSError,ValueError):return None

def listening(port):
 with socket.socket() as client:
  client.settimeout(.3);return client.connect_ex(('127.0.0.1',port))==0

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('action',choices=['start','status','stop']);parser.add_argument('--thread');args=parser.parse_args()
 if args.thread:(RUNTIME/'thread-id').write_text(args.thread)
 for name,(command,port) in SERVICES.items():
  pid=owned_pid(name)
  if args.action=='start' and not pid:
   if listening(port):raise SystemExit(f'El puerto {port} está ocupado por otro proceso; no se modifica.')
   if name=='monitor' and not (args.thread or os.getenv('CODEX_THREAD_ID') or (RUNTIME/'thread-id').exists()):
    print('Monitor no iniciado: falta --thread o CODEX_THREAD_ID.');continue
   log=(RUNTIME/(name+'.log')).open('ab');child=subprocess.Popen(command,cwd=ROOT,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True);pid=child.pid;(RUNTIME/(name+'.pid')).write_text(str(pid))
   for _ in range(50):
    if listening(port):break
    if child.poll() is not None:raise SystemExit(f'{name} no inició; revisar .runtime/{name}.log')
    time.sleep(.1)
  if args.action=='stop' and pid:
   os.killpg(pid,signal.SIGTERM);(RUNTIME/(name+'.pid')).unlink(missing_ok=True);print(name,'detenido');continue
  print(f'{name}: '+(f'PID {pid} · http://0.0.0.0:{port}' if pid else 'no iniciado'))
