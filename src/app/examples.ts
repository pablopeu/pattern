import {geometry,newProject,node,uid,type Project} from './model';
export const exampleNames=['Jardín geométrico','Espejos · p4m','Hexagonal · p6m','Órbita radial','Warp Grid','Guilloché','Jardín en un perímetro','Penrose aperiódico'];
export function example(index:number):Project{
 const p=newProject();p.metadata.name=exampleNames[index]??exampleNames[0];const pattern=p.patterns[0];pattern.name=p.metadata.name;pattern.symmetry.angle=90;
 const leaf=geometry('path',[
  {...node(8,32),out:{x:0,y:-17}},
  {...node(31,7),in:{x:-15,y:0},out:{x:0,y:16}},
  {...node(8,32),in:{x:15,y:0}}
 ],true);leaf.fill='#55765b';leaf.strokeWidth=.4;
 const vein=geometry('path',[node(9,31),{...node(26,12),in:{x:-8,y:10}}]);vein.stroke='#dce7c9';vein.strokeWidth=.6;
 const dot=geometry('ellipse',[],true);dot.fill='#c0cd8f';dot.stroke='none';dot.parameters={x:37,y:36,width:8,height:8,radius:0,sides:5};
 pattern.sourceGeometry=[leaf,vein,dot];
 if(index===1||index===2){pattern.symmetry.group=index===1?'p4m':'p6m';pattern.symmetry.width=80;pattern.sourceGeometry=[{...leaf,transform:[.6,0,0,.6,2,2],fill:'#496e55'}, {...dot,parameters:{...dot.parameters!,x:7,y:5,width:3,height:3}}];}
 if(index===3){pattern.symmetry.family='radial';pattern.symmetry.group='Dn';pattern.symmetry.sectors=10;}
 if(index===4){pattern.generator={...pattern.generator,kind:'warp',rows:3,columns:3,spacing:18,amplitude:4,frequency:2,scale:.3};pattern.symmetry.width=75;pattern.symmetry.height=75;}
 if(index===5){pattern.sourceGeometry=[];pattern.generator={...pattern.generator,kind:'guilloche',radius:23,amplitude:5,frequency:9,count:17};pattern.symmetry.width=70;pattern.symmetry.height=70;}
 if(index===6){
  const r=geometry('path',[{...node(-70,-65),out:{x:95,y:-35}}, {...node(75,-45),in:{x:-45,y:-15},out:{x:60,y:55}},{...node(40,65),in:{x:60,y:-5},out:{x:-50,y:40}},{...node(-75,35),in:{x:10,y:50},out:{x:-30,y:-45}}],true);
  r.name='Perímetro orgánico';r.fill='#edf1e8';const region={id:uid(),name:'Perímetro orgánico',geometry:[r]};p.regions=[region];p.applications=[{id:uid(),name:'Aplicación 01',patternId:pattern.id,regionId:region.id,placementTransform:[1,0,0,1,0,0],linked:true,showOutline:true}];
 }
 if(index===7){pattern.sourceGeometry=[];pattern.generator={...pattern.generator,kind:'penrose',radius:95,frequency:4};}
 return p;
}
