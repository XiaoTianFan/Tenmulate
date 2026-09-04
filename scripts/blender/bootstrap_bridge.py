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

addon_utils.enable('blender_mcp_addon', default_set=False, persistent=False)
if not bpy.app.background:
    bpy.ops.blmcp.server_start()
print('Tenmulate official Blender MCP add-on registered', flush=True)
