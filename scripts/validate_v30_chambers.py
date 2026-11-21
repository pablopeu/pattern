"""Independent source-to-triangle formula and CairoSVG alpha/paint probes."""
import json,math
from pathlib import Path
import cairosvg
from PIL import Image,ImageChops,ImageStat
root=Path('.runtime')
def root_point(u,v,p=7,q=3):
 rc=math.sqrt(math.cos(math.pi/p+math.pi/q)/math.cos(math.pi/p-math.pi/q))
 ri=math.sqrt((math.cos(math.pi/q)-math.sin(math.pi/p))/(math.cos(math.pi/q)+math.sin(math.pi/p)))
 E=(2*ri/(1+ri*ri),0);V=(2*rc*math.cos(-math.pi/p)/(1+rc*rc),2*rc*math.sin(-math.pi/p)/(1+rc*rc));M=(V[0]/2,V[1]/2)
 if u+v<=1:k=(u*E[0]+v*M[0],u*E[1]+v*M[1])
 else:k=((V[0]-M[0])*u+(V[0]-E[0])*v+E[0]+M[0]-V[0],(V[1]-M[1])*u+(V[1]-E[1])*v+E[1]+M[1]-V[1])
 den=1+math.sqrt(1-k[0]*k[0]-k[1]*k[1]);return k[0]/den,k[1]/den
# Pixel coordinates locate edges; floor selects the pixel containing the analytic probe.
def pixel(p):return math.floor((p[0]+1)*1024),math.floor((p[1]+1)*1024)
results=[]
for kind in ['uniform','holes','pressure']:
 metadata=json.loads((root/f'chambers-{kind}.json').read_text());report=metadata['report'];assert metadata['sourceUnchanged']
 assert report['motif']['borderCorrespondence']=='CANONICAL_C0' and report['motif']['derivativesMatched'] is False
 assert report['numeric']['curveProjectionBoundMm']<=.005 and report['numeric']['canonicalAdjustmentEstimateMm']<1e-7
 cairosvg.svg2png(url=str(root/f'chambers-{kind}.svg'),write_to=str(root/f'chambers-{kind}-cairo.png'),output_width=2048,output_height=2048)
 a=Image.open(root/f'chambers-{kind}.png').convert('RGBA');b=Image.open(root/f'chambers-{kind}-cairo.png').convert('RGBA')
 probes=[('body',root_point(.2,.2),'blue')]
 if kind=='holes':probes.append(('hole-on-map-seam',root_point(.5,.5),'hole'))
 if kind=='pressure':probes += [('thin',root_point(.3,.832),'blue'),('thick',root_point(.7,.832),'pink')]
 values={}
 for name,pos,color in probes:
  found=[image.getpixel(pixel(pos)) for image in [a,b]];values[name]=found
  if color=='hole':assert all(v[3]==0 for v in found),(kind,name,found)
  elif color=='pink':assert all(max(abs(x-y) for x,y in zip(v,(199,51,124,255)))<=2 for v in found),(kind,name,found)
  else:assert all(abs(v[3]-128)<=1 and max(abs(x-y) for x,y in zip(v[:3],(59,130,246)))<=2 for v in found),(kind,name,found)
 if kind=='uniform':
  assert len(metadata['edges'])>=6
  for edge in metadata['edges']:
   x,y=pixel((edge['midpoint']['x'],edge['midpoint']['y']))
   for image in [a,b]:
    for dx in [-1,0,1]:
     for dy in [-1,0,1]:assert abs(image.getpixel((x+dx,y+dy))[3]-128)<=1,('alpha-seam',edge['id'],image.getpixel((x+dx,y+dy)))
 white=Image.new('RGBA',a.size,'white');ar=Image.alpha_composite(white,a).convert('RGB');br=Image.alpha_composite(white,b).convert('RGB')
 mean=sum(ImageStat.Stat(ImageChops.difference(ar,br)).mean)/3;assert mean<1.5,mean
 results.append({'kind':kind,'meanError255':mean,'independentProbes':values,'sharedEdgesChecked':len(metadata['edges']) if kind=='uniform' else 0})
print(json.dumps(results))
