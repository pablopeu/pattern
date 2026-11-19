import {describe,it,expect} from 'vitest';
import {apply,inverse,multiply,rotate,reflect,translate,scale,fromMM,toMM} from '../geometry/matrix';
import {closure,fractionalGenerators,key,lattice,wallpaperNames,cosets,friezeNames} from '../symmetry/groups';
import {newPattern} from '../app/model';
import {generate,penrose} from '../generators';
import {example} from '../app/examples';
import {parseProject,serialize} from '../persistence/schema';
import {History} from '../editor/history';
import {booleanGeometry,editablePaths,flattened} from '../geometry/paper';
import {pathData} from '../geometry/paths';

describe('Transformaciones',()=>{
 it('compone, refleja y edita desde instancia invertida',()=>{const m=multiply(translate(13,-25),multiply(rotate(67),multiply(reflect(22),scale(2,.4))));const p={x:17.23,y:-8.11};const q=apply(inverse(m),apply(m,p));expect(q.x).toBeCloseTo(p.x,10);expect(q.y).toBeCloseTo(p.y,10);});
 it('rechaza matrices singulares',()=>expect(()=>inverse(scale(0))).toThrow());
 it('convierte unidades sin modificar dimensiones físicas',()=>{for(const u of ['mm','cm','in','px'] as const)expect(toMM(fromMM(100,u),u)).toBeCloseTo(100,12);});
});
describe('Los 17 wallpaper groups',()=>{
 const orders=[1,2,2,2,2,4,4,4,4,4,8,8,3,6,6,6,12];
 wallpaperNames.forEach((name,index)=>{
  it(`${name}: orden, cierre, isometría e invariancia de red`,()=>{
   const group=closure(fractionalGenerators(name));expect(group).toHaveLength(orders[index]);const keys=new Set(group.map(key));
   for(const a of group)for(const b of group)expect(keys.has(key(multiply(a,b)))).toBe(true);
   const s={...newPattern().symmetry,group:name};const basis=lattice(s),inv=inverse(basis);
   for(const a of cosets(s)){
    expect(a[0]*a[0]+a[1]*a[1]).toBeCloseTo(1,7);expect(a[2]*a[2]+a[3]*a[3]).toBeCloseTo(1,7);expect(a[0]*a[2]+a[1]*a[3]).toBeCloseTo(0,7);
    for(const v of [{x:basis[0],y:basis[1]},{x:basis[2],y:basis[3]}]){const linear=apply(a,v),offset=apply(a,{x:0,y:0}),f=apply(inv,{x:linear.x-offset.x,y:linear.y-offset.y});expect(f.x).toBeCloseTo(Math.round(f.x),7);expect(f.y).toBeCloseTo(Math.round(f.y),7);}
   }
  });
 });
 it('los 7 frisos tienen órdenes correctos',()=>friezeNames.forEach((group,i)=>expect(cosets({...newPattern().symmetry,family:'frieze',group})).toHaveLength([1,2,2,2,2,4,4][i])));
 it('las rosetas no agregan traslaciones',()=>{const s={...newPattern().symmetry,family:'radial' as const,group:'Dn',sectors:13,center:{x:18,y:-12}};expect(cosets(s)).toHaveLength(26);for(const m of cosets(s)){expect(apply(m,s.center).x).toBeCloseTo(18);expect(apply(m,s.center).y).toBeCloseTo(-12);}});
});
describe('Generadores y recuperación',()=>{
 it('warp tiene determinismo con la misma semilla y parámetros',()=>{const p=example(4).patterns[0];p.generator.distribution='freeform';expect(generate(p.generator,p.sourceGeometry)).toEqual(generate(p.generator,p.sourceGeometry));const a=generate(p.generator,p.sourceGeometry);p.generator.seed++;expect(generate(p.generator,p.sourceGeometry)).not.toEqual(a);});
 it('Penrose subdivide triángulos con dos áreas en razón áurea',()=>{const paths=penrose(4,100);const areas=new Set(paths.map(g=>{const [a,b,c]=g.nodes;return Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;}).map(x=>Math.round(x*1e5)/1e5));expect(areas.size).toBe(2);expect(paths.length).toBeGreaterThan(100);});
 it('los 8 ejemplos tienen ciclo JSON sin pérdida',()=>{for(let i=0;i<8;i++){const p=example(i);expect(parseProject(serialize(p))).toEqual(p);}});
 it('rechaza archivos corruptos sin tocar el documento',()=>{const p=example(0);expect(()=>parseProject('{')).toThrow();expect(()=>parseProject(JSON.stringify({...p,schemaVersion:999}))).toThrow();expect(p.schemaVersion).toBe(1);});
 it('undo y redo coherentes y descartado de futuro',()=>{const h=new History({x:0});h.commit({x:1});h.commit({x:2});expect(h.undo()).toEqual({x:1});expect(h.redo()).toEqual({x:2});h.undo();h.commit({x:3});expect(h.canRedo).toBe(false);});
});
describe('Geometría real con Paper.js',()=>{
 it('convierte paramétricas a nodos conservando medidas',()=>{const s=example(0).patterns[0].sourceGeometry[2];expect(editablePaths(s)[0].nodes.length).toBe(4);expect(flattened(s,.01)[0].closed).toBe(true);});
 it('diferencia mantiene agujero como compound path',()=>{const s=example(0).patterns[0].sourceGeometry[2];const outer={...s,parameters:{...s.parameters!,x:0,y:0,width:100,height:100}},inner={...s,parameters:{...s.parameters!,x:25,y:25,width:50,height:50}};const out=booleanGeometry([outer,inner],'difference');expect((pathData(out).match(/M/g)||[]).length).toBe(2);});
});

