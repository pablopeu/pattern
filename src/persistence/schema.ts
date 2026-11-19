import {z} from 'zod';
import type {Project} from '../app/model';
const n=z.number().finite(),positive=n.positive(),point=z.object({x:n,y:n}),matrix=z.tuple([n,n,n,n,n,n]);
export const geometrySchema=z.object({id:z.string().min(1),name:z.string(),kind:z.enum(['path','rectangle','ellipse','polygon','compound']),nodes:z.array(point.extend({in:point,out:point})).max(100000),closed:z.boolean(),transform:matrix,stroke:z.string().regex(/^(none|#[0-9a-fA-F]{3,8})$/),fill:z.string().regex(/^(none|#[0-9a-fA-F]{3,8})$/),strokeWidth:n.min(0).max(1000),visible:z.boolean(),locked:z.boolean(),groupId:z.string().optional(),pathData:z.string().max(2000000).optional(),parameters:z.object({x:n,y:n,width:positive,height:positive,radius:n.min(0),sides:n.int().min(3).max(128)}).optional()});
const generator=z.object({kind:z.enum(['motif','grid','warp','radial','rosette','wave','guilloche','spirograph','lattice','tessellation','freeform','penrose']),version:z.literal(1),seed:n.int(),count:n.int().min(1).max(128),rows:n.int().min(1).max(32),columns:n.int().min(1).max(32),spacing:positive,offset:n,rotation:n,scale:positive.max(100),scaleRatio:positive.max(10),amplitude:n.min(0).max(500),frequency:n.min(1).max(64),phase:n,radius:positive.max(1000),ratio:positive.max(1),distribution:z.enum(['rectangular','circular','freeform']),periodicWarp:z.boolean(),placements:z.array(matrix).max(2000)});
const symmetry=z.object({family:z.enum(['wallpaper','frieze','radial']),group:z.string(),width:positive.max(10000),height:positive.max(10000),angle:n.min(15).max(165),sectors:n.int().min(2).max(64),center:point}).superRefine((s,ctx)=>{
 const allowed=s.family==='wallpaper'?['p1','p2','pm','pg','cm','pmm','pmg','pgg','cmm','p4','p4m','p4g','p3','p3m1','p31m','p6','p6m']:s.family==='frieze'?['p1','p11g','p1m1','p11m','p2','p2mg','p2mm']:['Cn','Dn'];
 if(!allowed.includes(s.group))ctx.addIssue({code:'custom',message:'Grupo incompatible con su familia',path:['group']});
});
const pattern=z.object({id:z.string(),name:z.string(),sourceGeometry:z.array(geometrySchema).max(10000),generator,symmetry});
export const projectSchema=z.object({schemaVersion:z.literal(1),metadata:z.object({id:z.string(),name:z.string(),createdAt:z.string(),updatedAt:z.string()}),documentUnits:z.enum(['mm','cm','in','px']),patterns:z.array(pattern).min(1).max(100),regions:z.array(z.object({id:z.string(),name:z.string(),geometry:z.array(geometrySchema).min(1)})).max(100),applications:z.array(z.object({id:z.string(),name:z.string(),patternId:z.string(),regionId:z.string(),placementTransform:matrix,linked:z.boolean(),frozenPattern:pattern.optional(),showOutline:z.boolean()})).max(100),preferences:z.object({grid:z.boolean(),snap:z.boolean(),guides:z.boolean(),split:z.boolean(),background:z.string().regex(/^#[0-9a-fA-F]{6}$/)})});
export function parseProject(text:string):Project{
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw Error('El archivo no contiene JSON válido.');}
 const result=projectSchema.safeParse(raw);
 if(!result.success){const issue=result.error.issues[0];throw Error(`Proyecto inválido en ${issue.path.join('.')}: ${issue.message}`);}
 const p=result.data;
 const ids=[...p.patterns.map(x=>x.id),...p.regions.map(x=>x.id),...p.applications.map(x=>x.id)];
 if(new Set(ids).size!==ids.length)throw Error('El proyecto contiene identificadores duplicados.');
 for(const r of p.regions)if(r.geometry.some(g=>!g.closed))throw Error('Los perímetros deben estar cerrados.');
 for(const a of p.applications){if(!p.patterns.some(x=>x.id===a.patternId)||!p.regions.some(x=>x.id===a.regionId))throw Error('Una aplicación tiene vínculos inexistentes.');if(!a.linked&&!a.frozenPattern)throw Error('Una aplicación congelada necesita una copia de su patrón.');}
 return p as Project;
}
export const serialize=(project:Project)=>JSON.stringify(project,null,2);
