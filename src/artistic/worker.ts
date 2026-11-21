import type { Project } from '../app/model';
import type { FlatSourceSelection } from '../patterns/finite-source';
import type { GeometryWorkerReply } from '../geometry/worker-job';
import {
  deriveArtisticDisk,
  type ArtisticDiskSettings,
  type ArtisticDiskRepresentation,
} from './disk';
export interface ArtisticDiskRequest {
  project: Project;
  patternId: string;
  selection: FlatSourceSelection;
  settings: ArtisticDiskSettings;
}
self.onmessage = (event: MessageEvent<ArtisticDiskRequest>) => {
  let reply: GeometryWorkerReply<ArtisticDiskRepresentation>;
  try {
    const r = event.data;
    reply = {
      ok: true,
      result: deriveArtisticDisk(r.project, r.patternId, r.selection, r.settings),
    };
  } catch (error) {
    reply = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(reply);
};
