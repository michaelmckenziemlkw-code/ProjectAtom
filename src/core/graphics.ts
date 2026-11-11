export interface GraphicsSettings {
  hair: boolean;
  ray: boolean;
  path: boolean;
  physx: boolean;
  generation: boolean;
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
  generation: false,
  ao: false,
  aa: 'off',
  upscaler: 'off',
  quality: 'quality',
  manual: 0,
});
export function effectiveFrameCap(s: GraphicsSettings, cinematicCap = 0): number {
  const caps = [
    cinematicCap,
    s.manual,
    s.hair ? 40 : 0,
    s.ray ? 20 : 0,
    s.hair && (s.ray || s.path) ? 5 : 0,
    s.path ? 8 : 0,
    s.physx ? 24 : 0,
    s.generation ? 30 : 0,
    s.ao ? 45 : 0,
    { off: 0, fxaa: 90, taa: 60, msaa: 30, dlaa: 50 }[s.aa],
  ];
  if (s.upscaler !== 'off')
    caps.push(
      Math.round(
        { quality: 55, balanced: 60, performance: 70, ultra: 80 }[s.quality] *
          { dlss: 1, fsr: 0.95, xess: 0.9 }[s.upscaler],
      ),
    );
  const positive = caps.filter((cap) => Number.isFinite(cap) && cap > 0);
  return positive.length ? Math.min(...positive) : 0;
}
