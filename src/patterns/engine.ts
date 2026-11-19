import type { Pattern } from '../app/model';
import { generate, type Generated } from '../generators';
import { IDENTITY, multiply, apply, type Matrix } from '../geometry/matrix';
import { visibleInstances, type Bounds, type Instance, type Periodicity } from '../symmetry/groups';
import {geometryBounds} from '../application/clipping';
export interface Scene {generated:Generated;instances:Instance[];status:Periodicity;message:string;}
export function buildScene(pattern:Pattern,bounds:Bounds):Scene{
  const generated=generate(pattern.generator,pattern.sourceGeometry);
  const finite=generated.finite||pattern.symmetry.family==='radial';
  const base=geometryBounds(generated.geometry),corners=[{x:base.x,y:base.y},{x:base.x+base.width,y:base.y},{x:base.x,y:base.y+base.height},{x:base.x+base.width,y:base.y+base.height}],extent=generated.placements.flatMap(m=>corners.map(p=>apply(m,p)));
  const padding=Math.max(1,...generated.geometry.map(g=>g.strokeWidth))*2;
  const motif=extent.length?{x:Math.min(...extent.map(p=>p.x))-padding,y:Math.min(...extent.map(p=>p.y))-padding,width:Math.max(...extent.map(p=>p.x))-Math.min(...extent.map(p=>p.x))+padding*2,height:Math.max(...extent.map(p=>p.y))-Math.min(...extent.map(p=>p.y))+padding*2}:base;
  const repeating=generated.finite?[{id:'finite',matrix:IDENTITY,cell:[0,0] as [number,number]}]:visibleInstances(pattern.symmetry,bounds,motif);
  return {generated,instances:repeating,status:finite?'FINITE_NONPERIODIC':'PERIODIC_SEAMLESS',message:generated.finite?'Penrose · región aperiódica finita':pattern.symmetry.family==='radial'?'Simetría radial · sin periodicidad de traslación':pattern.symmetry.family==='frieze'?'Periódico en una dirección':'Periódico por construcción sobre su red de traslación'};
}
export function expandedTransforms(scene:Scene):Matrix[]{return scene.instances.flatMap(i=>scene.generated.placements.map(p=>multiply(i.matrix,p)));}
