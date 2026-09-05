"""Render the master cameras; presentation-only, never baked into runtime lighting."""
from pathlib import Path
import sys
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
clay=scene.get('venueId')=='clay-sunset-arena'
output=ROOT/'artifacts/venue-build'/('clay-sunset-arena' if clay else '')
output.mkdir(parents=True,exist_ok=True)
views=[('01 Player baseline','blender-player.png'),('02 Court corner' if clay else '02 Lower corner','blender-corner.png'),('03 Upper overview','blender-overview.png')]
if '--' in sys.argv and 'corner' in sys.argv[sys.argv.index('--')+1:]: views=views[1:2]
for name,filename in views:
    scene.camera=bpy.data.objects[name]
    path=output/filename
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    paths.append(str(path))
result={'renders':paths}
