import {prepareExport,type ExportOptions} from './svg';
import {exportDXF} from './dxf';
import type {Project} from '../app/model';
self.onmessage=(event:MessageEvent<{project:Project;options:ExportOptions}>)=>{
 try{const {project,options}=event.data;const result=prepareExport(project,options,n=>self.postMessage({progress:n}));self.postMessage({result:options.format==='dxf'?{...result,dxf:exportDXF(result.geometries,options.tolerance)}:result});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
