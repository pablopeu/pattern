import { newProject, uid, type Pattern } from '../app/model';
import { migratePatternV1 } from './migrations';
import { parseProject } from './schema';
import { remapJunctions } from '../editor/junctions';
export function parsePreset(text: string): Pattern {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw Error('El preset no contiene JSON válido.');
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    !('presetVersion' in data) ||
    (data.presetVersion !== 1 &&
      data.presetVersion !== 2 &&
      data.presetVersion !== 3 &&
      data.presetVersion !== 4 &&
      data.presetVersion !== 5 &&
      data.presetVersion !== 6) ||
    !('pattern' in data)
  )
    throw Error('Versión o estructura de preset no compatible.');
  const project = newProject();
  project.patterns = [
    (data.presetVersion === 1 ? migratePatternV1(data.pattern) : data.pattern) as Pattern,
  ];
  const pattern = parseProject(
    JSON.stringify({ ...project, schemaVersion: data.presetVersion < 4 ? 3 : data.presetVersion }),
  ).patterns[0];
  const oldPatternId = pattern.id;
  pattern.id = uid();
  const ids = new Map(pattern.sourceGeometry.map((g) => [g.id, uid()]));
  const groups = new Map<string, string>();
  for (const shape of pattern.sourceGeometry) {
    shape.id = ids.get(shape.id)!;
    if (shape.fillRegion) {
      const fill = shape.fillRegion;
      for (const r of [...fill.refs, ...fill.inputs]) {
        if (r.patternId === oldPatternId) {
          r.patternId = pattern.id;
          r.shapeId = ids.get(r.shapeId) ?? r.shapeId;
        }
      }
      fill.linked = false;
      fill.status = 'fixed';
      fill.reason = 'Preset importado: contorno conservado como valor independiente.';
    }
    if (shape.groupId) {
      if (!groups.has(shape.groupId)) groups.set(shape.groupId, uid());
      shape.groupId = groups.get(shape.groupId);
    }
  }
  remapJunctions(pattern.sourceGeometry);
  return pattern;
}
