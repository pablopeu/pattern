import {test,expect,type Page} from '@playwright/test';
async function ready(page:Page){await page.goto('/');await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);}
async function menu(page:Page,name:string){const details=page.locator('.main-menu');if(!await details.getAttribute('open'))await details.locator('summary').click();await details.getByRole('button',{name,exact:true}).click();if(await details.getAttribute('open')!==null)await details.locator('summary').click();}
async function newProject(page:Page){await menu(page,'Nuevo proyecto');await expect(page.locator('.empty-canvas')).toBeVisible();}
async function model(page:Page){return page.evaluate(async()=>{const {recover}=await import('/src/persistence/storage.ts');return await recover();});}
async function modelPoint(page:Page,x:number,y:number){return page.locator('.studio-canvas').first().evaluate((el,p)=>{const point=new DOMPoint(p.x,p.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);return {x:point.x,y:point.y};},{x,y});}
async function uploadSVG(page:Page,svg:string){await page.locator('input[type=file][accept=".svg,image/svg+xml"]').setInputFiles({name:'test.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});await page.getByRole('dialog',{name:'Importar SVG',exact:true}).getByRole('button',{name:'Importar SVG',exact:true}).click();}

test('editor inicial, tres modos y capturas desktop sin errores',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await expect(page.locator('.studio-canvas use')).not.toHaveCount(0);
 for(const [label,file] of [['Diseño','edit'],['Patrón','pattern'],['Aplicar','apply']]){await page.getByRole('tab',{name:label,exact:true}).click();await page.screenshot({path:`test-results/${file}-1440.png`});}
 await page.setViewportSize({width:1366,height:768});await page.getByRole('tab',{name:'Diseño',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/edit-1366.png'});expect(errors).toEqual([]);
});
test('AC-01: primera línea visible antes de soltar; undo y redo',async({page})=>{
 await ready(page);await newProject(page);await page.getByRole('button',{name:'Línea',exact:true}).click();const a=await modelPoint(page,0,0),b=await modelPoint(page,20,15);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});
 const d=await page.locator('.studio-canvas defs g path').first().getAttribute('d');expect(d).toContain('L20 15');expect(await page.locator('.studio-canvas use').count()).toBeGreaterThan(5);await page.mouse.up();
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.locator('.empty-canvas')).toBeVisible();await page.getByRole('button',{name:'Rehacer',exact:true}).click();await expect(page.locator('.empty-canvas')).toHaveCount(0);
});
test('AC-02/03: arrastrar nodo desde copia reflejada cambia la fuente',async({page})=>{
 await ready(page);await newProject(page);await uploadSVG(page,'<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="60mm" viewBox="0 0 60 60"><path d="M10 10L25 15L15 25Z" fill="#55765b"/></svg>');
 await page.getByRole('tab',{name:'Patrón',exact:true}).click();await page.getByRole('button',{name:'Simetría pm',exact:true}).click();await page.getByRole('button',{name:'Editar nodos',exact:true}).click();const hit=await modelPoint(page,16,-15);await page.mouse.click(hit.x,hit.y);await expect(page.getByLabel('Nodo 1',{exact:true})).toBeVisible();
 const n=await page.getByLabel('Nodo 1',{exact:true}).boundingBox();expect(n).not.toBeNull();await page.mouse.move(n!.x+n!.width/2,n!.y+n!.height/2);await page.mouse.down();await page.mouse.move(n!.x+n!.width/2+15,n!.y+n!.height/2+15,{steps:4});await page.mouse.up();await expect.poll(async()=>((await model(page)) as any).patterns[0].sourceGeometry[0].nodes[0].y).toBeLessThan(10);
});
test('AC-12/13: rectángulo 100x50 mm, JSON portable y recuperación',async({page})=>{
 await ready(page);await newProject(page);await page.getByRole('button',{name:'Rectángulo',exact:true}).click();const a=await modelPoint(page,0,0),b=await modelPoint(page,35,25);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);await page.mouse.up();
 await page.getByLabel('Ancho',{exact:true}).fill('100');await page.getByLabel('Alto',{exact:true}).fill('50');const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Guardar proyecto',exact:true}).click();const download=await downloadPromise;const file=await download.path();expect(file).not.toBeNull();
 await page.reload();await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);await expect.poll(async()=>((await model(page)) as any).patterns[0].sourceGeometry[0]?.parameters?.width).toBe(100);
 await newProject(page);await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles(file!);await expect.poll(async()=>((await model(page)) as any).patterns[0].sourceGeometry[0]?.parameters?.height).toBe(50);
});
test('SVG sanitizado: escalas, transformaciones y scripts inertes',async({page})=>{
 await ready(page);await newProject(page);await uploadSVG(page,'<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 200 100"><script>window.HACKED=true</script><g transform="translate(20 10)"><rect x="0" y="0" width="100" height="50" fill="#334455" onclick="window.HACKED=true"/></g><image href="https://evil.invalid/x.png"/></svg>');
 expect(await page.evaluate(()=>Boolean((window as any).HACKED))).toBe(false);
 await expect.poll(async()=>((await model(page)) as any)?.patterns[0].sourceGeometry.length).toBe(1);
 const result=await page.evaluate(async()=>{const {recover}=await import('/src/persistence/storage.ts');const {geometryBounds}=await import('/src/application/clipping.ts');return geometryBounds((await recover())!.patterns[0].sourceGeometry);});expect(result.width).toBeCloseTo(50,6);expect(result.height).toBeCloseTo(25,6);expect(result.x).toBeCloseTo(10,6);expect(result.y).toBeCloseTo(5,6);
});
test('exportación real SVG, PNG, JPEG y DXF desde worker',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'Exportar',exact:true}).click();await expect(page.getByAltText('Previsualización de exportación')).toBeVisible();
 for(const format of ['svg','png','jpeg','dxf']){await page.getByLabel('Formato',{exact:true}).selectOption(format);await expect(page.getByRole('button',{name:'Descargar archivo',exact:true})).toBeEnabled();const d=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar archivo',exact:true}).click();const file=await d;const path=await file.path();expect(path).not.toBeNull();const fs=await import('node:fs/promises');const content=await fs.readFile(path!);expect(content.length).toBeGreaterThan(100);if(format==='svg')expect(content.toString()).toContain('width="200mm"');if(format==='png')expect(content.subarray(1,4).toString()).toBe('PNG');if(format==='jpeg')expect(content[0]).toBe(255);if(format==='dxf')expect(content.toString()).toContain('LWPOLYLINE');}
});
test('aplicación a perímetro y SVG expandido sin máscara',async({page})=>{
 await ready(page);await menu(page,'Jardín en un perímetro');await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByLabel('Representación',{exact:true}).selectOption('expanded');await expect(page.getByRole('button',{name:'Descargar archivo',exact:true})).toBeEnabled({timeout:20000});const d=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar archivo',exact:true}).click();const fs=await import('node:fs/promises');const text=await fs.readFile((await (await d).path())!,'utf8');expect(text).not.toContain('clipPath');expect(text).not.toContain('<use');expect(text).toContain('<path');
});
test('vista dividida y cambio de generador conserva geometría y undo',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'Vista dividida',exact:true}).click();await expect(page.locator('.studio-canvas')).toHaveCount(2);await page.getByLabel('Familia',{exact:true}).selectOption('warp');await expect(page.getByLabel('Espaciado',{exact:true})).toBeVisible();await page.getByLabel('Espaciado',{exact:true}).fill('30');await expect.poll(async()=>((await model(page)) as any).patterns[0].generator.spacing).toBe(30);await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.getByLabel('Espaciado',{exact:true})).toHaveValue('22');expect(((await model(page)) as any).patterns[0].sourceGeometry).toHaveLength(3);
});

