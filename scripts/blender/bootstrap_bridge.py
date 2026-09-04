"""Load the pinned official add-on into the project Blender session.

Run with Blender --background --factory-startup --python this_file --command blender_mcp.
The add-on is loaded from the local checkout; no global Blender preferences are changed.
"""
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.tools' / 'blender-mcp' / 'addon'))
import addon_utils

# The official GUI register/start hooks require an AddonPreferences entry.
# Create it in this factory-startup session; never call save_userpref().
addon_utils.enable('blender_mcp_addon', default_set=True, persistent=False)
preferences = bpy.context.preferences.addons['blender_mcp_addon'].preferences
preferences.host = '127.0.0.1'
preferences.port = 9876
if not bpy.app.background:
    bpy.ops.blmcp.server_start()
print('Tenmulate official Blender MCP add-on registered', flush=True)
