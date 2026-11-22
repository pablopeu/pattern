#!/usr/bin/env python3
"""Cairo parses true SVG arcs; compare against independently parametrized geodesics."""
from pathlib import Path
import io,json,cmath,math,xml.etree.ElementTree as ET
import cairosvg
from PIL import Image,ImageChops,ImageStat
root=Path('.runtime/hyperbolic-proof')
ns='{http://www.w3.org/2000/svg}'
def geodesic(a,b,t):
 # Move a to zero, interpolate the hyperbolic distance radially, then undo.
 w=(b-a)/(1-a.conjugate()*b)
 if abs(w)<1e-14:return a
 u=w/abs(w)*math.tanh(t*math.atanh(min(abs(w),1-1e-15)))
 return (u+a)/(1+a.conjugate()*u)
def render(svg):return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=ET.tostring(svg),output_width=907,output_height=907))).convert('RGBA')
files=sorted(root.glob('*.json'))
assert files, 'Missing generated proof artifacts'
for file in files:
 data=json.loads(file.read_text());name=file.stem;svg=ET.parse(root/f'{name}-structure.svg').getroot();arcs=render(svg);arcs.save(root/f'{name}-structure-cairo.png')
 assert svg.attrib['width']=='200mm' and svg.attrib['height']=='200mm'
 assert data['limited']['numeric']==0 and data['maximumBound']*100<=.01
 assert len(svg.findall(ns+'path'))==len(data['cells'])
 # Sample 96 points/edge using complex Möbius maps, not SVG circle centers/arcs.
 for path,cell in zip(svg.findall(ns+'path'),data['cells']):
  vertices=[complex(v['x'],v['y']) for v in cell['vertices']];points=[]
  for i,a in enumerate(vertices):
   b=vertices[(i+1)%len(vertices)]
   points.extend(geodesic(a,b,k/96) for k in range(96))
  path.attrib['d']='M'+'L'.join(f'{100*z.real} {100*z.imag}' for z in points)+'Z'
 dense=render(svg);dense.save(root/f'{name}-dense-cairo.png');error=max(ImageStat.Stat(ImageChops.difference(arcs,dense)).mean)
 assert error<1.5,(name,'SVG geodesic sweep disagrees with independent Möbius sampler',error)
 motif=render(ET.parse(root/f'{name}-motif.svg').getroot());motif.save(root/f'{name}-motif-cairo.png')
 ink=sum(1 for r,g,b,a in getattr(motif,'get_flattened_data',motif.getdata)() if a>128);assert ink>1000,(name,'no actual projected motif ink')
 # Beyond the disk must remain empty, even for peripheral polygons.
 pixels=arcs.load()
 for x,y in [(0,0),(906,0),(0,906),(906,906),(0,453),(906,453)]:assert pixels[x,y][3]<5,(name,'ink outside disk',x,y)
 print(f'{name}: {len(data["cells"])} cells; true arcs vs independent Möbius sampler error {error:.3f}/255; {ink} motif pixels; bound<=0.01mm',flush=True)
print('Headless diagnostics passed; UI/native/export integration is still pending.')
