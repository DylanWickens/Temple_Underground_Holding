// Single source of truth for hero scene tunable values.
//
// Ported from the PointClouds_ThreeJS_Exploration sketch. The numbers here are the
// ones dialled in on its lil-gui panel, NOT the `debugObject` defaults in its
// main.js — those had drifted well away from the look that was actually on screen.

import {
  resolveStops,
  TIER_MAX_WIDTH,
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
// Two regimes, split at COVER_MAX_WIDTH.
//
// Tablet and desktop: camera distance is solved from the canvas WIDTH alone — height
// never enters it, so a short wide window frames the same as a tall one. Distance rather
// than fov because gl_PointSize is `uSize * aScale^2 / -viewZ`, so pulling back shrinks
// the points with the model, which fov would not do.
//
// A stop table rather than a formula, because the curve this needs is not one shape:
// working back from what reads well, the exponent of a power law would have to be
// ~0.10 at 2560 and ~0.14 at 1440. Nearly flat across desktop. Same width-keyed scheme
// as COMPOSITION_STOPS and LIFT_STOPS.
//
// Phones: the build has to COVER the frame — large, running off the left and right
// edges, with the hero logo reading as an overlay on it. A width-keyed distance cannot
// express that, because 390px is a very different frame at 19.5:9 than at 4:3. So this
// band solves the distance from the frame's real aspect against a tunable coverage.
// ---------------------------------------------------------------------------

/** Below this canvas width the camera covers the frame rather than following CAMERA_Z_STOPS. */
export const COVER_MAX_WIDTH = TIER_MAX_WIDTH.mobile;

/**
 * Camera distance by canvas width, from COVER_MAX_WIDTH up. Interpolated; flat outside
 * the end stops. Nothing below 768 lives here — that band is solved from COVER_STOPS,
 * and a stop under it would be a second, silent source of truth.
 */
export const CAMERA_Z_STOPS: Stop<{ z: number }>[] = [
  // 6, not the 27.3 this stop held: that value was out of family with every other one
  // here (the curve ran 16 → 27.3 → 5.8), and since resolveStops lerps, it dragged the
  // whole tablet band back with it.
  { width: 768, value: { z: 6 } },
  { width: 1280, value: { z: 5.8 } },
  { width: 1440, value: { z: 5.5 } },
  { width: 1920, value: { z: 5.2 } },
  { width: 2560, value: { z: 5 } },
  { width: 3840, value: { z: 4.8 } },
];

/**
 * How much of the frame's MINOR axis the build spans, by canvas width. 1 is exactly edge
 * to edge; above 1 it overflows and crops, which is the point.
 *
 * Minor axis rather than height: the build is wide and low, and NORMALIZED_SIZE measures
 * its LONGEST dimension. Filling a portrait phone vertically would want z ≈ 2.2, inside
 * the cloud's own 1.25 half-extent once orbited. Anchoring on the minor axis — the width,
 * on a phone — reads as the same full bleed with the camera safely outside.
 */
export const COVER_STOPS: Stop<{ coverage: number }>[] = [
  { width: 390, value: { coverage: 1.6 } },
  // Not a composition choice — this is the handoff. 0.75 is what CAMERA_Z_STOPS' z: 6
  // already resolves to on a portrait tablet frame, so the two regimes meet at 768
  // instead of stepping. Tune the 390 stop for the phone look; tune this one only to
  // keep the seam closed.
  { width: 768, value: { coverage: 0.75 } },
];

/** Floor on the solved distance, so a coverage drag cannot seat the camera in the cloud. */
export const MIN_CAMERA_Z = 2.6;

/**
 * Camera distance for a given canvas size in CSS px.
 *
 * `height` and `fov` bear only on the cover band: at COVER_MAX_WIDTH and above, the
 * width-keyed table answers on its own exactly as it did before that band existed.
 */
export function solveCameraZ(
  width: number,
  height: number,
  fov: number = CAMERA.fov,
): number {
  const widest = CAMERA_Z_STOPS[CAMERA_Z_STOPS.length - 1].value.z;
  if (!Number.isFinite(width) || width <= 0) return widest;

  // A height that cannot be trusted falls back to the table rather than solving off a
  // bad aspect: a table framing is merely the wrong size, a bad aspect is a black frame.
  if (width >= COVER_MAX_WIDTH || !Number.isFinite(height) || height <= 0) {
    return resolveStops(CAMERA_Z_STOPS, width).z;
  }

  // visibleHeight = 2 * z * tan(fov / 2) and visibleWidth = visibleHeight * aspect, so
  // the minor axis spans 2 * z * tan(fov / 2) * min(aspect, 1). Solved for the z at which
  // NORMALIZED_SIZE covers `coverage` of it.
  //
  // Clamped low: a coverage of 0 solves to an infinite distance. The GUI slider cannot
  // reach it, but a hand-edited stop should not be able to produce a NaN camera matrix.
  const coverage = Math.max(resolveStops(COVER_STOPS, width).coverage, 0.1);
  const aspect = width / height;
  const minorAxis = 2 * Math.tan((fov * Math.PI) / 360) * Math.min(aspect, 1);

  return Math.max(NORMALIZED_SIZE / (coverage * minorAxis), MIN_CAMERA_Z);
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
  // Radius and grain re-set with the cover framing: both were dialled against a build
  // that occupied a fraction of the frame, and read as a haze over one that fills it.
  { width: 390, value: { bloomStrength: 0.59, bloomRadius: 1, filmIntensity: 0.5 } },
  { width: 768, value: { bloomStrength: 0.48, bloomRadius: 1, filmIntensity: 0.48 } },
  { width: 1280, value: { bloomStrength: 0.75, bloomRadius: 1, filmIntensity: 0.75 } },
  { width: 1920, value: { bloomStrength: 0.89, bloomRadius: 1, filmIntensity: 0.89 } },
  { width: 3840, value: { bloomStrength: 1, bloomRadius: 1, filmIntensity: 0.36 } },
];

// ---------------------------------------------------------------------------
// Lift — how far up the frame the cloud sits, as a ratio of the visible frame
// height, so the composition holds at any canvas size. Positive is up.
//
// Zero at every width: the cloud sits centred and the hero logo reads as an overlay on
// it. The phone stop was lifted 0.25 while the build was framed small enough to sit
// above that logo; it covers the frame now, so there is nothing to clear. The table is
// kept, and kept in the dev GUI, as the mechanism for vertical art direction.
// ---------------------------------------------------------------------------

export const LIFT_STOPS: Stop<{ y: number }>[] = [
  { width: 390, value: { y: 0 } },
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

// ---------------------------------------------------------------------------
// Reveal — the cloud twinkles in rather than appearing whole.
//
// Every point draws a random birth time across `duration`, then brightens over
// `twinkle` seconds with a flash that overshoots to (1 + flash) before settling. The
// clock advances by real frame deltas (capped), so a stall while bloom allocates
// its targets pauses the reveal rather than skipping most of it.
// ---------------------------------------------------------------------------

export const REVEAL = {
  /** Seconds over which the birth times are spread. */
  duration: 2.0,
  /** Seconds a single point takes to twinkle in, once born. */
  twinkle: 0.45,
  /** Peak overshoot of the twinkle: 0 is a plain fade-in. */
  flash: 1.6,
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
  // 0.5, up from the 0.33 that suited the old small phone framing: the same points
  // spread over a build that now fills the screen read as a sketch of one. Not 1 —
  // the points grow with the model as the camera closes in, so fill rate rises too.
  mobile: 0.5,
  tablet: 0.66,
  desktop: 1,
};

/** Upper bound for the canvas + composer pixel ratio. */
export const TIER_MAX_DPR: Record<Tier, number> = {
  mobile: 1.5,
  tablet: 2,
  desktop: 2,
};
