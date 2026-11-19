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

tile_svg=ET.parse(root/'tile-editable.svg').getroot()
assert tile_svg.findall('.//{http://www.w3.org/2000/svg}clipPath')
assert not any('data-symmetry-structure' in node.attrib for node in tile_svg.iter())
assert not any('data-tile-outline' in node.attrib for node in tile_svg.iter())
tile_expanded=ET.parse(root/'tile-expanded.svg').getroot()
assert not tile_expanded.findall('.//{http://www.w3.org/2000/svg}clipPath')
assert not tile_expanded.findall('.//{http://www.w3.org/2000/svg}use')
cairosvg.svg2png(url=str(root/'tile-editable.svg'),write_to=str(root/'tile-external-cairo.png'),dpi=200)
for file in ['tile.png','tile-external-cairo.png']:
 with Image.open(root/file).convert('RGBA') as im:
  assert abs(im.width-round(100/25.4*200))<=1
  assert abs(im.height-round(80/25.4*200))<=1
  assert sum(1 for r,g,b,a in getattr(im,"get_flattened_data",im.getdata)() if a>128 and g>r)>1000,('Empty tile render',file)
  print('Curved hex tile render:',file,im.size,'with actual green ink')
tile_dxf=ezdxf.readfile(root/'tile.dxf')
assert tile_dxf.header['$INSUNITS']==4
tile_entities=list(tile_dxf.modelspace())
assert len(tile_entities)>20
assert all(e.dxftype()=='LWPOLYLINE' for e in tile_entities)
for entity in tile_entities:
 for point in entity.vertices_in_wcs():
  assert abs(point.z)<1e-9
  assert abs(point.x)<=50.02 and abs(point.y)<=40.02
print('Curved hex tile DXF:',len(tile_entities),'clipped 2D polylines in mm')
