export interface BodyPoint {
  x: number;
  z: number;
  heading: number;
}
interface PathPoint {
  x: number;
  z: number;
  distance: number;
}
export const WORM_SEGMENTS = 11;
export const WORM_SPACING = 0.14;

/** Arc-length history: body segments follow the head's actual path, not its rotation. */
export class WormBody {
  private points: PathPoint[] = [];
  private distance = 0;
  constructor(x = 0, z = -5.2, heading = 0) {
    this.reset(x, z, heading);
  }
  reset(x: number, z: number, heading = 0) {
    const length = WORM_SEGMENTS * WORM_SPACING;
    this.distance = 0;
    this.points = [
      { x: x - Math.sin(heading) * length, z: z - Math.cos(heading) * length, distance: -length },
      { x, z, distance: 0 },
    ];
  }
  record(x: number, z: number) {
    const last = this.points.at(-1)!;
    const moved = Math.hypot(x - last.x, z - last.z);
    if (moved < 1e-9) return;
    this.distance += moved;
    const point = { x, z, distance: this.distance };
    if (
      this.points.length > 2 &&
      last.distance - this.points[this.points.length - 2].distance < 0.005
    )
      this.points[this.points.length - 1] = point;
    else this.points.push(point);
    const oldest = this.distance - WORM_SEGMENTS * WORM_SPACING;
    while (this.points.length > 2 && this.points[1].distance < oldest) this.points.shift();
  }
  private position(behind: number) {
    const target = this.distance - Math.max(0, behind);
    for (let i = this.points.length - 1; i > 0; i--) {
      const a = this.points[i - 1],
        b = this.points[i];
      if (target >= a.distance) {
        const t = Math.max(0, Math.min(1, (target - a.distance) / (b.distance - a.distance)));
        return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      }
    }
    return this.points[0];
  }
  pose(index: number): BodyPoint {
    const behind = index * WORM_SPACING;
    const point = this.position(behind);
    const front = this.position(Math.max(0, behind - 0.035)),
      rear = this.position(behind + 0.035);
    return { x: point.x, z: point.z, heading: Math.atan2(front.x - rear.x, front.z - rear.z) };
  }
}
