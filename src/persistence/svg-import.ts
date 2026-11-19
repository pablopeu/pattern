import {geometry,node,type Geometry} from '../app/model';
import {scope} from '../geometry/paper';
import {scale} from '../geometry/matrix';
export interface ImportedSVG {geometry:Geometry[];warnings:string[];widthMM:number;}
const allowed=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','use','title','desc']);
const allowedAttributes=new Set(['id','x','y','x1','y1','x2','y2','width','height','viewBox','preserveAspectRatio','d','points','cx','cy','rx','ry','r','transform','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-rule','opacity','fill-opacity','stroke-opacity','href','xlink:href','xmlns','xmlns:xlink']);
function physicalLength(value:string|null):number|null{if(!value)return null;const match=value.match(/^\s*([\d.]+)\s*(mm|cm|in|pt|pc)\s*$/);if(!match)return null;return Number(match[1])*({mm:1,cm:10,in:25.4,pt:25.4/72,pc:25.4/6}[match[2]]??1);}
export function sanitizeSVG(text:string):{root:SVGSVGElement;warnings:string[]}{
 if(text.length>8_000_000)throw Error('El SVG supera 8 MB. Simplificá la geometría.');
 const doc=new DOMParser().parseFromString(text,'image/svg+xml');
 if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw Error('El archivo no es un SVG válido.');
 const warnings:string[]=[];
 for(const element of [...doc.querySelectorAll('*')]){
  if(!allowed.has(element.localName)){warnings.push(`Elemento no compatible eliminado: ${element.localName}`);element.remove();continue;}
  for(const attr of [...element.attributes]){
   if(attr.name==='style'){
    for(const declaration of attr.value.split(';')){const [key,...rest]=declaration.split(':');const value=rest.join(':').trim();if(allowedAttributes.has(key.trim())&&!/url\(|javascript:|data:/i.test(value))element.setAttribute(key.trim(),value);}
    element.removeAttribute('style');continue;
   }
   if(!allowedAttributes.has(attr.name)||/url\(|javascript:|data:|https?:|\/\//i.test(attr.value)&&!attr.name.startsWith('xmlns')||(['href','xlink:href'].includes(attr.name)&&!/^#[\w.-]+$/.test(attr.value))){warnings.push(`Atributo no permitido eliminado: ${attr.name}`);element.removeAttribute(attr.name);}
  }
 }
 const ids=new Set([...doc.querySelectorAll('[id]')].map(e=>e.id));
 for(const use of [...doc.querySelectorAll('use')]){const ref=(use.getAttribute('href')||use.getAttribute('xlink:href')||'').slice(1);if(!ids.has(ref)||doc.getElementById(ref)?.localName==='use'){use.remove();warnings.push('Referencia SVG inválida o recursiva eliminada.');}}
 return {root:doc.documentElement as unknown as SVGSVGElement,warnings:[...new Set(warnings)]};
}
export function importSVG(text:string,explicitWidthMM:number):ImportedSVG{
 const {root,warnings}=sanitizeSVG(text),physicalWidth=physicalLength(root.getAttribute('width'));
 const view=(root.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
 const width=physicalWidth??explicitWidthMM;
 if(!physicalWidth)warnings.push(`Escala definida por el usuario: ${explicitWidthMM} mm de ancho.`);
 if(!Number.isFinite(width)||width<=0)throw Error('Definí un ancho físico válido para importar.');
 const rawWidth=Number.parseFloat(root.getAttribute('width')||'100'),rawHeight=Number.parseFloat(root.getAttribute('height')||'100');
 const vb=view.length===4&&view.every(Number.isFinite)&&view[2]>0&&view[3]>0?view:[0,0,rawWidth,rawHeight];
 root.setAttribute('width',String(vb[2]));root.setAttribute('height',String(vb[3]));
 scope.activate();let item:paper.Item;
 try{item=scope.project.importSVG(root,{insert:false,expandShapes:true,applyMatrix:true}) as paper.Item;}catch{throw Error('El SVG contiene geometría no compatible.');}
 const out:Geometry[]=[];
 const visit=(entry:paper.Item)=>{
  if(entry instanceof scope.Path || entry instanceof scope.CompoundPath){
   entry.applyMatrix=true;const path=entry as paper.PathItem;
   const g=geometry(entry instanceof scope.CompoundPath?'compound':'path',[],false);
   const global=entry.globalMatrix;const copy=path.clone({insert:false});copy.matrix=global;copy.applyMatrix=true;
   const factor=width/vb[2];copy.scale(factor,new scope.Point(0,0));
   if(copy instanceof scope.Path){g.nodes=copy.segments.map(s=>({...node(s.point.x,s.point.y),in:{x:s.handleIn.x,y:s.handleIn.y},out:{x:s.handleOut.x,y:s.handleOut.y}}));g.closed=copy.closed;}
   else {g.pathData=copy.pathData;g.closed=copy.children.every(p=>(p as paper.Path).closed);}
   g.stroke=path.strokeColor?.toCSS(true)??'none';g.fill=path.fillColor?.toCSS(true)??'none';g.strokeWidth=(path.strokeWidth||1)*factor;
   if(!g.stroke.startsWith('#')&&g.stroke!=='none')g.stroke='#233b2d';if(!g.fill.startsWith('#')&&g.fill!=='none')g.fill='#233b2d';
   g.transform=scale(1);g.name=entry.name||'SVG importado';copy.remove();out.push(g);
  }else entry.children?.forEach(visit);
 };
 try{visit(item);}finally{item.remove();}
 if(!out.length)throw Error('No hay paths o formas vectoriales compatibles en el SVG.');return {geometry:out,warnings,widthMM:width};
}
