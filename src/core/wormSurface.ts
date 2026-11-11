import { add, rotate } from './birds.ts';
import type { Point } from './birds.ts';
export const SURFACE_RINGS = 160;
export const SURFACE_SIDES = 16;
export const WORM_FLOOR = 0.04;
// Rounded anterior cap, as wide as the trunk: no broad skull or narrow neck.
export const HEAD_RADII: Point = [0.081, 0.073, 0.095];
export const HEAD_EYE: Point = [0.057, 0.016, 0.05];
export const HEAD_EYE_RADII: Point = [0.007, 0.014, 0.015];
export const HEAD_LID: Point = [0.056, 0.027, 0.05];
export const HEAD_MOUTH: Point = [0, -0.018, 0.091];
export const WORM_ANNULI = 32;
export function annulusGroove(u: number): number {
  return Math.pow(0.5 - 0.5 * Math.cos(u * Math.PI * 2 * WORM_ANNULI), 3);
}
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
  const ring = 1 - 0.12 * annulusGroove(u);
  const girdle = 1 + 0.07 * Math.exp(-Math.pow((u - 0.26) / 0.055, 4));
  // Uniform trunk, with a hemispherical rounding only over the final four percent.
  const end = Math.max(0, Math.min(1, (u - 0.96) / 0.04));
  return 0.081 * ring * girdle * Math.sqrt(Math.max(0.01, 1 - end * end));
}
export function wormHeadAngles(points: Point[]): Point {
  const d = subtract(points[0]!, points[1]!);
  return [-Math.atan2(d[1], Math.hypot(d[0], d[2])), Math.atan2(d[0], d[2]), 0];
}
export function headVerticalExtent(points: Point[], rotation: Point): number {
  const angles = wormHeadAngles(points);
  const shapes: [Point, Point][] = [
    [[0, 0, 0], HEAD_RADII],
    ...[-1, 1].flatMap((side): [Point, Point][] => [
      [[side * HEAD_EYE[0], HEAD_EYE[1], HEAD_EYE[2]], HEAD_EYE_RADII],
      // Covers the full eyelid envelope both resting and lowered after impact.
      [
        [side * HEAD_LID[0], HEAD_LID[1] - 0.004, HEAD_LID[2]],
        [0.009, 0.015, 0.015],
      ],
    ]),
    [HEAD_MOUTH, [0.015, 0.005, 0.006]],
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
  const reach = Math.max(...points.map((p) => Math.hypot(...p))) + 0.3;
  if (position[1] > reach) return result;
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
  // Preserve a round tail: move the entire curve by any residual spline penetration.
  // The old per-vertex projection could flatten the tail into the water surface.
  const surface = buildWormSurface(result);
  let minimum = Infinity;
  for (let i = 0; i < surface.positions.length; i += 3)
    minimum = Math.min(
      minimum,
      position[1] +
        rotate(
          [surface.positions[i]!, surface.positions[i + 1]!, surface.positions[i + 2]!],
          rotation,
        )[1],
    );
  if (minimum < WORM_FLOOR + 0.003) {
    const correction = inverseRotate([0, WORM_FLOOR + 0.003 - minimum, 0], rotation);
    for (let i = 0; i < result.length; i++) result[i] = add(result[i]!, correction);
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
  const reach = Math.max(...points.map((p) => Math.hypot(...p))) + 0.3;
  for (let i = 0; i <= SURFACE_RINGS; i++) {
    const u = i / SURFACE_RINGS,
      c = centre(points, u);
    const tangent = normal(subtract(centre(points, u - 0.002), centre(points, u + 0.002)));
    const right = normal(
        Math.hypot(tangent[0], tangent[2]) < 1e-6 ? [1, 0, 0] : [tangent[2], 0, -tangent[0]],
      ),
      up = normal(cross(tangent, right));
    const radius = wormRadius(u);
    for (let side = 0; side <= SURFACE_SIDES; side++) {
      const angle = (side / SURFACE_SIDES) * Math.PI * 2;
      let p = c.map(
        (v, axis) =>
          v + right[axis]! * Math.cos(angle) * radius + up[axis]! * Math.sin(angle) * radius * 0.9,
      ) as Point;
      if (position[1] < reach) {
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
  // Closed ends; the first cap is hidden inside the head, the last closes the rounded tail.
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
