import type { Symmetry } from '../app/model';
import { IDENTITY, apply, inverse, multiply, rotate, scale, translate, type Matrix, type Point } from '../geometry/matrix';
export const wallpaperNames=['p1','p2','pm','pg','cm','pmm','pmg','pgg','cmm','p4','p4m','p4g','p3','p3m1','p31m','p6','p6m'] as const;
export const friezeNames=['p1','p11g','p1m1','p11m','p2','p2mg','p2mm'] as const;
export const groupDescriptions:Record<string,string>={p1:'Traslaciones en dos direcciones',p2:'Giros de 180°',pm:'Reflexiones paralelas',pg:'Reflexiones con deslizamiento',cm:'Reflexiones · red centrada',pmm:'Dos ejes de reflexión perpendiculares',pmg:'Reflexiones y deslizamientos',pgg:'Deslizamientos en ambos ejes',cmm:'Reflexiones · red rómbica',p4:'Giros de 90° · red cuadrada',p4m:'Giros de 90° y espejos',p4g:'Giros de 90° y deslizamientos',p3:'Giros de 120° · red triangular',p3m1:'Giros de 120° · espejos sobre centros',p31m:'Giros de 120° · centros fuera de espejos',p6:'Giros de 60° · red triangular',p6m:'Giros de 60° y espejos',p11g:'Deslizamiento a lo largo del friso',p1m1:'Espejos perpendiculares al friso',p11m:'Espejo paralelo al friso',p2mg:'Espejos y deslizamientos en friso',p2mm:'Espejos perpendiculares y giros de 180°',Cn:'Rotaciones alrededor de un centro',Dn:'Rotaciones y reflexiones radiales'};
const R2:Matrix=[-1,0,0,-1,0,0], MX:Matrix=[1,0,0,-1,0,0], MY:Matrix=[-1,0,0,1,0,0];
const R4:Matrix=[0,1,-1,0,0,0],R6:Matrix=[0,1,-1,1,0,0],R3=multiply(R6,R6);
const mod=(n:number)=>{const v=((n%1)+1)%1;return Math.abs(v-1)<1e-7||Math.abs(v)<1e-7?0:v;};
export const canonical=(m:Matrix):Matrix=>[...m.slice(0,4).map(v=>Math.round(v*1e9)/1e9),mod(m[4]),mod(m[5])] as unknown as Matrix;
export const key=(m:Matrix)=>canonical(m).map(x=>x.toFixed(7)).join(',');
export function closure(generators:Matrix[]):Matrix[]{
  const found=new Map<string,Matrix>([[key(IDENTITY),IDENTITY]]),queue:Matrix[]=[IDENTITY];
  while(queue.length){const a=queue.shift()!;for(const g of generators){const m=canonical(multiply(a,g)),k=key(m);if(!found.has(k)){if(found.size>48)throw Error('Generadores incompatibles con la red');found.set(k,m);queue.push(m);}}}
  return [...found.values()];
}
export function fractionalGenerators(group:string):Matrix[]{
  switch(group){
    case 'p1':return [];
    case 'p2':return [R2];
    case 'pm':return [MX];
    case 'pg':return [[1,0,0,-1,.5,0]];
    case 'cm':return [[0,1,1,0,0,0]];
    case 'pmm':return [MX,MY];
    case 'pmg':return [MX,[-1,0,0,1,.5,.5]];
    case 'pgg':return [[1,0,0,-1,.5,0],[-1,0,0,1,0,.5]];
    case 'cmm':return [[0,1,1,0,0,0],R2];
    case 'p4':return [R4];
    case 'p4m':return [R4,MX];
    case 'p4g':return [R4,[1,0,0,-1,.5,.5]];
    case 'p3':return [R3];
    case 'p3m1':return [R3,[0,1,1,0,0,0]];
    case 'p31m':return [R3,[1,0,1,-1,0,0]];
    case 'p6':return [R6];
    case 'p6m':return [R6,[0,1,1,0,0,0]];
    default:throw Error(`Grupo desconocido: ${group}`);
  }
}
export function lattice(s:Symmetry):Matrix{
  const w=Math.max(1,s.width),h=Math.max(1,s.height);
  if(/^p[36]/.test(s.group))return [w,0,w/2,w*Math.sqrt(3)/2,0,0];
  if(/^p4/.test(s.group))return [w,0,0,w,0,0];
  if(s.group==='cm'||s.group==='cmm')return [w/2,h/2,-w/2,h/2,0,0];
  if(s.group==='p1'||s.group==='p2'){const a=s.angle*Math.PI/180;return [w,0,h*Math.cos(a),h*Math.sin(a),0,0];}
  return [w,0,0,h,0,0];
}
export function cosets(s:Symmetry):Matrix[]{
  if(s.family==='radial'){
    const center=s.center;return Array.from({length:s.sectors},(_,i)=>rotate(i*360/s.sectors,center)).flatMap(r=>s.group==='Dn'?[r,multiply(r,multiply(translate(center.x,center.y),multiply(scale(1,-1),translate(-center.x,-center.y))))]:[r]);
  }
  if(s.family==='frieze'){
    const w=s.width;
    switch(s.group){case 'p1':return [IDENTITY];case 'p11g':return [IDENTITY,[1,0,0,-1,w/2,0]];case 'p1m1':return [IDENTITY,MY];case 'p11m':return [IDENTITY,MX];case 'p2':return [IDENTITY,R2];case 'p2mg':return [IDENTITY,MY,[1,0,0,-1,w/2,0],[-1,0,0,-1,w/2,0]];case 'p2mm':return [IDENTITY,MY,MX,R2];default:throw Error('Friso desconocido');}
  }
  const b=lattice(s),inv=inverse(b);return closure(fractionalGenerators(s.group)).map(g=>multiply(b,multiply(g,inv)));
}
export interface Bounds {x:number;y:number;width:number;height:number}
export interface Instance {id:string;matrix:Matrix;cell:[number,number]}
export function instances(s:Symmetry,bounds:Bounds,margin=1):Instance[]{
  const group=cosets(s);
  if(s.family==='radial')return group.map((matrix,i)=>({id:`radial-${i}`,matrix,cell:[0,0]}));
  const b=s.family==='frieze'?[s.width,0,0,s.height,0,0] as Matrix:lattice(s),inv=inverse(b);
  const corners=[{x:bounds.x,y:bounds.y},{x:bounds.x+bounds.width,y:bounds.y},{x:bounds.x,y:bounds.y+bounds.height},{x:bounds.x+bounds.width,y:bounds.y+bounds.height}].map(p=>apply(inv,p));
  const minX=Math.floor(Math.min(...corners.map(p=>p.x)))-margin,maxX=Math.ceil(Math.max(...corners.map(p=>p.x)))+margin;
  const minY=s.family==='frieze'?0:Math.floor(Math.min(...corners.map(p=>p.y)))-margin,maxY=s.family==='frieze'?0:Math.ceil(Math.max(...corners.map(p=>p.y)))+margin;
  if((maxX-minX+1)*(maxY-minY+1)*group.length>20000)throw Error('Demasiadas instancias. Aumentá la celda o acercá la vista.');
  const out:Instance[]=[];
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const p=apply(b,{x,y});group.forEach((g,k)=>out.push({id:`${x}:${y}:${k}`,matrix:multiply(translate(p.x,p.y),g),cell:[x,y]}));}
  return out;
}
export type Periodicity='PERIODIC_SEAMLESS'|'FINITE_NONPERIODIC'|'UNVERIFIED';
export function rectangularCell(s:Symmetry):{width:number;height:number}|null{
  if(s.family!=='wallpaper')return null;
  if(/^p[36]/.test(s.group))return {width:s.width,height:s.width*Math.sqrt(3)};
  if(s.group==='cm'||s.group==='cmm')return {width:s.width,height:s.height};
  if((s.group==='p1'||s.group==='p2')&&Math.abs(s.angle-90)>1e-6)return null;
  return {width:s.width,height:/^p4/.test(s.group)?s.width:s.height};
}
export function latticeVectors(s:Symmetry):[Point,Point]{const b=lattice(s);return [{x:b[0],y:b[1]},{x:b[2],y:b[3]}];}
