import type { Pattern } from '../app/model';
import { generate, type Generated } from '../generators';
import { IDENTITY, multiply, type Matrix } from '../geometry/matrix';
import { instances, type Bounds, type Instance, type Periodicity } from '../symmetry/groups';
export interface Scene {generated:Generated;instances:Instance[];status:Periodicity;message:string;}
export function buildScene(pattern:Pattern,bounds:Bounds):Scene{
  const generated=generate(pattern.generator,pattern.sourceGeometry);
  const finite=generated.finite||pattern.symmetry.family==='radial';
  const repeating=generated.finite?[{id:'finite',matrix:IDENTITY,cell:[0,0] as [number,number]}]:instances(pattern.symmetry,bounds,2);
  return {generated,instances:repeating,status:finite?'FINITE_NONPERIODIC':'PERIODIC_SEAMLESS',message:generated.finite?'Penrose · región aperiódica finita':pattern.symmetry.family==='radial'?'Simetría radial · sin periodicidad de traslación':pattern.symmetry.family==='frieze'?'Periódico en una dirección':'Periódico por construcción sobre su red de traslación'};
}
export function expandedTransforms(scene:Scene):Matrix[]{return scene.instances.flatMap(i=>scene.generated.placements.map(p=>multiply(i.matrix,p)));}
