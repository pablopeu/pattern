#!/usr/bin/env python3
"""CairoSVG/Pillow/ezdxf verification of original figurative examples."""
from pathlib import Path
import io, json, math, xml.etree.ElementTree as ET
import cairosvg, ezdxf
from PIL import Image, ImageChops, ImageStat

root = Path('.runtime/figurative-exports')
types = ['figurative-fish','figurative-bird','figurative-reptile','figurative-abstract']
for kind in types:
    images = []
    for mode in ['editable', 'expanded']:
        file = root / f'{kind}-{mode}.svg'
        svg = ET.parse(file).getroot()
        assert svg.attrib['width'] == '180mm' and svg.attrib['height'] == '140mm'
        assert bool(svg.findall('.//{http://www.w3.org/2000/svg}use')) == (mode == 'editable')
        image = Image.open(io.BytesIO(cairosvg.svg2png(url=str(file), output_width=680, output_height=529))).convert('RGBA')
        image.save(root / f'{kind}-cairo-{mode}.png')
        pixels = getattr(image, 'get_flattened_data', image.getdata)()
        assert sum(1 for r,g,b,a in pixels if a>128 and r>220 and g>210 and b>170) > 120, (kind, 'missing light details')
        images.append(image)
    error = ImageStat.Stat(ImageChops.difference(*images)).mean
    assert max(error) < 2, (kind, 'editable/expanded mismatch', error)
    with Image.open(root / f'{kind}.png') as image:
        assert image.size == (680,529) and abs(image.info['dpi'][0]-96)<0.1
        browser_error = ImageStat.Stat(ImageChops.difference(image.convert('RGBA'),images[0])).mean
        assert max(browser_error)<5, (kind,'browser/Cairo mismatch',browser_error)
    with Image.open(root / f'{kind}.jpeg') as image:
        assert image.size == (680,529) and image.mode=='RGB' and abs(image.info['dpi'][0]-96)<0.1
    doc=ezdxf.readfile(root / f'{kind}.dxf')
    entities=list(doc.modelspace())
    assert doc.header['$INSUNITS']==4 and len(entities)>10
    assert all(e.dxftype()=='LWPOLYLINE' for e in entities)
    assert all(abs(p.z)<1e-9 and abs(p.x)<=90.02 and abs(p.y)<=70.02 for e in entities for p in e.vertices_in_wcs())
    project=json.loads((root / f'{kind}.json').read_text())
    assert len(project['patterns'][0]['sourceGeometry'])=={'figurative-fish':8,'figurative-bird':7,'figurative-reptile':8,'figurative-abstract':3}[kind]
    # Tile the exported transparent color cell, then compare against a direct view.
    ns='http://www.w3.org/2000/svg'
    cell=ET.parse(root / f'{kind}-lattice.svg').getroot()
    a,b,c,d,_,_=json.loads((root / f'{kind}-basis.json').read_text())
    mosaic=ET.Element(f'{{{ns}}}svg', {'viewBox':'-90 -70 180 140','width':'180mm','height':'140mm'})
    defs=ET.SubElement(mosaic,f'{{{ns}}}defs')
    group=ET.SubElement(defs,f'{{{ns}}}g', {'id':'exported-color-cell'})
    for child in list(cell): group.append(child)
    determinant=a*d-b*c
    corners=[((d*x-c*y)/determinant,(-b*x+a*y)/determinant) for x in (-90,90) for y in (-70,70)]
    irange=range(math.floor(min(p[0] for p in corners)),math.ceil(max(p[0] for p in corners)))
    jrange=range(math.floor(min(p[1] for p in corners)),math.ceil(max(p[1] for p in corners)))
    for i in irange:
        for j in jrange:
            ET.SubElement(mosaic,f'{{{ns}}}use', {
                '{http://www.w3.org/1999/xlink}href':'#exported-color-cell',
                'transform':f'translate({i*a+j*c} {i*b+j*d})'})
    mosaic_bytes=ET.tostring(mosaic)
    (root / f'{kind}-mosaic.svg').write_bytes(mosaic_bytes)
    tiled=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=mosaic_bytes,output_width=680,output_height=529))).convert('RGBA')
    tiled.save(root / f'{kind}-mosaic.png')
    seam_error=ImageStat.Stat(ImageChops.difference(tiled,images[0])).mean
    assert max(seam_error)<3, (kind,'color-cell repetition mismatch',seam_error)
    for color in project['patterns'][0]['tiling']['colors']['palette']:
        rgb=tuple(int(color[k:k+2],16) for k in (1,3,5))
        pixels=getattr(images[0],'get_flattened_data',images[0].getdata)()
        assert sum(1 for r,g,b,a in pixels if a>240 and max(abs(v-w) for v,w in zip((r,g,b),rgb))<4)>100, (kind,'missing palette class',color)
    print(f'{kind}: actual interior ink, SVG mean error {max(error):.3f}/255, PNG/JPEG96DPI, {len(entities)} DXF polylines')
    print(f'  repeated color cell vs direct view: {max(seam_error):.3f}/255')
print('All4 figurative examples passed independent export validation.')