test('pluma Bézier y polígono: tangentes, cierre, fuente editable y un undo por trazo',async({page})=>{
 await ready(page);await newProject(page);await page.getByRole('button',{name:'Pluma Bézier',exact:true}).click();
 const a=await modelPoint(page,0,0),b=await modelPoint(page,25,0),c=await modelPoint(page,15,25);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(a.x+20,a.y+20);await page.mouse.up();await page.mouse.click(b.x,b.y);await page.mouse.click(c.x,c.y);await page.keyboard.press('Shift+Enter');
 await expect.poll(async()=>((await model(page)) as any)?.patterns[0].sourceGeometry[0]?.name).toBe('Curva');const saved:any=await model(page);expect(saved.patterns[0].sourceGeometry[0].closed).toBe(true);expect(saved.patterns[0].sourceGeometry[0].nodes[0].out.x).not.toBe(0);
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.locator('.empty-canvas')).toBeVisible();await page.getByRole('button',{name:'Rehacer',exact:true}).click();await expect(page.locator('.empty-canvas')).toHaveCount(0);
});
test('edición de un nodo desde una instancia rotada',async({page})=>{
 await ready(page);await newProject(page);await uploadSVG(page,'<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="60mm" viewBox="0 0 60 60"><path d="M10 10L25 15L15 25Z" fill="#55765b"/></svg>');await page.getByRole('tab',{name:'Patrón',exact:true}).click();await page.getByRole('button',{name:'Simetría p4',exact:true}).click();await page.getByRole('button',{name:'Editar nodos',exact:true}).click();const q=await modelPoint(page,-16,15);await page.mouse.click(q.x,q.y);const n=await page.getByLabel('Nodo 1',{exact:true}).boundingBox();expect(n).not.toBeNull();await page.mouse.move(n!.x+n!.width/2,n!.y+n!.height/2);await page.mouse.down();await page.mouse.move(n!.x+n!.width/2+18,n!.y+n!.height/2);await page.mouse.up();await expect.poll(async()=>((await model(page)) as any)?.patterns[0].sourceGeometry[0]?.nodes[0].y).toBeLessThan(10);
});
test('presets y biblioteca conservan proyectos al restaurar ejemplos',async({page})=>{
 await ready(page);await page.getByLabel('Nombre del proyecto',{exact:true}).fill('Mi proyecto conservado');await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);await menu(page,'Espejos · p4m');await menu(page,'Biblioteca de este navegador');const dialog=page.getByRole('dialog',{name:'Biblioteca de proyectos'});await dialog.getByRole('button',{name:/Mi proyecto conservado/}).click();await expect(page.getByLabel('Nombre del proyecto',{exact:true})).toHaveValue('Mi proyecto conservado');
 const d=page.waitForEvent('download');await menu(page,'Exportar preset del patrón');const file=await (await d).path();await page.locator('input[type=file][accept=".json"]').setInputFiles(file!);await expect.poll(async()=>((await model(page)) as any)?.patterns.length).toBe(2);
});
test('un path abierto importado como perímetro se rechaza sin cierre silencioso',async({page})=>{
 await ready(page);await page.getByRole('tab',{name:'Aplicar',exact:true}).click();await uploadSVG(page,'<svg xmlns="http://www.w3.org/2000/svg" width="50mm" viewBox="0 0 50 50"><path d="M0 0L50 0L25 25" fill="none" stroke="#222222"/></svg>');await expect(page.getByRole('status')).toContainText('paths abiertos');expect(((await model(page)) as any).regions.length).toBe(0);
});
test('la celda SVG teselada coincide con la escena grande, incluidos cruces de borde',async({page})=>{
 await ready(page);const measurements=await page.evaluate(async()=>{
  const {newProject,geometry}=await import('/src/app/model.ts');const {prepareExport,svgDocument}=await import('/src/export/svg.ts');const {rectangularCell}=await import('/src/symmetry/groups.ts');
  const samples=[];
  const render=async(svg,width,height)=>{const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await img.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,width,height);return ctx.getImageData(0,0,width,height).data;};
  for(const group of ['p1','p4g','p6m']){
   const p=newProject(),pat=p.patterns[0];pat.symmetry={...pat.symmetry,group,angle:90,width:40,height:40};const g=geometry('rectangle',[],true);g.parameters={x:35,y:28,width:12,height:20,radius:2,sides:4};g.fill='#334455';g.strokeWidth=.5;pat.sourceGeometry=[g];
   const opts={target:'tile',format:'svg',representation:'editable',width:120,height:120,dpi:96,background:'#ffffff',transparent:false,quality:.9,tolerance:.02,outlineStrokes:true,patternId:pat.id};
   const cell=rectangularCell(pat.symmetry),tile=prepareExport(p,opts);const large=prepareExport(p,{...opts,target:'view',width:3*cell.width,height:3*cell.height});
   const content=`<defs><pattern id="mosaic" patternUnits="userSpaceOnUse" width="${cell.width}" height="${cell.height}"><image href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(tile.svg)}" width="${cell.width}" height="${cell.height}"/></pattern></defs><rect x="${large.bounds.x}" y="${large.bounds.y}" width="${large.bounds.width}" height="${large.bounds.height}" fill="url(#mosaic)"/>`;
   const mosaic=svgDocument(content,large.bounds,'#ffffff'),width=480,height=Math.round(480*large.bounds.height/large.bounds.width),a=await render(large.svg,width,height),b=await render(mosaic,width,height);let difference=0;for(let i=0;i<a.length;i++)difference+=Math.abs(a[i]-b[i]);samples.push({group,meanChannelDifference:difference/a.length});
  }return samples;
 });for(const m of measurements)expect(m.meanChannelDifference,`${m.group}: diferencias del mosaico`).toBeLessThan(2);
});

