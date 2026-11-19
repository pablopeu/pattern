import type {Geometry} from '../app/model';
import {flattened} from '../geometry/paper';
export function exportDXF(shapes:Geometry[],tolerance=.05):string{
 const lines:(string|number)[]=[0,'SECTION',2,'HEADER',9,'$INSUNITS',70,4,0,'ENDSEC',0,'SECTION',2,'ENTITIES'];
 for(const shape of shapes)for(const path of flattened(shape,tolerance)){
  if(path.points.length<2)continue;
  lines.push(0,'LWPOLYLINE',100,'AcDbEntity',8,'0',100,'AcDbPolyline',90,path.points.length,70,path.closed?1:0);
  for(const p of path.points)lines.push(10,p.x,20,-p.y);
 }
 lines.push(0,'ENDSEC',0,'EOF');return lines.join('\n')+'\n';
}
