import ClipperLib from 'clipper-lib';
import type {Geometry,Region} from '../app/model';
import {geometry} from '../app/model';
import {IDENTITY,type Matrix} from '../geometry/matrix';
import {paperPath,pathToGeometry,flattened,scope} from '../geometry/paper';
import {pathData} from '../geometry/paths';
export function regionPath(region:Region):paper.CompoundPath{
 const d=region.geometry.map(g=>{const p=paperPath(g);const s=p.pathData;p.remove();return s;}).join(' ');
 return new scope.CompoundPath({pathData:d,fillRule:'evenodd',insert:false});
}
export function regionData(region:Region):string{const p=regionPath(region);const d=p.pathData;p.remove();return d;}
export function strokeRegion(shape:Geometry,matrix:Matrix=IDENTITY,tolerance=.02):Geometry{
 const paths=flattened(shape,tolerance,matrix),factor=100000;
 const offset=new ClipperLib.ClipperOffset(2,tolerance*factor),solution:ClipperLib.Paths=[];
 // SVG transforms scale strokes as well; use geometric mean for anisotropic affine transforms.
 const fullScale=Math.sqrt(Math.abs((matrix[0]*matrix[3]-matrix[1]*matrix[2])*(shape.transform[0]*shape.transform[3]-shape.transform[1]*shape.transform[2])));
 for(const path of paths)if(path.points.length>1)offset.AddPath(path.points.map(p=>({X:Math.round(p.x*factor),Y:Math.round(p.y*factor)})),ClipperLib.JoinType.jtRound,path.closed?ClipperLib.EndType.etClosedLine:ClipperLib.EndType.etOpenRound);
 offset.Execute(solution,shape.strokeWidth*fullScale/2*factor);
 const g=geometry('compound',[],true);g.fill=shape.stroke;g.stroke='none';g.pathData=solution.map(p=>p.map((v,i)=>`${i?'L':'M'}${v.X/factor} ${v.Y/factor}`).join('')+'Z').join('');return g;
}
export function clipGeometry(shape:Geometry,region:Region,transform:Matrix=IDENTITY,outlineStroke=false,tolerance=.02):Geometry[]{
 const mask=regionPath(region),out:Geometry[]=[];
 try{
  if(shape.closed&&shape.fill!=='none'){
   const source=paperPath(shape,transform);const result=source.intersect(mask,{insert:false});source.remove();
   if(result.pathData){const g=pathToGeometry(result,shape);g.stroke='none';out.push(g);}else result.remove();
  }
  if(shape.stroke!=='none'&&shape.strokeWidth>0){
   const stroked=outlineStroke?strokeRegion(shape,transform,tolerance):shape;
   const source=paperPath(stroked,outlineStroke?IDENTITY:transform);
   const result=source.intersect(mask,{insert:false,trace:outlineStroke});source.remove();
   if(result.pathData){const g=pathToGeometry(result,stroked);if(!outlineStroke){g.fill='none';g.closed=false;}out.push(g);}else result.remove();
  }
  return out;
 }finally{mask.remove();}
}
export function geometryBounds(shapes:Geometry[]):{x:number;y:number;width:number;height:number}{
 if(!shapes.length)return {x:-100,y:-100,width:200,height:200};
 const paths=shapes.map(g=>paperPath(g));let bounds=paths[0].bounds.clone();for(const p of paths.slice(1))bounds=bounds.unite(p.bounds);paths.forEach(p=>p.remove());return {x:bounds.x,y:bounds.y,width:Math.max(1,bounds.width),height:Math.max(1,bounds.height)};
}
export function hasClosedGeometry(shape:Geometry):boolean{
 if(!shape.closed)return false;
 const p=paperPath(shape);try{const paths=p instanceof scope.CompoundPath?p.children:[p];return paths.every(c=>(c as paper.Path).closed)&&Math.abs((p as paper.CompoundPath).area)>1e-8;}finally{p.remove();}
}
export {pathData};
