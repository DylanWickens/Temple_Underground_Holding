// Mesh -> point cloud conversion for the hero scene.
//
// Distilled from the PointClouds_ThreeJS_Exploration sketch. The sketch carried a
// nine-model registry and a PLY branch; this handles the one glTF the site uses.
// Everything here is pure — no React, no Three scene graph mutation beyond the
// matrixWorld update the sampler needs.
//
// Split in two on purpose, mirroring the sketch's modelCache/regenerateObject pair:
// prepareHeroModel() does the costly work once (a MeshSurfaceSampler per mesh), and
// sampleHeroObject() draws samples against those, cheaply, whenever a density moves.

import * as THREE from "three";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { MAX_OBJECT_POINTS, NORMALIZED_SIZE } from "./heroSceneDefaults";

export type ModelTransform = { center: THREE.Vector3; scale: number };

type ObjectPart = {
  sampler: MeshSurfaceSampler;
  area: number;
  matrixWorld: THREE.Matrix4;
};

export type HeroObject = {
  /** "BUILD / WINDOWS" — the label the density sliders are named after. */
  label: string;
  /** Real world surface area in m², what the density is dialled against. */
  area: number;
  parts: ObjectPart[];
  /** This object's own mesh vertices, baked into model space — the debug layer. */
  vertices: Float32Array;
};

export type HeroModel = {
  transform: ModelTransform;
  objects: HeroObject[];
  /** Every mesh vertex, baked into model space — the "show mesh vertices" layer. */
  baseVertices: Float32Array;
};

// @types/three is behind three 0.185's MeshSurfaceSampler, which has had
// setRandomGenerator since r150. Narrow cast rather than `any` so the rest of the
// sampler stays typed.
type SeedableSampler = MeshSurfaceSampler & {
  setRandomGenerator(randomFunction: () => number): MeshSurfaceSampler;
};

// The sketch used Math.random() for both the surface sampling and the aScale fill.
// Under StrictMode the component renders twice and HMR re-runs the memo, so that
// reshuffled the entire cloud on every edit. A seeded stream keeps a given seed
// producing a given cloud; the Regenerate button advances the seed.
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

// The bounding-box centre and the uniform scale that fits the model into
// NORMALIZED_SIZE. Baked into the positions rather than applied as a parent transform
// because the vertex shader samples noise straight off the `position` ATTRIBUTE —
// left unbaked, that attribute would still be in the model's original units and would
// silently retune uNoisePeriod and uNoiseStrength. (A transform on the group is fine:
// modelMatrix never touches the attribute.)
function getModelTransform(positions: Float32Array): ModelTransform {
  const box = new THREE.Box3().setFromArray(positions);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  return { center: box.getCenter(new THREE.Vector3()), scale: NORMALIZED_SIZE / maxDim };
}

// Every vertex baked through its own matrixWorld into one flat array.
function collectMeshVertices(meshes: THREE.Mesh[]): Float32Array {
  let vertexCount = 0;
  for (const mesh of meshes) vertexCount += mesh.geometry.attributes.position.count;

  const positions = new Float32Array(vertexCount * 3);
  const temp = new THREE.Vector3();
  let cursor = 0;

  for (const mesh of meshes) {
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      temp.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      positions[cursor++] = temp.x;
      positions[cursor++] = temp.y;
      positions[cursor++] = temp.z;
    }
  }

  return positions;
}

function applyModelTransform(
  positions: Float32Array,
  { center, scale }: ModelTransform,
): Float32Array {
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] - center.x) * scale;
    positions[i + 1] = (positions[i + 1] - center.y) * scale;
    positions[i + 2] = (positions[i + 2] - center.z) * scale;
  }
  return positions;
}

// Skip pass-through wrapper nodes (a single mesh-less child) so the exporter nesting
// the real content under a lone root still yields useful objects.
function unwrapNode(node: THREE.Object3D): THREE.Object3D {
  let current = node;
  while (!(current as THREE.Mesh).isMesh && current.children.length === 1) {
    current = current.children[0];
  }
  return current;
}

// The named children of each top-level node are the scene's "objects" — one density
// slider each. A node carrying geometry itself, or with no children, stands alone.
// This build yields 10: BUILD's 4 and KIT's 6.
function collectObjectNodes(root: THREE.Object3D): THREE.Object3D[] {
  const nodes: THREE.Object3D[] = [];

  for (const top of root.children) {
    const node = unwrapNode(top);
    if ((node as THREE.Mesh).isMesh || node.children.length === 0) nodes.push(node);
    else nodes.push(...node.children);
  }

  return nodes;
}

