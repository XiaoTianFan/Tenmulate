"""Original garden grass arena. Blender / metres / Z-up; rebuilds its own scene.

Development sources distinguish published dimensions from authored estimates.
No third-party model, photograph, event identity or branding is exported.
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
from venue_mesh import Batch, material, linear

SOURCE = ROOT / 'assets/venues/grass-center-court'
BUILD = ROOT / 'artifacts/venue-build/grass-center-court'
BUILD.mkdir(parents=True, exist_ok=True)
(SOURCE / 'textures').mkdir(exist_ok=True)
D = json.loads((SOURCE / 'design.json').read_text())
B, C, P, R = (D[k] for k in ('bowl', 'court', 'perimeter', 'roof'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections): bpy.data.collections.remove(col)
bpy.data.orphans_purge(do_recursive=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene['venueId'], scene['sourceVersion'] = D['id'], D['version']
scene['designNotes'] = D['description']


def collection(name):
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    return col


architecture = collection('01 Garden bowl terraces and baseline pavilion')
seating = collection('02 Linked forest-green seats')
roof = collection('03 Fixed canopy and open concertina banks')
court = collection('04 Striped grass court and equipment')
anchors = collection('05 Gameplay light and access registration')
presentation = collection('06 Review cameras and lights - not exported')
stone = material('Muted limestone terrace', D['palette']['terrace'], .94)
riser = material('Dark green terrace risers', D['palette']['riser'], .94)
green = material('Forest green court padding', D['palette']['wall'], .86)
roofmat = material('Olive standing seam fixed roof', D['palette']['roof'], .72, .15)
soffitmat = material('Sage panelled canopy soffit', D['palette']['soffit'], .83)
steel = material('Ivory painted roof steel', D['palette']['steel'], .46, .25)
dark = material('Dark bronze rails and frames', '#303e34', .65, .3)
white = material('Warm white court paint', '#eeeedd', .9)
timber = material('Honey oak pavilion trim', D['palette']['timber'], .72)
netmat = material('Dark woven net', '#202c24', .97)
glass = material('Deep green recessed glazing', '#263c34', .24, .25)
glass.use_backface_culling = False
membrane = material('Dense ivory folded roof fabric', '#e1e5da', R['membraneRoughness'])
membrane.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = R['membraneTransmission']
membrane.use_backface_culling = False
lamp = material('Court light diffusers', '#f7f3e5', .4)
lamp.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (*linear('#f7f3e5'), 1)
lamp.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = .6


def image_node(mat, name, pixels, space='sRGB'):
    height, width = pixels.shape[:2]
    image = bpy.data.images.new(name, width=width, height=height)
    image.colorspace_settings.name = space
    image.pixels.foreach_set(pixels.astype(np.float32).ravel())
    image.filepath_raw = str(SOURCE / 'textures' / f'{name}.png')
    image.file_format = 'PNG'
    image.save()
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = image
    return node


# Original full-lawn PBR map. World-aligned UVs keep stripes continuous across
# the regulation surface and the adjoining runoff; no baked directional light.
size = 1024
yy, xx = np.mgrid[0:size, 0:size]
x = (xx / (size-1) - .5) * C['grassWidth']
y = (yy / (size-1) - .5) * C['grassLength']
rng = np.random.default_rng(20497)
grain = rng.normal(0, 1, (size, size))
stripes = np.where((np.floor((x + C['grassWidth']/2) / C['stripeWidth']).astype(int) % 2) == 0, 1.1, .89)
streaks = rng.normal(0, .022, (1, size))
color = np.array([int(D['palette']['grass'][i:i+2],16)/255 for i in (1,3,5)])
rgb = color[None, None, :] * (stripes + .06*grain + streaks)[:, :, None]
wear = np.exp(-((np.abs(y)-11.885)/.85)**2) * np.exp(-(x/4.6)**6) * .38
rgb = rgb * (1-wear[:, :, None]) + np.array([.60,.51,.34])[None, None, :] * wear[:, :, None]
pixels = np.ones((size, size, 4))
pixels[:, :, :3] = np.clip(rgb, 0, 1)
grass = material('Original striped ryegrass', D['palette']['grass'], .93)
albedo = image_node(grass, 'grass-stripes-albedo', pixels)
grass.node_tree.links.new(albedo.outputs['Color'], grass.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
pixels[:, :, :3] = np.clip(.93 + grain[:, :, None]*.018, .82, 1)
rough = image_node(grass, 'grass-fibre-roughness', pixels, 'Non-Color')
grass.node_tree.links.new(rough.outputs['Color'], grass.node_tree.nodes['Principled BSDF'].inputs['Roughness'])
gy, gx = np.gradient(grain)
normal = np.dstack((-gx*.16, -gy*.085, np.ones_like(grain)))
normal /= np.linalg.norm(normal, axis=2)[:, :, None]
pixels[:, :, :3] = normal*.5+.5
normaltex = image_node(grass, 'grass-fibre-normal', pixels, 'Non-Color')
normalnode = grass.node_tree.nodes.new('ShaderNodeNormalMap')
normalnode.inputs['Strength'].default_value = .3
grass.node_tree.links.new(normaltex.outputs['Color'], normalnode.inputs['Color'])
grass.node_tree.links.new(normalnode.outputs['Normal'], grass.node_tree.nodes['Principled BSDF'].inputs['Normal'])
# Micro-fibre maps repeat independently of the nonrepeating mowing/wear albedo.
coords = grass.node_tree.nodes.new('ShaderNodeTexCoord')
mapping = grass.node_tree.nodes.new('ShaderNodeMapping')
mapping.inputs['Scale'].default_value = (6,6,1)
grass.node_tree.links.new(coords.outputs['UV'], mapping.inputs['Vector'])
for node in (normaltex, rough): grass.node_tree.links.new(mapping.outputs['Vector'], node.inputs['Vector'])


def text(name, body, location, size, rotation=(0, 0, 0), owner=court, mat=white):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body, curve.align_x, curve.size = body, 'CENTER', size
    curve.extrude = .0005
    curve.materials.append(mat)
    obj = bpy.data.objects.new(name, curve)
    owner.objects.link(obj)
    obj.location, obj.rotation_euler = location, rotation
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj


def shape(depth):
    return B['innerHalfWidth']+depth, B['innerHalfLength']+depth, B['cornerRadius']+depth*B['cornerGrowth']


def corner_point(c, depth, t):
    a, b, radius = shape(depth)
    sx, sy = ((1, 1), (-1, 1), (-1, -1), (1, -1))[c]
    theta = (c+t)*math.pi/2
    return Vector((sx*(a-radius)+radius*math.cos(theta), sy*(b-radius)+radius*math.sin(theta)))


STANDS = ('East', 'North', 'West', 'South')


def stand_point(s, depth, t):
    a, b, _ = shape(depth)
    return Vector({'East': (a, t), 'North': (t, b), 'West': (-a, t), 'South': (t, -b)}[s])


def limit(s, depth):
    a, b, radius = shape(depth)
    return (b if s in ('East', 'West') else a)-radius


def stand_strip(batch, s, d1, d2, z1, z2, lo=-1000, hi=1000):
    l1, l2 = limit(s, d1), limit(s, d2)
    a, b, c, d = max(lo, -l1), min(hi, l1), max(lo, -l2), min(hi, l2)
    if a >= b or c >= d: return
    points = [stand_point(s, d1, a), stand_point(s, d2, c), stand_point(s, d2, d), stand_point(s, d1, b)]
    vertices = [(p.x, p.y, z) for p, z in zip(points, (z1, z2, z2, z1))]
    if s in ('North', 'West'): vertices.reverse()
    batch.face(vertices)


def corner_strip(batch, c, d1, d2, z1, z2, lo=0, hi=1):
    for i in range(16):
        a, b = lo+(hi-lo)*i/16, lo+(hi-lo)*(i+1)/16
        pts = (corner_point(c, d1, a), corner_point(c, d2, a), corner_point(c, d2, b), corner_point(c, d1, b))
        batch.face([(p.x, p.y, z) for p, z in zip(pts, (z1, z2, z2, z1))])


def ring(batch, d1, d2, z1, z2=None):
    z2 = z1 if z2 is None else z2
    for s in STANDS: stand_strip(batch, s, d1, d2, z1, z2)
    for c in range(4): corner_strip(batch, c, d1, d2, z1, z2)


templates = []
for i, color in enumerate(D['palette']['seats']):
    mat = material(f'Moulded garden green seating {i+1}', color, .56)
    shell = Batch(f'Curved green seat shell {i+1}', mat, seating)
    pan = [(-.21, -.22), (.21, -.22), (.235, -.15), (.235, .15), (.19, .21), (-.19, .21), (-.235, .15), (-.235, -.15)]
    shell.face([(a, b, .45) for a, b in pan])
    shell.face([(a, b, .415) for a, b in reversed(pan)])
    for j, (a, b) in enumerate(pan):
        c, d = pan[(j+1) % len(pan)]
        shell.face([(a, b, .415), (c, d, .415), (c, d, .45), (a, b, .45)])
    for j in range(6):
        a, b = -.235+j*.47/6, -.235+(j+1)*.47/6
        ya, yb = .18+.65*a*a, .18+.65*b*b
        za, zb = .86-.55*a*a, .86-.55*b*b
        shell.face([(a, ya, .51), (b, yb, .51), (b, yb+.035, zb), (a, ya+.035, za)])
        shell.face([(b, yb+.045, .51), (a, ya+.045, .51), (a, ya+.08, za), (b, yb+.08, zb)])
        shell.face([(a, ya+.035, za), (b, yb+.035, zb), (b, yb+.08, zb), (a, ya+.08, za)])
    obj = shell.finish()
    templates.append(obj.data)
    bpy.data.objects.remove(obj, do_unlink=True)

seat_count, seat_tiers = 0, []
seat_rng = np.random.default_rng(2917)


def seat(name, p, z, angle, support):
    global seat_count
    obj = bpy.data.objects.new(name, templates[int(seat_rng.integers(4))])
    seating.objects.link(obj)
    obj.location, obj.rotation_euler.z = (p.x, p.y, z), angle
    support.box((p.x, p.y, z+.22), (.055, .065, .44), angle)
    t = Vector((math.cos(angle), math.sin(angle)))
    support.box((p.x+t.x*.25, p.y+t.y*.25, z+.6), (.025, .32, .035), angle)
    seat_count += 1


def split_spans(holes):
    cursor = -1000
    for a, b in sorted(holes):
        if a > cursor: yield cursor, a
        cursor = max(cursor, b)
    yield cursor, 1000


for ti, tier in enumerate(B['tiers']):
    before = seat_count
    terraces = Batch(f'Tier {ti+1} precast terraces', stone, architecture)
    risers = Batch(f'Tier {ti+1} riser faces', riser, architecture)
    stairs = Batch(f'Tier {ti+1} court-normal and fan stairs', stone, architecture)
    rails = Batch(f'Tier {ti+1} slender dark handrails', dark, architecture)
    supports = Batch(f'Tier {ti+1} seat pedestals and arms', dark, seating)
    portals = Batch(f'Tier {ti+1} recessed terrace entrances', green, architecture)
    for row in range(tier['rows']):
        depth, z = tier['offset']+row*B['rowDepth'], tier['base']+row*tier['rise']
        for s in STANDS:
            if tier.get('omitSouth') and s == 'South': continue
            side = s in ('East', 'West')
            angle = {'East': -math.pi/2, 'North': 0, 'West': math.pi/2, 'South': math.pi}[s]
            aisles = B['sidelineAisles'] if side else B['baselineAisles'] + ([0] if s == 'North' else [])
            holes = []
            # Full body-height ground approaches are carved out of the first rows.
            if ti == 0 and side and row < 6: holes += [(c-1.48, c+1.48) for c in P['portalCenters']]
            # Baseline pavilions occupy real reserved volumes, not overlaid seats.
            if ti == 0 and not side and row < (9 if s == 'South' else 5): holes.append((-6.6, 6.6))
            entries = (-16, 0, 16) if side else (-6, 6)
            if ti == 1 and 3 <= row < 7: holes += [(c-1.35, c+1.35) for c in entries]
            for lo, hi in split_spans(holes):
                stand_strip(terraces, s, depth, depth+B['rowDepth'], z, z, lo, hi)
                stand_strip(risers, s, depth, depth, z-tier['rise'], z, lo, hi)
            n = math.floor((limit(s, depth+.4)-.33)/B['seatSpacing'])
            for column in range(-n, n+1):
                t = column*B['seatSpacing']
                if any(abs(t-a) < B['aisleWidth']/2+.27 for a in aisles): continue
                if any(lo-.27 < t < hi+.27 for lo, hi in holes): continue
                seat(f'Seat T{ti+1} {s} R{row+1:02} C{column:+04}', stand_point(s, depth+.4, t), z, angle, supports)
            for a in aisles:
                if abs(a) > limit(s, depth)-.7 or any(lo < a < hi for lo, hi in holes): continue
                for step in range(2):
                    d = depth+step*B['rowDepth']/2
                    h = z-tier['rise']/2+step*tier['rise']/2+.012
                    stand_strip(stairs, s, d, d+B['rowDepth']/2, h, h, a-.56, a+.56)
                    stand_strip(stairs, s, d, d, h-tier['rise']/2, h, a-.56, a+.56)
                p, q = stand_point(s, depth, a), stand_point(s, depth+B['rowDepth'], a)
                rails.beam((p.x, p.y, z+.86), (q.x, q.y, z+tier['rise']+.86), .019)
                if row % 3 == 0: rails.beam((p.x, p.y, z), (p.x, p.y, z+.86), .023)
            if ti == 1 and row == 3:
                for a in entries:
                    p = stand_point(s, depth+1.48, a)
                    tangent = (stand_point(s, depth, 1)-stand_point(s, depth, 0)).normalized()
                    rot = math.atan2(tangent.y, tangent.x)
                    portals.box((p.x, p.y, z-.92), (2.7, 2.96, .12), rot)
                    for sign in (-1, 1): portals.box((p.x+sign*1.38*tangent.x, p.y+sign*1.38*tangent.y, z+.14), (.12, 2.96, 2.24), rot)
                    back = stand_point(s, depth+3.0, a)
                    portals.box((back.x, back.y, z+.54), (2.85, .12, 3.1), rot)
        for c in range(4):
            # The additional gallery stops at the south corners, as in the plan.
            if tier.get('omitSouth') and c in (2, 3): continue
            corner_strip(terraces, c, depth, depth+B['rowDepth'], z, z)
            corner_strip(risers, c, depth, depth, z-tier['rise'], z)
            radius = shape(depth+.4)[2]
            length = radius*math.pi/2
            n = math.floor((length-.7)/B['seatSpacing'])
            fractions = (1/3, 2/3)
            for j in range(n):
                t = .5+(j-(n-1)/2)*B['seatSpacing']/length
                if any(abs(t-a)*length < .84 for a in fractions): continue
                seat(f'Seat T{ti+1} Corner{c+1} R{row+1:02} C{j:03}', corner_point(c, depth+.4, t), z, (c+t)*math.pi/2-math.pi/2, supports)
            for a in fractions:
                half = .56/length
                for step in range(2):
                    d = depth+step*B['rowDepth']/2
                    h = z-tier['rise']/2+step*tier['rise']/2+.012
                    corner_strip(stairs, c, d, d+B['rowDepth']/2, h, h, a-half, a+half)
                    corner_strip(stairs, c, d, d, h-tier['rise']/2, h, a-half, a+half)
                p, q = corner_point(c, depth, a), corner_point(c, depth+B['rowDepth'], a)
                rails.beam((p.x, p.y, z+.86), (q.x, q.y, z+tier['rise']+.86), .019)
                if row % 3 == 0: rails.beam((p.x, p.y, z), (p.x, p.y, z+.86), .023)
    for batch in (terraces, risers, stairs, rails, supports, portals): batch.finish()
    seat_tiers.append(seat_count-before)

outer = B['tiers'][-1]['offset'] + B['tiers'][-1]['rows']*B['rowDepth']
concourse = Batch('Continuous narrow concourse landings', stone, architecture)
parapet = Batch('Continuous dark concourse parapets', green, architecture)
for d1, d2, z, previous, following in ((8.88, 10.48, 5.12, 4.69, 6.1), (29.72, 30.47, 16.87, 16.35, 17.44), (outer, outer+2.5, 20.4, 19.59, 20.4)):
    ring(concourse, d1, d2, z)
    ring(concourse, d1, d1, previous, z)
    ring(concourse, d2, d2, z, following)
    ring(parapet, d1+.04, d1+.04, z, z+.84)
concourse.finish()
parapet.finish()

# Complete muted garden facade: continuous enclosure, stone bands, inset windows,
# piers and planted ground edge. No borrowed facade photography or branding.
facade = Batch('Garden green exterior enclosure', green, architecture)
ring(facade, outer+1.6, outer+1.6, 0, R['outerHeight'])
facade.faces = [tuple(reversed(f)) for f in facade.faces]
facade.finish()
interior_mat = material('Interior dark concourse enclosure', '#293d30', .92)
interior_mat.use_backface_culling = False
interior = Batch('Continuous inner enclosure and rear canopy reveal', interior_mat, architecture)
ring(interior, outer+1.45, outer+1.45, 0, R['outerHeight'])
interior.finish()
bands = Batch('Exterior limestone belts and podium', stone, architecture)
for z in (0, 4.5, 9.1, 14, 19): ring(bands, outer+1.5, outer+3.0, z)
ring(bands, outer+1.5, outer+6, -.15)
bands.finish()
foundation = Batch('Continuous garden foundation below bowl and apron', riser, architecture)
a,b,r = shape(outer+6)
outline = []
for c in range(4):
    for t in np.linspace(0,1,33): outline.append(corner_point(c,outer+6,float(t)))
for p,q in zip(outline,outline[1:]+outline[:1]): foundation.face([(0,0,-.18),(p.x,p.y,-.18),(q.x,q.y,-.18)])
foundation.finish()
windows = Batch('Exterior recessed window bands', glass, architecture)
for z in (5.3, 10, 15): ring(windows, outer+1.64, outer+1.64, z, z+2.5)
windows.faces = [tuple(reversed(f)) for f in windows.faces]
windows.finish()
piers = Batch('Garden facade mullions and piers', dark, architecture)
for s in STANDS:
    for t in np.arange(-limit(s, outer), limit(s, outer)+.1, 3.2):
        p = stand_point(s, outer+1.78, float(t))
        piers.box((p.x, p.y, 11), (.2, .2, 22))
for c in range(4):
    for t in np.linspace(0, 1, 18):
        p = corner_point(c, outer+1.78, float(t))
        piers.box((p.x, p.y, 11), (.2, .2, 22))
piers.finish()

# Thin low padding around the court, with recessed access pockets at four sides.
wall = Batch('Low perimeter padding with open player portals', green, court)
for s in STANDS:
    holes = [(c-1.3, c+1.3) for c in P['portalCenters']] if s in ('East', 'West') else []
    for lo, hi in split_spans(holes): stand_strip(wall, s, 0, 0, 0, P['wallHeight'], lo, hi)
for c in range(4): corner_strip(wall, c, 0, 0, 0, P['wallHeight'])
wall.finish()['arenaPart'] = 'perimeterWall'
linings = Batch('Recessed player access linings', green, court)
for sign in (-1, 1):
    for y0 in P['portalCenters']:
        x0 = sign*B['innerHalfWidth']
        for edge in (-1, 1): linings.box((x0+sign*2.1, y0+edge*1.43, 1.1), (4.2, .12, 2.2))
        linings.box((x0+sign*2.1, y0, -.06), (4.2, 2.8, .12))
        linings.box((x0+sign*2.1, y0, 2.27), (4.2, 2.8, .16))
        linings.box((x0+sign*4.25, y0, 1.1), (.1, 2.8, 2.2))
        obj = bpy.data.objects.new(f'Clear player approach {sign} {y0}', None)
        anchors.objects.link(obj)
        obj.location = (sign*12.7, y0, 1.05)
        obj['role'], obj['halfExtents'] = 'clear-access-lane', [2.5, .98, 1.08]
linings.finish()

w, h = C['width']/2, C['length']/2
playing = Batch('Regulation striped grass playing surface', grass, court, 'court')
playing.face([(-w, -h, 0), (w, -h, 0), (w, h, 0), (-w, h, 0)])
apron = Batch('Continuous striped grass runback', grass, court, 'runoff')
ax, ay = C['grassWidth']/2, C['grassLength']/2
for vertices in [[(-ax,-ay,0),(ax,-ay,0),(ax,-h,0),(-ax,-h,0)], [(-ax,h,0),(ax,h,0),(ax,ay,0),(-ax,ay,0)],
                 [(-ax,-h,0),(-w,-h,0),(-w,h,0),(-ax,h,0)], [(w,-h,0),(ax,-h,0),(ax,h,0),(w,h,0)]]: apron.face(vertices)
for batch in (playing, apron):
    obj = batch.finish()
    for loop in obj.data.loops:
        v = obj.data.vertices[loop.vertex_index].co
        obj.data.uv_layers.active.data[loop.index].uv = ((v.x+ax)/(ax*2), (v.y+ay)/(ay*2))
walk = Batch('Grass edge drainage and perimeter walk', stone, court)
walk.box((0, -21.24, -.04), (24.4, 1.48, .08))
walk.box((0, 21.24, -.04), (24.4, 1.48, .08))
for sign in (-1, 1): walk.box((sign*11.6, 0, -.04), (1.2, 41, .08))
walk.finish()
drains = Batch('Narrow court drainage channels', dark, court)
for sign in (-1, 1):
    drains.box((sign*11.08, 0, .003), (.08, 41, .006))
    drains.box((0, sign*20.58, .003), (22.2, .08, .006))
drains.finish()
lines = Batch('Regulation grass court painted lines', white, court)
for y0 in (-h, h):
    lines.box((0, y0, .003), (C['width']+.05, .05, .003))
    lines.box((0, y0-math.copysign(.075, y0), .003), (.05, .15, .003))
for x0 in (-w, w, -C['singlesWidth']/2, C['singlesWidth']/2): lines.box((x0, 0, .003), (.05, C['length'], .003))
for y0 in (-C['serviceLine'], C['serviceLine']): lines.box((0, y0, .003), (C['singlesWidth'], .05, .003))
lines.box((0, 0, .003), (.05, 2*C['serviceLine'], .003))
lines.finish()

net = Batch('Woven net cords', netmat, court)
tape = Batch('Ivory net headband and center strap', white, court)
posts = Batch('Honey timber net posts', timber, court)
nh = w+.914
def netheight(x0): return .914+.156*(abs(x0)/nh)**2
for i in range(193):
    x0 = -nh+i*2*nh/192
    net.beam((x0,0,.055), (x0,0,netheight(x0)-.036), .0017, 4)
for row in range(16):
    for i in range(48):
        a,b = -nh+i*2*nh/48, -nh+(i+1)*2*nh/48
        net.beam((a,0,.055+(netheight(a)-.1)*row/15), (b,0,.055+(netheight(b)-.1)*row/15), .0017, 4)
for i in range(96):
    a,b = -nh+i*2*nh/96, -nh+(i+1)*2*nh/96
    for sign in (-1,1): tape.face([(a,sign*.02,netheight(a)-.035),(b,sign*.02,netheight(b)-.035),(b,sign*.02,netheight(b)+.035),(a,sign*.02,netheight(a)+.035)])
tape.mat.use_backface_culling = False
tape.box((0,0,.457),(.05,.05,.914))
for x0 in (-nh,nh): posts.beam((x0,0,0),(x0,0,1.1),.052,12)
for batch in (net,tape,posts): batch.finish()

# Distinct baseline pavilions replace rather than overlap the reserved seating.
pavilion = Batch('Baseline garden pavilion and media wall', green, architecture)
trim = Batch('Oak pavilion side cheeks and rails', timber, architecture)
for sign in (-1,1):
    pavilion.box((0,sign*23.65,1.5),(12.8,3.2,3.0))
    pavilion.box((0,sign*22.06,1.9),(11.6,.16,2.5))
    for x0 in (-6.1,6.1): trim.box((x0,sign*24,3.48),(.18,3.8,.85))
honor_support = Batch('Pavilion lounge seat pedestals', dark, seating)
for row in range(5):
    y0, z = -23.0-row*.74, 3.05+row*.29
    pavilion.box((0,y0,z-.1),(11.6,.74,.2))
    for x0 in np.arange(-5.15,5.2,.67):
        if abs(x0)<.65: continue
        seat(f'Garden pavilion seat R{row} X{x0:.2f}',Vector((float(x0),y0)),z,math.pi,honor_support)
    for x0 in (-5.95,5.95): trim.box((x0,y0,z+.48),(.18,.74,.96))
pavilion.finish()
trim.finish()
honor_support.finish()

frames = Batch('Player chair and umpire frames', dark, court)
cushions = Batch('Green player cushions and coolers', green, court)
for y0 in (-4.6,-3.6,3.6,4.6):
    for dx in (-.25,.25):
        for dy in (-.26,.26): frames.beam((-9.4+dx,y0+dy,0),(-9.4+dx,y0+dy,.48),.024)
    cushions.box((-9.4,y0,.48),(.65,.65,.12))
    cushions.box((-9.7,y0,.8),(.1,.66,.6))
for y0 in (-6,6): cushions.box((-9.5,y0,.32),(.7,.62,.64))
for y0 in (-.43,.43):
    for x0 in (-8.5,-7.7): frames.beam((x0,y0,0),(-8.1+(x0+8.1)*.65,y0,2.12),.04)
for i in range(7): frames.beam((-8.5+i*.025,-.43,i*.3),(-8.5+i*.025,.43,i*.3),.024)
cushions.box((-8.1,0,2.12),(.72,.86,.12))
cushions.box((-8.43,0,2.43),(.12,.86,.58))
frames.finish()
cushions.finish()
for sign in (-1,1):
    text(f'Baseline neutral wordmark {sign}','T E N M U L A T E',(0,sign*21.965,1.22),.38,(math.pi/2,0,math.pi if sign<0 else 0))
    for y0 in (-8,8): text(f'Sideline neutral wordmark {sign} {y0}','TENMULATE',(sign*12.18,y0,.55),.34,(math.pi/2,0,-sign*math.pi/2))
score = Batch('Original baseline scoreboard housings', dark, court)
for sign in (-1,1):
    x0,y0 = sign*8.8,sign*21.88
    score.box((x0,y0,2.1),(3.8,.28,2.0))
    rot = (math.pi/2,0,math.pi if sign<0 else 0)
    text(f'Neutral score title {sign}','PRACTICE',(x0,y0-sign*.16,2.63),.28,rot)
    text(f'Neutral score values {sign}','HOME   0   0\nAWAY   0   0',(x0,y0-sign*.17,1.66),.25,rot)
score.finish()


def roundrect(a,b,r,t):
    # Uniform eight-piece parameterization is sufficient for the roof's ring.
    segment = min(7,int(t*8))
    u = t*8-segment
    points = [(a,b-r),(a-r,b),(-a+r,b),(-a,b-r),(-a,-b+r),(-a+r,-b),(a-r,-b),(a,-b+r)]
    if segment%2:
        return Vector(points[segment]).lerp(Vector(points[(segment+1)%8]),u)
    c = segment//2
    sx,sy = ((1,1),(-1,1),(-1,-1),(1,-1))[c]
    theta = (c+u)*math.pi/2
    return Vector((sx*(a-r)+r*math.cos(theta),sy*(b-r)+r*math.sin(theta)))


def roofpoints(t):
    a,b,r = shape(outer+3)
    return roundrect(R['openingHalfWidth'],R['openingHalfLength'],5,t),roundrect(a,b,r,t)


top = Batch('Olive fixed perimeter canopy', roofmat, roof, roof=True)
soffit = Batch('Opaque grid panel canopy underside', soffitmat, roof, roof=True)
fascia = Batch('Deep curved canopy aperture fascia', roofmat, roof, roof=True)
seams = Batch('Canopy radial and concentric panel seams', dark, roof, roof=True)
for i in range(256):
    u,p = roofpoints(i/256)
    v,q = roofpoints((i+1)/256)
    zi,zo = R['edgeHeight'],R['outerHeight']
    top.face([(u.x,u.y,zi),(p.x,p.y,zo),(q.x,q.y,zo),(v.x,v.y,zi)])
    soffit.face([(v.x,v.y,zi-.2),(q.x,q.y,zo-.2),(p.x,p.y,zo-.2),(u.x,u.y,zi-.2)])
    fascia.face([(u.x,u.y,zi-1.0),(v.x,v.y,zi-1.0),(v.x,v.y,zi),(u.x,u.y,zi)])
    for t in (0,.2,.4,.6,.8,1):
        a,b = u.lerp(p,t),v.lerp(q,t)
        z = zi+(zo-zi)*t-.22
        seams.beam((a.x,a.y,z),(b.x,b.y,z),.017,4)
    if i%4==0: seams.beam((u.x,u.y,zi-.22),(p.x,p.y,zo-.22),.022,4)
for batch in (top,soffit,fascia,seams): batch.finish()

# Two genuinely separate parked banks, with triangular space-frame chords and
# pleated fabric between them. No leaf, truss or skin crosses the open aperture.
tracks = Batch('Concertina rails supports and travel beams', dark, roof, roof=True)
bogies = Batch('Roof carriage wheels and drive housings', steel, roof, roof=True)
for sign in (-1,1):
    tracks.box((sign*R['halfSpan'],0,22.05),(.7,96,1.1))
    tracks.box((sign*R['halfSpan'],0,22.67),(.16,96,.16))
    for y0 in (-45,-32,32,45): tracks.beam((sign*R['halfSpan'],y0,18),(sign*R['halfSpan'],y0,22),.18,6)
def camber(x0): return R['camber']*(1-(x0/R['halfSpan'])**2)
for bank in (-1,1):
    for index in range(R['trussesPerBank']):
        y0 = bank*(R['bankLeadingY']+index*R['parkedPitch'])
        truss = Batch(f'Open roof bank {bank:+} lattice truss {index+1}',steel,roof,roof=True)
        for k in range(12):
            a,b = -R['halfSpan']+k*2*R['halfSpan']/12,-R['halfSpan']+(k+1)*2*R['halfSpan']/12
            za,zb = R['trussBase']+camber(a),R['trussBase']+camber(b)
            for dy in (-.27,.27):
                truss.beam((a,y0+dy,za),(b,y0+dy,zb),.13,8)
                truss.beam((a,y0+dy,za+R['trussDepth']),(b,y0+dy,zb+R['trussDepth']),.15,8)
                truss.beam((a,y0+dy,za if k%2==0 else za+R['trussDepth']),(b,y0+dy,zb+R['trussDepth'] if k%2==0 else zb),.085,6)
            truss.beam((a,y0-.27,za),(b,y0+.27,zb),.045)
        obj = truss.finish()
        obj['role'],obj['roofBank'],obj['trussIndex'] = 'concertina-roof-truss',bank,index
        for sign in (-1,1):
            x0 = sign*R['halfSpan']
            bogies.box((x0,y0,22.9),(.95,1.1,.22))
            for dy in (-.35,.35): bogies.beam((x0-.25,y0+dy,22.7),(x0+.25,y0+dy,22.7),.19,10)
            bogies.box((x0+sign*.48,y0,23.0),(.4,.6,.45))
        if index == R['trussesPerBank']-1: continue
        skin = Batch(f'Folded dense fabric bank {bank:+} bay {index+1}',membrane,roof,roof=True)
        for j in range(8):
            ta,tb = j/8,(j+1)/8
            ya,yb = y0+bank*ta*R['parkedPitch'],y0+bank*tb*R['parkedPitch']
            for k in range(24):
                a,b = -R['halfSpan']+k*2*R['halfSpan']/24,-R['halfSpan']+(k+1)*2*R['halfSpan']/24
                za = R['trussBase']+R['trussDepth']+.12+1.2*math.sin(ta*math.pi)
                zb = R['trussBase']+R['trussDepth']+.12+1.2*math.sin(tb*math.pi)
                skin.face([(a,ya,za+camber(a)),(b,ya,za+camber(b)),(b,yb,zb+camber(b)),(a,yb,zb+camber(a))])
        obj=skin.finish()
        obj['roofMembrane'],obj['role'],obj['roofBank']=True,'folded-roof-fabric',bank
tracks.finish()
bogies.finish()
fixtures = Batch('Fixed canopy light housings', dark, roof, roof=True)
lenses = Batch('Fixed canopy light lenses', lamp, roof, roof=True)
for sign in (-1,1):
    for y0 in (-22,-11,0,11,22):
        fixtures.box((sign*29.8,y0,20.0),(1.4,.82,.28))
        lenses.box((sign*29.8,y0,19.85),(1.28,.72,.025))
for batch in (fixtures,lenses): batch.finish()
for x0 in (-18,18):
    for y0 in (-20,20):
        obj=bpy.data.objects.new(f'court_light_{x0}_{y0}',None)
        anchors.objects.link(obj)
        obj.location=(x0,y0,19.8)
        obj['role']='venue-light'

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
    data.lens,data.clip_end=lens,500
    return obj


scene.camera=camera('01 Player baseline',(0,14,1.7),(0,-18,3),22)
camera('02 Court corner',(14,21,7),(0,0,5),22)
camera('03 Roof overview',(72,80,92),(0,0,8),38)
world=bpy.data.worlds.new('Neutral garden review sky')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.52,.69,.86,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
scene.world=world
sun_data=bpy.data.lights.new('Review sun','SUN')
sun_data.energy,sun_data.angle=2.5,.06
sun=bpy.data.objects.new('Review sun',sun_data)
presentation.objects.link(sun)
sun.rotation_euler=(math.radians(20),math.radians(-12),math.radians(145))
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x,scene.render.resolution_y=1600,1000
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene['seatCount'],scene['seatCountByTier']=seat_count,seat_tiers
scene['referenceBasis']='Public schematic and photographic proportions, not a surveyed or certified reconstruction'
runpy.run_path(str(ROOT/'scripts/blender/bake_ambient.py'))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'grass-center-court.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type in {'MESH','EMPTY'}: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(BUILD/'grass-center-court.raw.glb'),export_format='GLB',
    use_selection=True,export_extras=True,export_cameras=False,export_lights=False,
    export_animations=False,export_yup=True,export_apply=False,export_tangents=True,export_vertex_color='ACTIVE')
result={'blend':str(SOURCE/'grass-center-court.blend'),'rawGlb':str(BUILD/'grass-center-court.raw.glb'),
        'seats':seat_count,'seatTiers':seat_tiers,'objects':len(scene.objects),'blender':bpy.app.version_string}
(BUILD/'blender-build.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result),flush=True)
