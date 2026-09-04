"""Bake nondirectional local occlusion for the web renderer's indirect-light gap.

One representative of each shared seat mesh is baked; architectural terraces
are baked in context. Colors are exported as COLOR_0, without baking time of day.
"""
import time
import bpy
import numpy as np

scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=16
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='OPTIX'
    prefs.get_devices()
    for device in prefs.devices:
        device.use=device.type=='OPTIX'
    scene.cycles.device='GPU' if any(d.use for d in prefs.devices) else 'CPU'
except Exception:
    scene.cycles.device='CPU'
targets=[]
seen=set()
for obj in scene.objects:
    if obj.type!='MESH':
        continue
    if ('precast terraces' in obj.name or 'riser faces' in obj.name or 'concourse' in obj.name.lower()
            or obj.name.startswith('Seat T')) and obj.data.name not in seen:
        targets.append(obj)
        seen.add(obj.data.name)
bpy.ops.object.select_all(action='DESELECT')
for obj in targets:
    attr=obj.data.color_attributes.get('BakedAO') or obj.data.color_attributes.new(name='BakedAO',type='FLOAT_COLOR',domain='CORNER')
    obj.data.color_attributes.active_color=attr
    obj.select_set(True)
bpy.context.view_layer.objects.active=targets[0]
started=time.monotonic()
bpy.ops.object.bake(type='AO',target='VERTEX_COLORS',use_clear=True)
for obj in targets:
    attr=obj.data.color_attributes['BakedAO']
    values=np.empty(len(attr.data)*4,dtype=np.float32)
    attr.data.foreach_get('color',values)
    rgba=values.reshape((-1,4))
    rgba[:,:3]=.26+.74*np.sqrt(np.clip(rgba[:,:3],0,1))
    rgba[:,3]=1
    attr.data.foreach_set('color',values)
    obj['bakedOcclusion']='Cycles 16 samples; neutral AO with 0.26 floor'
bpy.ops.object.select_all(action='DESELECT')
result={'bakedMeshes':len(targets),'seconds':round(time.monotonic()-started,2)}
print(result,flush=True)
