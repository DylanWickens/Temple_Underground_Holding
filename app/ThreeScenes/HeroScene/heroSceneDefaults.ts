// Single source of truth for hero scene tunable values.
//
// Ported from the PointClouds_ThreeJS_Exploration sketch. The numbers here are the
// ones dialled in on its lil-gui panel, NOT the `debugObject` defaults in its
// main.js — those had drifted well away from the look that was actually on screen.

import {
  resolveStops,
  type Stop,
  type Tier,
} from "../EquipmentScene/equipmentSceneDefaults";

export const MODEL_URL = "/models/TempleStudio_C4DBuild_025.gltf";

// The model is centred and scaled to this maxDim, so camera framing does not depend
// on the export's own units. 2.5 is carried over from the sketch unchanged.
export const NORMALIZED_SIZE = 2.5;

export const CAMERA = {
  fov: 45,
  near: 0.001,
  far: 1000,
};

// ---------------------------------------------------------------------------
// Responsive framing
//
// Camera distance is solved from the canvas WIDTH alone — height never enters it, so
// a short wide window frames the same as a tall one. Distance rather than fov because
// gl_PointSize is `uSize * aScale^2 / -viewZ`, so pulling back shrinks the points with
// the model, which fov would not do.
//
// A stop table rather than a formula, because the curve this needs is not one shape:
// working back from what reads well, the exponent of a power law would have to be
// ~0.10 at 2560, ~0.14 at 1440 and ~0.48 at 400. Nearly flat across desktop, steep
// below it. Same width-keyed scheme as COMPOSITION_STOPS and LIFT_STOPS.
// ---------------------------------------------------------------------------

/** Camera distance by canvas width. Interpolated; flat outside the end stops. */
export const CAMERA_Z_STOPS: Stop<{ z: number }>[] = [
  { width: 390, value: { z: 16 } },
  { width: 768, value: { z: 27.3 } },
  { width: 1280, value: { z: 5.8 } },
  { width: 1440, value: { z: 5.5 } },
  { width: 1920, value: { z: 5.2 } },
  { width: 2560, value: { z: 5 } },
  { width: 3840, value: { z: 4.8 } },
];

/** Camera distance for a given canvas width in CSS px. */
export function solveCameraZ(width: number): number {
  const widest = CAMERA_Z_STOPS[CAMERA_Z_STOPS.length - 1].value.z;
  if (!Number.isFinite(width) || width <= 0) return widest;
  return resolveStops(CAMERA_Z_STOPS, width).z;
}

// ---------------------------------------------------------------------------
// Post-processing scaling
//
// MULTIPLIERS on the base POST values, not absolutes: POST holds the look as tuned at
// 4K, and this trims it per width. 1 leaves a parameter alone.
//
// A table rather than a scalar derived from the camera distance, for the same reason
// the framing is a table — one curve cannot be right for bloom, grain and exposure at
// once, and the small end needs shaping that no single exponent produces.
// ---------------------------------------------------------------------------

// Exposure is deliberately absent: it is a constant of the look, not a function of
// how big the model is on screen, so it stays at POST.exposure at every width.
export type PostScale = {
  bloomStrength: number;
  bloomRadius: number;
  filmIntensity: number;
};

export const POST_SCALE_STOPS: Stop<PostScale>[] = [
  { width: 390, value: { bloomStrength: 0.59, bloomRadius: 0.01, filmIntensity: 0.87 } },
  { width: 768, value: { bloomStrength: 0.48, bloomRadius: 1, filmIntensity: 0.48 } },
  { width: 1280, value: { bloomStrength: 0.75, bloomRadius: 1, filmIntensity: 0.75 } },
  { width: 1920, value: { bloomStrength: 0.89, bloomRadius: 1, filmIntensity: 0.89 } },
  { width: 3840, value: { bloomStrength: 1, bloomRadius: 1, filmIntensity: 1 } },
];

// ---------------------------------------------------------------------------
// Lift — how far up the frame the cloud sits, as a ratio of the visible frame
// height, so the composition holds at any canvas size. Positive is up.
//
// Only the phone stop is lifted: at 390 the model is framed small and pushed above
// the centred hero logo. Everything from 768 up sits centred, and resolveStops holds
// the last stop for anything wider.
// ---------------------------------------------------------------------------

export const LIFT_STOPS: Stop<{ y: number }>[] = [
  { width: 390, value: { y: 0.25 } },
  { width: 768, value: { y: 0 } },
];

/** Vertical offset as a ratio of the visible frame height, for a canvas width. */
export function solveLift(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 0;
  return resolveStops(LIFT_STOPS, width).y;
}

