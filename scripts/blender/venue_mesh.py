"""Small DCC-only mesh helpers. No scene reset, materials or file writes on import."""
import math
import bpy
from mathutils import Vector


def linear(color):
    rgb = [int(color.lstrip('#')[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)


def material(name, color, roughness=.7, metal=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*linear(color), 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metal
    mat.diffuse_color = (*linear(color), 1)
    mat.use_backface_culling = True
    return mat


class Batch:
    def __init__(self, name, mat, owner, role=None, roof=False):
        self.name, self.mat, self.owner, self.role, self.roof = name, mat, owner, role, roof
        self.vertices, self.faces = [], []

    def face(self, vertices):
        start = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.append(tuple(range(start, start+len(vertices))))

    def box(self, center, dimensions, angle=0):
        x, y, z = center
        w, d, h = (v/2 for v in dimensions)
        co, si = math.cos(angle), math.sin(angle)
        verts = [(x+a*co-b*si, y+a*si+b*co, z+c)
                 for a,b,c in ((-w,-d,-h),(w,-d,-h),(w,d,-h),(-w,d,-h),
                               (-w,-d,h),(w,-d,h),(w,d,h),(-w,d,h))]
        for indices in ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)):
            self.face([verts[i] for i in indices])

    def beam(self, a, b, radius=.05, sides=6):
        a,b = Vector(a),Vector(b)
        if (b-a).length < .00001:
            return
        v = (b-a).normalized()
        ref = Vector((0,0,1)) if abs(v.z)<.95 else Vector((1,0,0))
        u = v.cross(ref).normalized()*radius
        w = v.cross(u).normalized()*radius
        ring = [u*math.cos(i*math.tau/sides)+w*math.sin(i*math.tau/sides) for i in range(sides)]
        self.face([tuple(a+r) for r in reversed(ring)])
        self.face([tuple(b+r) for r in ring])
        for i in range(sides):
            j=(i+1)%sides
            self.face([tuple(a+ring[i]),tuple(a+ring[j]),tuple(b+ring[j]),tuple(b+ring[i])])

    def finish(self, uv_scale=3):
        if not self.faces:
            return None
        mesh=bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.append(self.mat)
        mesh.update()
        uv=mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            normal=poly.normal
            axes=(0,1) if abs(normal.z)>.5 else ((0,2) if abs(normal.y)>abs(normal.x) else (1,2))
            for li in poly.loop_indices:
                v=mesh.vertices[mesh.loops[li].vertex_index].co
                uv.data[li].uv=(v[axes[0]]/uv_scale,v[axes[1]]/uv_scale)
        obj=bpy.data.objects.new(self.name,mesh)
        self.owner.objects.link(obj)
        if self.role:
            obj['surfaceRole']=self.role
        if self.roof:
            obj['arenaPart']='roof'
        return obj
