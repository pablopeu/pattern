#!/usr/bin/env python3
"""Optional independent QA dependencies: ezdxf, cairosvg and Pillow (not app dependencies)."""
import json, pathlib, xml.etree.ElementTree as ET
import ezdxf, cairosvg
from PIL import Image
root=pathlib.Path('.runtime/exports')
expected=json.loads((root/'expected.json').read_text())
svg=ET.parse(root/'applied.svg').getroot()
assert not svg.findall('.//{http://www.w3.org/2000/svg}clipPath')
assert float(svg.attrib['width'].removesuffix('mm'))==expected['width']
cairosvg.svg2png(url=str(root/'applied.svg'),write_to=str(root/'external-cairo.png'),dpi=200)
for kind in ['png','jpeg']:
 with Image.open(root/('applied.'+kind)) as im:
  assert abs(im.width-round(expected['width']/25.4*200))<=1
  assert abs(im.height-round(expected['height']/25.4*200))<=1
  assert abs(im.info['dpi'][0]-200)<.1,(kind,im.info)
  print(kind,im.size,'DPI',im.info['dpi'])
with Image.open(root/'external-cairo.png') as im:
 assert abs(im.width-round(expected['width']/25.4*200))<=1
 print('CairoSVG independent render:',im.size)
doc=ezdxf.readfile(root/'applied.dxf')
assert doc.header['$INSUNITS']==4
entities=list(doc.modelspace())
assert entities and all(e.dxftype()=='LWPOLYLINE' for e in entities)
assert all(all(abs(p[2])<1e-9 for p in e.vertices_in_wcs()) for e in entities)
print('ezdxf independent parser:',len(entities),'2D polylines, unit mm')
print('All independent export checks passed.')
