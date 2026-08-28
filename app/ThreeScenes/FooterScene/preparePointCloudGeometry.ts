// PLY geometry preparation for the footer point cloud.
// Handles axis conversion (Polycam Z-up → Three.js Y-up), centering, and per-point scale.

import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Vector3,
} from "three";

function extractPositionsFromPLY(geometry: BufferGeometry): Float32Array {
  const pos = geometry.getAttribute("position");
  return new Float32Array(pos.array);
}

function getCenteredPositions(positions: Float32Array): Float32Array {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.computeBoundingBox();
  geo.center();
  const centered = new Float32Array(geo.getAttribute("position").array);
  geo.dispose();
  return centered;
}

function rotatePositions(
  positions: Float32Array,
  axis: "x" | "y" | "z",
  angle: number,
): Float32Array {
  const rotated = new Float32Array(positions.length);
  const point = new Vector3();
  const matrix = new Matrix4();
  if (axis === "x") matrix.makeRotationX(angle);
  else if (axis === "y") matrix.makeRotationY(angle);
  else matrix.makeRotationZ(angle);
  for (let i = 0; i < positions.length; i += 3) {
    point.set(positions[i], positions[i + 1], positions[i + 2]);
    point.applyMatrix4(matrix);
    rotated[i] = point.x;
    rotated[i + 1] = point.y;
    rotated[i + 2] = point.z;
  }
  return rotated;
}

export function preparePositions(positions: Float32Array): Float32Array {
  const rotated = rotatePositions(positions, "x", -Math.PI / 2);
  return getCenteredPositions(rotated);
}

function getDeterministicScale(index: number): number {
  let hash = (index + 1) | 0;
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 4294967295;
}

export function buildPointCloudGeometry(rawGeometry: BufferGeometry): BufferGeometry {
  const positions = preparePositions(extractPositionsFromPLY(rawGeometry));
  const count = positions.length / 3;
  const scales = new Float32Array(count);
  for (let i = 0; i < count; i++) scales[i] = getDeterministicScale(i);

  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setAttribute("aScale", new BufferAttribute(scales, 1));
  return geo;
}
