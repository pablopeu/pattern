"""Independent v2.2 SVG/raster/DXF geometry and physical-unit verification."""
import json, math, pathlib, xml.etree.ElementTree as ET
import cairosvg, ezdxf
from PIL import Image, ImageChops, ImageStat

ROOT=pathlib.Path('.runtime/exports/v22')
SCENARIOS=json.loads((ROOT/'manifest.json').read_text())
NS='{http://www.w3.org/2000/svg}'

def rgb(file):
    with Image.open(file) as source:
        rgba=source.convert('RGBA')
        return Image.alpha_composite(Image.new('RGBA',rgba.size,'white'),rgba).convert('RGB')

def color(kind,pixel):
    r,g,b=pixel
    return {'blue':b>r+25 and b>g+20,'green':g>r+20 and g>b+15,
            'purple':r>90 and b>r+10 and g<150 and b>g+40,
            'coral':r>g+35 and r>b+40,'teal':g>r+30 and g>b+15,
            'brown':r>g+8 and g>b+15,'white':min(r,g,b)>240}[kind]

def diff_metrics(a,b):
    assert a.size==b.size,(a.size,b.size)
    delta=ImageChops.difference(a,b)
    channels=delta.split()
    maximum=ImageChops.lighter(ImageChops.lighter(channels[0],channels[1]),channels[2])
    histogram=maximum.histogram()
    return {'mean':sum(ImageStat.Stat(delta).mean)/3,'fraction_above_32':sum(histogram[33:])/(a.width*a.height)}

def distance_segment(point,a,b):
    dx=b[0]-a[0];dy=b[1]-a[1]
    t=max(0,min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy))) if dx*dx+dy*dy else 0
    return math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)

reports=[]
for scenario in SCENARIOS:
    name=scenario['name'];bounds=scenario['bounds'];dpi=scenario['dpi'];tolerance=scenario['tolerance']
    size=(round(bounds['width']/25.4*dpi),round(bounds['height']/25.4*dpi))
    for representation in ['editable','expanded']:
        file=ROOT/f'{name}-{representation}.svg'
        svg=ET.parse(file).getroot()
        assert abs(float(svg.attrib['width'].removesuffix('mm'))-bounds['width'])<1e-9
        assert abs(float(svg.attrib['height'].removesuffix('mm'))-bounds['height'])<1e-9
        assert not any('data-symmetry-structure' in node.attrib for node in svg.iter())
        assert not any('data-stroke-error' in node.attrib for node in svg.iter())
        if representation=='expanded':
            assert not svg.findall('.//'+NS+'use'),name
            assert not svg.findall('.//'+NS+'clipPath'),name
        cairosvg.svg2png(url=str(file),write_to=str(ROOT/f'{name}-cairo-{representation}.png'),dpi=dpi,output_width=size[0],output_height=size[1])
    for ext in ['png','jpeg']:
        with Image.open(ROOT/f'{name}.{ext}') as raster:
            assert raster.size==size,(name,ext,raster.size,size)
            assert abs(raster.info['dpi'][0]-dpi)<.1,(name,ext,raster.info)
    images={key:rgb(ROOT/file) for key,file in {
        'chrome':f'{name}.png','jpeg':f'{name}.jpeg',
        'cairo_editable':f'{name}-cairo-editable.png','cairo_expanded':f'{name}-cairo-expanded.png'}.items()}
    comparisons={key:diff_metrics(images['cairo_editable'],images[key]) for key in ['chrome','cairo_expanded']}
    for key,metrics in comparisons.items():
        assert metrics['mean']<1.25,(name,key,metrics)
        assert metrics['fraction_above_32']<.018,(name,key,metrics)
    for source,image in images.items():
        for check in scenario['checks']:
            point=check['point'];px=min(image.width-1,max(0,round((point['x']-bounds['x'])/bounds['width']*image.width)))
            py=min(image.height-1,max(0,round((point['y']-bounds['y'])/bounds['height']*image.height)))
            value=image.getpixel((px,py))
            assert color(check['kind'],value),(name,source,check,value,(px,py))
    for kind in scenario['colors']:
        count=sum(color(kind,pixel) for pixel in getattr(images['chrome'],'get_flattened_data',images['chrome'].getdata)())
        assert count>100,(name,'missing actual ink',kind,count)
    doc=ezdxf.readfile(ROOT/f'{name}.dxf');assert doc.header['$INSUNITS']==4
    entities=list(doc.modelspace());assert entities,name
    clearance=math.inf
    for entity in entities:
        assert entity.dxftype()=='LWPOLYLINE',(name,entity.dxftype())
        points=[(v.x,v.y) for v in entity.vertices_in_wcs()]
        assert len(points)>=2
        assert all(abs(v.z)<1e-9 for v in entity.vertices_in_wcs())
        assert all(bounds['x']-tolerance<=x<=bounds['x']+bounds['width']+tolerance and -bounds['y']-bounds['height']-tolerance<=y<=-bounds['y']+tolerance for x,y in points),(name,'outside crop')
        for i in range(len(points) if entity.closed else len(points)-1):
            clearance=min(clearance,distance_segment((0,0),points[i],points[(i+1)%len(points)]))
    if 'holeClearance' in scenario:
        assert clearance>scenario['holeClearance'],(name,'DXF crosses hole',clearance)
    report={'scenario':name,'pixels':size,'dxf_polylines':len(entities),'comparisons':comparisons}
    reports.append(report);print(json.dumps(report))
(ROOT/'validation-report.json').write_text(json.dumps(reports,indent=2))
print(f'All {len(reports)} v2.2 independent export scenarios passed.')
