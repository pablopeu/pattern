"""Independent CairoSVG raster and analytical probe locations (no JS mapper)."""
import json, math
from pathlib import Path
import cairosvg
from PIL import Image, ImageChops, ImageStat
root=Path('.runtime')
proof=json.loads((root/'artistic-disk-proof.json').read_text())
report=proof['report']; assert report['validity']=='ARTISTIC' and report['hyperbolicTessellation'] is False
assert report['numeric']['curveProjectionBoundMm']<=.005
cairosvg.svg2png(url=str(root/'artistic-disk-proof.svg'),write_to=str(root/'artistic-disk-cairo.png'),output_width=2048,output_height=2048)
a=Image.open(root/'artistic-disk-proof.png').convert('RGBA');b=Image.open(root/'artistic-disk-cairo.png').convert('RGBA')
m=report['source']['embedding']['matrix'];v=report['parameters'];scale=v['compression'];angle=v['angle'];cx=v['center']['x'];cy=v['center']['y']
def pixel(point):
 x,y=point;u=scale*(m[0]*x+m[2]*y+m[4]-cx);w=scale*(m[1]*x+m[3]*y+m[5]-cy)
 d=math.sqrt(1+u*u+w*w);x=(math.cos(angle)*u-math.sin(angle)*w)/d;y=(math.sin(angle)*u+math.cos(angle)*w)/d
 return round((x+1)*1024),round((y+1)*1024)
probes={'hole':((10,10),None),'body':((4,10),(59,130,246,255)),'boundary':((7.1,10),(17,17,17,255)),
 'thin-pressure':((5,16.6),(59,130,246,255)),'thick-pressure':((15,16.6),(255,0,255,255)),'outside-crop':((70,0),None)}
observed={}
for name,(point,expected) in probes.items():
 pos=pixel(point);values=[image.getpixel(pos) for image in [a,b]];observed[name]=values
 if expected is None: assert all(value[3]==0 for value in values),(name,values)
 else: assert all(max(abs(x-y) for x,y in zip(value,expected))<=1 for value in values),(name,values)
# Premultiply on white so RGB in transparent pixels does not affect the comparison.
white=Image.new('RGBA',a.size,'white');ar=Image.alpha_composite(white,a).convert('RGB');br=Image.alpha_composite(white,b).convert('RGB')
mean=sum(ImageStat.Stat(ImageChops.difference(ar,br)).mean)/3
assert mean<.5,mean
assert proof['sourceUnchanged'] and proof['preAbort'] and proof['activeAbort'] and proof['recovery']
print(json.dumps({'independentRenderer':'CairoSVG','meanError255':mean,'probes':observed,'projectionBoundMm':report['numeric']['curveProjectionBoundMm']}))
