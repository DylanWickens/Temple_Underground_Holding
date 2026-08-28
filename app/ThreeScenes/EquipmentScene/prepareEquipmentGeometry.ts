// PLY geometry preparation for the equipment point cloud.
// Centres the model, adds the per-point random scale attribute, and optionally
// decimates the cloud for low-power devices.

import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Vector3 } from "three";

/**
 * Stable per-index pseudo-random in [0,1). Deterministic so the particle
 * distribution does not reshuffle when the geometry is rebuilt at a breakpoint,
 * and so SSR and client agree.
 */
function getDeterministicScale(index: number): number {
  let hash = (index + 1) | 0;
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 4294967295;
}

/**
 * Keep every `stride`th vertex. Striding rather than truncating preserves the
 * shape of the model at lower density — a draw-range cut would lop off whichever
 * part of the cloud the PLY happens to store last.
 */
function decimate(positions: Float32Array, stride: number): Float32Array {
  if (stride <= 1) return positions;

  const sourceCount = positions.length / 3;
  const keptCount = Math.ceil(sourceCount / stride);
  const out = new Float32Array(keptCount * 3);

  for (let i = 0, w = 0; i < sourceCount; i += stride, w++) {
    out[w * 3] = positions[i * 3];
    out[w * 3 + 1] = positions[i * 3 + 1];
    out[w * 3 + 2] = positions[i * 3 + 2];
  }
  return out;
}

export type PreparedEquipmentGeometry = {
  geometry: BufferGeometry;
  /** Largest bounding-box dimension, in model units — the anchor for `coverage`. */
  maxDim: number;
};

export function buildEquipmentGeometry(
  rawGeometry: BufferGeometry,
  stride = 1,
): PreparedEquipmentGeometry {
  const source = rawGeometry.getAttribute("position");
  const positions = decimate(new Float32Array(source.array as Float32Array), stride);

  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.center();
  geo.computeBoundingBox();

  const size = new Vector3();
  geo.boundingBox?.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  const count = positions.length / 3;
  const scales = new Float32Array(count);
  for (let i = 0; i < count; i++) scales[i] = getDeterministicScale(i);
  geo.setAttribute("aScale", new BufferAttribute(scales, 1));

  return { geometry: geo, maxDim };
}
