"""Shared authored net weave; visual detail only, never gameplay collision."""
import math

MESH_PITCH = .042
CORD_RADIUS = .0022
CURVE_SEGMENTS = 48


def build_net_cords(batch, half_width, bottom=.06):
    """Finish one opaque braided-cord batch, retaining the existing sag/anchors."""
    def height(x):
        return .914 + .156 * (abs(x) / half_width) ** 2

    columns = math.ceil(2 * half_width / MESH_PITCH)
    rows = math.ceil((1.07 - .036 - bottom) / MESH_PITCH)
    for i in range(columns + 1):
        x = -half_width + i * 2 * half_width / columns
        batch.beam((x, 0, bottom), (x, 0, height(x) - .036), CORD_RADIUS, 4)
    for row in range(rows + 1):
        ratio = row / rows
        for i in range(CURVE_SEGMENTS):
            a = -half_width + i * 2 * half_width / CURVE_SEGMENTS
            b = -half_width + (i + 1) * 2 * half_width / CURVE_SEGMENTS
            batch.beam((a, 0, bottom + (height(a) - .036 - bottom) * ratio),
                       (b, 0, bottom + (height(b) - .036 - bottom) * ratio), CORD_RADIUS, 4)
    obj = batch.finish()
    obj['role'] = 'woven-net'
    obj['meshPitch'] = MESH_PITCH
    obj['cordRadius'] = CORD_RADIUS
    obj['verticalCords'] = columns + 1
    obj['horizontalCords'] = rows + 1
    return obj
