import {pngDensity,jpegDensity} from './density';
export async function rasterize(svg:string,widthMM:number,heightMM:number,dpi:number,format:'png'|'jpeg',quality:number,background:string,transparent:boolean):Promise<Blob>{
 const w=Math.round(widthMM/25.4*dpi),h=Math.round(heightMM/25.4*dpi);
 if(w*h>64_000_000||w<1||h<1)throw Error('La imagen debe tener entre 1 y 64 millones de píxeles. Ajustá dimensiones o DPI.');
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas no disponible.');
 if(format==='jpeg'||!transparent){ctx.fillStyle=background;ctx.fillRect(0,0,w,h);}
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{
  const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('No se pudo rasterizar el SVG.'));image.src=url;});ctx.drawImage(image,0,0,w,h);
  const encoded=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No se pudo generar la imagen.')),`image/${format}`,quality));
  const bytes=new Uint8Array(await encoded.arrayBuffer());return new Blob([format==='png'?pngDensity(bytes,dpi):jpegDensity(bytes,dpi)],{type:`image/${format}`});
 }finally{URL.revokeObjectURL(url);}
}
