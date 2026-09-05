"""Reproducible, editable arena master and glTF. Blender 5.2, metres, Z up.

Construction uses original meshes and linked moulded seats. glTF converts (x,y,z)
to (x,z,-y); all court anchors are checked again by the runtime asset build.
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

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/blender'))
from venue_net import build_net_cords
SOURCE = ROOT / 'assets/venues/hard-open-arena'
BUILD = ROOT / 'artifacts/venue-build'
BUILD.mkdir(parents=True, exist_ok=True)
DESIGN = json.loads((SOURCE / 'design.json').read_text())
B = DESIGN['bowl']
C = DESIGN['court']
R = DESIGN['roof']
P = DESIGN['perimeter']

# Only this process's scene is rebuilt. Invoke in the dedicated project session.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for existing_collection in list(bpy.data.collections):
    bpy.data.collections.remove(existing_collection)
bpy.data.orphans_purge(do_recursive=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene['venueId'] = DESIGN['id']
scene['sourceVersion'] = DESIGN['version']
scene['designNotes'] = DESIGN['description']


def collection(name):
    value = bpy.data.collections.new(name)
    scene.collection.children.link(value)
    return value


architecture = collection('01 • Bowl, concourses and tunnels')
seating = collection('02 • Linked moulded seats')
roof_collection = collection('03 • Open retractable roof and rigging')
court_collection = collection('04 • Regulation court and furniture')
anchors = collection('05 • Runtime anchors')
presentation = collection('06 • Review cameras and lighting — not exported')


def linear(hex_value):
    rgb = [int(hex_value.lstrip('#')[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb)


def material(name, color, roughness=.7, metal=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*linear(color), 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metal
    mat.diffuse_color = (*linear(color), 1)
    mat.use_backface_culling = True
    return mat


def image_node(mat, path, color_space='sRGB'):
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(path), check_existing=True)
    tex.image.colorspace_settings.name = color_space
    return tex


concrete = material('CC0 • brushed precast concrete', '#ffffff', .88)
nodes, links = concrete.node_tree.nodes, concrete.node_tree.links
p = nodes.get('Principled BSDF')
diff = image_node(concrete, SOURCE / 'textures/brushed_concrete_diff_1k.jpg')
links.new(diff.outputs['Color'], p.inputs['Base Color'])
arm = image_node(concrete, SOURCE / 'textures/brushed_concrete_arm_1k.jpg', 'Non-Color')
sep = nodes.new('ShaderNodeSeparateColor')
links.new(arm.outputs['Color'], sep.inputs['Color'])
links.new(sep.outputs['Green'], p.inputs['Roughness'])
norm = image_node(concrete, SOURCE / 'textures/brushed_concrete_nor_gl_1k.jpg', 'Non-Color')
normal_map = nodes.new('ShaderNodeNormalMap')
normal_map.inputs['Strength'].default_value = .5
links.new(norm.outputs['Color'], normal_map.inputs['Color'])
links.new(normal_map.outputs['Normal'], p.inputs['Normal'])
dark_concrete = material('Riser and tunnel shadow', '#424a50', .93)
steel = material('Graphite structural steel', '#384652', .46, .62)
silver = material('Galvanised roof steel', '#abb6be', .4, .72)
fascia = material('Charcoal acoustic fascia', '#1c2932', .82)
roof_mat = material('Standing seam warm silver roof', '#b7bec3', .64, .35)
roof_seam = material('Roof seams and gutters', '#78868f', .58, .45)
glass = material('Concourse glazing', '#344b5c', .2, .35)
white = material('Court line paint', '#efefdf', .85)
tape_mat = material('Woven white net tape', '#eeeade', .92)
net_mat = material('Braided charcoal net', '#162026', .92)
board_mat = material('Matte padded perimeter', '#142832', .92)
seat_mats = [material(f'Moulded polypropylene • blue {i+1}', color, .55)
             for i, color in enumerate(('#255991', '#356ca5', '#427caf', '#6e94b2'))]
lamp_mat = material('LED diffuser', '#f4f3e7', .35)
lp = lamp_mat.node_tree.nodes.get('Principled BSDF')
lp.inputs['Emission Color'].default_value = (*linear('#e8f2ff'), 1)
lp.inputs['Emission Strength'].default_value = .65


def acrylic(name, color):
    """Bake an original repeatable acrylic grain into portable PBR texture maps."""
    mat = material(name, color, .9)
    rng = np.random.default_rng(8917)
    size = 512
    noise = rng.normal(0, .017, (size, size, 1))
    rgb = np.array([int(color[i:i+2], 16)/255 for i in (1, 3, 5)])
    pixels = np.ones((size, size, 4), dtype=np.float32)
    pixels[:, :, :3] = np.clip(rgb + noise, 0, 1)
    img = bpy.data.images.new(name + ' baked albedo', width=size, height=size)
    # Byte image storage uses sRGB values; the image color-space metadata performs
    # the conversion on sampling. Prelinearizing here would darken the export twice.
    img.pixels.foreach_set(pixels.ravel())
    img.filepath_raw = str(SOURCE / 'textures' / (name.replace(' ', '_') + '.png'))
    img.file_format = 'PNG'
    img.save()
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = img
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (1, 1, 1, 1)
    mat.node_tree.links.new(tex.outputs['Color'], p.inputs['Base Color'])
    return mat


court_blue = acrylic('Acrylic blue', C['blue'])
runoff_green = acrylic('Acrylic green', C['green'])


class Batch:
    """A named editable mesh per architectural component/material; planar UVs in metres."""
    def __init__(self, name, mat, owner=architecture, role=None):
        self.name, self.mat, self.owner, self.role = name, mat, owner, role
        self.vertices, self.faces = [], []

    def face(self, vertices):
        start = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.append(tuple(range(start, start + len(vertices))))

    def box(self, center, dimensions, angle=0):
        x, y, z = center
        w, d, h = (v/2 for v in dimensions)
        co, si = math.cos(angle), math.sin(angle)
        verts = [(x + a*co-b*si, y+a*si+b*co, z+c)
                 for a, b, c in ((-w,-d,-h),(w,-d,-h),(w,d,-h),(-w,d,-h),
                                 (-w,-d,h),(w,-d,h),(w,d,h),(-w,d,h))]
        for indices in ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)):
            self.face([verts[i] for i in indices])

    def beam(self, a, b, radius=.05, sides=6):
        a, b = Vector(a), Vector(b)
        v = (b-a).normalized()
        ref = Vector((0,0,1)) if abs(v.z) < .95 else Vector((1,0,0))
        u = v.cross(ref).normalized() * radius
        w = v.cross(u).normalized() * radius
        ring = [u*math.cos(i*math.tau/sides)+w*math.sin(i*math.tau/sides) for i in range(sides)]
        self.face([tuple(a+r) for r in reversed(ring)])
        self.face([tuple(b+r) for r in ring])
        for i in range(sides):
            j = (i+1) % sides
            self.face([tuple(a+ring[i]),tuple(a+ring[j]),tuple(b+ring[j]),tuple(b+ring[i])])

    def finish(self):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.append(self.mat)
        mesh.update()
        uv = mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            normal = poly.normal
            axes = (0,1) if abs(normal.z) > .5 else ((0,2) if abs(normal.y) > abs(normal.x) else (1,2))
            for li in poly.loop_indices:
                v = mesh.vertices[mesh.loops[li].vertex_index].co
                uv.data[li].uv = (v[axes[0]] / 3, v[axes[1]] / 3)
        obj = bpy.data.objects.new(self.name, mesh)
        self.owner.objects.link(obj)
        if self.role:
            obj['surfaceRole'] = self.role
        if self.owner == roof_collection:
            obj['arenaPart'] = 'roof'
        return obj


PATHS = {}


def path(offset):
    if offset in PATHS:
        return PATHS[offset]
    radius = B['cornerRadius'] + offset
    cx, cy = B['innerHalfWidth'] - B['cornerRadius'], B['innerHalfLength'] - B['cornerRadius']
    points = []
    for quadrant, (x,y) in enumerate(((cx,cy),(-cx,cy),(-cx,-cy),(cx,-cy))):
        for i in range(25):
            a = (quadrant + i/24) * math.pi/2
            points.append(Vector((x+radius*math.cos(a), y+radius*math.sin(a))))
    points.append(points[0])
    lengths = [0.0]
    for a,b in zip(points, points[1:]):
        lengths.append(lengths[-1]+(b-a).length)
    PATHS[offset] = points, lengths
    return points, lengths


def point(offset, fraction):
    points, lengths = path(offset)
    distance = (fraction % 1)*lengths[-1]
    i = min(len(points)-2, bisect.bisect_right(lengths,distance)-1)
    return points[i].lerp(points[i+1], (distance-lengths[i])/(lengths[i+1]-lengths[i]))


def strip(batch, inner, outer, z1, z2=None, start=0, end=1, count=256):
    """Horizontal ring strip, or vertical fascia when inner equals outer."""
    z2 = z1 if z2 is None else z2
    steps = max(1, round(count*(end-start)))
    for i in range(steps):
        a, b = start+(end-start)*i/steps, start+(end-start)*(i+1)/steps
        p,q,r,s = point(inner,a),point(outer,a),point(outer,b),point(inner,b)
        batch.face([(p.x,p.y,z1),(q.x,q.y,z2),(r.x,r.y,z2),(s.x,s.y,z1)])


# Continuous stepped bowl, segmented stair aisles and deliberate entry openings.
tiers = [(0, B['lowerRows'], 2.65, B['lowerRise']),
         (B['lowerRows']*B['rowDepth']+B['concourseWidth'], B['upperRows'], 13.8, B['upperRise'])]
seat_count = 0
seat_templates = []
for i, mat in enumerate(seat_mats):
    seat = Batch(f'Seat mould master {i+1}', mat, seating)
    # Chamfered shell profile, slightly reclined and concave back.
    pan = [(-.205,-.225),(.205,-.225),(.235,-.19),(.235,.19),(.195,.225),(-.195,.225),(-.235,.19),(-.235,-.19)]
    seat.face([(x,y,.45) for x,y in pan])
    seat.face([(x,y,.39) for x,y in reversed(pan)])
    for j,(x,y) in enumerate(pan):
        u,v = pan[(j+1)%len(pan)]
        seat.face([(x,y,.39),(u,v,.39),(u,v,.45),(x,y,.45)])
    # Local -Y is forward; the back sits at +Y.
    back_outline=[(-.225,.49),(.225,.49),(.232,.80),(.195,.875),(.135,.9),(-.135,.9),(-.195,.875),(-.232,.80)]
    front=[(x,.19+(.9-z)*.09,z) for x,z in back_outline]
    back=[(x,y+.062,z) for x,y,z in front]
    seat.face(front)
    seat.face(list(reversed(back)))
    for j in range(len(front)):
        k=(j+1)%len(front)
        seat.face([front[j],front[k],back[k],back[j]])
    seat.box((-.22,.005,.55),(.035,.41,.04))
    seat.box((.22,.005,.55),(.035,.41,.04))
    obj = seat.finish()
    seat_templates.append(obj.data)
    bpy.data.objects.remove(obj, do_unlink=True)

for tier, (offset, rows, base, rise) in enumerate(tiers):
    treads = Batch(f'Tier {tier+1} precast terraces', concrete)
    risers = Batch(f'Tier {tier+1} riser faces', dark_concrete)
    steps = Batch(f'Tier {tier+1} aisle steps', concrete)
    rails = Batch(f'Tier {tier+1} aisle handrails', silver)
    supports = Batch(f'Tier {tier+1} seat pedestals', steel)
    for row in range(rows):
        d, h = offset+row*B['rowDepth'], base+row*rise
        for sec in range(B['sections']):
            start, end = sec/B['sections'], (sec+1)/B['sections']
            # Court access is BELOW the raised front tier, not a shed pushed
            # across the apron. Only the upper concourse cuts through seat rows.
            tunnel = tier == 1 and row < 4 and sec in (3, 11, 19, 27)
            if not tunnel:
                strip(treads,d,d+B['rowDepth'],h,start=start,end=end)
                strip(risers,d,d,h-rise,h,start=start,end=end)
            circumference = path(d+.41)[1][-1]
            section_length = circumference/B['sections']
            num = max(0, int((section_length-1.35)/B['seatSpacing']))
            for j in range(num):
                if tunnel:
                    continue
                fraction = start+(.8+(section_length-1.6)*(j+.5)/num)/circumference
                p = point(d+.43,fraction)
                tangent = (point(d+.43,fraction+.00005)-p).normalized()
                angle = math.atan2(tangent.y,tangent.x)
                # CCW path tangent: local -Y points inward after this rotation.
                angle += math.pi
                shade = (row//5 + sec//4) % 3
                if tier and sec % 8 in (1,2):
                    shade = 3
                obj = bpy.data.objects.new(f'Seat T{tier+1}-{sec+1:02}-{row+1:02}-{j+1:02}',seat_templates[shade])
                seating.objects.link(obj)
                obj.location = (p.x,p.y,h)
                obj.rotation_euler.z = angle
                supports.box((p.x,p.y,h+.20),(.055,.065,.4),angle)
                seat_count += 1
            # Two steps per seating row at each radial aisle.
            half_width = .56/circumference
            for step in range(2):
                sd = d + step*B['rowDepth']/2
                sh = h-rise/2+step*rise/2+.01
                strip(steps,sd,sd+B['rowDepth']/2,sh,start=start-half_width,end=start+half_width,count=512)
                strip(steps,sd,sd,sh-rise/2,sh,start=start-half_width,end=start+half_width,count=512)
            p1,p2 = point(d,start),point(d+B['rowDepth'],start)
            rails.beam((p1.x,p1.y,h+.8),(p2.x,p2.y,h+rise+.8),.022)
            if row % 3 == 0:
                rails.beam((p1.x,p1.y,h),(p1.x,p1.y,h+.8),.022)
    for batch in (treads,risers,steps,rails,supports):
        batch.finish()

lower_end = B['lowerRows']*B['rowDepth']
outer = tiers[1][0]+B['upperRows']*B['rowDepth']
concourse = Batch('Mid-bowl continuous concourse',concrete)
strip(concourse,lower_end,tiers[1][0],11.8)
concourse.finish()
faces = Batch('Mid-tier fascia and upper parapet',fascia)
strip(faces,tiers[1][0],tiers[1][0],11.8,13.85)
strip(faces,outer,outer,23.4,26.5)
strip(faces,outer,outer+3.5,24.6)
faces.finish()
# Complete the external shell so aerial inspection does not reveal a floating roof.
exterior = Batch('Curved external glazed facade',glass)
strip(exterior,outer+3,outer+3,3,25.6)
# The exterior faces outward; reverse the internal-facing strip winding.
exterior.faces=[tuple(reversed(face)) for face in exterior.faces]
exterior.finish()
podium=Batch('Concrete entry podium and exterior bands',concrete)
strip(podium,outer+3,outer+3,-.3,3)
strip(podium,outer+3,outer+9,-.25)
for height in (3,10,18,25.6):
    strip(podium,outer+3,outer+3.35,height)
podium.finish()
columns=Batch('External facade columns',silver)
for i in range(96):
    p=point(outer+3.2,i/96)
    columns.beam((p.x,p.y,0),(p.x,p.y,25.8),.12,8)
columns.finish()
glazing = Batch('Upper hospitality windows',glass)
frames = Batch('Hospitality window mullions',silver)
for i in range(128):
    a,b = i/128+.0008,(i+1)/128-.0008
    strip(glazing,outer-.03,outer-.03,23.6,25.2,start=a,end=b)
    p = point(outer-.08,i/128)
    frames.beam((p.x,p.y,23.4),(p.x,p.y,25.3),.045)
glazing.finish()
frames.finish()
barriers = Batch('Concourse edge railings',silver)
for d,h in ((lower_end-.12,11.95),(tiers[1][0]-.12,13.9),(outer-.3,24.4)):
    for i in range(256):
        p,q = point(d,i/256),point(d,(i+1)/256)
        for z in (h+.5,h+1):
            barriers.beam((p.x,p.y,z),(q.x,q.y,z),.022)
        if i%2 == 0:
            barriers.beam((p.x,p.y,h),(p.x,p.y,h+1),.025)
barriers.finish()
# Tall padded retaining wall follows the seating edge. Split its straight
# sides at exact doorway edges, so neither wall nor low board crosses access.
wall = Batch('Outer padded retaining wall with four access openings',board_mat,court_collection)
wall_points = path(0)[0]
for a,b in zip(wall_points,wall_points[1:]):
    cuts = [0.0,1.0]
    on_side = abs(abs(a.x)-B['innerHalfWidth']) < .001 and abs(a.x-b.x) < .001
    if on_side and abs(b.y-a.y) > .001:
        for center in P['portalCenters']:
            for edge in (center-P['portalWidth']/2,center+P['portalWidth']/2):
                t=(edge-a.y)/(b.y-a.y)
                if 0<t<1: cuts.append(t)
    for lo,hi in zip(sorted(cuts),sorted(cuts)[1:]):
        u,v=a.lerp(b,lo),a.lerp(b,hi)
        middle=(u+v)/2
        opening=on_side and any(abs(middle.y-c)<P['portalWidth']/2 for c in P['portalCenters'])
        bottom=P['portalHeight'] if opening else 0
        height=P['wallHeight']-bottom
        wall.box((middle.x,middle.y,bottom+height/2),((v-u).length,P['wallThickness'],height),math.atan2(v.y-u.y,v.x-u.x))
wall.finish()['arenaPart']='perimeterWall'
portal_lining=Batch('Flush recessed player access linings',fascia,court_collection)
portal_trim=Batch('Access frame edge trims',steel,court_collection)
for side in (-1,1):
    for y in P['portalCenters']:
        x=side*B['innerHalfWidth']
        for sign in (-1,1):
            portal_lining.box((x+side*1.05,y+sign*(P['portalWidth']/2+.065),P['portalHeight']/2),(2.1,.13,P['portalHeight']))
            portal_trim.box((x-side*.18,y+sign*(P['portalWidth']/2+.035),P['portalHeight']/2),(.05,.07,P['portalHeight']))
        portal_lining.box((x+side*1.05,y,P['portalHeight']+.07),(2.1,P['portalWidth'],.14))
        portal_lining.box((x+side*2.15,y,P['portalHeight']/2),(.12,P['portalWidth'],P['portalHeight']))
        portal_lining.box((x+side*1.05,y,-.035),(2.1,P['portalWidth'],.07))
        # Metadata is an inspection contract, not a gameplay collider.
        lane=bpy.data.objects.new(f'Clear player access {side:+} {y:+}',None)
        anchors.objects.link(lane)
        lane.location=(side*13.2,y,1)
        lane['role']='clear-access-lane'
        lane['halfExtents']=[2.4,1.0,1.28]  # glTF Y-up coordinates
portal_lining.finish()
portal_trim.finish()
vestibules=Batch('Recessed dark access vestibules',board_mat)
for offset,rows,base,rise in tiers[1:]:
    floor=11.8
    ceiling=base+4*rise-.08
    for sec in (3,11,19,27):
        fraction=(sec+.5)/32
        p=point(offset+2,fraction)
        tangent=(point(offset+2,fraction+.00005)-p).normalized()
        angle=math.atan2(tangent.y,tangent.x)
        width=path(offset+2)[1][-1]/32+.1
        back=point(offset+3.4,fraction)
        vestibules.box((back.x,back.y,(floor+ceiling)/2),(width,.2,ceiling-floor),angle)
        vestibules.box((p.x,p.y,floor-.04),(width,4,.08),angle)
        vestibules.box((p.x,p.y,ceiling),(width,4,.12),angle)
        for side in (-1,1):
            vestibules.box((p.x+side*tangent.x*width/2,p.y+side*tangent.y*width/2,(floor+ceiling)/2),(.16,4,ceiling-floor),angle)
vestibules.finish()

# The physical aperture is independent of bowl offsets. The old ring's opening
# exceeded its declared dimensions and therefore never shaded the court ends.
def aperture(fraction):
    # Same perimeter correspondence as the outer rounded bowl; rectangular opening.
    p=point(0,fraction)
    scale=min(R['openingHalfWidth']/max(abs(p.x),.001),R['openingHalfLength']/max(abs(p.y),.001))
    return p*scale

def roof_skin(batch,inner_z,outer_z,reverse=False):
    for i in range(256):
        a,b=i/256,(i+1)/256
        u,v=aperture(a),aperture(b)
        p,q=point(outer+5,a),point(outer+5,b)
        verts=[(u.x,u.y,inner_z),(p.x,p.y,outer_z),(q.x,q.y,outer_z),(v.x,v.y,inner_z)]
        batch.face(list(reversed(verts)) if reverse else verts)

# Fixed perimeter roof and separately modelled sliding-panel assemblies.
roof = Batch('Fixed perimeter standing-seam roof',roof_mat,roof_collection)
roof_skin(roof,R['height'],26.5)
roof.finish()
under = Batch('Roof soffit and perimeter rim',fascia,roof_collection)
for i in range(256):
    p,q=aperture(i/256),aperture((i+1)/256)
    under.face([(p.x,p.y,R['height']-.55),(q.x,q.y,R['height']-.55),(q.x,q.y,R['height']),(p.x,p.y,R['height'])])
strip(under,outer+5,outer+5,25.9,26.5)
roof_skin(under,R['height']-.3,26.2,reverse=True)
under.finish()
soffit_ribs=Batch('Underside radial roof purlins',steel,roof_collection)
for i in range(128):
    p,q=aperture(i/128),point(outer+4,i/128)
    soffit_ribs.beam((p.x,p.y,R['height']-.5),(q.x,q.y,26.0),.08)
soffit_ribs.finish()
seams = Batch('Radial roof seams and rain gutters',roof_seam,roof_collection)
for i in range(256):
    p,q = aperture(i/256),point(outer+5,i/256)
    seams.beam((p.x,p.y,R['height']+.05),(q.x,q.y,26.56),.035)
seams.finish()
trusses=Batch('Deep paired transverse runway trusses',silver,roof_collection)
tracks=Batch('Twin steel rails and carriage bearing plates',steel,roof_collection)
catwalk=Batch('Roof maintenance catwalk and guard rails',silver,roof_collection)
bogies=Batch('Sliding roof bogie wheels axles and drive motors',steel,roof_collection)
for side in (-1,1):
    y=side*(R['openingHalfLength']+.7)
    # Paired chords give the truss depth in both section and plan.
    for dy in (-.48,.48):
        for z in (27.0,30.0): trusses.beam((-43,y+dy,z),(43,y+dy,z),.14,8)
        for i in range(22):
            x=-43+i*86/22
            trusses.beam((x,y+dy,27),(x+86/22,y+dy,30),.075)
            trusses.beam((x,y+dy,30),(x+86/22,y+dy,27),.075)
        tracks.box((0,y+dy,30.15),(86,.12,.18))
    for i in range(23):
        x=-43+i*86/22
        trusses.beam((x,y-.48,30),(x,y+.48,30),.09)
        catwalk.box((x,y+side*1.3,28.8),(86/22-.025,.7,.07))
        catwalk.beam((x,y+side*1.65,28.8),(x,y+side*1.65,29.9),.025)
    catwalk.beam((-43,y+side*1.65,29.9),(43,y+side*1.65,29.9),.026)
for side in (-1,1):
    width=R['openingHalfWidth']
    center=side*(width*1.5+R['leafClearance'])
    parked=Batch(f'Parked retractable leaf {side:+}',roof_mat,roof_collection)
    parked.box((center,0,R['leafElevation']),(width,2*R['openingHalfLength'],.24))
    parked.finish()['role']='sliding-roof-leaf'
    ribs=Batch(f'Sliding leaf {side:+} triangulated support frame',silver,roof_collection)
    for j in range(9):
        y=-R['openingHalfLength']+j*R['openingHalfLength']/4
        a,b=center-width/2,center+width/2
        ribs.beam((a,y,30.55),(b,y,30.55),.08)
        ribs.beam((a,y,29.95),(b,y,29.95),.08)
        for i in range(6):
            x=a+i*width/6
            ribs.beam((x,y,29.95),(x+width/6,y,30.55),.045)
    ribs.finish()
    for x in (center-width/2+.7,center+width/2-.7):
        for end in (-1,1):
            y=end*(R['openingHalfLength']+.7)
            bogies.box((x,y,30.58),(1.35,1.45,.18))
            bogies.box((x,y-end*.6,30.87),(.48,.45,.34))
            for dx in (-.4,.4):
                for dy in (-.48,.48):
                    bogies.beam((x+dx,y+dy-.065,30.43),(x+dx,y+dy+.065,30.43),.2,12)
            # Bracket joins carriage to panel rather than floating beside it.
            bogies.beam((x,y,30.68),(x,end*R['openingHalfLength'],30.68),.11)
trusses.finish()
tracks.finish()
catwalk.finish()
bogies.finish()

fixtures = Batch('Floodlight housings',steel,roof_collection)
diffusers = Batch('Floodlight LED panels',lamp_mat,roof_collection)
for side in (-1,1):
    for i in range(9):
        y = -25+i*6.25
        fixtures.box((side*21.5,y,26.7),(1.5,1.0,.4))
        diffusers.box((side*21.5,y,26.47),(1.34,.84,.035))
    anchor = bpy.data.objects.new(f'fixture_{side:+}',None)
    anchors.objects.link(anchor)
    anchor.location=(side*18,0,24)
    anchor['role']='venue-light'
fixtures.finish()
diffusers.finish()

# Court plane is exactly z=0. Blue playing area, green surround, no duplicated faces.
blue = Batch('Regulation blue playing surface',court_blue,court_collection,'court')
blue.box((0,0,-.04),(C['width'],C['length'],.08))
blue.finish()
green = Batch('Green runback and sideline apron',runoff_green,court_collection,'runoff')
w,h = C['width']/2,C['length']/2
apron_x,apron_y=B['innerHalfWidth']+.3,B['innerHalfLength']+.3
green.face([(-apron_x,-apron_y,0),(apron_x,-apron_y,0),(apron_x,-h,0),(-apron_x,-h,0)])
green.face([(-apron_x,h,0),(apron_x,h,0),(apron_x,apron_y,0),(-apron_x,apron_y,0)])
green.face([(-apron_x,-h,0),(-w,-h,0),(-w,h,0),(-apron_x,h,0)])
green.face([(w,-h,0),(apron_x,-h,0),(apron_x,h,0),(w,h,0)])
green.finish()
lines = Batch('Regulation line markings',white,court_collection)
for y in (-h,h):
    lines.box((0,y,.001),(C['width']+.055,.055,.002))
    lines.box((0,y-math.copysign(.075,y),.001),(.055,.15,.002))
for x in (-w,w,-C['singlesWidth']/2,C['singlesWidth']/2):
    lines.box((x,0,.001),(.055,C['length'],.002))
for y in (-C['serviceLine'],C['serviceLine']):
    lines.box((0,y,.001),(C['singlesWidth'],.055,.002))
lines.box((0,0,.001),(.055,C['serviceLine']*2,.002))
lines.finish()
net = Batch('Woven net cords',net_mat,court_collection)
tape = Batch('Sagging net tape and centre strap',tape_mat,court_collection)
posts = Batch('Net posts and winding gear',steel,court_collection)
net_half = w+.914


def net_height(x):
    return .914+(.156)*(abs(x)/net_half)**2


build_net_cords(net, net_half, bottom=.07)
for i in range(96):
    x,q = -net_half+i*2*net_half/96,-net_half+(i+1)*2*net_half/96
    z1,z2=net_height(x),net_height(q)
    tape.face([(x,-.021,z1-.035),(q,-.021,z2-.035),(q,-.021,z2+.035),(x,-.021,z1+.035)])
    tape.face([(q,.021,z2-.035),(x,.021,z1-.035),(x,.021,z1+.035),(q,.021,z2+.035)])
tape.box((0,0,.457),(.05,.05,.914))
for x in (-net_half,net_half):
    posts.beam((x,0,0),(x,0,1.10),.045,12)
    posts.box((x,0,.075),(.21,.21,.15))
tape.finish()
posts.finish()

boards = Batch('Separate low courtside sponsor boards',board_mat,court_collection)
board_signs=[]
for side in (-1,1):
    # Deliberate breaks align with the doorway approaches. The central player
    # zone is also open for benches and the umpire, without crossed boards.
    for start,end in ((-15.5,-12.35),(-9.05,-7.1),(7.1,9.05),(12.35,15.5)):
        y=(start+end)/2
        boards.box((side*P['boardSideX'],y,P['boardHeight']/2),(.18,end-start,P['boardHeight']))
        board_signs.append(((side*(P['boardSideX']-.105),y,.12),-side*math.pi/2))
    for x in (-6.5,-2.2,2.2,6.5):
        boards.box((x,side*P['boardEndY'],P['boardHeight']/2),(3.9,.18,P['boardHeight']))
        board_signs.append(((x,side*(P['boardEndY']-.105),.12),math.pi if side<0 else 0))
boards.finish()['arenaPart']='lowBoards'
bench = Batch('Player bench frames and umpire chair',silver,court_collection)
bench_seats = Batch('Player bench slats',seat_mats[1],court_collection)
for y in (-3.8,3.8):
    for x in (-10.8,-10.2):
        bench.beam((x,y-1.1,0),(x,y-1.1,.45),.033)
        bench.beam((x,y+1.1,0),(x,y+1.1,.45),.033)
    for j in range(5):
        bench_seats.box((-10.8+j*.14,y,.46),(.11,2.6,.045))
    bench_seats.box((-10.88,y,.78),(.05,2.6,.45))
    # Cooler beside each bench.
    bench_seats.box((-10.4,y+1.8,.3),(.7,.6,.6))
for y in (-.48,.48):
    for x in (-9.15,-8.25):
        bench.beam((x,y,0),(-8.7+(x+8.7)*.65,y,2.2),.036)
for i in range(7):
    bench.beam((-9.15+i*.025,-.45,i*.30),(-9.15+i*.025,.45,i*.30),.03)
bench_seats.box((-8.7,0,2.1),(.7,.9,.10))
bench_seats.box((-9.02,0,2.42),(.07,.9,.58))
for y in (-.42,.42):
    bench.beam((-9,y,2.28),(-8.4,y,2.28),.025)
bench.finish()
bench_seats.finish()


def text_object(name, body, location, size, owner=court_collection, rotation=(0,0,0)):
    curve = bpy.data.curves.new(name,'FONT')
    curve.body,curve.align_x,curve.size = body,'CENTER',size
    curve.extrude=.001
    curve.materials.append(white)
    obj=bpy.data.objects.new(name,curve)
    owner.objects.link(obj)
    obj.location,obj.rotation_euler=location,rotation
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    if owner == roof_collection:
        obj['arenaPart']='roof'
    return obj


for side in (-1,1):
    text_object(f'Neutral end-court wordmark {side}', 'T E N M U L A T E', (0,side*18.5,.006),.46,
                rotation=(0,0,math.pi if side<0 else 0))
    text_object(f'End wall signage {side}', 'T E N M U L A T E', (0,side*(B['innerHalfLength']-.18),1.35),.62,
                rotation=(math.pi/2,0,math.pi if side<0 else 0))
    for y in (-6,0,6):
        text_object(f'Side wall signage {side} {y}', 'T E N M U L A T E', (side*(B['innerHalfWidth']-.18),y,1.35),.55,
                    rotation=(math.pi/2,0,-side*math.pi/2))
for i,(position,angle) in enumerate(board_signs):
    text_object(f'Low board wordmark {i}', 'TENMULATE',position,.23,rotation=(math.pi/2,0,angle))
for sec in range(32):
    p=point(tiers[1][0]-.06,(sec+.5)/32)
    tangent=(point(tiers[1][0]-.06,(sec+.501)/32)-p).normalized()
    text_object(f'Section {sec+1:02}',f'{sec+1:02}',(p.x,p.y,12.45),.5,architecture,
                (math.pi/2,0,math.atan2(tangent.y,tangent.x)+math.pi))

# A compact original score display at each end, with modelled frame and characters.
screens = Batch('Scoreboard enclosures',steel,roof_collection)
screen_face = Batch('Scoreboard black glass',board_mat,roof_collection)
for side in (-1,1):
    screens.box((0,side*38.3,18.1),(8.2,.5,3.65))
    screen_face.box((0,side*38.0,18.1),(7.8,.1,3.25))
    rotation=(math.pi/2,0,math.pi if side<0 else 0)
    text_object(f'Scoreboard title {side}','T E N M U L A T E',(0,side*37.92,18.7),.43,roof_collection,rotation)
    text_object(f'Scoreboard score {side}','HOME    0     0\nAWAY    0     0',(0,side*37.91,17.2),.5,roof_collection,rotation)
screens.finish()
screen_face.finish()

for name, location in {'court_origin':(0,0,0),'baseline_near':(0,h,0),
                       'baseline_far':(0,-h,0),'net_center':(0,0,.914),
                       'doubles_left':(-w,0,0),'doubles_right':(w,0,0)}.items():
    obj=bpy.data.objects.new(name,None)
    anchors.objects.link(obj)
    obj.location=location
    obj['role']='court-anchor'

# Reference cameras retained in the .blend; Three.js remains runtime light owner.
def camera(name, position, target, lens):
    data=bpy.data.cameras.new(name)
    obj=bpy.data.objects.new(name,data)
    presentation.objects.link(obj)
    obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    data.lens=lens
    data.clip_end=500
    return obj

scene.camera=camera('01 Player baseline',(0,14,1.7),(0,-15,4.4),22)
camera('02 Lower corner',(12,19,6.3),(0,0,4),20)
camera('03 Upper overview',(64,70,108),(0,0,8),35)
world=bpy.data.worlds.new('Review daylight')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.52,.69,.86,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
scene.world=world
sun_data=bpy.data.lights.new('Review sun','SUN')
sun_data.energy=2.4
sun_data.angle=.06
sun=bpy.data.objects.new('Review sun',sun_data)
presentation.objects.link(sun)
sun.rotation_euler=(math.radians(14),math.radians(-12),math.radians(-35))
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1600
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene['seatCount']=seat_count
scene['referenceBasis']='Visual proportions; not an as-built survey'
runpy.run_path(str(ROOT/'scripts/blender/bake_ambient.py'))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'hard-open-arena.blend'),compress=True)

bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type in {'MESH','EMPTY'}:
        obj.select_set(True)
print(f'Exporting arena: {seat_count} linked seats',flush=True)
bpy.ops.export_scene.gltf(filepath=str(BUILD/'hard-open-arena.raw.glb'),export_format='GLB',
    use_selection=True,export_extras=True,export_cameras=False,export_lights=False,
    export_animations=False,export_yup=True,export_apply=False,export_tangents=True,
    export_vertex_color='ACTIVE')
result={'blend':str(SOURCE/'hard-open-arena.blend'),'rawGlb':str(BUILD/'hard-open-arena.raw.glb'),
        'seats':seat_count,'objects':len(scene.objects),'blender':bpy.app.version_string}
(BUILD/'blender-build.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result),flush=True)
