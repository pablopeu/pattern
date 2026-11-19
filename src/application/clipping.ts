import ClipperLib from 'clipper-lib';
import type {Geometry,Region} from '../app/model';
import {geometry} from '../app/model';
import {IDENTITY,multiply,type Matrix} from '../geometry/matrix';
import {paperPath,pathToGeometry,flattened,scope} from '../geometry/paper';
import {pathData} from '../geometry/paths';
export function regionPath(region:Region):paper.CompoundPath{
 const d=region.geometry.map(g=>{const p=paperPath(g);const s=p.pathData;p.remove();return s;}).join(' ');
 return new scope.CompoundPath({pathData:d,fillRule:'evenodd',insert:false});
}
export function regionData(region:Region):string{const p=regionPath(region);const d=p.pathData;p.remove();return d;}
export function strokeRegion(shape:Geometry,matrix:Matrix=IDENTITY,tolerance=.02):Geometry{
 const paths=flattened({...shape,transform:IDENTITY},tolerance),factor=100000;
 const offset=new ClipperLib.ClipperOffset(2,tolerance*factor),solution:ClipperLib.Paths=[];
 // Construct the stroke in the path's own coordinate system before the affine transform.
 // This preserves anisotropic scaling, including elliptical caps and joins.
 for(const path of paths)if(path.points.length>1)offset.AddPath(path.points.map(p=>({X:Math.round(p.x*factor),Y:Math.round(p.y*factor)})),ClipperLib.JoinType.jtRound,path.closed?ClipperLib.EndType.etClosedLine:ClipperLib.EndType.etOpenRound);
 offset.Execute(solution,shape.strokeWidth/2*factor);
 const g=geometry('compound',[],true);g.fill=shape.stroke;g.stroke='none';g.opacity=shape.opacity;g.fillOpacity=shape.strokeOpacity;g.pathData=solution.map(p=>p.map((v,i)=>`${i?'L':'M'}${v.X/factor} ${v.Y/factor}`).join('')+'Z').join('');
 const source=paperPath(g,multiply(matrix,shape.transform));const result=pathToGeometry(source,g);return result;
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
   if(result.pathData){const g=pathToGeometry(result,stroked);if(!outlineStroke){g.fill='none';g.closed=false;const full=multiply(transform,shape.transform);g.strokeWidth=shape.strokeWidth*Math.sqrt(Math.abs(full[0]*full[3]-full[1]*full[2]));}out.push(g);}else result.remove();
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
