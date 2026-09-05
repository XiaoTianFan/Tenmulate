"""Original Philippe-Chatrier-informed clay arena, Blender 5.2 / metres / Z-up.

Only run in the dedicated project Blender session: this rebuilds its whole scene.
Parameter/provenance files distinguish published evidence from visual estimates.
"""
import bisect
import json
import math
import runpy
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/blender'))
from venue_mesh import Batch, material, linear

SOURCE=ROOT/'assets/venues/clay-sunset-arena'
BUILD=ROOT/'artifacts/venue-build/clay-sunset-arena'
BUILD.mkdir(parents=True,exist_ok=True)
(SOURCE/'textures').mkdir(exist_ok=True)
D=json.loads((SOURCE/'design.json').read_text())
B,C,P,R=D['bowl'],D['court'],D['perimeter'],D['roof']
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections): bpy.data.collections.remove(col)
bpy.data.orphans_purge(do_recursive=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1
scene['venueId']=D['id']
scene['sourceVersion']=D['version']
scene['designNotes']=D['description']


def collection(name):
    col=bpy.data.collections.new(name)
    scene.collection.children.link(col)
    return col


architecture=collection('01 • Rectilinear limestone bowl and hospitality')
seating=collection('02 • Linked pale timber seats')
roof=collection('03 • Nested roof wings, rails and fixed canopies')
court=collection('04 • Clay court, padded walls and equipment')
anchors=collection('05 • Runtime registration and clearance anchors')
presentation=collection('06 • Review cameras and lights — not exported')
stone=material('Warm limestone precast',D['palette']['limestone'],.9)
riser=material('Terrace riser shadow','#74776f',.94)
cream=material('Ivory concrete fascias',D['palette']['fascia'],.83)
steel=material('Warm silver steel','#a9afa9',.45,.6)
dark=material('Structural charcoal','#303c38',.63,.45)
green=material('Forest green court padding',D['palette']['wall'],.9)
white=material('Off-white line tapes and wordmarks','#f3f0df',.83)
netmat=material('Dark woven net','#262c27',.95)
membrane=material('Ivory tensile roof membrane',D['palette']['roof'],.78)
glass=material('Hospitality blue-grey glass','#49605d',.22,.3)
balustrade=material('Clear green-edge balustrade glass','#b9d1c7',.14)
balustrade.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.15
balustrade.surface_render_method='DITHERED'
balustrade.use_backface_culling=False
lamp=material('Court fixture diffuser','#fff4dc',.4)
lamp.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(*linear('#f2eee1'),1)
lamp.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.65


def image_material(mat,name,pixels,space='sRGB'):
    height,width=pixels.shape[:2]
    image=bpy.data.images.new(name,width=width,height=height)
    image.colorspace_settings.name=space
    image.pixels.foreach_set(pixels.astype(np.float32).ravel())
    image.filepath_raw=str(SOURCE/'textures'/f'{name}.png')
    image.file_format='PNG'
    image.save()
    node=mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image=image
    return node


# Original relightable clay grain, no photographic court or baked sunlight.
rng=np.random.default_rng(24701)
size=1024
yy,xx=np.mgrid[0:size,0:size]/size
grain=rng.normal(0,1,(size,size))
clay_rgb=np.array([int(C['clay'][i:i+2],16)/255 for i in (1,3,5)])
pixels=np.ones((size,size,4))
variation=.014*grain+.0015*np.sin(xx*98+np.sin(yy*17)*2)+.0008*np.sin(yy*470)
pixels[:,:,:3]=np.clip(clay_rgb[None,None,:]+variation[:,:,None],0,1)
claymat=material('Original rolled terracotta clay',C['clay'],.98)
albedo=image_material(claymat,'clay-grain-albedo',pixels)
claymat.node_tree.links.new(albedo.outputs['Color'],claymat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
pixels[:,:,:3]=np.clip(.93+grain[:,:,None]*.015,.85,1)
rough=image_material(claymat,'clay-grain-roughness',pixels,'Non-Color')
claymat.node_tree.links.new(rough.outputs['Color'],claymat.node_tree.nodes['Principled BSDF'].inputs['Roughness'])
gy,gx=np.gradient(grain)
norm=np.dstack((-gx*.12,-gy*.12,np.ones_like(grain)))
norm/=np.linalg.norm(norm,axis=2)[:,:,None]
pixels[:,:,:3]=norm*.5+.5
normal=image_material(claymat,'clay-grain-normal',pixels,'Non-Color')
normalmap=claymat.node_tree.nodes.new('ShaderNodeNormalMap')
normalmap.inputs['Strength'].default_value=.24
claymat.node_tree.links.new(normal.outputs['Color'],normalmap.inputs['Color'])
claymat.node_tree.links.new(normalmap.outputs['Normal'],claymat.node_tree.nodes['Principled BSDF'].inputs['Normal'])

# One shared ash-grain map, four natural seating shades, linked curved seat shells.
pixels=np.ones((512,128,4))
wood_rng=np.random.default_rng(713)
grainline=wood_rng.normal(0,.014,(1,128,1))
pixels[:,:,:3]=np.clip(.79+grainline+wood_rng.normal(0,.007,(512,128,1)),0,1)
seat_mats=[]
for i,color in enumerate(D['palette']['timberSeats']):
    mat=material(f'Laminated ash seating • {i+1}',color,.68)
    tex=image_material(mat,f'ash-grain-{i+1}',pixels*np.array([*[int(color[j:j+2],16)/255/.79 for j in (1,3,5)],1]))
    mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    seat_mats.append(mat)

# Existing CC0 normal/roughness detail is reused, not downloaded again.
for channel,suffix in [('Normal','nor_gl'),('Roughness','arm')]:
    node=stone.node_tree.nodes.new('ShaderNodeTexImage')
    node.image=bpy.data.images.load(str(ROOT/f'assets/venues/hard-open-arena/textures/brushed_concrete_{suffix}_1k.jpg'))
    node.image.colorspace_settings.name='Non-Color'
    if channel=='Normal':
        conv=stone.node_tree.nodes.new('ShaderNodeNormalMap')
        conv.inputs['Strength'].default_value=.2
        stone.node_tree.links.new(node.outputs['Color'],conv.inputs['Color'])
        stone.node_tree.links.new(conv.outputs['Normal'],stone.node_tree.nodes['Principled BSDF'].inputs['Normal'])
    else:
        sep=stone.node_tree.nodes.new('ShaderNodeSeparateColor')
        stone.node_tree.links.new(node.outputs['Color'],sep.inputs['Color'])
        stone.node_tree.links.new(sep.outputs['Green'],stone.node_tree.nodes['Principled BSDF'].inputs['Roughness'])

PATHS={}


def path(offset):
    if offset not in PATHS:
        x,y=B['innerHalfWidth']+offset,B['innerHalfLength']+offset
        cut=B['cornerCut']+offset*.4
        pts=[Vector(v) for v in [(x,y-cut),(x-cut,y),(-x+cut,y),(-x,y-cut),(-x,-y+cut),(-x+cut,-y),(x-cut,-y),(x,-y+cut),(x,y-cut)]]
        lengths=[0.]
        for a,b in zip(pts,pts[1:]): lengths.append(lengths[-1]+(b-a).length)
        PATHS[offset]=(pts,lengths)
    return PATHS[offset]


def point(offset,fraction):
    pts,lengths=path(offset)
    distance=(fraction%1)*lengths[-1]
    i=min(len(pts)-2,bisect.bisect_right(lengths,distance)-1)
    return pts[i].lerp(pts[i+1],(distance-lengths[i])/(lengths[i+1]-lengths[i]))


def strip(batch,inner,outer,z1,z2=None,start=0,end=1,count=280):
    z2=z1 if z2 is None else z2
    steps=max(1,round(count*(end-start)))
    for i in range(steps):
        a,b=start+(end-start)*i/steps,start+(end-start)*(i+1)/steps
        p,q,r,s=point(inner,a),point(outer,a),point(outer,b),point(inner,b)
        batch.face([(p.x,p.y,z1),(q.x,q.y,z2),(r.x,r.y,z2),(s.x,s.y,z1)])


def text(name,body,location,size,rotation=(0,0,0),owner=court):
    curve=bpy.data.curves.new(name,'FONT')
    curve.body,curve.align_x,curve.size=body,'CENTER',size
    curve.extrude=.0005
    curve.materials.append(white)
    obj=bpy.data.objects.new(name,curve)
    owner.objects.link(obj)
    obj.location,obj.rotation_euler=location,rotation
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    if owner==roof: obj['arenaPart']='roof'
    return obj


templates=[]
for i,mat in enumerate(seat_mats):
    shell=Batch(f'Ash seat shell {i+1}',mat,seating)
    pan=[(-.215,-.215),(.215,-.215),(.235,-.15),(.235,.16),(.19,.21),(-.19,.21),(-.235,.16),(-.235,-.15)]
    shell.face([(x,y,.45) for x,y in pan])
    shell.face([(x,y,.41) for x,y in reversed(pan)])
    for j,(x,y) in enumerate(pan):
        u,v=pan[(j+1)%8]
        shell.face([(x,y,.41),(u,v,.41),(u,v,.45),(x,y,.45)])
    # Segmented gently curved back, with an open hand-slot below its top rim.
    for section in range(6):
        a,b=-.235+section*.47/6,-.235+(section+1)*.47/6
        ya,yb=.19+.55*a*a,.19+.55*b*b
        topa,topb=.86-.6*a*a,.86-.6*b*b
        shell.face([(a,ya,.51),(b,yb,.51),(b,yb+.025,topb),(a,ya+.025,topa)])
        shell.face([(b,yb+.055,.51),(a,ya+.055,.51),(a,ya+.08,topa),(b,yb+.08,topb)])
        shell.face([(a,ya+.025,topa),(b,yb+.025,topb),(b,yb+.08,topb),(a,ya+.08,topa)])
    obj=shell.finish(.7)
    templates.append(obj.data)
    bpy.data.objects.remove(obj,do_unlink=True)

lower_end=B['lowerRows']*B['rowDepth']
upper_start=lower_end+B['concourseWidth']
outer=upper_start+B['upperRows']*B['rowDepth']
tiers=[(0,B['lowerRows'],2.47,B['lowerRise']),(upper_start,B['upperRows'],14.15,B['upperRise'])]
seat_count=0
seat_tiers=[]
for ti,(offset,rows,base,rise) in enumerate(tiers):
    tread=Batch(f'Tier {ti+1} precast terraces',stone,architecture)
    risers=Batch(f'Tier {ti+1} riser faces',riser,architecture)
    stairs=Batch(f'Tier {ti+1} aisle stair treads',cream,architecture)
    rails=Batch(f'Tier {ti+1} brushed handrails',steel,architecture)
    supports=Batch(f'Tier {ti+1} seat pedestals and arms',dark,seating)
    partition=Batch(f'Tier {ti+1} box seating partitions',cream,architecture)
    panes=Batch(f'Tier {ti+1} glass aisle guards',balustrade,architecture)
    portals=Batch(f'Tier {ti+1} recessed terrace portals',riser,architecture)
    count_before=seat_count
    for row in range(rows):
        d,h=offset+row*B['rowDepth'],base+row*rise
        circumference=path(d+.42)[1][-1]
        section_length=circumference/B['sections']
        for sec in range(B['sections']):
            start,end=sec/B['sections'],(sec+1)/B['sections']
            middle=(start+end)/2
            entry=sec%4==1 and ((ti==0 and 8<=row<13) or (ti==1 and 2<=row<6))
            hole=1.35/circumference
            spans=[(start,end)] if not entry else [(start,middle-hole),(middle+hole,end)]
            for lo,hi in spans:
                strip(tread,d,d+B['rowDepth'],h,start=lo,end=hi)
                strip(risers,d,d,h-rise,h,start=lo,end=hi)
            num=max(0,int((section_length-1.3)/B['seatSpacing']))
            for j in range(num):
                fraction=start+(.68+(section_length-1.36)*(j+.5)/num)/circumference
                if entry and abs(fraction-middle)<hole+.12/circumference: continue
                p=point(d+.43,fraction)
                tangent=(point(d+.43,fraction+.00001)-p).normalized()
                angle=math.atan2(tangent.y,tangent.x)+math.pi
                shade=(sec*7+row*3+j)%4
                obj=bpy.data.objects.new(f'Seat T{ti+1}-{sec+1:02}-{row+1:02}-{j+1:02}',templates[shade])
                seating.objects.link(obj)
                obj.location=(p.x,p.y,h)
                obj.rotation_euler.z=angle
                supports.box((p.x,p.y,h+.22),(.06,.065,.44),angle)
                # Shared arms read as fine dark lines, not enormous seat blocks.
                tangent=Vector((math.cos(angle),math.sin(angle)))
                supports.box((p.x+tangent.x*.245,p.y+tangent.y*.245,h+.61),(.025,.33,.035),angle)
                seat_count+=1
            half=.56/circumference
            for step in range(2):
                sd=d+step*B['rowDepth']/2
                sh=h-rise/2+step*rise/2+.012
                strip(stairs,sd,sd+B['rowDepth']/2,sh,start=start-half,end=start+half)
                strip(stairs,sd,sd,sh-rise/2,sh,start=start-half,end=start+half)
            p,q=point(d,start),point(d+B['rowDepth'],start)
            rails.beam((p.x,p.y,h+.9),(q.x,q.y,h+rise+.9),.018)
            if row%3==0: rails.beam((p.x,p.y,h),(p.x,p.y,h+.9),.022)
            if ti==0 and row<7:
                strip(partition,d,d+B['rowDepth'],h+.05,h+rise+.64,start=start+half+.0007,end=start+half+.0017)
            if row%3==0 and row>6:
                p,q=point(d,start+half),point(d+B['rowDepth']*2,start+half)
                panes.face([(p.x,p.y,h+.12),(q.x,q.y,h+rise*2+.12),(q.x,q.y,h+rise*2+1),(p.x,p.y,h+1)])
        if row in ([8] if ti==0 else [2]):
            for sec in range(1,B['sections'],4):
                f=(sec+.5)/B['sections']
                p=point(d+1.8,f)
                t=(point(d+1.8,f+.00001)-p).normalized()
                a=math.atan2(t.y,t.x)
                # Recess sits only inside the seat/terrace hole, never across an aisle.
                portals.box((p.x,p.y,h-1.05),(2.55,3.7,.12),a)
                for sign in (-1,1):
                    portals.box((p.x+sign*t.x*1.34,p.y+sign*t.y*1.34,h+.1),(.13,3.7,2.3),a)
                back=point(d+3.6,f)
                # Close the rear all the way to the upper edge of the terrace cut.
                # Leaving this at doorway height exposed the bright sky through it.
                portals.box((back.x,back.y,h+.65),(2.7,.14,3.4),a)
    for batch in (tread,risers,stairs,rails,supports,partition,panes,portals): batch.finish()
    seat_tiers.append(seat_count-count_before)

# The glazed intermediate band and pale horizontal fascias are key to this arena.
floors=Batch('Continuous hospitality concourse slabs',cream,architecture)
strip(floors,lower_end-.1,upper_start+1,11.45)
strip(floors,lower_end-.1,upper_start+1,13.95)
strip(floors,lower_end-.1,lower_end-.1,13.7,14.1)
strip(floors,outer,outer+3.0,23.15)
floors.finish()
windows=Batch('Glazed hospitality ribbon and rear clerestory',glass,architecture)
strip(windows,upper_start-.75,upper_start-.75,11.65,13.7)
strip(windows,outer+.15,outer+.15,23.2,25.4)
windows.finish()
mullions=Batch('Hospitality glazing mullions',steel,architecture)
for i in range(120):
    for d,z1,z2 in [(upper_start-.78,11.5,13.95),(outer+.12,23.1,25.45)]:
        p=point(d,i/120)
        mullions.beam((p.x,p.y,z1),(p.x,p.y,z2),.035)
mullions.finish()
guard=Batch('Concourse glass balustrades',balustrade,architecture)
guard_rail=Batch('Concourse silver cap rails',steel,architecture)
for d,h in [(lower_end-.25,11.48),(upper_start-.1,14.16),(outer-.2,23.15)]:
    strip(guard,d,d,h+.08,h+1.1)
    for i in range(160):
        p,q=point(d,i/160),point(d,(i+1)/160)
        guard_rail.beam((p.x,p.y,h+1.1),(q.x,q.y,h+1.1),.022)
guard.finish()
guard_rail.finish()

# Exterior has a complete podium, stacked floor bands, slender columns and louvers.
podium=Batch('Limestone exterior podium and floor bands',stone,architecture)
strip(podium,outer+1,outer+6,-.15)
strip(podium,outer+1,outer+1,-.15,3.0)
for z in (3,8,13.7,19,25.5): strip(podium,outer+.5,outer+2.8,z)
podium.finish()
shell=Batch('Exterior concourse shadow panels',glass,architecture)
strip(shell,outer+1.2,outer+1.2,3,25.5)
shell.faces=[tuple(reversed(face)) for face in shell.faces]
shell.finish()
columns=Batch('Exterior limestone piers and vertical louvers',cream,architecture)
for i in range(104):
    p=point(outer+2.0,i/104)
    columns.beam((p.x,p.y,0),(p.x,p.y,26.9),.14,6)
for i in range(208):
    p=point(outer+1.5,i/208)
    columns.beam((p.x,p.y,19),(p.x,p.y,25.5),.055,4)
columns.finish()

# Court perimeter: green wall interrupted at real ground-level approach openings.
wall=Batch('Green perimeter wall with four clear portals',green,court)
pts=path(0)[0]
for a,b in zip(pts,pts[1:]):
    cuts=[0.,1.]
    on_side=abs(abs(a.x)-B['innerHalfWidth'])<.001 and abs(a.x-b.x)<.001
    if on_side:
        for center in P['portalCenters']:
            for edge in (center-P['portalWidth']/2,center+P['portalWidth']/2):
                t=(edge-a.y)/(b.y-a.y)
                if 0<t<1: cuts.append(t)
    cuts.sort()
    for lo,hi in zip(cuts,cuts[1:]):
        u,v=a.lerp(b,lo),a.lerp(b,hi)
        m=(u+v)/2
        opening=on_side and any(abs(m.y-c)<P['portalWidth']/2 for c in P['portalCenters'])
        bottom=P['portalHeight'] if opening else 0
        height=P['wallHeight']-bottom
        wall.box((m.x,m.y,bottom+height/2),((v-u).length,.24,height),math.atan2(v.y-u.y,v.x-u.x))
wall.finish()['arenaPart']='perimeterWall'
linings=Batch('Recessed ground access linings',riser,court)
for side in (-1,1):
    for y in P['portalCenters']:
        x=side*B['innerHalfWidth']
        for sign in (-1,1): linings.box((x+side*1.4,y+sign*1.33,1.02),(2.8,.14,2.04))
        linings.box((x+side*1.4,y,-.06),(2.8,2.8,.12))
        linings.box((x+side*1.4,y,2.13),(2.8,2.8,.18))
        linings.box((x+side*2.85,y,1.02),(.12,2.8,2.04))
        lane=bpy.data.objects.new(f'Clear player access {side:+} {y:+}',None)
        anchors.objects.link(lane)
        lane.location=(side*11.5,y,1)
        lane['role']='clear-access-lane'
        lane['halfExtents']=[2.2,.98,1.16]
linings.finish()

w,h=C['width']/2,C['length']/2
playing=Batch('Regulation terracotta playing surface',claymat,court,'court')
playing.box((0,0,-.04),(C['width'],C['length'],.08))
playing.finish()
apron=Batch('Continuous clay runback and sidelines',claymat,court,'runoff')
ax,ay=B['innerHalfWidth']+.15,B['innerHalfLength']+.15
for vertices in [[(-ax,-ay,0),(ax,-ay,0),(ax,-h,0),(-ax,-h,0)],
                 [(-ax,h,0),(ax,h,0),(ax,ay,0),(-ax,ay,0)],
                 [(-ax,-h,0),(-w,-h,0),(-w,h,0),(-ax,h,0)],
                 [(w,-h,0),(ax,-h,0),(ax,h,0),(w,h,0)]]: apron.face(vertices)
apron.finish()
lines=Batch('Regulation inset white clay tapes',white,court)
for y in (-h,h):
    lines.box((0,y,.001),(C['width']+.05,.05,.002))
    lines.box((0,y-math.copysign(.075,y),.001),(.05,.15,.002))
for x in (-w,w,-C['singlesWidth']/2,C['singlesWidth']/2): lines.box((x,0,.001),(.05,C['length'],.002))
for y in (-C['serviceLine'],C['serviceLine']): lines.box((0,y,.001),(C['singlesWidth'],.05,.002))
lines.box((0,0,.001),(.05,2*C['serviceLine'],.002))
lines.finish()

net=Batch('Woven net cords',netmat,court)
tape=Batch('White net headband and central strap',white,court)
posts=Batch('Dark green net posts and tension gear',green,court)
nh=w+.914
def netheight(x): return .914+.156*(abs(x)/nh)**2
for i in range(193):
    x=-nh+i*2*nh/192
    net.beam((x,0,.06),(x,0,netheight(x)-.036),.0017,4)
for row in range(16):
    for i in range(48):
        x,q=-nh+i*2*nh/48,-nh+(i+1)*2*nh/48
        net.beam((x,0,.06+(netheight(x)-.1)*row/15),(q,0,.06+(netheight(q)-.1)*row/15),.0017,4)
for i in range(96):
    x,q=-nh+i*2*nh/96,-nh+(i+1)*2*nh/96
    za,zb=netheight(x),netheight(q)
    tape.face([(x,-.02,za-.035),(q,-.02,zb-.035),(q,-.02,zb+.035),(x,-.02,za+.035)])
    tape.face([(q,.02,zb-.035),(x,.02,za-.035),(x,.02,za+.035),(q,.02,zb+.035)])
tape.box((0,0,.457),(.05,.05,.914))
for x in (-nh,nh):
    posts.beam((x,0,0),(x,0,1.10),.043,12)
    posts.box((x,0,.06),(.16,.16,.12))
for batch in (net,tape,posts): batch.finish()

# Original player zone: two separate lounge chairs per side of the umpire.
furniture=Batch('Player chair frames and umpire ladder',steel,court)
cushions=Batch('Forest green player chair cushions and coolers',green,court)
for y in (-4.7,-3.65,3.65,4.7):
    for dx in (-.26,.26):
        for dy in (-.28,.28): furniture.beam((-9.75+dx,y+dy,0),(-9.75+dx,y+dy,.46),.024)
    cushions.box((-9.75,y,.46),(.63,.67,.13))
    cushions.box((-10.02,y,.77),(.12,.68,.58))
    for dy in (-.39,.39): furniture.beam((-9.98,y+dy,.64),(-9.42,y+dy,.64),.028)
for y in (-6,6):
    cushions.box((-9.8,y,.3),(.7,.6,.6))
    text(f'Player cooler {y}','T',(-9.435,y,.22),.3,(math.pi/2,0,-math.pi/2))
for y in (-.43,.43):
    for x in (-8.5,-7.7): furniture.beam((x,y,0),(-8.1+(x+8.1)*.6,y,2.1),.035)
for i in range(7): furniture.beam((-8.5+i*.025,-.43,i*.3),(-8.5+i*.025,.43,i*.3),.025)
cushions.box((-8.1,0,2.1),(.7,.85,.12))
cushions.box((-8.4,0,2.42),(.10,.86,.56))
furniture.finish()
cushions.finish()

for side in (-1,1):
    for y in (-9,0,9): text(f'Green sidewall wordmark {side} {y}','T E N M U L A T E',(side*(B['innerHalfWidth']-.135),y,.95),.46,(math.pi/2,0,-side*math.pi/2))
    for x in (-5.7,5.7): text(f'Green baseline wordmark {side} {x}','TENMULATE',(x,side*(B['innerHalfLength']-.135),.9),.46,(math.pi/2,0,math.pi if side<0 else 0))
    text(f'Clay baseline stencil {side}','T E N M U L A T E',(0,side*19.4,.004),.5,(0,0,math.pi if side<0 else 0))

# Light horizontal canopies and the asymmetric stack of cambered roof wings.
fixed=Batch('Fixed ivory canopy roof and inner fascia',membrane,roof,roof=True)
soffit=Batch('Fixed canopy underside',cream,roof,roof=True)
def aperture(f):
    p=point(0,f)
    ylimit=R['openingNorth'] if p.y>0 else -R['openingSouth']
    scale=min(R['openingHalfWidth']/max(abs(p.x),.001),ylimit/max(abs(p.y),.001))
    return p*scale
for i in range(280):
    a,b=i/280,(i+1)/280
    u,v=aperture(a),aperture(b)
    p,q=point(outer+3,a),point(outer+3,b)
    fixed.face([(u.x,u.y,27.2),(p.x,p.y,26.5),(q.x,q.y,26.5),(v.x,v.y,27.2)])
    soffit.face([(v.x,v.y,26.8),(q.x,q.y,26.1),(p.x,p.y,26.1),(u.x,u.y,26.8)])
    soffit.face([(u.x,u.y,26.8),(v.x,v.y,26.8),(v.x,v.y,27.2),(u.x,u.y,27.2)])
fixed.finish()
soffit.finish()
canopy_ribs=Batch('Fixed canopy radial ribs and perimeter edge',steel,roof,roof=True)
for i in range(140):
    u,p=aperture(i/140),point(outer+3,i/140)
    canopy_ribs.beam((u.x,u.y,26.72),(p.x,p.y,26.02),.055)
    v=aperture((i+1)/140)
    canopy_ribs.beam((u.x,u.y,26.72),(v.x,v.y,26.72),.065)
canopy_ribs.finish()
tracks=Batch('Paired roof runways rails and support columns',steel,roof,roof=True)
for side in (-1,1):
    x=side*R['halfSpan']
    tracks.box((x,0,27.55),(.65,112,1.2))
    tracks.box((x,0,28.23),(.18,112,.18))
    for y in range(-50,51,10): tracks.beam((x,y,19),(x,y,27.2),.14,6)
tracks.finish()
wingframes=Batch('Curved wing ribs chord members and purlins',steel,roof,roof=True)
bogies=Batch('Roof wheel bogies drive housings and service guards',dark,roof,roof=True)
# Ten nested profiles are deliberately original, not the reference eleven.
for index in range(R['wingCount']):
    y0=29.6+index*R['parkedPitch']
    z0=28.55+index*.13
    leaf=Batch(f'Parked cambered wing {index+1:02}',membrane,roof,roof=True)
    def profile(t): return R['wingRise']*(1-math.exp(-4*t))+.18*t
    for j in range(16):
        ta,tb=j/16,(j+1)/16
        ya,yb=y0+ta*R['wingDepth'],y0+tb*R['wingDepth']
        za,zb=z0+profile(ta),z0+profile(tb)
        leaf.face([(-R['halfSpan'],ya,za),(R['halfSpan'],ya,za),(R['halfSpan'],yb,zb),(-R['halfSpan'],yb,zb)])
        for x in (-R['halfSpan'],R['halfSpan']): wingframes.beam((x,ya,za-.12),(x,yb,zb-.12),.07)
    obj=leaf.finish()
    obj['role']='parked-roof-wing'
    obj['wingIndex']=index
    for x in np.linspace(-R['halfSpan'],R['halfSpan'],23):
        for j in range(8):
            ta,tb=j/8,(j+1)/8
            wingframes.beam((x,y0+ta*R['wingDepth'],z0+profile(ta)-.16),(x,y0+tb*R['wingDepth'],z0+profile(tb)-.16),.045)
    wingframes.box((0,y0,z0-.15),(2*R['halfSpan'],.45,.3))
    for side in (-1,1):
        x=side*R['halfSpan']
        bogies.box((x,y0,28.65),(.95,1.55,.22))
        bogies.beam((x,y0,28.7),(x,y0,z0),.11)
        for dy in (-.46,.46): bogies.beam((x-.15,y0+dy,28.47),(x+.15,y0+dy,28.47),.21,10)
        bogies.box((x+side*.48,y0,28.7),(.42,.55,.42))
wingframes.finish()
bogies.finish()

# Fixed light bridges remain independent of the nested mobile roof.
lighting=Batch('Fixed court lighting bridges and housings',dark,roof,roof=True)
lenses=Batch('Warm-white court light lenses',lamp,roof,roof=True)
for side in (-1,1):
    for y in (-22,-11,0,11,22):
        x=side*29.7
        lighting.beam((side*32,y,26.6),(x,y,25.7),.07)
        lighting.box((x,y,25.55),(1.4,.9,.22))
        lenses.box((x,y,25.42),(1.26,.8,.03))
for x in (-20,20):
    for y in (-20,20):
        obj=bpy.data.objects.new(f'court_light_{x}_{y}',None)
        anchors.objects.link(obj)
        obj.location=(x,y,24.5)
        obj['role']='venue-light'
        obj['intensity']=4500
lighting.finish()
lenses.finish()

screen=Batch('Original score display housings',dark,architecture)
screenface=Batch('Original scoreboard face',green,architecture)
for side in (-1,1):
    y=side*(B['innerHalfLength']+upper_start+2.8)
    screen.box((0,y,19.5),(6.4,.4,3.1))
    screenface.box((0,y-side*.24,19.5),(6,.08,2.8))
    text(f'Scoreboard identity {side}','TENMULATE',(0,y-side*.30,20.05),.42,(math.pi/2,0,math.pi if side<0 else 0),architecture)
    text(f'Scoreboard score {side}','HOME   0   0\nAWAY   0   0',(0,y-side*.31,18.75),.39,(math.pi/2,0,math.pi if side<0 else 0),architecture)
screen.finish()
screenface.finish()
for name,location in {'court_origin':(0,0,0),'baseline_near':(0,h,0),'baseline_far':(0,-h,0),
                      'net_center':(0,0,.914),'doubles_left':(-w,0,0),'doubles_right':(w,0,0)}.items():
    obj=bpy.data.objects.new(name,None)
    anchors.objects.link(obj)
    obj.location=location
    obj['role']='court-anchor'

def camera(name,position,target,lens):
    data=bpy.data.cameras.new(name)
    obj=bpy.data.objects.new(name,data)
    presentation.objects.link(obj)
    obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    data.lens=lens
    data.clip_end=500
    return obj
scene.camera=camera('01 Player baseline',(0,14,1.7),(0,-15,4),22)
camera('02 Court corner',(13,20,7),(0,0,5),20)
camera('03 Upper overview',(78,85,105),(0,0,10),37)
world=bpy.data.worlds.new('Neutral review sky')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.52,.69,.86,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
scene.world=world
sun_data=bpy.data.lights.new('Review sun','SUN')
sun_data.energy=2.5
sun_data.angle=.06
sun=bpy.data.objects.new('Review sun',sun_data)
presentation.objects.link(sun)
sun.rotation_euler=(math.radians(20),math.radians(-12),math.radians(145))
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1600
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene['seatCount']=seat_count
scene['seatCountByTier']=seat_tiers
scene['referenceBasis']='Primary photos and public technical diagrams; not surveyed or certified'
runpy.run_path(str(ROOT/'scripts/blender/bake_ambient.py'))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'clay-sunset-arena.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type in {'MESH','EMPTY'}: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(BUILD/'clay-sunset-arena.raw.glb'),export_format='GLB',
    use_selection=True,export_extras=True,export_cameras=False,export_lights=False,
    export_animations=False,export_yup=True,export_apply=False,export_tangents=True,export_vertex_color='ACTIVE')
result={'blend':str(SOURCE/'clay-sunset-arena.blend'),'rawGlb':str(BUILD/'clay-sunset-arena.raw.glb'),
        'seats':seat_count,'seatTiers':seat_tiers,'objects':len(scene.objects),'blender':bpy.app.version_string}
(BUILD/'blender-build.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result),flush=True)
