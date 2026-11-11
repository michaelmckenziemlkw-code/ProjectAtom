/** Local playable study. No DOM, renderer, transport, or implied partner state. */
export interface WalkInput {
  forward: number;
  right: number;
  yaw: number;
}
export interface BeetleMotion {
  x: number;
  y: number;
  z: number;
  heading: number;
  stage: 'waiting' | 'approaching' | 'picking-up' | 'leaving' | 'cleared';
  carrying: boolean;
  blocked: boolean;
  walking: boolean;
}
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
export function beetleMotion(seconds: number, beddingAt: number | null): BeetleMotion {
  const t = beddingAt === null ? -1 : Math.max(0, seconds - beddingAt);
  if (t < 0)
    return {
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      stage: 'waiting',
      carrying: false,
      blocked: true,
      walking: false,
    };
  const p = smooth(t / 1.8),
    leave = smooth((t - 2.6) / 2.4);
  return {
    x: 1.8 * p + 3.7 * leave,
    y: 0.55 * p + 0.6 * leave,
    z: -0.2 * p + 4.4 * leave,
    heading: (-Math.PI / 2) * smooth(t / 0.65) - 1.0 * smooth((t - 2.6) / 0.6),
    stage: t < 1.8 ? 'approaching' : t < 2.6 ? 'picking-up' : t < 5 ? 'leaving' : 'cleared',
    carrying: t >= 2.3,
    blocked: t < 1.5,
    walking: t < 1.8 || (t >= 2.6 && t < 5),
  };
}
export class WalkSession {
  x = 0;
  z = -5.2;
  heading = 0;
  distance = 0;
  beddingAt: number | null = null;
  private lastTime = 0;
  reset(seconds = 0) {
    this.x = 0;
    this.z = -5.2;
    this.heading = 0;
    this.distance = 0;
    this.beddingAt = null;
    this.lastTime = seconds;
  }
  canPlace(seconds: number) {
    return (
      this.beddingAt === null &&
      Math.hypot(this.x, this.z) < 3.15 &&
      this.z < -0.6 &&
      beetleMotion(seconds, this.beddingAt).blocked
    );
  }
  placeBedding(seconds: number): boolean {
    if (!this.canPlace(seconds)) return false;
    this.beddingAt = seconds;
    return true;
  }
  advance(seconds: number, input: WalkInput) {
    const elapsed = Math.max(0, seconds - this.lastTime);
    this.lastTime = seconds;
    const length = Math.hypot(input.forward, input.right);
    if (!length || !elapsed) return;
    const forward = input.forward / Math.max(1, length),
      right = input.right / Math.max(1, length);
    const dx = Math.sin(input.yaw) * forward + Math.cos(input.yaw) * right;
    const dz = Math.cos(input.yaw) * forward - Math.sin(input.yaw) * right;

    // Small steps prevent tunnelling; unused time at a wall requires no catch-up work.
    const steps = Math.ceil(elapsed * 120),
      dt = elapsed / steps;
    for (let i = 0; i < steps; i++) {
      const oldX = this.x,
        oldZ = this.z;
      const blocked = beetleMotion(seconds - elapsed + (i + 1) * dt, this.beddingAt).blocked;
      let x = Math.max(-1.35, Math.min(1.35, this.x + dx * 1.8 * dt));
      let z = Math.max(-6.2, Math.min(7.2, this.z + dz * 1.8 * dt));
      const radius = 1.92,
        distance = Math.hypot(x, z);
      if (blocked && distance < radius) {
        x = distance > 0.00001 ? (x / distance) * radius : this.x;
        z = distance > 0.00001 ? (z / distance) * radius : this.z;
        x = Math.max(-1.35, Math.min(1.35, x));
        if (Math.hypot(x, z) < radius)
          z = (oldZ <= 0 ? -1 : 1) * Math.sqrt(radius * radius - x * x);
      }
      this.x = x;
      this.z = z;
      const moved = Math.hypot(x - oldX, z - oldZ);
      this.distance += moved;
      if (moved > 1e-8) this.heading = Math.atan2(dx, dz);
      else if (!blocked || this.beddingAt === null || seconds < this.beddingAt + 1.5) break;
    }
  }
}
