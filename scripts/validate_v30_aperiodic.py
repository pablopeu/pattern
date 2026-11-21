#!/usr/bin/env python3
"""Independent CairoSVG/Pillow/ezdxf validation of finite substitution patches."""
from pathlib import Path
import io,json,xml.etree.ElementTree as ET
import cairosvg,ezdxf
from PIL import Image,ImageChops,ImageStat
root=Path('.runtime/aperiodic-exports')
for kind in ['penrose','hat','spectre']:
    name=f'aperiodic-{kind}'
    project=json.loads((root/f'{name}.json').read_text())
    source=project['patterns'][0]['sourceGeometry']
    assert len(source)==(0 if kind=='penrose' else 1)
    images=[]
    for mode in ['editable','expanded']:
        file=root/f'{name}-{mode}.svg'
        svg=ET.parse(file).getroot()
        assert svg.attrib['width']=='240mm' and svg.attrib['height']=='240mm'
        if kind!='penrose' or mode=='expanded':
            assert bool(svg.findall('.//{http://www.w3.org/2000/svg}use'))==(mode=='editable')
        image=Image.open(io.BytesIO(cairosvg.svg2png(url=str(file),output_width=907,output_height=907))).convert('RGBA')
        image.save(root/f'{name}-cairo-{mode}.png');images.append(image)
        pixels=getattr(image,'get_flattened_data',image.getdata)()
        assert sum(1 for r,g,b,a in pixels if a>240)>100000, (kind,'missing actual patch ink')
    error=ImageStat.Stat(ImageChops.difference(*images)).mean
    assert max(error)<2,(kind,'SVG editable/expanded mismatch',error)
    with Image.open(root/f'{name}.png') as image:
        assert image.size==(907,907) and abs(image.info['dpi'][0]-96)<0.1
        error_browser=ImageStat.Stat(ImageChops.difference(image.convert('RGBA'),images[0])).mean
        assert max(error_browser)<5,(kind,'browser/Cairo mismatch',error_browser)
    with Image.open(root/f'{name}.jpeg') as image:
        assert image.size==(907,907) and image.mode=='RGB' and abs(image.info['dpi'][0]-96)<0.1
    doc=ezdxf.readfile(root/f'{name}.dxf');entities=list(doc.modelspace())
    assert doc.header['$INSUNITS']==4 and len(entities)>30
    assert all(e.dxftype()=='LWPOLYLINE' for e in entities)
    assert all(abs(p.z)<1e-9 and abs(p.x)<=120.02 and abs(p.y)<=120.02 for e in entities for p in e.vertices_in_wcs())
    if kind!='penrose':
        assert project['patterns'][0]['generator']['version']==2
        for color in project['patterns'][0]['generator']['aperiodic']['palette']:
            rgb=tuple(int(color[k:k+2],16) for k in (1,3,5))
            pixels=getattr(images[0],'get_flattened_data',images[0].getdata)()
            assert sum(1 for r,g,b,a in pixels if a>240 and max(abs(v-w) for v,w in zip((r,g,b),rgb))<4)>100,(kind,'missing palette ink',color)
    print(f'{kind}: source{len(source)}, SVG max mean error{max(error):.3f}/255, PNG/JPEG96DPI, DXF2D/mm{len(entities)} contours',flush=True)
print('All3 finite aperiodic examples passed independent export validation.')
