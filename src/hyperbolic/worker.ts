import { deriveDisk, type DiskSettings, type DiskRepresentation } from './representation';
import type { Geometry, Project } from '../app/model';
import {
  deriveProjectDisk,
  type FlatSourceSelection,
  type ProjectDiskRepresentation,
} from './flat-source';
export type DiskWorkerRequest =
  | { kind: 'shapes'; shapes: Geometry[]; settings: DiskSettings }
  | {
      kind: 'project';
      project: Project;
      patternId: string;
      selection: FlatSourceSelection;
      settings: DiskSettings;
    };
export type DiskWorkerResult = DiskRepresentation & {
  flatSource?: ProjectDiskRepresentation['flatSource'];
};
export type DiskWorkerReply = { ok: true; result: DiskWorkerResult } | { ok: false; error: string };
self.onmessage = (event: MessageEvent<DiskWorkerRequest>) => {
  let reply: DiskWorkerReply;
  try {
    const request = event.data;
    reply = {
      ok: true,
      result:
        request.kind === 'project'
          ? deriveProjectDisk(
              request.project,
              request.patternId,
              request.selection,
              request.settings,
            )
          : deriveDisk(request.shapes, request.settings),
    };
  } catch (error) {
    reply = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(reply);
};
