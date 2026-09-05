"""Original indoor venues. Blender owns all visible architecture, court and seats.

Run with -- <venue-id>. Metres, Z-up. Linked seat shells and named light anchors
are shared with the outdoor export contract; no web-generated hall geometry.
"""
import json
import math
import runpy
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'scripts/blender'))
from venue_mesh import Batch, material, linear
from venue_net import build_net_cords

VENUE = sys.argv[sys.argv.index('--')+1]
CONFIGS = {
    'timber-hall': dict(surface='hard', width=36, length=52, eave=8.8, crown=12.4, rows=5,
        structure='#ac8055', wall='#b9ae96', padding='#263c44', seats='#566b69', court='#28637c', runoff='#537268'),
    'clay-stadium': dict(surface='clay', width=40, length=56, eave=11, crown=14, rows=8,
        structure='#52616a', wall='#b9b7ad', padding='#304d45', seats='#af8763', court='#ac5838', runoff='#b45e3c'),
    'covered-grass-arena': dict(surface='grass', width=38, length=54, eave=7.5, crown=15.5, rows=6,
        structure='#dddcc9', wall='#b5bcad', padding='#24463c', seats='#356759', court='#587938', runoff='#526d37'),
}
D = CONFIGS[VENUE]
SOURCE, BUILD = ROOT/'assets/venues'/VENUE, ROOT/'artifacts/venue-build'/VENUE
(SOURCE/'textures').mkdir(parents=True, exist_ok=True)
BUILD.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections): bpy.data.collections.remove(col)
bpy.data.orphans_purge(do_recursive=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene['venueId'], scene['sourceVersion'] = VENUE, 1

def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

architecture = collection('01 Enclosed hall and spectator terraces')
roof = collection('02 Structural roof and clerestories')
seating = collection('03 Linked spectator seating')
court = collection('04 Regulation court and equipment')
anchors = collection('05 Gameplay and light anchors')
review = collection('06 Blender review cameras and lights')
stone = material('Warm mineral wall', D['wall'], .92)
structure = material('Glulam' if VENUE=='timber-hall' else 'Powder coated structural steel', D['structure'], .67, .15 if VENUE!='timber-hall' else 0)
padding = material('Padded acoustic perimeter', D['padding'], .91)
metal = material('Graphite equipment frames', '#344147', .53, .5)
ivory = material('Ivory roof lining', '#dadbd1', .91)
white = material('Court paint and net tape', '#efeede', .86)
timber = material('Oiled timber slats', '#97744e', .79)
glass = material('Diffusing clerestory panels', '#aec7cc', .62)
glass.use_backface_culling = False
gp = glass.node_tree.nodes['Principled BSDF']
gp.inputs['Emission Color'].default_value=(*linear('#aec7cc'), 1)
gp.inputs['Emission Strength'].default_value=.12
lamp = material('Frosted luminaire', '#f2eee0', .5)
lp=lamp.node_tree.nodes['Principled BSDF']
lp.inputs['Emission Color'].default_value=(*linear('#fff3da'), 1)
lp.inputs['Emission Strength'].default_value=1.8

def texture(mat, name, color, kind='mineral'):
    """Bake original nondirectional albedo, micro-normal and roughness maps."""
    n=512
    rng=np.random.default_rng(1081)
    yy,xx=np.mgrid[0:n,0:n]
    noise=rng.normal(0,1,(n,n))
    if kind=='timber': noise=noise*.3+np.sin(xx*.18+np.sin(yy*.024)*2)*.8+np.sin(xx*.73)*.22
    tint=np.array([int(color[i:i+2],16)/255 for i in (1,3,5)])
    rgb=tint[None,None,:]*(1+noise[:,:,None]*.055)
    if kind=='grass': rgb*=np.where(xx//32%2==0,1.10,.88)[:,:,None]
    gy,gx=np.gradient(noise)
    normal=np.dstack((-gx*.15,-gy*.15,np.ones_like(noise)))
    normal/=np.linalg.norm(normal,axis=2)[:,:,None]
    for suffix,data,space in [('albedo',rgb,'sRGB'),('normal',normal*.5+.5,'Non-Color'),('roughness',np.repeat(np.clip(.91+noise*.018,0,1)[:,:,None],3,axis=2),'Non-Color')]:
        pix=np.ones((n,n,4),dtype=np.float32); pix[:,:,:3]=np.clip(data,0,1)
        im=bpy.data.images.new(name+'-'+suffix,width=n,height=n)
        im.colorspace_settings.name=space; im.pixels.foreach_set(pix.ravel())
        im.filepath_raw=str(SOURCE/'textures'/f'{name}-{suffix}.png'); im.file_format='PNG'; im.save()
        node=mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image=im
        if kind=='grass' and suffix!='albedo':
            uv=mat.node_tree.nodes.new('ShaderNodeTexCoord')
            mapping=mat.node_tree.nodes.new('ShaderNodeMapping'); mapping.inputs['Scale'].default_value=(6,6,1)
            mat.node_tree.links.new(uv.outputs['UV'],mapping.inputs['Vector'])
            mat.node_tree.links.new(mapping.outputs['Vector'],node.inputs['Vector'])
        p=mat.node_tree.nodes['Principled BSDF']
        if suffix=='normal':
            nm=mat.node_tree.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value=.28
            mat.node_tree.links.new(node.outputs['Color'],nm.inputs['Color']); mat.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
        else: mat.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color' if suffix=='albedo' else 'Roughness'])

texture(stone,'mineral-panels',D['wall'])
texture(timber,'oak-slats','#97744e','timber')
if VENUE=='timber-hall': texture(structure,'laminated-beams',D['structure'],'timber')
floor=material('Textured '+D['surface']+' court',D['court'],.94)
apron=material('Textured '+D['surface']+' runoff',D['runoff'],.94)
texture(floor,'court',D['court'],D['surface'])
texture(apron,'runoff',D['runoff'],D['surface'])
W,L,E=D['width']/2,D['length']/2,D['eave']
shell=Batch('Mineral wall panels and entrance lintels',stone,architecture)
base=Batch('Hall foundation and circulation concourse',stone,architecture)
base.box((0,0,-.24),(W*2+1,L*2+1,.3))
# Complete enclosed shell, with real side-door openings away from seat banks.
for s in (-1,1):
    for a,b in [(-L,-21),(-18,18),(21,L)]: shell.box((s*W,(a+b)/2,E/2),(.3,b-a,E))
    for y in (-19.5,19.5): shell.box((s*W,y,(E+2.5)/2),(.3,3,E-2.5))
    shell.box((0,s*L,2.0),(W*2,.3,4.0))
    shell.box((0,s*L,E-.65),(W*2,.3,1.3))
shell.finish(); base.finish()
glazing=Batch('End clerestory glass',glass,architecture)
frames=Batch('Clerestory mullions and door frames',metal,architecture)
slats=Batch('Fine acoustic wall slats',timber,architecture)
for s in (-1,1):
    glazing.box((0,s*(L-.17),(4+E-1.3)/2),(W*2-.7,.05,E-5.3))
    for x in np.arange(-W+.5,W,.95):
        frames.box((x,s*(L-.22),(4+E-1.3)/2),(.045,.08,E-5.3))
    for x in np.arange(-W+.3,W,.18): slats.box((x,s*(L-.22),3.2),(.075,.11,1.4))
    for y in np.arange(-17,18,2.2):
        # Side acoustic absorbers, with expressed timber frames and shadow gaps.
        frames.box((s*(W-.22),y,5.0),(.08,1.76,2.4))
        for dy in np.arange(-.80,.81,.16): slats.box((s*(W-.30),y+dy,5),(.08,.06,2.3))
    for y in (-19.5,19.5):
        frames.box((s*(W+.1),y,1.25),(.1,2.6,2.5))
        for dy in (-1.37,1.37): frames.box((s*(W-.18),y+dy,1.3),(.18,.08,2.6))
        frames.box((s*(W-.18),y,2.58),(.18,2.8,.1))
glazing.finish(); frames.finish(); slats.finish()

# Linear, court-perpendicular section divisions. Clear 1.4 m aisles separate
# three banks on each side; no seat, pedestal or handrail crosses an aisle.
seatmat=material('Moulded hall seating',D['seats'],.6)
sb=Batch('Linked contoured seat master',seatmat,seating)
sb.box((0,0,.43),(.46,.44,.065))
for i in range(8):
    a,b=-.23+i*.46/8,-.23+(i+1)*.46/8
    ya,yb=.2+a*a,.2+b*b
    za,zb=.9-.5*a*a,.9-.5*b*b
    sb.face([(a,ya,.49),(b,yb,.49),(b,yb+.045,zb),(a,ya+.045,za)])
    sb.face([(b,yb+.07,.49),(a,ya+.07,.49),(a,ya+.085,za),(b,yb+.085,zb)])
for s in (-1,1): sb.box((s*.245,-.015,.61),(.03,.38,.045))
obj=sb.finish(); template=obj.data; bpy.data.objects.remove(obj,do_unlink=True)
terraces=Batch('Precast terraces',stone,architecture)
rails=Batch('Fine terrace handrails and seat pedestals',metal,architecture)
boards=Batch('Padded court perimeter and aisle gates',padding,architecture)
count=0
for side in (-1,1):
    for start,end in [(-17.6,-6.6),(-5.2,5.2),(6.6,17.6)]:
        boards.box((side*12.15,(start+end)/2,.52),(.18,end-start,1.04))
        for row in range(D['rows']):
            x=side*(12.8+row*.82); z=.34+row*.34
            terraces.box((x,(start+end)/2,z/2),(.82,end-start,z))
            for i,y in enumerate(np.arange(start+.45,end-.35,.56)):
                seat=bpy.data.objects.new(f'Seat T1 {side} {start} R{row:02} C{i:03}',template)
                seating.objects.link(seat); seat.location=(x,y,z); seat.rotation_euler.z=-side*math.pi/2
                rails.box((x,y,z+.19),(.055,.07,.38))
                count+=1
        for y in (start+.10,end-.10):
            rails.beam((side*12.6,y,1.2),(side*(12.8+(D['rows']-1)*.82),y,.34*D['rows']+.9),.026,6)
    for y in (-5.9,5.9):
        for step in range(D['rows']*2):
            x=side*(12.39+step*.41); z=.17+step*.17
            terraces.box((x,y,z/2),(.41,1.35,z))
    boards.box((0,side*21.4,.66),(24.4,.2,1.32))
terraces.finish(); rails.finish(); boards.finish()

def roof_z(x):
    return E+(D['crown']-E)*(math.sqrt(max(0,1-(x/W)**2)) if D['surface']=='grass' else 1-abs(x)/W)

skin=Batch('Roof insulated panels',ivory,roof,roof=True)
roofglass=Batch('Diffuse roof daylight strips',glass,roof,roof=True)
ribs=Batch('Primary roof portal ribs',structure,roof,roof=True)
fine=Batch('Fine roof purlins bracing bolts and cable trays',metal,roof,roof=True)
gable=Batch('Upper glazed end caps',glass,architecture)
panels=32 if D['surface']=='grass' else 12
for i in range(panels):
    a,b=-W+i*W*2/panels,-W+(i+1)*W*2/panels
    target=roofglass if i in (panels//2-1,panels//2) else skin
    target.face([(a,-L,roof_z(a)),(b,-L,roof_z(b)),(b,L,roof_z(b)),(a,L,roof_z(a))])
    for side in (-1,1):
        # Enclose the gable / barrel end rather than leaving a roof-height hole.
        gable.face([(a,side*(L-.17),E),(b,side*(L-.17),E),(b,side*(L-.17),roof_z(b)),(a,side*(L-.17),roof_z(a))])
    fine.beam((a,-L,roof_z(a)-.12),(a,L,roof_z(a)-.12),.045,6)
for y in np.linspace(-L+.4,L-.4,11):
    for side in (-1,1): ribs.box((side*(W-.28),y,E/2),(.42,.48,E))
    for i in range(panels):
        a,b=-W+i*W*2/panels,-W+(i+1)*W*2/panels
        ribs.beam((a,y,roof_z(a)-.28),(b,y,roof_z(b)-.28),.24,8)
        if D['surface']=='clay':
            ribs.beam((a,y,E-.3),(b,y,E-.3),.10,6)
            fine.beam((a,y,E-.3),(b,y,roof_z(b)-.3),.055,6)
    for side in (-1,1):
        fine.box((side*(W-.22),y,E-.25),(.6,.6,.04))
skin.mat.use_backface_culling=False
skin.finish(); roofglass.finish(); ribs.finish(); fine.finish()
gable.finish()

# Original PBR court, flat registration and white painted regulation markings.
w,h,sw,service=5.485,11.885,4.115,6.4
playing=Batch('Regulation playing surface',floor,court,role='court')
playing.face([(-w,-h,0),(w,-h,0),(w,h,0),(-w,h,0)])
runoff=Batch('Continuous court runoff',apron,court,role='runoff')
for a,b,c,d in [(-12,-w,-21,21),(w,12,-21,21),(-w,w,-21,-h),(-w,w,h,21)]: runoff.face([(a,c,0),(b,c,0),(b,d,0),(a,d,0)])
playing.finish(uv_scale=24 if D['surface']=='grass' else 3)
runoff.finish(uv_scale=24 if D['surface']=='grass' else 3)
lines=Batch('Regulation white court lines',white,court)
for x in (-w,-sw,sw,w): lines.box((x,0,.003),(.055,h*2,.003))
for y in (-h,h): lines.box((0,y,.003),(w*2,.10,.003))
for y in (-service,service): lines.box((0,y,.003),(sw*2,.055,.003))
lines.box((0,0,.003),(.055,service*2,.003))
for y in (-h+.1,h-.1): lines.box((0,y,.003),(.055,.2,.003))
lines.finish()
netmat=material('Dark woven net','#202c24',.98)
cords=Batch('Dense net cords',netmat,court)
build_net_cords(cords,6.4)
posts=Batch('Net posts and equipment frames',metal,court)
for x in (-6.4,6.4): posts.beam((x,0,0),(x,0,1.12),.045,12)
tape=Batch('Curved white net headband and centre strap',white,court)
for i in range(48):
    a,b=-6.4+i*12.8/48,-6.4+(i+1)*12.8/48
    za,zb=.914+.156*(abs(a)/6.4)**2,.914+.156*(abs(b)/6.4)**2
    tape.face([(a,-.012,za-.045),(b,-.012,zb-.045),(b,-.012,zb),(a,-.012,za)])
    tape.face([(b,.012,zb-.045),(a,.012,za-.045),(a,.012,za),(b,.012,zb)])
tape.box((0,0,.457),(.035,.03,.914)); tape.finish()
furniture=Batch('Timber bench slats and storage cabinets',timber,court)
for y in (-4,4):
    for x in np.arange(9.1,9.55,.105): furniture.box((x,y,.47),(.08,2,.065))
    furniture.box((9.62,y,.78),(.075,2,.34))
    for yy in (y-.8,y+.8): posts.box((9.33,yy,.23),(.38,.05,.46))
    furniture.box((9.45,y+1.65,.35),(.6,.55,.7))
for x in (8.05,8.6):
    for y in (-.34,.34): posts.beam((x,y,0),(8.25 if x<8.3 else 8.5,y*.72,2.02),.035,6)
posts.box((8.35,0,1.8),(.72,.72,.055))
posts.box((8.65,0,2.3),(.045,.72,.52))
for z in np.arange(.2,2,.28): posts.box((8.65,0,z),(.08,.65,.04))
furniture.box((8.3,0,2.05),(.6,.62,.08))
posts.finish(); furniture.finish()

housing=Batch('Suspended light housings',metal,roof,roof=True)
lenses=Batch('Luminaire diffuser panels',lamp,roof,roof=True)
for x in (-7,7):
    for y in (-16,-8,0,8,16):
        height=8.0 if D['surface']=='hard' else 9.8
        housing.box((x,y,height),(1.8,.6,.18)); lenses.box((x,y,height-.1),(1.65,.5,.025))
        for xx in (x-.6,x+.6): housing.beam((xx,y,height),(xx,y,roof_z(xx)-.25),.015,4)
housing.finish(); lenses.finish()
for x in (-7,7):
    for y in (-8,8):
        obj=bpy.data.objects.new(f'court_light_{x}_{y}',None); anchors.objects.link(obj)
        obj.location=(x,y,7.88 if D['surface']=='hard' else 9.68); obj['role']='venue-light'; obj['intensity']=550
for name,position in {'court_origin':(0,0,0),'baseline_near':(0,h,0),'baseline_far':(0,-h,0),'net_center':(0,0,.914),'doubles_left':(-w,0,0),'doubles_right':(w,0,0)}.items():
    obj=bpy.data.objects.new(name,None); anchors.objects.link(obj); obj.location=position; obj['role']='court-anchor'
camera_data=bpy.data.cameras.new('Court corner review')
camera=bpy.data.objects.new('Court corner review',camera_data); review.objects.link(camera)
camera.location=(10,18,3.5); camera.rotation_euler=(Vector((0,-6,4))-camera.location).to_track_quat('-Z','Y').to_euler(); camera_data.lens=22
scene.camera=camera
world=bpy.data.worlds.new('Soft interior review world'); world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45; scene.world=world
for x in (-7,7):
    for y in (-10,10):
        data=bpy.data.lights.new('Review softbox','AREA'); data.energy=2200; data.shape='DISK'; data.size=5
        obj=bpy.data.objects.new('Review softbox',data); review.objects.link(obj); obj.location=(x,y,8)
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x,scene.render.resolution_y=1600,1000
scene['seatCount']=count
runpy.run_path(str(ROOT/'scripts/blender/bake_ambient.py'))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f'{VENUE}.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type in {'MESH','EMPTY'}: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(BUILD/f'{VENUE}.raw.glb'),export_format='GLB',use_selection=True,export_extras=True,
    export_cameras=False,export_lights=False,export_animations=False,export_yup=True,export_tangents=True,export_vertex_color='ACTIVE')
(SOURCE/'design.json').write_text(json.dumps(dict(id=VENUE,version=1,**D),indent=2)+'\n')
(BUILD/'blender-build.json').write_text(json.dumps(dict(seats=count,objects=len(scene.objects),blender=bpy.app.version_string),indent=2))
print(f'BUILT {VENUE}: {count} seats',flush=True)
