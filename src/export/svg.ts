import {geometry,type Application,type Geometry,type Pattern,type Project,type Region} from '../app/model';
import {IDENTITY,matrixString,multiply,inverse,type Matrix} from '../geometry/matrix';
import {pathData} from '../geometry/paths';
import {buildScene,expandedTransforms} from '../patterns/engine';
import {geometryBounds,clipGeometry,regionData} from '../application/clipping';
import {rectangularCell,latticeVectors,fundamentalDomain,type Bounds} from '../symmetry/groups';
export interface ExportOptions {target:'view'|'tile'|'lattice'|'fundamental'|'application';format:'svg'|'png'|'jpeg'|'dxf';representation:'editable'|'expanded';width:number;height:number;dpi:number;background:string;transparent:boolean;quality:number;tolerance:number;outlineStrokes:boolean;patternId:string;applicationId?:string;}
export interface ExportResult {svg:string;geometries:Geometry[];bounds:Bounds;warnings:string[];}
export const escapeXML=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function svgPath(shape:Geometry):string{return `<path d="${escapeXML(pathData(shape))}" transform="${matrixString(shape.transform)}" fill="${escapeXML(shape.fill)}" stroke="${escapeXML(shape.stroke)}" stroke-width="${shape.strokeWidth}" opacity="${shape.opacity}" fill-opacity="${shape.fillOpacity}" stroke-opacity="${shape.strokeOpacity}" stroke-linecap="${shape.strokeCap}" stroke-linejoin="${shape.strokeJoin}" stroke-miterlimit="${shape.miterLimit}" fill-rule="${shape.fillRule}"/>`;}
export function svgDocument(content:string,bounds:Bounds,background?:string):string{
 return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${bounds.width}mm" height="${bounds.height}mm" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}"><title>Pattern Studio 2D</title>${background?`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${escapeXML(background)}"/>`:''}${content}</svg>`;
}
export function prepareExport(project:Project,options:ExportOptions,onProgress?:(n:number)=>void):ExportResult{
 let pattern:Pattern|undefined=project.patterns.find(p=>p.id===options.patternId),region:Region|undefined,application:Application|undefined;
 let placement:Matrix=IDENTITY;
 if(options.target==='application'){
  const appId=options.applicationId;application=project.applications.find(a=>a.id===appId);if(!application)throw Error('Seleccioná una aplicación existente.');
  const selected=application;region=project.regions.find(r=>r.id===selected.regionId);pattern=selected.linked?project.patterns.find(p=>p.id===selected.patternId):selected.frozenPattern;
  placement=application.placementTransform;
 }
 if(!pattern)throw Error('No se encontró el patrón.');
 let bounds:Bounds={x:-options.width/2,y:-options.height/2,width:options.width,height:options.height};let latticeMask='';
 if(region)bounds=geometryBounds(region.geometry);
 if(options.target==='tile'){
  const cell=rectangularCell(pattern.symmetry);if(!cell||pattern.generator.kind==='penrose')throw Error('Este patrón no tiene una celda rectangular seamless. Elegí celda de red o región finita.');
  bounds={x:0,y:0,...cell};
 }
 if(options.target==='lattice'){
  if(pattern.symmetry.family!=='wallpaper'||pattern.generator.kind==='penrose')throw Error('Este patrón no tiene una celda de traslación bidimensional.');
  const [a,b]=latticeVectors(pattern.symmetry);const xs=[0,a.x,b.x,a.x+b.x],ys=[0,a.y,b.y,a.y+b.y];
  bounds={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  latticeMask=`M0 0L${a.x} ${a.y}L${a.x+b.x} ${a.y+b.y}L${b.x} ${b.y}Z`;
 }
 if(options.target==='fundamental'){
  if(pattern.symmetry.family!=='wallpaper'||pattern.generator.kind==='penrose')throw Error('Esta composición no tiene una región fundamental periódica.');
  const points=fundamentalDomain(pattern.symmetry),xs=points.map(p=>p.x),ys=points.map(p=>p.y);bounds={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  latticeMask=points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join('')+'Z';
 }
 // Transform all viewport corners, not just the diagonal, for rotated applications.
 const inv=inverse(placement),corners=[{x:bounds.x,y:bounds.y},{x:bounds.x+bounds.width,y:bounds.y},{x:bounds.x,y:bounds.y+bounds.height},{x:bounds.x+bounds.width,y:bounds.y+bounds.height}].map(p=>({x:inv[0]*p.x+inv[2]*p.y+inv[4],y:inv[1]*p.x+inv[3]*p.y+inv[5]}));
 const visible={x:Math.min(...corners.map(p=>p.x)),y:Math.min(...corners.map(p=>p.y)),width:Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height:Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y))};
 const scene=buildScene(pattern,visible),transforms=expandedTransforms(scene),geometries:Geometry[]=[];
 const cropShape=geometry('compound',[],true);cropShape.pathData=latticeMask||`M${bounds.x} ${bounds.y}h${bounds.width}v${bounds.height}h${-bounds.width}Z`;const cropRegion:Region=region??{id:'export-crop',name:'Límite de exportación',geometry:[cropShape]};
 const expanded=options.representation==='expanded'||options.format==='dxf';
 const total=transforms.length*scene.generated.geometry.length;
 if(total>150000)throw Error('La exportación excede 150.000 trazados. Aumentá la celda o reducí la región.');
 const warnings:string[]=[];
 if(scene.status!=='PERIODIC_SEAMLESS')warnings.push(scene.message);if(pattern.symmetry.family==='frieze')warnings.push('Friso: sólo repite en una dirección. Esta exportación es una región finita, no una baldosa bidimensional.');if(options.target==='fundamental')warnings.push('Región fundamental: requiere las operaciones del grupo para reconstruir el patrón; no es una baldosa rectangular de traslación.');
 if(expanded){let count=0;for(const t of transforms)for(const shape of scene.generated.geometry){const m=multiply(placement,t);geometries.push(...clipGeometry(shape,cropRegion,m,options.outlineStrokes,options.tolerance));if(++count%100===0)onProgress?.(count/total);}}
 const mask=region?regionData(region):latticeMask;
 const defs=`<defs><g id="motif">${scene.generated.geometry.map(svgPath).join('')}</g>${mask?`<clipPath id="region"><path d="${escapeXML(mask)}" clip-rule="evenodd"/></clipPath>`:''}</defs>`;
 let content=expanded?geometries.map(svgPath).join(''):transforms.map(t=>`<use href="#motif" xlink:href="#motif" transform="${matrixString(multiply(placement,t))}"/>`).join('');
 // Expanded applications contain real intersections and no masks/definitions.
 if(options.target==='tile'&&!expanded){content=`${defs}<defs><pattern id="tile" patternUnits="userSpaceOnUse" width="${bounds.width}" height="${bounds.height}">${content}</pattern></defs><rect width="${bounds.width}" height="${bounds.height}" fill="url(#tile)"/>`;}else if(mask&&!expanded)content=`${defs}<g clip-path="url(#region)">${content}</g>`;else if(!expanded&&options.target!=='tile')content=defs+content;
 if(region&&application?.showOutline){const outlines=region.geometry.map(g=>({...g,fill:'none'}));content+=outlines.map(svgPath).join('');if(expanded)geometries.push(...outlines);}
 const metadata={units:'mm',symmetry:pattern.symmetry,status:scene.status,algorithmVersion:pattern.generator.version};content=`<metadata>${escapeXML(JSON.stringify(metadata))}</metadata>`+content;
 return {svg:svgDocument(content,bounds,options.transparent?undefined:options.background),geometries,bounds,warnings};
}
