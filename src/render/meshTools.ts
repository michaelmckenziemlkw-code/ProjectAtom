import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

export function material(scene: Scene, name: string, hex: string, gloss = 12): StandardMaterial {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(hex);
  result.specularColor = new Color3(0.22, 0.25, 0.2);
  result.specularPower = gloss;
  return result;
}

export function ellipsoid(
  scene: Scene,
  name: string,
  position: Vector3,
  scale: Vector3,
  mat: StandardMaterial,
  parent?: TransformNode,
): Mesh {
  const mesh = MeshBuilder.CreateSphere(name, { diameter: 2, segments: 20 }, scene);
  mesh.position.copyFrom(position);
  mesh.scaling.copyFrom(scale);
  mesh.material = mat;
  if (parent) mesh.parent = parent;
  return mesh;
}

export function moveSegment(mesh: Mesh, from: Vector3, to: Vector3): void {
  const direction = to.subtract(from);
  const length = direction.length();
  mesh.position.copyFrom(from.add(to).scale(0.5));
  mesh.scaling.y = length;
  const axis = Vector3.Cross(Vector3.Up(), direction);
  mesh.rotationQuaternion =
    axis.lengthSquared() > 1e-8
      ? Quaternion.RotationAxis(
          axis.normalize(),
          Math.acos(Math.max(-1, Math.min(1, direction.y / length))),
        )
      : Quaternion.RotationAxis(Vector3.Right(), direction.y < 0 ? Math.PI : 0);
}

export function segment(
  scene: Scene,
  name: string,
  from: Vector3,
  to: Vector3,
  radius: number,
  mat: StandardMaterial,
  parent?: TransformNode,
): Mesh {
  const mesh = MeshBuilder.CreateCylinder(
    name,
    { height: 1, diameterTop: radius * 1.35, diameterBottom: radius * 2, tessellation: 8 },
    scene,
  );
  mesh.material = mat;
  if (parent) mesh.parent = parent;
  moveSegment(mesh, from, to);
  return mesh;
}
