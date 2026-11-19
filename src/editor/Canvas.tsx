import {useState,useRef,useMemo,useEffect,useId,type PointerEvent as RPointerEvent} from 'react';
import {ZoomIn,ZoomOut,Maximize,Scan,Grid2X2,Hand,Eye,EyeOff} from 'lucide-react';
import type {Studio} from '../app/useStudio';
import {geometry,node,uid,type Geometry,type Node} from '../app/model';
import {IDENTITY,apply,inverse,multiply,translate,matrixString,sub,distance,type Matrix,type Point} from '../geometry/matrix';
import {pathData,simplifyPoints} from '../geometry/paths';
import {paperPath,scope,smoothNodes} from '../geometry/paper';
import {buildScene,type Scene} from '../patterns/engine';
import {latticeVectors,type Bounds} from '../symmetry/groups';
import {geometryBounds,regionData} from '../application/clipping';

interface Props {studio:Studio;editorOnly?:boolean;previewOnly?:boolean;}
interface Drag {type:'pan'|'move'|'node'|'draw'|'penhandle'|'marquee';start:Point;last?:Point;view?:Bounds;ids?:string[];transforms?:Map<string,Matrix>;matrix?:Matrix;id?:string;index?:number;handle?:'node'|'in'|'out';baseNode?:Node;shape?:Geometry;}
function safeScene(pattern:Studio['pattern'],bounds:Bounds):{scene:Scene|null;error:string}{try{return {scene:buildScene(pattern,bounds),error:''};}catch(e){return {scene:null,error:(e as Error).message};}}
export function Canvas({studio:s,editorOnly=false,previewOnly=false}:Props){
 const [view,setView]=useState<Bounds>({x:-110,y:-100,width:300,height:240}),[size,setSize]=useState({width:1000,height:800}),[cursor,setCursor]=useState<Point>({x:0,y:0}),[marquee,setMarquee]=useState<{start:Point;end:Point}|null>(null);
 const svgRef=useRef<SVGSVGElement>(null),container=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null),pathDraft=useRef<{id:string;anchors:Node[]}|null>(null),space=useRef(false),lastPointer=useRef<Point>({x:0,y:0});
 const prefix=useId().replace(/:/g,''),scalePx=size.width/view.width;
 const actualView=useMemo(()=>({...view,height:view.width*size.height/size.width}),[view,size]);
 useEffect(()=>{if(!container.current)return;const observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;setSize({width:Math.max(1,r.width),height:Math.max(1,r.height)});});observer.observe(container.current);return ()=>observer.disconnect();},[]);
 const {scene,error}=useMemo(()=>safeScene(s.pattern,actualView),[s.pattern,actualView]);
 const point=(event:{clientX:number;clientY:number}):Point=>{const svg=svgRef.current;if(!svg)return {x:0,y:0};const matrix=svg.getScreenCTM();if(!matrix)return {x:0,y:0};const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return {x:p.x,y:p.y};};
 const snap=(p:Point):Point=>{
  if(!s.project.preferences.snap)return p;
  const limit=8/scalePx;
  for(const g of s.objects)if(!s.selected.includes(g.id))for(const n of g.nodes){const q=apply(g.transform,n);if(distance(p,q)<limit)return q;}
  const grid=5;return {x:Math.round(p.x/grid)*grid,y:Math.round(p.y/grid)*grid};
 };
 const addShape=(g:Geometry)=>{
  if(s.mode==='apply'&&!s.region){const id=uid();s.change(p=>{p.regions.push({id,name:`Perímetro ${p.regions.length+1}`,geometry:[g]});},true);s.setRegionId(id);}
  else s.editObjects(objects=>objects.push(g),true);
 };
 const updateShape=(id:string,recipe:(g:Geometry)=>void)=>{
  // Resolve region by shape ID as the first pointer event may precede a React render.
  s.change(p=>{const objects=[...p.patterns.flatMap(p=>p.sourceGeometry),...p.regions.flatMap(r=>r.geometry)];const g=objects.find(g=>g.id===id);if(g)recipe(g);},true);
 };
 const finishPath=(closed=false)=>{
  const draft=pathDraft.current;if(!draft)return;
  if(draft.anchors.length>=2){updateShape(draft.id,g=>{g.nodes=structuredClone(draft.anchors);g.closed=closed||s.mode==='apply';});s.setSelected([draft.id]);s.commit();}
  else {s.change(p=>{for(const pat of p.patterns)pat.sourceGeometry=pat.sourceGeometry.filter(g=>g.id!==draft.id);for(const r of p.regions)r.geometry=r.geometry.filter(g=>g.id!==draft.id);p.regions=p.regions.filter(r=>r.geometry.length);},true);s.commit();}
  pathDraft.current=null;drag.current=null;
 };
 const cancelPath=()=>{
  const draft=pathDraft.current;if(!draft)return;
  s.change(p=>{for(const pat of p.patterns)pat.sourceGeometry=pat.sourceGeometry.filter(g=>g.id!==draft.id);for(const r of p.regions)r.geometry=r.geometry.filter(g=>g.id!==draft.id);p.regions=p.regions.filter(r=>r.geometry.length);},true);pathDraft.current=null;drag.current=null;s.commit();
 };
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&e.target.matches('input,textarea,select'))return;if(e.code==='Space'){space.current=true;e.preventDefault();}if(e.key==='Enter'){e.preventDefault();finishPath(e.shiftKey);}if(e.key==='Escape'){if(pathDraft.current)cancelPath();else{s.setSelected([]);s.setTool('select');}}};
  const up=(e:KeyboardEvent)=>{if(e.code==='Space')space.current=false;};window.addEventListener('keydown',down);window.addEventListener('keyup',up);return ()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);};
 });
 useEffect(()=>{if(pathDraft.current)finishPath(false);},[s.tool,s.mode,s.patternId]); // Finish an existing path when changing context.
 const selectInstance=(event:RPointerEvent,transform:Matrix)=>{
  if(previewOnly||!['select','nodes'].includes(s.tool)||space.current||event.button!==0)return;
  const p=apply(inverse(transform),point(event));let hit:Geometry|undefined;
  for(const g of [...s.objects].reverse()){
   if(!g.visible||g.locked)continue;const path=paperPath(g);
   try{const loc=path.getNearestPoint(new scope.Point(p.x,p.y));if((g.fill!=='none'&&path.contains(new scope.Point(p.x,p.y)))||loc&&distance(p,{x:loc.x,y:loc.y})<Math.max(7/scalePx,g.strokeWidth/2)){hit=g;break;}}finally{path.remove();}
  }
  if(!hit){if(scene?.generated.geometry.some(g=>g.id.startsWith('generated-')))s.setMessage('Esta curva es paramétrica. Ajustá el generador o usá «Convertir generador a paths» para editar nodos.');return;}
  event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
  let ids=s.selected.includes(hit.id)?s.selected:[hit.id];
  if(hit.groupId&&!event.altKey)ids=s.objects.filter(g=>g.groupId===hit!.groupId).map(g=>g.id);
  if(event.shiftKey)ids=s.selected.includes(hit.id)?s.selected.filter(id=>id!==hit!.id):[...s.selected,...ids];
  s.setSelected([...new Set(ids)]);s.setInstance(transform);
  drag.current={type:'move',start:apply(inverse(transform),point(event)),ids,transforms:new Map(s.objects.filter(g=>ids.includes(g.id)).map(g=>[g.id,g.transform])),matrix:transform};
 };
 const startNode=(event:RPointerEvent,id:string,index:number,handle:'node'|'in'|'out')=>{
  if(previewOnly)return;event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);const shape=s.objects.find(g=>g.id===id)!;
  const matrix=multiply(s.instance,shape.transform);drag.current={type:'node',start:point(event),matrix,id,index,handle,baseNode:structuredClone(shape.nodes[index])};
 };
 const pointerDown=(event:RPointerEvent<SVGSVGElement>)=>{
  if(event.button===2)return;
  const p=point(event);lastPointer.current=p;
  if(event.button===1||space.current||s.tool==='pan'){event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);drag.current={type:'pan',start:{x:event.clientX,y:event.clientY},view:{...view}};return;}
  if(previewOnly)return;
  const q=snap(p);event.currentTarget.setPointerCapture(event.pointerId);
  if(s.tool==='select'||s.tool==='nodes'){s.setSelected([]);s.setInstance(IDENTITY);drag.current={type:'marquee',start:p};return;}
  s.setInstance(IDENTITY);
  if(s.tool==='pen'||s.tool==='polygon'||s.tool==='region'){
   const current=pathDraft.current;
   if(current&&current.anchors.length>=3&&distance(q,current.anchors[0])<10/scalePx){finishPath(true);return;}
   if(!current){const g=geometry('path',[node(q.x,q.y)],false);g.name=s.mode==='apply'?'Perímetro':'Curva';if(s.mode==='apply')g.fill='#dce6d4';addShape(g);pathDraft.current={id:g.id,anchors:[node(q.x,q.y)]};}
   else {current.anchors.push(node(q.x,q.y));updateShape(current.id,g=>{g.nodes=structuredClone(current.anchors);});}
   const draft=pathDraft.current!;drag.current={type:'penhandle',id:draft.id,index:draft.anchors.length-1,start:q};return;
  }
  const kind=['rectangle','ellipse'].includes(s.tool)?s.tool as 'rectangle'|'ellipse':'path';
  const g=geometry(kind,[node(q.x,q.y),node(q.x,q.y)],kind!=='path'||s.mode==='apply');
  if(kind!=='path')g.parameters={x:q.x,y:q.y,width:.1,height:.1,radius:0,sides:5};
  if(s.mode==='apply')g.fill='#dce6d4';
  addShape(g);s.setSelected([g.id]);drag.current={type:'draw',start:q,id:g.id,shape:g};
 };
 const pointerMove=(event:RPointerEvent<SVGSVGElement>)=>{
  const p=point(event);setCursor(p);lastPointer.current=p;const d=drag.current;
  if(!d){if(pathDraft.current){const draft=pathDraft.current;const q=snap(p);updateShape(draft.id,g=>{g.nodes=[...structuredClone(draft.anchors),node(q.x,q.y)];});}return;}
  if(d.type==='pan'){const ratio=d.view!.width/size.width;setView({...d.view!,x:d.view!.x-(event.clientX-d.start.x)*ratio,y:d.view!.y-(event.clientY-d.start.y)*ratio});return;}
  if(d.type==='move'){
   const current=apply(inverse(d.matrix!),p),delta=sub(current,d.start);if(s.project.preferences.snap){delta.x=Math.round(delta.x);delta.y=Math.round(delta.y);}
   s.editObjects(objects=>{for(const g of objects)if(d.ids!.includes(g.id)){const m=d.transforms!.get(g.id)!;g.transform=multiply(translate(delta.x,delta.y),m);}},true);
  }
  if(d.type==='node'){
   const q=apply(inverse(d.matrix!),p);updateShape(d.id!,g=>{const n=g.nodes[d.index!];if(d.handle==='node'){const snapped=s.project.preferences.snap?{x:Math.round(q.x),y:Math.round(q.y)}:q;n.x=snapped.x;n.y=snapped.y;}else{n[d.handle!]=sub(q,n);if(!event.altKey){const other=d.handle==='in'?'out':'in';n[other]={x:-n[d.handle!].x,y:-n[d.handle!].y};}}});
  }
  if(d.type==='draw'){
   const q=s.tool==='pencil'?p:snap(p);updateShape(d.id!,g=>{
    if(g.parameters){g.parameters={...g.parameters,x:Math.min(d.start.x,q.x),y:Math.min(d.start.y,q.y),width:Math.max(.01,Math.abs(q.x-d.start.x)),height:Math.max(.01,Math.abs(q.y-d.start.y))};if(event.shiftKey)g.parameters.height=g.parameters.width;}
    else if(s.tool==='pencil'){if(distance(g.nodes.at(-1)!,q)>.6/scalePx)g.nodes.push(node(q.x,q.y));}
    else g.nodes=[node(d.start.x,d.start.y),node(q.x,q.y)];
   });
  }
  if(d.type==='penhandle'&&s.tool==='pen'){
   const q=snap(p),delta=sub(q,d.start),draft=pathDraft.current!;draft.anchors[d.index!].out=delta;draft.anchors[d.index!].in={x:-delta.x,y:-delta.y};updateShape(d.id!,g=>{g.nodes=structuredClone(draft.anchors);});
  }
  if(d.type==='marquee')setMarquee({start:d.start,end:p});
 };
 const pointerUp=(event:RPointerEvent<SVGSVGElement>)=>{
  const d=drag.current;if(!d)return;
  if(d.type==='draw'&&s.tool==='pencil')updateShape(d.id!,g=>{g.nodes=smoothNodes(simplifyPoints(g.nodes,.25).map(p=>node(p.x,p.y)),g.closed);});
  if(d.type==='marquee'&&marquee){const lo={x:Math.min(marquee.start.x,marquee.end.x),y:Math.min(marquee.start.y,marquee.end.y)},hi={x:Math.max(marquee.start.x,marquee.end.x),y:Math.max(marquee.start.y,marquee.end.y)};s.setSelected(s.objects.filter(g=>{if(g.locked)return false;const b=geometryBounds([g]);return b.x>=lo.x&&b.y>=lo.y&&b.x+b.width<=hi.x&&b.y+b.height<=hi.y;}).map(g=>g.id));setMarquee(null);}
  if(d.type!=='penhandle'&&d.type!=='pan'&&d.type!=='marquee')s.commit();
  drag.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 const zoom=(factor:number,center:Point={x:actualView.x+actualView.width/2,y:actualView.y+actualView.height/2})=>setView(v=>{const width=Math.max(10,Math.min(10000,v.width*factor)),f=width/v.width;return {...v,width,x:center.x+(v.x-center.x)*f,y:center.y+(v.y-center.y)*f};});
 useEffect(()=>{
  const svg=svgRef.current;if(!svg)return;const wheel=(e:WheelEvent)=>{e.preventDefault();if(e.ctrlKey||e.metaKey)zoom(Math.exp(e.deltaY*.002),point(e));else setView(v=>({...v,x:v.x+e.deltaX*v.width/size.width,y:v.y+e.deltaY*v.width/size.width}));};svg.addEventListener('wheel',wheel,{passive:false});return ()=>svg.removeEventListener('wheel',wheel);
 });
 const fit=()=>{let b:Bounds;if(s.mode==='apply'&&s.region)b=geometryBounds(s.region.geometry);else if(s.pattern.generator.kind==='penrose')b={x:-s.pattern.generator.radius,y:-s.pattern.generator.radius,width:s.pattern.generator.radius*2,height:s.pattern.generator.radius*2};else b=geometryBounds(s.objects);const width=Math.max(b.width+30,(b.height+30)*size.width/size.height);setView({x:b.x+b.width/2-width/2,y:b.y+b.height/2-width*size.height/size.width/2,width,height:width*size.height/size.width});};
 const renderShape=(g:Geometry)=> <path key={g.id} d={pathData(g)} transform={matrixString(g.transform)} fill={g.fill} stroke={g.stroke} strokeWidth={g.strokeWidth} strokeLinecap="round" strokeLinejoin="round" fillRule="evenodd"/>;
 const renderPattern=(sc:Scene,id:string,placement:Matrix=IDENTITY,interactive=true)=>{
  const count=sc.instances.length*sc.generated.placements.length;
  if(count>18000)return <text x={view.x+10} y={view.y+15} fontSize={4}>Demasiadas instancias. Aumentá la celda o acercá la vista.</text>;
  return <><defs><g id={id}>{sc.generated.geometry.map(renderShape)}</g></defs>{sc.instances.map(i=><g key={i.id}>{sc.generated.placements.map((m,k)=>{const matrix=multiply(placement,multiply(i.matrix,m));return <use key={k} href={`#${id}`} transform={matrixString(matrix)} onPointerDown={interactive?e=>selectInstance(e,matrix):undefined} className={interactive?'pattern-instance':''}/>;})}</g>)}</>;
 };
 const selectedShapes=s.objects.filter(g=>s.selected.includes(g.id)&&g.visible);
 const [a,b]=latticeVectors(s.pattern.symmetry);
 const applications=useMemo(()=>s.project.applications.map(app=>{
  const region=s.project.regions.find(r=>r.id===app.regionId),pat=app.linked?s.project.patterns.find(p=>p.id===app.patternId):app.frozenPattern;
  if(!region||!pat)return null;
  const inv=inverse(app.placementTransform),corners=[{x:actualView.x,y:actualView.y},{x:actualView.x+actualView.width,y:actualView.y},{x:actualView.x,y:actualView.y+actualView.height},{x:actualView.x+actualView.width,y:actualView.y+actualView.height}].map(p=>apply(inv,p));
  const bounds={x:Math.min(...corners.map(p=>p.x)),y:Math.min(...corners.map(p=>p.y)),width:Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height:Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y))};
  return {app,region,data:regionData(region),...safeScene(pat,bounds)};
 }),[s.project,actualView]);
 return <div className={`canvas-container ${editorOnly?'source-canvas':''} ${previewOnly?'preview-canvas':''}`} ref={container}>
  {s.project.preferences.split&&<div className="view-label">{editorOnly?'GEOMETRÍA FUENTE':'VISTA DEL PATRÓN'}<span>{editorOnly?'Editable':'Sincronizada'}</span></div>}
  <svg ref={svgRef} className={`studio-canvas tool-${s.tool}`} viewBox={`${actualView.x} ${actualView.y} ${actualView.width} ${actualView.height}`} style={{background:s.project.preferences.background}} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onDoubleClick={()=>{if(pathDraft.current){const d=pathDraft.current;if(d.anchors.length>2&&distance(d.anchors.at(-1)!,d.anchors.at(-2)!)<1)d.anchors.pop();finishPath(s.mode==='apply');}}} onContextMenu={e=>e.preventDefault()} aria-label={editorOnly?'Editor de geometría':'Lienzo de patrones'}>
   <defs><pattern id={`${prefix}-grid`} width={5} height={5} patternUnits="userSpaceOnUse"><circle cx={0} cy={0} r={.22} fill="#bdcbbd"/></pattern></defs>
   {s.project.preferences.grid&&<rect x={actualView.x} y={actualView.y} width={actualView.width} height={actualView.height} fill={`url(#${prefix}-grid)`} pointerEvents="none"/>}
   {s.mode!=='apply'&&scene&&(editorOnly?<g>{scene.generated.geometry.map(renderShape)}</g>:renderPattern(scene,`${prefix}-motif`))}
   {s.mode==='apply'&&applications.map((entry,i)=>entry&&entry.scene?<g key={entry.app.id}><defs><clipPath id={`${prefix}-region-${i}`}><path d={entry.data} clipRule="evenodd"/></clipPath></defs><g clipPath={`url(#${prefix}-region-${i})`}>{renderPattern(entry.scene,`${prefix}-app-${i}`,entry.app.placementTransform,false)}</g>{entry.app.showOutline&&<path d={entry.data} fill="none" stroke="#627d58" strokeWidth={.4} pointerEvents="none"/>}</g>:null)}
   {s.mode==='apply'&&s.project.regions.map(region=><g key={region.id} opacity={region.id===s.regionId?1:.4}>{region.geometry.filter(g=>g.visible).map(g=><path key={g.id} d={pathData(g)} transform={matrixString(g.transform)} fill="transparent" fillRule="evenodd" stroke={region.id===s.regionId?'#527744':'#a2ad9e'} strokeWidth={.5} strokeDasharray={region.id===s.regionId?undefined:'2 2'} onPointerDown={e=>{s.setRegionId(region.id);selectInstance(e,IDENTITY);}}/>)}</g>)}
   {s.project.preferences.guides&&!editorOnly&&s.mode!=='apply'&&s.pattern.symmetry.family==='wallpaper'&&s.pattern.generator.kind!=='penrose'&&<g pointerEvents="none"><path d={`M0 0L${a.x} ${a.y}L${a.x+b.x} ${a.y+b.y}L${b.x} ${b.y}Z`} fill="none" stroke="#79976b" strokeWidth={.35} strokeDasharray="2 1.5"/><circle cx={0} cy={0} r={.8} fill="#59764d"/><text x={a.x/2} y={a.y/2-2} fill="#648154" fontSize={2.8}>a</text><text x={b.x/2-3} y={b.y/2} fill="#648154" fontSize={2.8}>b</text></g>}
   {s.project.preferences.guides&&s.pattern.symmetry.family==='radial'&&<g pointerEvents="none" stroke="#79976b" strokeWidth={.3} strokeDasharray="2 2">{Array.from({length:s.pattern.symmetry.sectors},(_,i)=>{const t=i*2*Math.PI/s.pattern.symmetry.sectors,c=s.pattern.symmetry.center;return <line key={i} x1={c.x} y1={c.y} x2={c.x+Math.cos(t)*80} y2={c.y+Math.sin(t)*80}/>;})}</g>}
   {!previewOnly&&selectedShapes.map(shape=><g key={shape.id} transform={matrixString(multiply(s.instance,shape.transform))}>
    <path d={pathData(shape)} fill="none" stroke="#82a357" strokeWidth={1.4/scalePx} pointerEvents="none"/>
    {s.tool==='nodes'&&shape.kind==='path'?shape.nodes.map((n,i)=><g key={i}><g stroke="#86a367" strokeWidth={.8/scalePx}>{(['in','out'] as const).map(handle=><g key={handle}>{(n[handle].x!==0||n[handle].y!==0)&&<><line x1={n.x} y1={n.y} x2={n.x+n[handle].x} y2={n.y+n[handle].y}/><circle aria-label={`Tangente ${handle} ${i+1}`} cx={n.x+n[handle].x} cy={n.y+n[handle].y} r={3.5/scalePx} fill="#f9fcf5" onPointerDown={e=>startNode(e,shape.id,i,handle)}/></>}</g>)}</g><rect aria-label={`Nodo ${i+1}`} x={n.x-3.5/scalePx} y={n.y-3.5/scalePx} width={7/scalePx} height={7/scalePx} rx={1/scalePx} fill="#f9fcf5" stroke="#557f39" strokeWidth={1.2/scalePx} onPointerDown={e=>startNode(e,shape.id,i,'node')}/></g>):null}
   </g>)}
   {marquee&&<rect x={Math.min(marquee.start.x,marquee.end.x)} y={Math.min(marquee.start.y,marquee.end.y)} width={Math.abs(marquee.end.x-marquee.start.x)} height={Math.abs(marquee.end.y-marquee.start.y)} fill="#90ae6220" stroke="#6e8d50" strokeWidth={.4} pointerEvents="none"/>}
  </svg>
  {error&&<div className="canvas-warning">{error}</div>}
  {!s.objects.length&&s.pattern.generator.kind==='motif'&&s.mode!=='apply'&&<div className="empty-canvas"><span>Todo empieza con una línea.</span><small>Elegí una herramienta y dibujá. El patrón aparece mientras trazás.</small></div>}
  {s.mode==='apply'&&!s.project.regions.length&&<div className="empty-canvas"><span>Dale un lugar a tu patrón.</span><small>Dibujá un perímetro cerrado o importá un SVG.</small></div>}
  <div className="canvas-floats"><button title="Alejar" aria-label="Alejar" onClick={()=>zoom(1.25)}><ZoomOut size={17}/></button><span>{Math.round(scalePx/3.779527559*100)}%</span><button title="Acercar" aria-label="Acercar" onClick={()=>zoom(.8)}><ZoomIn size={17}/></button><i/><button title="Ajustar contenido" aria-label="Ajustar contenido" onClick={fit}><Maximize size={17}/></button><button title="Restablecer vista" aria-label="Restablecer vista" onClick={()=>setView({x:-110,y:-100,width:300,height:240})}><Scan size={17}/></button><i/><button title="Grilla" aria-label="Mostrar grilla" className={s.project.preferences.grid?'active':''} onClick={()=>s.change(p=>{p.preferences.grid=!p.preferences.grid;})}><Grid2X2 size={17}/></button><button title="Guías" aria-label="Mostrar guías" onClick={()=>s.change(p=>{p.preferences.guides=!p.preferences.guides;})}>{s.project.preferences.guides?<Eye size={17}/>:<EyeOff size={17}/>}</button></div>
  <div className="coordinate"><Hand size={12}/> Espacio + arrastrar · Ctrl + rueda para zoom <span>{cursor.x.toFixed(1)}, {cursor.y.toFixed(1)} mm</span></div>
 </div>;
}