function buildObjectParts(node: THREE.Object3D): ObjectPart[] {
  const parts: ObjectPart[] = [];

  node.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const sampler = new MeshSurfaceSampler(mesh);
    sampler.build();

    // distribution holds cumulative face areas in the mesh's own local space. Every
    // node in this build is uniformly scaled, so det^(2/3) converts that to world
    // square metres exactly. An empty distribution means no faces at all — which is
    // how the Camera node drops out.
    const distribution = sampler.distribution;
    const localArea = distribution ? distribution[distribution.length - 1] : 0;
    if (!Number.isFinite(localArea) || localArea <= 0) return;

    const areaFactor = Math.pow(Math.abs(mesh.matrixWorld.determinant()), 2 / 3);

    parts.push({
      sampler,
      area: localArea * areaFactor,
      matrixWorld: mesh.matrixWorld.clone(),
    });
  });

  return parts;
}

/**
 * The expensive half: parse the build, measure it, and construct one sampler per mesh.
 * Runs once per model, never on a density change.
 */
export function prepareHeroModel(root: THREE.Object3D): HeroModel {
  // Every top-level node matters (BUILD, KIT and a Camera), so update the whole graph
  // rather than a single root.
  root.updateMatrixWorld(true);

  const allMeshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) allMeshes.push(child as THREE.Mesh);
  });

  const baseVertices = collectMeshVertices(allMeshes);
  const transform = getModelTransform(baseVertices);
  applyModelTransform(baseVertices, transform);

  const labelCounts = new Map<string, number>();
  const objects: HeroObject[] = [];

  for (const node of collectObjectNodes(root)) {
    const parts = buildObjectParts(node);
    if (parts.length === 0) continue; // camera nodes, empty groups

    // This object's raw vertices, so the debug layer can show one object on its own
    // rather than the whole build at once.
    const nodeMeshes: THREE.Mesh[] = [];
    node.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) nodeMeshes.push(child as THREE.Mesh);
    });
    const vertices = applyModelTransform(collectMeshVertices(nodeMeshes), transform);

    // The build repeats names ("Amplifier 01" twice), so repeats get a suffix to stay
    // tellable apart in the panel.
    const parentName = node.parent?.name ?? "";
    const base = parentName ? `${parentName} / ${node.name}` : node.name;
    const seen = (labelCounts.get(base) ?? 0) + 1;
    labelCounts.set(base, seen);

    objects.push({
      label: seen > 1 ? `${base} #${seen}` : base,
      area: parts.reduce((sum, part) => sum + part.area, 0),
      parts,
      vertices,
    });
  }

  return { transform, objects, baseVertices };
}

/**
 * The cheap half: draw `density * area` samples across the object's meshes.
 *
 * `seed` is mixed with the object index by the caller, so each object gets its own
 * stream and one slider moving does not reshuffle its neighbours.
 */
export function sampleHeroObject(
  object: HeroObject,
  transform: ModelTransform,
  density: number,
  seed: number,
): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  for (const part of object.parts) {
    (part.sampler as SeedableSampler).setRandomGenerator(rng);
  }

  const total = Math.min(Math.round(density * object.area), MAX_OBJECT_POINTS);

  const positions = new Float32Array(total * 3);
  const scales = new Float32Array(total);
  const { center, scale } = transform;
  const temp = new THREE.Vector3();

  let remaining = total;
  let cursor = 0;

  object.parts.forEach((part, i) => {
    // Weight by surface area, not by mesh count: an object's 63 tiny meshes must not
    // outvote its one large one. The last part absorbs the rounding remainder, so the
    // total comes out exact.
    const share =
      i === object.parts.length - 1
        ? remaining
        : Math.min(remaining, Math.round(total * (part.area / object.area)));
    remaining -= share;

    for (let s = 0; s < share; s++) {
      part.sampler.sample(temp);
      temp.applyMatrix4(part.matrixWorld);
      positions[cursor++] = (temp.x - center.x) * scale;
      positions[cursor++] = (temp.y - center.y) * scale;
      positions[cursor++] = (temp.z - center.z) * scale;
    }
  });

  for (let i = 0; i < total; i++) scales[i] = rng();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

  return geometry;
}

/** The raw mesh vertices as a point geometry, for the "show mesh vertices" layer. */
export function buildBaseVertexGeometry(
  baseVertices: Float32Array,
  seed: number,
): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const count = baseVertices.length / 3;
  const scales = new Float32Array(count);
  for (let i = 0; i < count; i++) scales[i] = rng();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(baseVertices.slice(), 3));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  return geometry;
}
