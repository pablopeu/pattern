import {useEffect,useRef,useState,useCallback} from 'react';
import {hasClosedGeometry} from '../application/clipping';
import {History} from '../editor/history';
import {autosave,recover} from '../persistence/storage';
import {example} from './examples';
import {uid,type Project,type Geometry} from './model';
import {IDENTITY,type Matrix} from '../geometry/matrix';
export type Mode='edit'|'pattern'|'apply';
export type Tool='select'|'nodes'|'pen'|'pencil'|'line'|'rectangle'|'ellipse'|'polygon'|'region'|'pan';
export function useStudio(){
 const [project,setProject]=useState<Project>(()=>example(0)),ref=useRef(project),history=useRef(new History(project)),hydrated=useRef(false),gesture=useRef(false);
 const [loaded,setLoaded]=useState(false),[saved,setSaved]=useState('Recuperando…'),[message,setMessage]=useState(''),[mode,setMode]=useState<Mode>('edit'),[tool,setTool]=useState<Tool>('select');
 const [nodeIndex,setNodeIndex]=useState(0);
 const [selected,setSelected]=useState<string[]>([]),[instance,setInstance]=useState<Matrix>(IDENTITY),[patternId,setPatternId]=useState(project.patterns[0].id),[regionId,setRegionId]=useState(''),[applicationId,setApplicationId]=useState('');
 const [revision,setRevision]=useState(0),[fileSaved,setFileSaved]=useState(false);
 const replace=useCallback((p:Project)=>{ref.current=p;setProject(p);},[]);
 const change=useCallback((recipe:(p:Project)=>void,transient=false)=>{const next=structuredClone(ref.current);recipe(next);next.metadata.updatedAt=new Date().toISOString();replace(next);setFileSaved(false);if(!transient&&!gesture.current){history.current.commit(next);setRevision(n=>n+1);}},[replace]);
 const commit=useCallback(()=>{history.current.commit(ref.current);setRevision(n=>n+1);},[]);
 const load=useCallback((p:Project)=>{if(hydrated.current)void autosave(ref.current).catch(()=>{});history.current.reset(p);replace(p);setPatternId(p.patterns[0].id);setRegionId(p.regions[0]?.id??'');setApplicationId(p.applications[0]?.id??'');setSelected([]);setInstance(IDENTITY);setRevision(n=>n+1);setFileSaved(true);},[replace]);
 useEffect(()=>{let live=true;recover().then(p=>{if(live&&p)load(p);}).catch(e=>{if(live)setMessage(`No se pudo recuperar el autosave: ${e.message}`);}).finally(()=>{if(live){hydrated.current=true;setLoaded(true);}});return ()=>{live=false;};},[load]);
 useEffect(()=>{if(!loaded)return;if(project.regions.some(r=>r.geometry.some(g=>!hasClosedGeometry(g)))){setSaved('Trazo en curso');return;}setSaved('Guardando…');const timer=setTimeout(()=>{autosave(project).then(()=>setSaved('Guardado local')).catch(e=>{setSaved('Error de guardado');setMessage(`El almacenamiento local falló: ${e.message}. Guardá un archivo JSON.`);});},600);return ()=>clearTimeout(timer);},[project,loaded]);
 useEffect(()=>{const start=(e:PointerEvent)=>{if(e.target instanceof HTMLInputElement&&e.target.type==='range')gesture.current=true;};const end=()=>{if(gesture.current){gesture.current=false;commit();}};document.addEventListener('pointerdown',start,true);document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);return ()=>{document.removeEventListener('pointerdown',start,true);document.removeEventListener('pointerup',end,true);document.removeEventListener('pointercancel',end,true);};},[commit]);
 const undo=useCallback(()=>{replace(history.current.undo());setSelected([]);setRevision(n=>n+1);setFileSaved(false);},[replace]);
 const redo=useCallback(()=>{replace(history.current.redo());setSelected([]);setRevision(n=>n+1);setFileSaved(false);},[replace]);
 const pattern=project.patterns.find(p=>p.id===patternId)??project.patterns[0];
 const region=project.regions.find(r=>r.id===regionId);
 const application=project.applications.find(a=>a.id===applicationId);
 const objects=mode==='apply'&&region?region.geometry:pattern.sourceGeometry;
 const editObjects=useCallback((recipe:(shapes:Geometry[])=>void,transient=false)=>change(p=>{const r=p.regions.find(r=>r.id===regionId);const pat=p.patterns.find(x=>x.id===patternId)??p.patterns[0];recipe(mode==='apply'&&r?r.geometry:pat.sourceGeometry);},transient),[change,regionId,patternId,mode]);
 const deleteSelected=useCallback(()=>{
  if(mode==='apply'&&region&&region.geometry.every(s=>selected.includes(s.id))){change(p=>{p.regions=p.regions.filter(r=>r.id!==regionId);p.applications=p.applications.filter(a=>a.regionId!==regionId);});setRegionId('');}
  else editObjects(shapes=>{for(let i=shapes.length-1;i>=0;i--)if(selected.includes(shapes[i].id))shapes.splice(i,1);});setSelected([]);
 },[change,editObjects,selected,mode,region,regionId]);
 const duplicate=useCallback(()=>{const ids:string[]=[],groups=new Map<string,string>();editObjects(shapes=>{for(const shape of shapes.filter(s=>selected.includes(s.id))){const g=structuredClone(shape);g.id=uid();if(g.groupId){if(!groups.has(g.groupId))groups.set(g.groupId,uid());g.groupId=groups.get(g.groupId);}g.name+=' copia';g.transform=[...g.transform.slice(0,4),g.transform[4]+5,g.transform[5]+5] as unknown as Matrix;shapes.push(g);ids.push(g.id);}});setSelected(ids);},[selected,editObjects]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.target instanceof HTMLElement&&(e.target.matches('input,textarea,select')||e.target.isContentEditable))return;
   const mod=e.ctrlKey||e.metaKey;
   if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}
   else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
   else if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();}
   else if(mod&&e.key.toLowerCase()==='a'){e.preventDefault();setSelected(objects.filter(s=>!s.locked).map(s=>s.id));}
   else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();}
   else if(!mod){const shortcuts:Record<string,Tool>={v:'select',a:'nodes',p:'pen',b:'pencil',l:'line',r:'rectangle',e:'ellipse',h:'pan'};if(shortcuts[e.key.toLowerCase()])setTool(shortcuts[e.key.toLowerCase()]);}
  };window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);
 },[undo,redo,duplicate,deleteSelected,objects]);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),12000);return ()=>clearTimeout(timer);},[message]);
 return {nodeIndex,setNodeIndex,project,projectRef:ref,change,commit,load,loaded,saved,message,setMessage,mode,setMode,tool,setTool,selected,setSelected,instance,setInstance,patternId,setPatternId,regionId,setRegionId,applicationId,setApplicationId,pattern,region,application,objects,editObjects,undo,redo,deleteSelected,duplicate,canUndo:history.current.canUndo,canRedo:history.current.canRedo,revision,fileSaved,setFileSaved};
}
export type Studio=ReturnType<typeof useStudio>;
