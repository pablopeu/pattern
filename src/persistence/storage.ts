import {openDB} from 'idb';
import {parseProject,serialize} from './schema';
import type {Project} from '../app/model';
const database=()=>openDB('pattern-studio',1,{upgrade(db){db.createObjectStore('projects');}});
export async function autosave(project:Project):Promise<void>{const db=await database();try{const tx=db.transaction('projects','readwrite');await tx.store.put(serialize(project),'last');await tx.store.put(serialize(project),'project:'+project.metadata.id);await tx.done;}finally{db.close();}}
export async function recover():Promise<Project|null>{const db=await database();try{const text=await db.get('projects','last');return text?parseProject(text):null;}finally{db.close();}}
export function download(contents:Blob|string,name:string,type='application/json'):void{
 const url=URL.createObjectURL(typeof contents==='string'?new Blob([contents],{type}):contents),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

export async function savedProjects():Promise<{id:string;name:string;updatedAt:string}[]>{const db=await database();try{const out:{id:string;name:string;updatedAt:string}[]=[];let cursor=await db.transaction('projects').store.openCursor();while(cursor){if(String(cursor.key).startsWith('project:')){try{const p=parseProject(cursor.value);out.push({id:p.metadata.id,name:p.metadata.name,updatedAt:p.metadata.updatedAt});}catch{/* Preserve unrecognized data for recovery; do not delete it. */}}cursor=await cursor.continue();}return out.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}finally{db.close();}}
export async function loadSavedProject(id:string):Promise<Project>{const db=await database();try{const data=await db.get('projects','project:'+id);if(!data)throw Error('No se encontró ese proyecto en este navegador.');return parseProject(data);}finally{db.close();}}
