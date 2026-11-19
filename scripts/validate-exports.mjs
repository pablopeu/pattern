/** Produce artifacts for independent CairoSVG/Pillow/ezdxf validation. */
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:4173');
const files=await page.evaluate(async()=>{
 const {example}=await import('/src/app/examples.ts');const {prepareExport}=await import('/src/export/svg.ts');const {exportDXF}=await import('/src/export/dxf.ts');const {rasterize}=await import('/src/export/raster.ts');
 const p=example(6),options={target:'application',format:'svg',representation:'expanded',width:100,height:100,dpi:200,background:'#ffffff',transparent:true,quality:.9,tolerance:.02,outlineStrokes:true,patternId:p.patterns[0].id,applicationId:p.applications[0].id};const result=prepareExport(p,options);
 const encode=async(blob)=>{const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(const v of bytes)binary+=String.fromCharCode(v);return btoa(binary);};
 return {svg:result.svg,dxf:exportDXF(result.geometries,.02),png:await encode(await rasterize(result.svg,result.bounds.width,result.bounds.height,200,'png',.9,'#ffffff',true)),jpeg:await encode(await rasterize(result.svg,result.bounds.width,result.bounds.height,200,'jpeg',.9,'#ffffff',false)),bounds:result.bounds};
});
await mkdir('.runtime/exports',{recursive:true});for(const type of ['svg','dxf','png','jpeg'])await writeFile('.runtime/exports/applied.'+type,['png','jpeg'].includes(type)?Buffer.from(files[type],'base64'):files[type]);await writeFile('.runtime/exports/expected.json',JSON.stringify(files.bounds));await browser.close();console.log('Artifacts in .runtime/exports');
