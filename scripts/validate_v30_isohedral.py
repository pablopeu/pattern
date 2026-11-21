#!/usr/bin/env python3
"""CairoSVG/Pillow/ezdxf verification of all12 marked IH types."""
from pathlib import Path
import io, json, xml.etree.ElementTree as ET
import cairosvg, ezdxf
from PIL import Image, ImageChops, ImageStat

root = Path('.runtime/isohedral-exports')
types = [19, 35, 48, 60, 63, 65, 70, 75, 80, 87, 89, 92]
for kind in types:
    images = []
    for mode in ['editable', 'expanded']:
        file = root / f'IH{kind}-{mode}.svg'
        svg = ET.parse(file).getroot()
        assert svg.attrib['width'] == '180mm' and svg.attrib['height'] == '140mm'
        assert bool(svg.findall('.//{http://www.w3.org/2000/svg}use')) == (mode == 'editable')
        image = Image.open(io.BytesIO(cairosvg.svg2png(url=str(file), output_width=680, output_height=529))).convert('RGBA')
        image.save(root / f'IH{kind}-cairo-{mode}.png')
        pixels = getattr(image, 'get_flattened_data', image.getdata)()
        assert sum(1 for r,g,b,a in pixels if a>128 and r>g*1.25 and r>b*1.5) > 120, (kind, 'missing interior marks')
        images.append(image)
    error = ImageStat.Stat(ImageChops.difference(*images)).mean
    assert max(error) < 2, (kind, 'editable/expanded mismatch', error)
    with Image.open(root / f'IH{kind}.png') as image:
        assert image.size == (680,529) and abs(image.info['dpi'][0]-96)<0.1
        browser_error = ImageStat.Stat(ImageChops.difference(image.convert('RGBA'),images[0])).mean
        assert max(browser_error)<5, (kind,'browser/Cairo mismatch',browser_error)
    with Image.open(root / f'IH{kind}.jpeg') as image:
        assert image.size == (680,529) and image.mode=='RGB' and abs(image.info['dpi'][0]-96)<0.1
    doc=ezdxf.readfile(root / f'IH{kind}.dxf')
    entities=list(doc.modelspace())
    assert doc.header['$INSUNITS']==4 and len(entities)>10
    assert all(e.dxftype()=='LWPOLYLINE' for e in entities)
    assert all(abs(p.z)<1e-9 and abs(p.x)<=90.02 and abs(p.y)<=70.02 for e in entities for p in e.vertices_in_wcs())
    project=json.loads((root / f'IH{kind}.json').read_text())
    assert len(project['patterns'][0]['sourceGeometry'])==2
    print(f'IH{kind}: actual interior ink, SVG mean error {max(error):.3f}/255, PNG/JPEG96DPI, {len(entities)} DXF polylines')
print('All12 marked constructions passed independent export validation.')
