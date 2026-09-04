"""Call the official MCP over stdio (also usable before Codex reloads its tools)."""
import argparse
import asyncio
import json
import os
from datetime import timedelta
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[2]


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('tool', nargs='?', default='get_blendfile_summary_datablocks')
    parser.add_argument('--arguments', default='{}')
    parser.add_argument('--script', type=Path)
    args = parser.parse_args()
    payload = json.loads(args.arguments)
    if args.script:
        path = args.script.resolve()
        payload = {'code': f"import runpy\nresult = runpy.run_path({str(path)!r}).get('result', {{}})"}
    env = dict(os.environ, BLENDER_PATH=str(ROOT / '.tools/blender-5.2.1-windows-x64/blender.exe'),
               BLENDER_MCP_HOST='127.0.0.1', BLENDER_MCP_PORT='9876')
    params = StdioServerParameters(command=str(ROOT / '.tools/mcp-venv/Scripts/blender-mcp.exe'), env=env)
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write, read_timeout_seconds=timedelta(minutes=30)) as session:
            await session.initialize()
            if args.tool == 'list':
                value = await session.list_tools()
            else:
                value = await session.call_tool(args.tool, payload, read_timeout_seconds=timedelta(minutes=30))
            print(value.model_dump_json(indent=2))
            structured = getattr(value, 'structuredContent', None) or {}
            if getattr(value, 'isError', False) or structured.get('status') == 'error':
                raise SystemExit(1)


if __name__ == '__main__':
    asyncio.run(main())
