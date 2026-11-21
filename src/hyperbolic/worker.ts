import { deriveDisk, type DiskSettings, type DiskRepresentation } from './representation';
import type { Geometry } from '../app/model';
export type DiskWorkerReply =
  | { ok: true; result: DiskRepresentation }
  | { ok: false; error: string };
self.onmessage = (event: MessageEvent<{ shapes: Geometry[]; settings: DiskSettings }>) => {
  let reply: DiskWorkerReply;
  try {
    reply = { ok: true, result: deriveDisk(event.data.shapes, event.data.settings) };
  } catch (error) {
    reply = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(reply);
};
