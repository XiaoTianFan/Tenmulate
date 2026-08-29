export type Vec3 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const add = (a: Vec3, b: Vec3): Vec3 =>
  vec3(a.x + b.x, a.y + b.y, a.z + b.z);

export const scale = (value: Vec3, scalar: number): Vec3 =>
  vec3(value.x * scalar, value.y * scalar, value.z * scalar);

export const magnitude = (value: Vec3): number =>
  Math.hypot(value.x, value.y, value.z);

export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
