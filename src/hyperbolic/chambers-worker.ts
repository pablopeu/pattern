import type { Project } from '../app/model';
import type { FlatSourceSelection } from '../patterns/finite-source';
import type { GeometryWorkerReply } from '../geometry/worker-job';
import {
  deriveChamberDisk,
  type ChamberSettings,
  type ChamberDiskRepresentation,
} from './chambers';
export interface ChamberRequest {
  project: Project;
  patternId: string;
  selection: FlatSourceSelection;
  settings: ChamberSettings;
}
self.onmessage = (event: MessageEvent<ChamberRequest>) => {
  let reply: GeometryWorkerReply<ChamberDiskRepresentation>;
  try {
    const r = event.data;
    reply = {
      ok: true,
      result: deriveChamberDisk(r.project, r.patternId, r.selection, r.settings),
    };
  } catch (error) {
    reply = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(reply);
};
