#!/usr/bin/env python3
"""Independent QA: CairoSVG, Pillow, ezdxf; no runtime dependency."""
import json, pathlib, io, xml.etree.ElementTree as ET
import cairosvg, ezdxf
from PIL import Image, ImageChops, ImageStat

root = pathlib.Path('.runtime/v30-exports')
manifest = json.loads((root / 'manifest.json').read_text())
for row in manifest['artifacts']:
    name = row['id']
    images = []
    for kind in ['editable', 'expanded']:
        file = root / f'{name}-{kind}.svg'
        svg = ET.parse(file).getroot()
        assert svg.attrib['width'] == '180mm'
        assert svg.attrib['height'] == '180mm'
        uses = svg.findall('.//{http://www.w3.org/2000/svg}use')
        assert bool(uses) == (kind == 'editable')
        assert 'FINITE_NONPERIODIC' in file.read_text()
        data = cairosvg.svg2png(url=str(file), output_width=850, output_height=850)
        im = Image.open(io.BytesIO(data)).convert('RGBA')
        im.save(root / f'{name}-cairo-{kind}.png')
        assert sum(1 for p in getattr(im, "get_flattened_data", im.getdata)() if p[3] > 128) > 8000, (name, 'empty')
        images.append(im)
    # Editable use/defs and expanded physical contours must describe the same ink.
    error = ImageStat.Stat(ImageChops.difference(*images)).mean
    assert max(error) < 2, (name, 'representations differ', error)
    palette = [tuple(bytes.fromhex(c[1:])) for c in row['palette']]
    pixels = list(getattr(images[0], "get_flattened_data", images[0].getdata)())
    colors = sum(sum(1 for p in pixels if p[3] > 200 and max(abs(p[i]-c[i]) for i in range(3)) < 5) > 20
                 for c in palette)
    assert colors >= 2, (name, 'lost level palette', colors)
    with Image.open(root / f'{name}.png') as im:
        assert im.size == (850, 850), (name, im.size)
        assert abs(im.info['dpi'][0] - 120) < 0.1
        error_browser = ImageStat.Stat(ImageChops.difference(im.convert('RGBA'), images[0])).mean
        assert max(error_browser) < 5, (name, 'browser/Cairo differ', error_browser)
    with Image.open(root / f'{name}.jpeg') as im:
        assert im.size == (850, 850) and im.mode == 'RGB'
        assert abs(im.info['dpi'][0] - 120) < 0.1
    dxf = ezdxf.readfile(root / f'{name}.dxf')
    entities = list(dxf.modelspace())
    assert dxf.header['$INSUNITS'] == 4 and len(entities) > 50
    assert all(e.dxftype() == 'LWPOLYLINE' for e in entities)
    assert all(abs(p.z) < 1e-9 for e in entities for p in e.vertices_in_wcs())
    assert all(abs(p.x) <= 90.02 and abs(p.y) <= 90.02 for e in entities for p in e.vertices_in_wcs())
    project = json.loads((root / f'{name}.json').read_text())
    assert project['schemaVersion'] == 5 and project['metadata']['example']['artwork'] == 'original'
    print(name, row['placementCount'], 'placements;', len(entities), 'DXF polylines; raster error', error)
print('Independent composition checks passed:', len(manifest['artifacts']), 'original examples.')