test('crear perímetro, aplicar, transformar, congelar y undo/redo',async({page})=>{
 await ready(page);await page.getByRole('tab',{name:'Aplicar',exact:true}).click();await page.getByRole('button',{name:'Rectángulo',exact:true}).click();const a=await modelPoint(page,-30,-30),b=await modelPoint(page,70,40);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);await page.mouse.up();await page.getByRole('button',{name:'Aplicar al perímetro',exact:true}).click();await expect.poll(async()=>((await model(page)) as any)?.applications.length).toBe(1);
 await page.getByLabel('Escala uniforme',{exact:true}).fill('1.5');await page.getByLabel('Rotación de aplicación',{exact:true}).fill('30');await page.getByRole('button',{name:'Vinculado · congelar copia',exact:true}).click();await expect.poll(async()=>((await model(page)) as any)?.applications[0]?.linked).toBe(false);await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.getByRole('button',{name:'Vinculado · congelar copia',exact:true})).toBeVisible();await page.getByRole('button',{name:'Rehacer',exact:true}).click();await expect(page.getByRole('button',{name:'Congelado · volver a vincular',exact:true})).toBeVisible();await page.screenshot({path:'test-results/applied-interaction.png'});
});

test('SVG: preserveAspectRatio, viewport físico y escalado no uniforme conservan las medidas',async({page})=>{
 await ready(page);const cases=await page.evaluate(async()=>{
  const {importSVG}=await import('/src/persistence/svg-import.ts');const {geometryBounds}=await import('/src/application/clipping.ts');
  const read=(text)=>{const result=importSVG(text,100);return {bounds:geometryBounds(result.geometry),stroke:result.geometry[0].strokeWidth,matrix:result.geometry[0].transform};};
  return [
   read('<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 200 100"><rect width="200" height="100"/></svg>'),
   read('<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 200 100" preserveAspectRatio="none"><rect width="200" height="100"/></svg>'),
   read('<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm"><rect width="96" height="96"/></svg>')
  ];
 });expect(cases[0].bounds.width).toBeCloseTo(100,6);expect(cases[0].bounds.height).toBeCloseTo(50,6);expect(cases[0].bounds.y).toBeCloseTo(25,6);expect(cases[1].bounds.height).toBeCloseTo(100,6);expect(cases[2].bounds.width).toBeCloseTo(25.4,6);
});

test('la exportación se puede cancelar y reintentar sin cambiar el documento',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.getByRole('alert')).toContainText('cancelada');await page.getByLabel('Qué exportar',{exact:true}).selectOption('tile');await expect(page.getByRole('button',{name:'Descargar archivo',exact:true})).toBeEnabled();
});

test('duplicar patrón mantiene fuentes independientes',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'Duplicar patrón',exact:true}).click();await expect.poll(async()=>((await model(page)) as any)?.patterns.length).toBe(2);const p:any=await model(page);expect(p.patterns[0].sourceGeometry[0].id).not.toBe(p.patterns[1].sourceGeometry[0].id);
 await page.getByRole('button',{name:/^Capas/}).click();await page.locator('.layer-name').last().click();await page.getByRole('button',{name:'Diseño',exact:true}).click();await page.getByLabel('Nombre del objeto',{exact:true}).fill('Sólo cambia la copia');await expect.poll(async()=>((await model(page)) as any)?.patterns[1].sourceGeometry[0].name).toBe('Sólo cambia la copia');expect(((await model(page)) as any).patterns[0].sourceGeometry[0].name).not.toBe('Sólo cambia la copia');
});
