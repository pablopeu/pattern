import { newProject, uid, type Pattern } from '../app/model';
import { migratePatternV1 } from './migrations';
import { parseProject } from './schema';
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
    (data.presetVersion !== 1 && data.presetVersion !== 2) ||
    !('pattern' in data)
  )
    throw Error('Versión o estructura de preset no compatible.');
  const project = newProject();
  project.patterns = [
    (data.presetVersion === 1 ? migratePatternV1(data.pattern) : data.pattern) as Pattern,
  ];
  const pattern = parseProject(JSON.stringify(project)).patterns[0];
  pattern.id = uid();
  const groups = new Map<string, string>();
  for (const shape of pattern.sourceGeometry) {
    shape.id = uid();
    if (shape.groupId) {
      if (!groups.has(shape.groupId)) groups.set(shape.groupId, uid());
      shape.groupId = groups.get(shape.groupId);
    }
  }
  return pattern;
}