describe('Región fundamental y clasificación',()=>{
 it('tiene área de la celda dividida por el orden del grupo',async()=>{const {fundamentalDomain}=await import('../symmetry/groups');for(const name of wallpaperNames){const s={...newPattern().symmetry,group:name};const poly=fundamentalDomain(s),b=lattice(s);const area=Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p.x*q.y-p.y*q.x;},0))/2;expect(area).toBeCloseTo(Math.abs(b[0]*b[3]-b[1]*b[2])/cosets(s).length,5);}});
 it('culling conserva motivos desplazados a muchas celdas del origen',async()=>{const {buildScene}=await import('../patterns/engine');const p=example(0).patterns[0];p.sourceGeometry[0].transform=[1,0,0,1,6000,6000];const scene=buildScene(p,{x:0,y:0,width:60,height:60});expect(scene.instances.some(i=>i.cell[0]<-90&&i.cell[1]<-90)).toBe(true);});
});

describe('Todas las familias de generadores',()=>{
 for(const kind of ['grid','warp','radial','rosette','wave','guilloche','spirograph','lattice','tessellation','freeform','penrose'] as const){it(`${kind}: salida vectorial, finita y determinística`,()=>{const p=example(0).patterns[0];p.generator.kind=kind;const a=generate(p.generator,p.sourceGeometry),b=generate(p.generator,p.sourceGeometry);expect(a).toEqual(b);expect(a.geometry.length).toBeGreaterThan(0);expect(JSON.stringify(a)).not.toMatch(/NaN|Infinity/);});}
 it('warp circular usa amplitud, frecuencia y fase; elíptica conserva motivos',()=>{const p=example(4).patterns[0];p.generator.distribution='circular';const a=generate(p.generator,p.sourceGeometry);p.generator.amplitude+=2;expect(generate(p.generator,p.sourceGeometry)).not.toEqual(a);const b=generate(p.generator,p.sourceGeometry);p.generator.aspectRatio=.5;expect(generate(p.generator,p.sourceGeometry)).not.toEqual(b);});
 it('p3m1 y p31m son grupos distintos sobre la misma red',()=>{expect(new Set(closure(fractionalGenerators('p3m1')).map(key))).not.toEqual(new Set(closure(fractionalGenerators('p31m')).map(key)));});
 it('el dominio Dirichlet funciona con redes muy oblicuas y ejes desiguales',async()=>{const {fundamentalDomain}=await import('../symmetry/groups');const s={...newPattern().symmetry,width:5,height:200,angle:15};const poly=fundamentalDomain(s),b=lattice(s);const area=Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p.x*q.y-p.y*q.x;},0))/2;expect(area).toBeCloseTo(Math.abs(b[0]*b[3]-b[1]*b[2]),5);});
});

describe('Validación semántica del documento',()=>{
 it('rechaza matrices singulares y shapes paramétricas incompletas',()=>{const p=example(0);p.patterns[0].sourceGeometry[0].transform=[0,0,0,0,0,0];expect(()=>parseProject(serialize(p))).toThrow(/invertible/);const q=example(0);q.patterns[0].sourceGeometry[2].parameters=undefined;expect(()=>parseProject(serialize(q))).toThrow(/parámetros/);});
 it('rechaza compound paths corruptos antes de reemplazar el documento',()=>{const p=example(0);p.patterns[0].sourceGeometry[0].kind='compound';p.patterns[0].sourceGeometry[0].pathData='invalid';expect(()=>parseProject(serialize(p))).toThrow(/válida/);});
});
