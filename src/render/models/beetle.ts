import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Gesture, SymbolKind } from '../../core/observation.ts';

/** A procedural actor today; a GLB + named clips adapter can implement this tomorrow. */
export interface BeetlePresentation {
  gesture: Gesture;
  symbol: SymbolKind;
  seconds: number;
}
export interface BeetleActor {
  readonly root: TransformNode;
  present(state: BeetlePresentation): void;
  dispose(): void;
}
export type BeetleFactory = (scene: Scene) => BeetleActor | Promise<BeetleActor>;