/** The multipliers to apply to POST at a given canvas width. */
export function resolvePostScale(width: number): PostScale {
  if (!Number.isFinite(width) || width <= 0) {
    return { ...POST_SCALE_STOPS[POST_SCALE_STOPS.length - 1].value };
  }
  return resolveStops(POST_SCALE_STOPS, width);
}

/**
 * Base gl_PointSize in device px, before dpr scaling — `main.js:343`.
 *
 * No viewport term, exactly as the sketch: gl_PointSize is in DEVICE pixels and the
 * vertex shader has no resolution term, so a point holds its absolute pixel size
 * whatever the canvas does.
 */
export const PARTICLE_SIZE = 10;

export const NOISE = {
  noisePeriod: 3.4,
  noiseSpeed: 0.15,
  noiseStrength: 0.037,
};

export const POST = {
  bloomStrength: 2.64,
  bloomRadius: 0,
  bloomThreshold: 0.03,
  filmIntensity: 1,
  filmGrayscale: false,
  exposure: 1.31,
};

// Points per m² of REAL surface area, so the same number reads as the same density
// on any object regardless of how big it is. Indexed by the order the glTF yields its
// objects. Hand-tuned on the 4K display; the areas are the model's real ones.
export const OBJECT_DENSITIES = [
  840, //  0  BUILD / WINDOWS              9.9 m²
  1220, // 1  BUILD / Beams               11.9 m²
  // 0 on purpose: Remesh is a near-duplicate of MainRoom2 and was the single largest
  // contributor to the point count. Dropping it costs nothing visually.
  0, //    2  BUILD / Remesh             158.5 m²
  270, //  3  BUILD / MainRoom2          157.1 m²
  3930, // 4  KIT / HiFi_Speaker1          1.3 m²
  3610, // 5  KIT / HiFi_Speaker           1.3 m²
  2010, // 6  KIT / Amplifier_02           2.4 m²
  1810, // 7  KIT / Amplifier_01           2.5 m²
  1850, // 8  KIT / Amplifier_01_1         2.5 m²
  540, //  9  KIT / Subdivision_Surface   33.3 m²
];

// ---------------------------------------------------------------------------
// DEBUG — live tuning. Read inside useFrame, so a slider needs no re-render.
// Set SHOW_HERO_DEV_GUI to false once the look is dialled in.
// ---------------------------------------------------------------------------

export const SHOW_HERO_DEV_GUI = true;

/** Sentinels for HERO_TUNING.meshVerticesIndex. */
export const MESH_VERTICES_OFF = -2;
export const MESH_VERTICES_ALL = -1;

export const HERO_TUNING = {
  /**
   * Multiplies the point size. Hand-tuned on the 4K display — the sketch's bare
   * `10 * dpr` is far too fine at this camera distance. Left as a multiplier rather
   * than folded into PARTICLE_SIZE so the panel and this file read the same.
   */
  pointSizeMultiplier: 3.85,
  /** Renders the raw scene straight to screen, skipping the whole composer. */
  bypassPost: false,
  /**
   * Seed for the surface sampling. Advanced by the panel's Regenerate button, so a
   * fresh cloud is a deliberate act while a reload stays reproducible.
   */
  seed: 132372737,
  /**
   * Which object's raw mesh vertices to draw alongside the sampled cloud.
   * MESH_VERTICES_OFF, MESH_VERTICES_ALL, or an index into OBJECT_DENSITIES.
   */
  meshVerticesIndex: MESH_VERTICES_OFF,
  /** Hides the sampled cloud, so the mesh vertices above can be read on their own. */
  hidePointCloud: false,
};

/** Slider bounds for the per-object density controls — the sketch's, exactly. */
export const DENSITY_RANGE = { min: 0, max: 5000, step: 10 };

/** Fallback for an object the table above does not cover (a re-export adding a node). */
export const DEFAULT_DENSITY = 750;

/** Ceiling per object, so a mistyped density cannot allocate hundreds of MB. */
export const MAX_OBJECT_POINTS = 500_000;

// Density multiplier per tier. A multiplier rather than a flat per-tier density, so
// the hand-tuned ratios between objects survive on a phone — the windows still read
// far denser than the beams, everything is just thinner overall.
export const TIER_DENSITY_SCALE: Record<Tier, number> = {
  mobile: 0.33,
  tablet: 0.66,
  desktop: 1,
};

/** Upper bound for the canvas + composer pixel ratio. */
export const TIER_MAX_DPR: Record<Tier, number> = {
  mobile: 1.5,
  tablet: 2,
  desktop: 2,
};
