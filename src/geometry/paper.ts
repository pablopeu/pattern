import paper from 'paper';
import { geometry, node, type Geometry, type Node } from '../app/model';
import { IDENTITY, type Matrix } from './matrix';
import { pathData } from './paths';
// Headless Paper project; never serves as the canonical editable document.
const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));
export function paperPath(shape:Geometry,transform:Matrix=IDENTITY):paper.PathItem{
  scope.activate();
  const path=new scope.CompoundPath({pathData:pathData(shape),insert:false});
  path.fillRule=shape.fillRule;
  const m=shape.transform;
  path.transform(new scope.Matrix(m[0],m[1],m[2],m[3],m[4],m[5]));
  path.transform(new scope.Matrix(...transform));
  return path;
}
export function pathToGeometry(path:paper.PathItem,style?:Geometry):Geometry{
  const g={...geometry('compound',[],true),stroke:style?.stroke??'#233b2d',fill:style?.fill??'none',strokeWidth:style?.strokeWidth??.65,pathData:path.pathData,opacity:style?.opacity??1,fillOpacity:style?.fillOpacity??1,strokeOpacity:style?.strokeOpacity??1,fillRule:path.fillRule as 'evenodd'|'nonzero'};
  path.remove();return g;
}
export function editablePaths(shape:Geometry):Geometry[]{
  const p=paperPath(shape),paths=p instanceof scope.CompoundPath?p.children:[p];
  const out=paths.map((item,i)=>{const path=item as paper.Path;return {...shape,id:i===0?shape.id:`${shape.id}-part-${i}`,kind:'path' as const,parameters:undefined,pathData:undefined,transform:IDENTITY,closed:path.closed,nodes:path.segments.map(s=>({x:s.point.x,y:s.point.y,in:{x:s.handleIn.x,y:s.handleIn.y},out:{x:s.handleOut.x,y:s.handleOut.y}}))};});
  p.remove();return out;
}
export type BooleanOperation='union'|'intersection'|'difference'|'reverse-difference'|'xor';
export function booleanGeometry(shapes:Geometry[],operation:BooleanOperation):Geometry{
  if(shapes.length<2||shapes.some(s=>!s.closed))throw Error('Seleccioná al menos dos regiones cerradas.');
  const work=operation==='reverse-difference'?[...shapes].reverse():shapes;
  let result=paperPath(work[0]);
  try{
    for(const shape of work.slice(1)){
      const next=paperPath(shape),old=result;
      if(operation==='union')result=result.unite(next,{insert:false});
      else if(operation==='intersection')result=result.intersect(next,{insert:false});
      else if(operation==='xor')result=result.exclude(next,{insert:false});
      else result=result.subtract(next,{insert:false});
      old.remove();next.remove();
    }
    if(!result.pathData)throw Error('La operación produce una región vacía. Los objetos originales se conservan.');return {...pathToGeometry(result,shapes[0]),name:operation};
  }finally{result.remove();}
}
/** Physical-unit flattening for DXF with Paper.js adaptive subdivision. */
export function flattened(shape:Geometry,tolerance:number,transform:Matrix=IDENTITY):{points:{x:number;y:number}[];closed:boolean}[]{
  const p=paperPath(shape,transform),paths=p instanceof scope.CompoundPath?p.children:[p];
  const result=paths.map(item=>{const path=item as paper.Path;path.flatten(tolerance);return {points:path.segments.map(s=>({x:s.point.x,y:s.point.y})),closed:path.closed};});p.remove();return result;
}
export function smoothNodes(nodes:Node[],closed=false):Node[]{
  scope.activate();const p=new scope.Path({segments:nodes.map(n=>new scope.Point(n.x,n.y)),closed,insert:false});p.smooth({type:'catmull-rom',factor:.5});
  const result=p.segments.map(s=>({...node(s.point.x,s.point.y),in:{x:s.handleIn.x,y:s.handleIn.y},out:{x:s.handleOut.x,y:s.handleOut.y}}));p.remove();return result;
}
export function insertNode(shape:Geometry,index:number):Geometry{
  const paths=editablePaths(shape);const g=paths[0];const p=paperPath(g),path=(p instanceof scope.CompoundPath?p.firstChild:p) as paper.Path;
  const curve=path.curves[Math.min(index,path.curves.length-1)];if(curve)curve.divideAtTime(.5);
  const result={...g,nodes:path.segments.map(s=>({x:s.point.x,y:s.point.y,in:{x:s.handleIn.x,y:s.handleIn.y},out:{x:s.handleOut.x,y:s.handleOut.y}}))};p.remove();return result;
}
export {scope};
