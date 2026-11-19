import {openDB} from 'idb';
import {parseProject,serialize} from './schema';
import type {Project} from '../app/model';
const database=()=>openDB('pattern-studio',1,{upgrade(db){db.createObjectStore('projects');}});
export async function autosave(project:Project):Promise<void>{const db=await database();try{await db.put('projects',serialize(project),'last');}finally{db.close();}}
export async function recover():Promise<Project|null>{const db=await database();try{const text=await db.get('projects','last');return text?parseProject(text):null;}finally{db.close();}}
export function download(contents:Blob|string,name:string,type='application/json'):void{
 const url=URL.createObjectURL(typeof contents==='string'?new Blob([contents],{type}):contents),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
