import type { Geometry, Node } from '../app/model';
import { apply, distance, type Matrix, type Point } from './matrix';
export function pathData(shape:Geometry):string {
  if(shape.kind==='compound' && shape.pathData) return shape.pathData;
  const p=shape.parameters;
  if(p && shape.kind==='rectangle') {
    const {x,y,width:w,height:h}=p, r=Math.min(Math.abs(w)/2,Math.abs(h)/2,p.radius);
    if(!r) return `M${x} ${y}h${w}v${h}h${-w}Z`;
    return `M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`;
  }
  if(p && shape.kind==='ellipse')return `M${p.x+p.width} ${p.y+p.height/2}a${p.width/2} ${p.height/2} 0 1 0 ${-p.width} 0a${p.width/2} ${p.height/2} 0 1 0 ${p.width} 0Z`;
  if(p && shape.kind==='polygon'){
    const points=Array.from({length:p.sides},(_,i)=>({x:p.x+p.width/2+Math.cos(i*2*Math.PI/p.sides-Math.PI/2)*p.width/2,y:p.y+p.height/2+Math.sin(i*2*Math.PI/p.sides-Math.PI/2)*p.height/2}));
    return points.map((n,i)=>`${i?'L':'M'}${n.x} ${n.y}`).join('')+'Z';
  }
  if(!shape.nodes.length)return '';
  const nodes=shape.nodes; let d=`M${nodes[0].x} ${nodes[0].y}`;
  for(let i=1;i<nodes.length+(shape.closed?1:0);i++){
    const a=nodes[(i-1)%nodes.length],b=nodes[i%nodes.length];
    if(a.out.x||a.out.y||b.in.x||b.in.y)d+=`C${a.x+a.out.x} ${a.y+a.out.y} ${b.x+b.in.x} ${b.y+b.in.y} ${b.x} ${b.y}`;
    else d+=`L${b.x} ${b.y}`;
  }
  return d+(shape.closed?'Z':'');
}
export function transformedNodes(nodes:Node[],m:Matrix):Node[]{return nodes.map(n=>{const p=apply(m,n),hi=apply(m,{x:n.x+n.in.x,y:n.y+n.in.y}),ho=apply(m,{x:n.x+n.out.x,y:n.y+n.out.y});return {...p,in:{x:hi.x-p.x,y:hi.y-p.y},out:{x:ho.x-p.x,y:ho.y-p.y}};});}
export function cubic(a:Point,b:Point,c:Point,d:Point,t:number):Point{const s=1-t;return {x:s*s*s*a.x+3*s*s*t*b.x+3*s*t*t*c.x+t*t*t*d.x,y:s*s*s*a.y+3*s*s*t*b.y+3*s*t*t*c.y+t*t*t*d.y};}
export function simplifyPoints(points:Point[],tolerance:number):Point[]{
  if(points.length<3)return points;
  const start=points[0],end=points[points.length-1],dx=end.x-start.x,dy=end.y-start.y;
  let max=0,index=0;
  for(let i=1;i<points.length-1;i++){const t=Math.max(0,Math.min(1,((points[i].x-start.x)*dx+(points[i].y-start.y)*dy)/(dx*dx+dy*dy||1)));const d=distance(points[i],{x:start.x+t*dx,y:start.y+t*dy});if(d>max){max=d;index=i;}}
  return max>tolerance?[...simplifyPoints(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyPoints(points.slice(index),tolerance)]:[start,end];
}
