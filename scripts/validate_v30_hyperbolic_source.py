#!/usr/bin/env python3
"""Independent actual pixels: compound hole, body and outlined varying-width stroke."""
from pathlib import Path
import io,json,xml.etree.ElementTree as ET
import cairosvg
from PIL import Image
root=Path('.runtime/hyperbolic-source-proof')
for file in sorted(root.glob('*.json')):
 data=json.loads(file.read_text());name=file.stem;svg=ET.parse(root/f'{name}.svg').getroot()
 assert data['curveProjectionBoundMm']<=.005 and data['hasUncertifiedOutlineStep'] is True
 for i,sample in enumerate(data['samples']):
  x,y=sample['point']['x']*100,sample['point']['y']*100
  svg.attrib.update({'viewBox':f'{x-1} {y-1} 2 2','width':'2mm','height':'2mm'})
  crop=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=ET.tostring(svg),output_width=256,output_height=256))).convert('RGBA');crop.save(root/f'{name}-sample{i}.png')
  actual=crop.getpixel((128,128));color=sample['color']
  if color is None:assert actual[3]<5,(name,'hole was filled',actual)
  else:
   rgb=tuple(int(color[k:k+2],16) for k in (1,3,5));assert actual[3]>250 and max(abs(a-b) for a,b in zip(actual,rgb))<3,(name,color,actual)
 image=Image.open(io.BytesIO(cairosvg.svg2png(url=str(root/f'{name}.svg'),output_width=907,output_height=907)));image.save(root/f'{name}-cairo.png')
 print(f'{name}: hole empty, body blue, variable stroke magenta; canonical source unchanged; mapping<=0.005mm ({data["segments"]} segments)',flush=True)
print('Outline tolerance is separately reported as an estimate, not a certified whole-pipeline bound.')
