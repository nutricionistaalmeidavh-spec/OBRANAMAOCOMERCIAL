#!/usr/bin/env python3
"""Reproducible, royalty-free cinematic hero from ACTUAL WppProspector QA captures.
Build-time only: Pillow. No stock photos, invented metrics, or runtime CDN.
Usage: python scripts/generate-wppprospector-hero.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
import math, random

ROOT=Path(__file__).resolve().parents[1]
MEDIA=ROOT/'public/wppprospector/media'
W,H=1600,950
random.seed(21)

def src(name):
    return Image.open(MEDIA/name).convert('RGB')

def font(size,bold=True):
    names=('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
           '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    try:return ImageFont.truetype(names[0 if bold else 1],size)
    except OSError:return ImageFont.load_default()

def glow(canvas,cx,cy,rx,ry,color,strength=1):
    layer=Image.new('RGBA',(W,H))
    for y in range(max(0,round(cy-ry*2)),min(H,round(cy+ry*2))):
        for x in range(max(0,round(cx-rx*2)),min(W,round(cx+rx*2))):
            v=math.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2)*1.8)
            alpha=int(116*v*strength)
            if alpha:layer.putpixel((x,y),(*color,alpha))
    return Image.alpha_composite(canvas,layer)

def bezier(p0,p1,p2,p3,n=260):
    result=[]
    for i in range(n+1):
        t=i/n
        a=1-t
        result.append((int(a*a*a*p0[0]+3*a*a*t*p1[0]+3*a*t*t*p2[0]+t*t*t*p3[0]),
                       int(a*a*a*p0[1]+3*a*a*t*p1[1]+3*a*t*t*p2[1]+t*t*t*p3[1])))
    return result

bg=Image.new('RGB',(W,H))
p=bg.load()
for y in range(H):
    for x in range(W):
        a=math.exp(-((x-770)/600)**2-((y-400)/400)**2)
        b=math.exp(-((x-540)/550)**2-((y-740)/400)**2)
        c=math.exp(-((x-1240)/450)**2-((y-340)/350)**2)
        p[x,y]=(5+int(a*13+b*11+c*2),8+int(a*6+b*2+c*10),18+int(a*32+b*22+c*22))
canvas=bg.convert('RGBA')
canvas=glow(canvas,850,630,560,260,(86,36,191),.7)
canvas=glow(canvas,1120,455,330,250,(28,140,165),.45)
canvas=glow(canvas,260,400,270,240,(98,51,175),.4)
floor=Image.new('RGBA',(W,H)); d=ImageDraw.Draw(floor)
for y in range(660,940,35):d.line([(0,y),(W,y)],fill=(85,96,170,int(32*(y-650)/300)),width=1)
for x in range(-750,2350,118):d.line([(800,650),(x,940)],fill=(65,87,167,27),width=1)
canvas=Image.alpha_composite(canvas,floor)

orbit=bezier((90,600),(220,835),(1310,860),(1510,470))+bezier((1510,470),(1640,180),(1060,160),(780,345))
light=Image.new('RGBA',(W,H));d=ImageDraw.Draw(light)
for offset,alpha in [(-16,28),(0,224),(9,46)]:
    d.line([(x,y+offset) for x,y in orbit],fill=(91,219,231,alpha),width=4 if not offset else 2,joint='curve')
canvas=Image.alpha_composite(canvas,light.filter(ImageFilter.GaussianBlur(17)))
canvas=Image.alpha_composite(canvas,light)
dust=Image.new('RGBA',(W,H));d=ImageDraw.Draw(dust)
for _ in range(145):
    x=random.randint(90,1510);y=random.randint(80,840);r=random.choice([1,1,1,2,2,3])
    d.ellipse((x-r,y-r,x+r,y+r),fill=(140,194,244,random.randint(28,100)))
canvas=Image.alpha_composite(canvas,dust)

def composite_layer(drawer):
    global canvas
    layer=Image.new('RGBA',(W,H))
    drawer(ImageDraw.Draw(layer),layer)
    canvas=Image.alpha_composite(canvas,layer)

# Laptop shadow and outer aluminum chassis
s=Image.new('RGBA',(W,H));d=ImageDraw.Draw(s)
d.rounded_rectangle((246,190,1336,809),radius=35,fill=(0,0,0,210))
canvas=Image.alpha_composite(canvas,s.filter(ImageFilter.GaussianBlur(57)))
def lid(d,layer):
    d.polygon([(304,180),(1264,154),(1300,725),(335,744)],fill=(79,75,93,255))
    d.line([(304,180),(1264,154),(1300,725),(335,744),(304,180)],fill=(184,168,209,245),width=5)
    d.polygon([(313,188),(1255,163),(1287,713),(343,732)],fill=(11,11,18,255))
composite_layer(lid)

screen=ImageEnhance.Brightness(src('painel-real.webp')).enhance(.91).resize((914,512),Image.Resampling.LANCZOS)
screen_layer=Image.new('RGBA',(W,H))
screen_layer.paste(screen,(352,201))
screen_layer=screen_layer.rotate(1.5,Image.Resampling.BICUBIC,center=(800,456))
mask=Image.new('L',(W,H));d=ImageDraw.Draw(mask)
d.polygon([(337,204),(1239,180),(1264,694),(364,714)],fill=255)
screen_layer.putalpha(mask)
canvas=Image.alpha_composite(canvas,screen_layer)

def laptop_base(d,layer):
    d.line([(337,204),(1239,180),(1264,694),(364,714),(337,204)],fill=(111,99,137,255),width=5)
    d.ellipse((787,176,794,183),fill=(91,66,158,255))
    d.polygon([(335,742),(1294,722),(1425,845),(194,869)],fill=(86,88,101,255))
    d.polygon([(342,744),(1292,729),(1404,838),(211,859)],fill=(25,26,37,255))
    d.line([(197,870),(1425,845)],fill=(156,157,173,255),width=7)
    d.line([(215,856),(1404,837)],fill=(79,82,96,255),width=4)
    for row in range(5):
        y=762+row*13;start=411-row*14;end=1215+row*20
        for j in range(18):
            x=start+j*(end-start)/18
            ky=y-int((x-400)/900*8);ww=30+row*3
            d.polygon([(x,ky),(x+ww,ky-1),(x+ww+5,ky+7),(x+4,ky+8)],fill=(38,39,51,235))
    d.rounded_rectangle((699,818,898,848),radius=8,outline=(92,94,109,198),width=2)
composite_layer(laptop_base)

s=Image.new('RGBA',(W,H));d=ImageDraw.Draw(s)
d.rounded_rectangle((1154,298,1420,870),radius=55,fill=(0,0,0,245))
canvas=Image.alpha_composite(canvas,s.filter(ImageFilter.GaussianBlur(30)))
phone=Image.new('RGBA',(W,H));d=ImageDraw.Draw(phone)
d.rounded_rectangle((1156,272,1436,866),radius=49,fill=(41,41,55,255),outline=(154,152,164,255),width=6)
d.rounded_rectangle((1167,283,1425,853),radius=40,fill=(5,5,10,255))
mobile=src('kanban-mobile-real.webp').resize((250,560),Image.Resampling.LANCZOS)
mask=Image.new('L',(250,560));md=ImageDraw.Draw(mask)
md.rounded_rectangle((0,0,249,559),radius=31,fill=255)
m=Image.new('RGBA',(250,560));m.paste(mobile,(0,0));m.putalpha(mask)
phone.alpha_composite(m,(1172,287));d=ImageDraw.Draw(phone)
d.rounded_rectangle((1264,282,1331,297),radius=8,fill=(4,5,11,255))
d.rounded_rectangle((1257,856,1339,859),radius=2,fill=(150,142,156,225))
canvas=Image.alpha_composite(canvas,phone)

def card(x,y,w,h,name,title,tag):
    global canvas
    shadow=Image.new('RGBA',(W,H));d=ImageDraw.Draw(shadow)
    d.rounded_rectangle((x+6,y+11,x+w+6,y+h+11),radius=22,fill=(0,0,0,210))
    canvas=Image.alpha_composite(canvas,shadow.filter(ImageFilter.GaussianBlur(19)))
    layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer)
    d.rounded_rectangle((x,y,x+w,y+h),radius=23,fill=(23,27,43,239),outline=(81,182,197,214),width=2)
    d.rounded_rectangle((x+6,y+6,x+w-6,y+h-6),radius=18,outline=(167,220,243,45),width=1)
    d.text((x+19,y+13),tag,font=font(13),fill=(97,213,232,245))
    d.text((x+19,y+36),title,font=font(19),fill=(239,247,255,255))
    sw,sh=w-32,h-79
    shot=src(name).resize((sw,sh),Image.Resampling.LANCZOS)
    m=Image.new('L',(sw,sh));md=ImageDraw.Draw(m);md.rounded_rectangle((0,0,sw-1,sh-1),radius=8,fill=255)
    im=Image.new('RGBA',(sw,sh));im.paste(shot,(0,0));im.putalpha(m)
    layer.alpha_composite(im,(x+16,y+67))
    canvas=Image.alpha_composite(canvas,layer)
card(65,270,288,195,'leads-real.webp','Gestão de leads','CONTATOS')
card(1292,102,255,188,'inteligencia-real.webp','Regras e IA','OPCIONAL')
card(77,622,260,180,'kanban-real.webp','Funil de vendas','OPORTUNIDADES')
front=Image.new('RGBA',(W,H));d=ImageDraw.Draw(front)
d.line(bezier((70,650),(310,820),(840,935),(1482,554)),fill=(148,98,255,165),width=3)
canvas=Image.alpha_composite(canvas,front.filter(ImageFilter.GaussianBlur(15)))
canvas=Image.alpha_composite(canvas,front)

# Slight vignette, no artificial dashboard values or customer data.
v=Image.new('RGBA',(W,H))
pixels=v.load()
for y in range(H):
    for x in range(W):
        t=min(1.,min(x,W-1-x)/W*9,min(y,H-1-y)/H*10)
        a=int(90*(1-t))
        if a:pixels[x,y]=(5,5,13,a)
canvas=Image.alpha_composite(canvas,v)
out=MEDIA/'hero-showcase-real.webp'
canvas.convert('RGB').save(out,'WEBP',quality=87,method=6)
mobile=canvas.crop((300,0,1490,950)).convert('RGB').resize((950,760),Image.Resampling.LANCZOS)
mobile_out=MEDIA/'hero-showcase-mobile-real.webp'
mobile.save(mobile_out,'WEBP',quality=86,method=6)
assert out.stat().st_size>25000 and mobile_out.stat().st_size>20000
print('Cinematic heroes generated from real QA captures:',out,out.stat().st_size,mobile_out,mobile_out.stat().st_size)
