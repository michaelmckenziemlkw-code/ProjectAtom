export interface GraphicsSettings {
  hair: boolean;
  ray: boolean;
  path: boolean;
  physx: boolean;
  generation: 'off' | '2x' | '3x' | '4x';
  ao: boolean;
  aa: 'off' | 'fxaa' | 'taa' | 'msaa' | 'dlaa';
  upscaler: 'off' | 'dlss' | 'fsr' | 'xess';
  quality: 'quality' | 'balanced' | 'performance' | 'ultra';
  manual: number;
}
export const defaultGraphics = (): GraphicsSettings => ({
  hair: false,
  ray: false,
  path: false,
  physx: false,
  generation: 'off',
  ao: false,
  aa: 'off',
  upscaler: 'off',
  quality: 'quality',
  manual: 0,
});

/** Deliberately tunable study parameters, not benchmarks of real vendor SDKs. */
export function graphicsMultiplier(s: GraphicsSettings): number {
  const cost =
    (s.hair ? 0.7 : 1) *
    (s.ray ? 0.2 : 1) *
    (s.path ? 0.3 : 1) *
    (s.physx ? 0.9 : 1) *
    (s.ao ? 0.9 : 1) *
    { off: 1, fxaa: 0.97, taa: 0.95, msaa: 0.8, dlaa: 0.9 }[s.aa];
  const upscale =
    s.upscaler === 'off'
      ? 1
      : {
          dlss: { quality: 1.3, balanced: 1.5, performance: 1.8, ultra: 2 },
          fsr: { quality: 1.25, balanced: 1.45, performance: 1.7, ultra: 1.9 },
          xess: { quality: 1.2, balanced: 1.4, performance: 1.6, ultra: 1.8 },
        }[s.upscaler][s.quality];
  return cost * upscale * { off: 1, '2x': 2, '3x': 3, '4x': 4 }[s.generation];
}

/** 0 means no pacing; amplification can recover lost frames, never invent throughput. */
export function effectiveFrameCap(
  s: GraphicsSettings,
  baselineFps: number | null,
  cinematicCap = 0,
): number {
  const limits = [s.manual, cinematicCap].filter((value) => Number.isFinite(value) && value > 0);
  const factor = graphicsMultiplier(s);
  if (baselineFps !== null && Number.isFinite(baselineFps) && baselineFps > 0 && factor < 1) {
    // Keep even an extreme combination observable; never raise a sub-1 FPS baseline.
    limits.push(Math.max(Math.min(1, baselineFps), baselineFps * factor));
  }
  return limits.length ? Math.min(...limits) : 0;
}
