// Landscape mesh -> point geometry for the footer particles.
//
// The Landscape node is a 128x128 grid of triangles. Handed straight to <points>, three
// walks its INDEX buffer, so every interior vertex went out six times — once per
// triangle sharing it — as six identical sprites stacked additively. This emits each
// position exactly once, and optionally subdivides every triangle so the terrain
// carries a finer lattice of smaller points. PARTICLES.intensity puts the brightness
// the stacking used to supply back in the fragment shader.
//
// Pure — no React, no scene graph.

import { BufferAttribute, BufferGeometry } from "three";

const SCALE_SEED = 0x2f6b3a1d;

// Seeded rather than Math.random(): StrictMode renders twice and HMR re-runs the memo,
// and a random fill reshuffled every point's size on each of those. Same generator as
// the hero scene's sampler.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One point per source vertex, plus — at `subdivisions` n > 1 — n-1 points along every
 * edge and (n-1)(n-2)/2 inside every triangle. Edges are shared between neighbouring
 * triangles, so they are de-duplicated by vertex pair: a duplicate would be two sprites
 * on one spot, and additive blending would show it as a bright speck.
 *
 * On the 128x128 grid: n=1 -> 16,641 points, n=2 -> 66,049, n=3 -> 148,225.
 */
export function buildLandscapePoints(
  source: BufferGeometry,
  subdivisions: number,
): BufferGeometry {
  const n = Math.max(1, Math.round(subdivisions));
  const position = source.getAttribute("position");
  const vertexCount = position.count;

  const src = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    src[i * 3] = position.getX(i);
    src[i * 3 + 1] = position.getY(i);
    src[i * 3 + 2] = position.getZ(i);
  }

  const index = source.getIndex();
  const tris = n > 1 && index ? index.array : null;
  const triCount = tris ? Math.floor(tris.length / 3) : 0;

  // Unique edges, as flat endpoint pairs. The key is unique while vertexCount^2 stays
  // inside 2^53, which is any mesh that fits in a browser.
  const edgeKeys = new Set<number>();
  const edgeEnds: number[] = [];
  if (tris) {
    for (let t = 0; t < triCount; t++) {
      for (let k = 0; k < 3; k++) {
        const a = tris[t * 3 + k];
        const b = tris[t * 3 + ((k + 1) % 3)];
        const key = Math.min(a, b) * vertexCount + Math.max(a, b);
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        edgeEnds.push(a, b);
      }
    }
  }

  const edgeCount = edgeEnds.length / 2;
  const perTriangle = tris ? ((n - 1) * (n - 2)) / 2 : 0;
  const total = vertexCount + edgeCount * (n - 1) + triCount * perTriangle;

  const positions = new Float32Array(total * 3);
  positions.set(src);
  let cursor = vertexCount * 3;

  for (let e = 0; e < edgeCount; e++) {
    const a = edgeEnds[e * 2] * 3;
    const b = edgeEnds[e * 2 + 1] * 3;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      positions[cursor++] = src[a] + (src[b] - src[a]) * t;
      positions[cursor++] = src[a + 1] + (src[b + 1] - src[a + 1]) * t;
      positions[cursor++] = src[a + 2] + (src[b + 2] - src[a + 2]) * t;
    }
  }

  if (tris && perTriangle > 0) {
    for (let t = 0; t < triCount; t++) {
      const a = tris[t * 3] * 3;
      const b = tris[t * 3 + 1] * 3;
      const c = tris[t * 3 + 2] * 3;
      // Strictly interior barycentric lattice: u, v >= 1/n and w = 1-u-v >= 1/n, so
      // nothing lands on an edge or corner already emitted above.
      for (let i = 1; i <= n - 2; i++) {
        for (let j = 1; j <= n - 1 - i; j++) {
          const u = i / n;
          const v = j / n;
          const w = 1 - u - v;
          for (let axis = 0; axis < 3; axis++) {
            positions[cursor++] = src[a + axis] * w + src[b + axis] * u + src[c + axis] * v;
          }
        }
      }
    }
  }

  const rng = mulberry32(SCALE_SEED);
  const scales = new Float32Array(total);
  for (let i = 0; i < total; i++) scales[i] = rng();

  // Non-indexed, and position + aScale only: the shaders read nothing else, so the
  // mesh's normals and UVs would be upload for nothing.
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aScale", new BufferAttribute(scales, 1));
  return geometry;
}
