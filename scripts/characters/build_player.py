"""Fit the CC0 segmented mannequin to the unchanged reviewed tennis armature.

Run in Blender background mode after fetch_player.ps1. Source animations are not
used. Only mesh rest coordinates and weights transfer to the calibrated skeleton.
"""
import bpy, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
CACHE=ROOT/'artifacts/character-source'
SPEC=json.loads((Path(__file__).parent/'source.json').read_text())
SOURCE=CACHE/'quaternius-mannequin-standard'/SPEC['modelPath']
OUTPUT=ROOT/'public/assets/opponents/quaternius-mannequin.glb'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==SPEC['modelSha256'], 'Mannequin source checksum mismatch'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
source_arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
source_body=next(o for o in bpy.context.scene.objects if o.name=='Mannequin' and o.type=='MESH')
source_arm.animation_data_clear(); source_arm.data.pose_position='REST'
source_bones={b.name:(b.head_local.copy(),b.tail_local.copy()) for b in source_arm.data.bones}
vertices=[source_body.matrix_world@v.co for v in source_body.data.vertices]
weights=[[(source_body.vertex_groups[g.group].name,g.weight) for g in v.groups if g.weight>0] for v in source_body.data.vertices]
faces=[list(p.vertices) for p in source_body.data.polygons]
joint_faces=[source_body.data.materials[p.material_index].name=='M_Joints' for p in source_body.data.polygons]
bpy.ops.wm.read_factory_settings(use_empty=True)
rig_source=ROOT/'public/assets/opponents/quaternius-neutral-male.glb'
bpy.ops.import_scene.gltf(filepath=str(rig_source))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for o in list(bpy.data.objects):
    if o!=arm:bpy.data.objects.remove(o,do_unlink=True)
target=arm.data.bones
assert set(source_bones)==set(b.name for b in target), 'Source and tennis bone contract differ'

def transfer(point,name):
    sh,st=source_bones[name]; bone=target[name]; th,tt=bone.head_local,bone.tail_local
    source_axis=st-sh; target_axis=tt-th
    # Preserve head volume and cohesive torso shells. Limbs/fingers follow the
    # calibrated segment lengths, retaining their radial shell thickness.
    if name in ['root','pelvis','spine_01','spine_02','spine_03','Head']:
        return point+th-sh
    axis=source_axis.normalized(); delta=point-sh
    ratio=target_axis.length/source_axis.length
    return th+source_axis.rotation_difference(target_axis)@(delta+axis*delta.dot(axis)*(ratio-1))

fitted=[]; normalized=[]
for point,influences in zip(vertices,weights):
    influences=sorted(influences,key=lambda p:-p[1])[:4]
    total=sum(w for _,w in influences)
    assert total>.01, 'Unweighted mannequin vertex'
    influences=[(name,w/total) for name,w in influences]
    fitted.append(sum((transfer(point,n)*w for n,w in influences),Vector()))
    normalized.append(influences)
mesh=bpy.data.meshes.new('ArticulatedMannequin');mesh.from_pydata(fitted,[],faces);mesh.update()
body=bpy.data.objects.new('NeutralOpponentBody',mesh);bpy.context.collection.objects.link(body);body.parent=arm
for b in target:body.vertex_groups.new(name=b.name)
for i,influences in enumerate(normalized):
    for name,w in influences:body.vertex_groups[name].add([i],w,'REPLACE')
mod=body.modifiers.new('ReviewedTennisRig','ARMATURE');mod.object=arm
# One colored primitive retains the single-carrier export/runtime contract.
colors=mesh.color_attributes.new(name='MannequinColor',type='FLOAT_COLOR',domain='CORNER')
for poly,is_joint in zip(mesh.polygons,joint_faces):
    poly.use_smooth=True
    for loop in poly.loop_indices:colors.data[loop].color=(.075,.11,.13,1) if is_joint else (.67,.73,.70,1)
mat=bpy.data.materials.new('NeutralMannequin');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.72
color=mat.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name='MannequinColor'
mat.node_tree.links.new(color.outputs['Color'],bsdf.inputs['Base Color']);mesh.materials.append(mat)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_extras=True)
record={'id':'quaternius-articulated-mannequin-v1','url':'/assets/opponents/'+OUTPUT.name,
        'nominalHeightMeters':SPEC['heightMeters'],'license':SPEC['license'],'sourceUrl':SPEC['sourceUrl'],
        'sourceRelease':SPEC['release'],'sourceModelSha256':SPEC['modelSha256'],
        'sha256':hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),'bytes':OUTPUT.stat().st_size,
        'vertices':len(mesh.vertices),'triangles':sum(len(p.vertices)-2 for p in mesh.polygons),
        'bones':len(target),'maximumSkinInfluences':4,
        'skeletonSourceSha256':hashlib.sha256(rig_source.read_bytes()).hexdigest(),
        'builderSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
OUTPUT.with_suffix('.manifest.json').write_text(json.dumps(record,indent=2)+'\n')
(ROOT/'src/content/opponent-asset.json').write_text(json.dumps({k:record[k] for k in ['id','url','nominalHeightMeters','license','sourceUrl','sha256']},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(CACHE/'articulated-mannequin.blend'))
print('MANNEQUIN',json.dumps(record))
