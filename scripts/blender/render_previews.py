"""Render the master cameras; presentation-only, never baked into runtime lighting."""
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[2]
scene=bpy.context.scene
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='OPTIX'
    prefs.get_devices()
    for device in prefs.devices:
        device.use=device.type=='OPTIX'
    scene.cycles.device='GPU'
except Exception:
    scene.cycles.device='CPU'
scene.cycles.samples=32
scene.render.resolution_percentage=100
paths=[]
for name,filename in [('01 Player baseline','blender-player.png'),('02 Lower corner','blender-corner.png'),('03 Upper overview','blender-overview.png')]:
    scene.camera=bpy.data.objects[name]
    path=ROOT/'artifacts/venue-build'/filename
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    paths.append(str(path))
result={'renders':paths}
