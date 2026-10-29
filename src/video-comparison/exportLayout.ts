export type GridRow = { id: string; clips: string[] };
export type GridDrop = { row: string; index: number } | { before: string | null; newRow: string };
export type Cell = { id: string; x: number; y: number; width: number; height: number };

export function moveGridClip(rows: readonly GridRow[], clip: string, drop: GridDrop): GridRow[] {
  if (!rows.some(row => row.clips.includes(clip))) return rows.slice();
  const next = rows.map(row => ({ ...row, clips: row.clips.filter(id => id !== clip) }));
  if ('row' in drop) {
    const target = next.find(row => row.id === drop.row), original = rows.find(row => row.id === drop.row);
    if (!target || !original) return rows.slice();
    const from = original.clips.indexOf(clip);
    const position = Math.max(0, Math.min(target.clips.length, drop.index - (from >= 0 && from < drop.index ? 1 : 0)));
    target.clips.splice(position, 0, clip);
  } else {
    const position = drop.before === null ? next.length : next.findIndex(row => row.id === drop.before);
    if (position < 0) return rows.slice();
    next.splice(position, 0, { id: drop.newRow, clips: [clip] });
  }
  return next.filter(row => row.clips.length);
}

export function gridCells(rows: readonly GridRow[], width: number, height: number, gap = 8): Cell[] {
  const active = rows.filter(row => row.clips.length);
  const rowHeight = (height - gap * (active.length + 1)) / active.length;
  return active.flatMap((row, r) => {
    const cellWidth = (width - gap * (row.clips.length + 1)) / row.clips.length;
    return row.clips.map((id, c) => ({ id, x: gap + c * (cellWidth + gap), y: gap + r * (rowHeight + gap), width: cellWidth, height: rowHeight }));
  });
}

export function containRect(sourceWidth: number, sourceHeight: number, cell: Omit<Cell, 'id'>): Omit<Cell, 'id'> {
  const scale = Math.min(cell.width / sourceWidth, cell.height / sourceHeight);
  const width = sourceWidth * scale, height = sourceHeight * scale;
  return { x: cell.x + (cell.width - width) / 2, y: cell.y + (cell.height - height) / 2, width, height };
}

export function outputSize(aspect: string, longEdge: number): { width: number; height: number } {
  const [w, h] = aspect.split(':').map(Number);
  const scale = longEdge / Math.max(w!, h!);
  return { width: Math.round(w! * scale / 2) * 2, height: Math.round(h! * scale / 2) * 2 };
}
