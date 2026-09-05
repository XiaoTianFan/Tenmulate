"""Export a genuinely simplified Blender variant and shared seat registration.

Reads the packed quality master without modifying it. Linked seat shells become
four-triangle folded cards; secondary rails, seams and hardware are omitted;
fine net cords become an alpha-cutout mesh. Structural silhouettes remain.
"""
import json
import math
import re
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/blender'))
from venue_mesh import Batch, material
VENUE=sys.argv[sys.argv.index('--')+1]
SOURCE=ROOT/'assets/venues'/VENUE
BUILD=ROOT/'artifacts/venue-build'/VENUE if VENUE!='hard-open-arena' else ROOT/'artifacts/venue-build'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/f'{VENUE}.blend'))
scene=bpy.context.scene
seats=sorted([o for o in scene.objects if o.type=='MESH' and (o.name.startswith('Seat ') or o.name.startswith('Garden pavilion seat '))],key=lambda o:o.name)
if len(seats)!=scene.get('seatCount'): raise RuntimeError('Seat registration does not cover every authored seat')
placements=[]
for obj in seats:
    p=obj.matrix_world.translation
    forward=obj.matrix_world.to_quaternion() @ Vector((0,-1,0))
    # Runtime glTF coordinates; local +Z faces toward the court.
    placements.append([round(p.x,4),round(p.z,4),round(-p.y,4),round(math.atan2(forward.x,-forward.y),5)])
(BUILD/'audience-seats.json').write_text(json.dumps(dict(version=1,stride=4,count=len(seats),seats=placements),separators=(',',':')))

def triangles():
    return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in scene.objects if o.type=='MESH')

quality_triangles=triangles()
templates={}
for obj in seats:
    mat=obj.data.materials[0]
    if mat.name not in templates:
        mesh=bpy.data.meshes.new('Performance folded seat '+mat.name)
        mesh.from_pydata([(-.23,-.22,.44),(.23,-.22,.44),(.23,.22,.44),(-.23,.22,.44),(-.23,.25,.87),(.23,.25,.87)],[],[(0,1,2,3),(3,2,5,4)])
        mesh.materials.append(mat); mat.use_backface_culling=False
        uv=mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                v=mesh.vertices[mesh.loops[li].vertex_index].co
                uv.data[li].uv=(v.x+0.5,v.z if poly.index else v.y+0.5)
        templates[mat.name]=mesh
    obj.data=templates[mat.name]

# Never match court roles, primary structure, entrances or a roof membrane.
omit=re.compile(r'fine |seat pedestals|handrails|seams|bogies|carriage wheels|drive housings|pavilion trim|bench slats|seat supports',re.I)
for obj in list(scene.objects):
    if obj.type!='MESH' or obj in seats: continue
    if omit.search(obj.name) and not obj.get('surfaceRole') and not obj.get('roofMembrane'):
        bpy.data.objects.remove(obj,do_unlink=True)

# Eliminate rough transmission's extra scene render in Performance mode.
for mat in bpy.data.materials:
    if mat.use_nodes:
        p=mat.node_tree.nodes.get('Principled BSDF')
        if p: p.inputs['Transmission Weight'].default_value=0

net_objects=[o for o in scene.objects if o.type=='MESH' and ('net cords' in o.name.lower() or o.get('role')=='woven-net')]
if net_objects:
    half=max(abs((o.matrix_world@Vector(v)).x) for o in net_objects for v in o.bound_box)
    owner=net_objects[0].users_collection[0]
    for o in net_objects: bpy.data.objects.remove(o,do_unlink=True)
    mat=material('Performance woven net cutout','#18231e',.98)
    mat.use_backface_culling=False
    # Texture is an original repeating engineering pattern, not generated art.
    size=64
    pixels=np.ones((size,size,4),dtype=np.float32)
    yy,xx=np.mgrid[0:size,0:size]
    pixels[:,:,3]=((xx<7)|(yy<7)).astype(np.float32)
    im=bpy.data.images.new('performance-net-weave',width=size,height=size,alpha=True)
    im.pixels.foreach_set(pixels.ravel()); im.pack()
    node=mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image=im
    mat.node_tree.links.new(node.outputs['Alpha'],mat.node_tree.nodes['Principled BSDF'].inputs['Alpha'])
    mat.surface_render_method='DITHERED'
    # glTF exporter uses glTF Material Output alpha cutoff custom properties.
    mat['gltf_alpha_mode']='MASK'
    batch=Batch('Performance net cutout',mat,owner)
    for i in range(32):
        a,b=-half+i*2*half/32,-half+(i+1)*2*half/32
        za,zb=.914+.156*(abs(a)/half)**2,.914+.156*(abs(b)/half)**2
        batch.face([(a,0,.06),(b,0,.06),(b,0,zb),(a,0,za)])
    obj=batch.finish()
    uv=obj.data.uv_layers.active
    for poly in obj.data.polygons:
        for li in poly.loop_indices:
            v=obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv=(v.x/.042,v.z/.042)
    obj['role']='performance-net'

performance_triangles=triangles()
if performance_triangles>quality_triangles*.4:
    raise RuntimeError(f'Insufficient geometry reduction {performance_triangles}/{quality_triangles}')
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type in {'MESH','EMPTY'}: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(BUILD/f'{VENUE}.performance.raw.glb'),export_format='GLB',use_selection=True,export_extras=True,
    export_cameras=False,export_lights=False,export_animations=False,export_yup=True,export_tangents=True,export_vertex_color='ACTIVE')
(BUILD/'performance-build.json').write_text(json.dumps(dict(qualityTriangles=quality_triangles,performanceTriangles=performance_triangles,
    reduction=round(1-performance_triangles/quality_triangles,4),seats=len(seats)),indent=2))
print(f'PERFORMANCE {VENUE}: {quality_triangles} -> {performance_triangles} triangles; {len(seats)} audience anchors',flush=True)
