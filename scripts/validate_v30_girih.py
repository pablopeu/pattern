#!/usr/bin/env python3
"""Independent raster/geometry proof of Girih bands, overpasses and empty underpass gaps."""
from pathlib import Path
import io,json,xml.etree.ElementTree as ET
import cairosvg,ezdxf
from PIL import Image,ImageChops,ImageStat
root=Path('.runtime/girih-exports')
for kind,count in [('rosette',1),('rhombus-grid',0)]:
 name=f'girih-{kind}';images=[]
 for mode in ['editable','expanded']:
  file=root/f'{name}-{mode}.svg';svg=ET.parse(file).getroot()
  assert svg.attrib['width']=='240mm' and svg.attrib['height']=='240mm'
  image=Image.open(io.BytesIO(cairosvg.svg2png(url=str(file),output_width=907,output_height=907))).convert('RGBA');image.save(root/f'{name}-cairo-{mode}.png');images.append(image)
  pixels=getattr(image,'get_flattened_data',image.getdata)();assert sum(1 for r,g,b,a in pixels if a>128)>3000,(kind,'no actual band ink')
  samples=json.loads((root/f'{name}-crossings.json').read_text())
  for i,sample in enumerate(samples):
   x,y=sample['point']['x'],sample['point']['y'];svg.attrib.update({'viewBox':f'{x-2} {y-2} 4 4','width':'4mm','height':'4mm'})
   crop=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=ET.tostring(svg),output_width=256,output_height=256))).convert('RGBA')
   expected=tuple(int(sample['color'][k:k+2],16) for k in (1,3,5));actual=crop.getpixel((128,128))
   assert actual[3]>250 and max(abs(a-b) for a,b in zip(actual,expected))<3,(kind,mode,i,'overpass mismatch',actual,expected)
   gap=sample['gap'];pixel=crop.getpixel((int((gap['x']-x+2)*64),int((gap['y']-y+2)*64)))
   assert pixel[3]<12,(kind,mode,i,'underpass gap filled',pixel)
   crop.save(root/f'{name}-{mode}-crossing{i}.png')
 error=ImageStat.Stat(ImageChops.difference(*images)).mean;assert max(error)<2,(kind,'editable/expanded mismatch',error)
 with Image.open(root/f'{name}.png') as image:
  assert image.size==(907,907) and abs(image.info['dpi'][0]-96)<.1
  browser_error=ImageStat.Stat(ImageChops.difference(image.convert('RGBA'),images[0])).mean;assert max(browser_error)<5,(kind,'browser/Cairo mismatch',browser_error)
 with Image.open(root/f'{name}.jpeg') as image:assert image.size==(907,907) and image.mode=='RGB' and abs(image.info['dpi'][0]-96)<.1
 doc=ezdxf.readfile(root/f'{name}.dxf');entities=list(doc.modelspace());assert doc.header['$INSUNITS']==4 and len(entities)>20
 assert all(e.dxftype()=='LWPOLYLINE' for e in entities)
 assert all(abs(p.z)<1e-9 and abs(p.x)<=120.02 and abs(p.y)<=120.02 for e in entities for p in e.vertices_in_wcs())
 project=json.loads((root/f'{name}.json').read_text());assert len(project['patterns'][0]['sourceGeometry'])==count;assert project['patterns'][0]['generator']['version']==3
 print(f'{kind}: source{count},5 actual overpasses/gaps in both SVGs; mean error{max(error):.3f}/255; raster96DPI, DXF2D/mm{len(entities)} contours',flush=True)
print('Both Girih examples passed independent crossing/export validation.')
