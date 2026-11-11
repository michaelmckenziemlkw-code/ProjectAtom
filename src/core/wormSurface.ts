import { add, rotate } from './birds.ts';
import type { Point } from './birds.ts';
export const SURFACE_RINGS = 112;
export const SURFACE_SIDES = 16;
export const WORM_FLOOR = 0.04;
export const HEAD_RADII: Point = [0.105, 0.082, 0.16];
const subtract = (a: Point, b: Point): Point => a.map((v, i) => v - b[i]!) as Point;
const normal = (a: Point): Point => {
  const n = Math.hypot(...a) || 1;
  return a.map((v) => v / n) as Point;
};
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Point, b: Point) => a.reduce((sum, v, i) => sum + v * b[i]!, 0);
const inverseRotate = (p: Point, r: Point): Point => [
  dot(p, rotate([1, 0, 0], r)),
  dot(p, rotate([0, 1, 0], r)),
  dot(p, rotate([0, 0, 1], r)),
];
export function wormRadius(u: number): number {
  const ring = 1 - 0.035 * Math.pow(0.5 + 0.5 * Math.cos(u * Math.PI * 64), 8);
  const girdle = 1 + 0.1 * Math.exp(-Math.pow((u - 0.26) / 0.055, 4));
  return (0.004 + 0.079 * Math.pow(Math.max(0, 1 - u), 0.65)) * ring * girdle;
}
export function wormHeadAngles(points: Point[]): Point {
  const d = subtract(points[0]!, points[1]!);
  return [-Math.atan2(d[1], Math.hypot(d[0], d[2])), Math.atan2(d[0], d[2]), 0];
}
export function headVerticalExtent(points: Point[], rotation: Point): number {
  const angles = wormHeadAngles(points);
  const shapes: [Point, Point][] = [
    [[0, 0, 0], HEAD_RADII],
    [
      [0.083, 0.025, 0.075],
      [0.01, 0.02, 0.025],
    ],
    [
      [-0.083, 0.025, 0.075],
      [0.01, 0.02, 0.025],
    ],
    [
      [0.08, 0.039, 0.075],
      [0.01, 0.008, 0.023],
    ],
    [
      [-0.08, 0.039, 0.075],
      [0.01, 0.008, 0.023],
    ],
    [
      [0, -0.025, 0.153],
      [0.02, 0.004, 0.005],
    ],
  ];
  return Math.max(
    ...shapes.map(([centre, radii]) => {
      const offsetY = rotate(rotate(centre, angles), rotation)[1];
      return (
        Math.hypot(
          ...radii.map((radius, i) => {
            const axis: Point = [0, 0, 0];
            axis[i] = 1;
            return radius * rotate(rotate(axis, angles), rotation)[1];
          }),
        ) - offsetY
      );
    }),
  );
}
export function groundWormControls(points: Point[], position: Point, rotation: Point): Point[] {
  const result = points.map((p) => [...p] as Point);
  if (position[1] > 2) return result;
  for (let i = 0; i < result.length; i++) {
    const world = add(position, rotate(result[i]!, rotation));
    // Conservative radial clearance; exact surface projection below handles spline overshoot.
    const clearance =
      i === 0 ? headVerticalExtent(result, rotation) : wormRadius(i / (result.length - 1));
    if (world[1] < WORM_FLOOR + clearance) {
      world[1] = WORM_FLOOR + clearance;
      result[i] = inverseRotate(subtract(world, position), rotation);
    }
  }
  // Correct the head again after its tangent changed; a small margin covers the embedded face.
  for (let pass = 0; pass < 5; pass++) {
    const world = add(position, rotate(result[0]!, rotation));
    const height = WORM_FLOOR + headVerticalExtent(result, rotation) + 0.006;
    if (world[1] >= height) break;
    world[1] = height;
    result[0] = inverseRotate(subtract(world, position), rotation);
  }
  return result;
}
function centre(points: Point[], u: number): Point {
  const f = Math.max(0, Math.min(1, u)) * (points.length - 1),
    i = Math.min(points.length - 2, Math.floor(f)),
    t = f - i;
  const a = points[Math.max(0, i - 1)]!,
    b = points[i]!,
    c = points[i + 1]!,
    d = points[Math.min(points.length - 1, i + 2)]!;
  return b.map(
    (v, k) =>
      0.5 *
      (2 * v +
        (-a[k]! + c[k]!) * t +
        (2 * a[k]! - 5 * v + 4 * c[k]! - d[k]!) * t * t +
        (-a[k]! + 3 * v - 3 * c[k]! + d[k]!) * t * t * t),
  ) as Point;
}
export function buildWormSurface(
  points: Point[],
  position: Point = [0, 10, 0],
  rotation: Point = [0, 0, 0],
) {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= SURFACE_RINGS; i++) {
    const u = i / SURFACE_RINGS,
      c = centre(points, u);
    const tangent = normal(subtract(centre(points, u - 0.002), centre(points, u + 0.002)));
    const right = normal([tangent[2], 0, -tangent[0]]),
      up = normal(cross(tangent, right));
    const radius = wormRadius(u);
    for (let side = 0; side <= SURFACE_SIDES; side++) {
      const angle = (side / SURFACE_SIDES) * Math.PI * 2;
      let p = c.map(
        (v, axis) =>
          v + right[axis]! * Math.cos(angle) * radius + up[axis]! * Math.sin(angle) * radius * 0.9,
      ) as Point;
      if (position[1] < 2) {
        const world = add(position, rotate(p, rotation));
        if (world[1] < WORM_FLOOR) {
          world[1] = WORM_FLOOR;
          p = inverseRotate(subtract(world, position), rotation);
        }
      }
      positions.push(...p);
      uvs.push(side / SURFACE_SIDES, u);
      if (i < SURFACE_RINGS && side < SURFACE_SIDES) {
        const a = i * (SURFACE_SIDES + 1) + side,
          b = a + SURFACE_SIDES + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  // Closed ends; the first cap is hidden inside the head, the last forms the tapered tail tip.
  for (const [u, reverse] of [
    [0, false],
    [1, true],
  ] as const) {
    const offset = u * SURFACE_RINGS * (SURFACE_SIDES + 1),
      vertex = positions.length / 3;
    const p: Point = [
      positions[offset * 3]!,
      positions[offset * 3 + 1]!,
      positions[offset * 3 + 2]!,
    ];
    // Use the mean ring centre after ground projection so caps also stay above the floor.
    p.fill(0);
    for (let side = 0; side < SURFACE_SIDES; side++)
      for (let axis = 0; axis < 3; axis++)
        p[axis]! += positions[(offset + side) * 3 + axis]! / SURFACE_SIDES;
    positions.push(...p);
    uvs.push(0.5, u);
    for (let side = 0; side < SURFACE_SIDES; side++)
      indices.push(vertex, offset + side + (reverse ? 0 : 1), offset + side + (reverse ? 1 : 0));
  }
  return { positions, uvs, indices };
}
