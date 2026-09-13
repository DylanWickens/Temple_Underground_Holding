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
  // 2.2, up from 1.6: at 1.6 the build read as an object sitting in a tall frame
  // rather than the full bleed this band exists for. 2.2 solves to z ~2.97 on a
  // 390x844 frame — deliberately the largest value that still clears MIN_CAMERA_Z on
  // its own, so this number is the whole story and no clamp is silently eating it.
  //
  // Tune it with the mobile spin RUNNING: the build is wide and low, so a quarter turn
  // presents its narrow face and a coverage dialled at the resting pose reads emptier
  // there.
  { width: 390, value: { coverage: 2.2 } },
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
// 0.05 from the tablet band up: the cloud sits slightly high and the hero logo reads
// as an overlay across it. resolveStops clamps flat above the last stop, so 768 is
// also what 1920 and 3840 get — the lift ramps in between 390 and 768 and then holds.
// The phone stop stays at 0: the build covers that frame edge to edge, so there is
// nothing for it to clear.
// ---------------------------------------------------------------------------

export const LIFT_STOPS: Stop<{ y: number }>[] = [
  { width: 390, value: { y: 0 } },
  { width: 768, value: { y: 0.05 } },
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
// Pointer tilt — the cloud turns to follow the cursor rather than being dragged.
// The pointer's Y drives rotation.x and its X drives rotation.y, each swinging to
// the max below at the edge of the window and passing through the resting pose at
// the centre. Authored in degrees: these are large enough that radians stop being
// legible at a glance.
// ---------------------------------------------------------------------------

const deg = (d: number) => (d * Math.PI) / 180;

export const MOUSE_ROTATION = {
  /** Max tilt from pointer Y at the top and bottom of the window — 320° end to end. */
  maxX: deg(160),
  /** Max tilt from pointer X at the left and right of the window — 320° end to end. */
  maxY: deg(160),
  /** Exponential follow rate, per second. Higher tracks tighter; lower trails more. */
  smoothing: 3,
};

/**
 * Resting orientation of the build, in radians — the pose the cursor tilt swings
 * around and settles back to, and the one MOBILE_SPIN drifts from. Applied to the
 * group, not baked into the geometry: baking would mean re-sampling every object to
 * change the framing.
 *
 * Y sat at a half turn; flipped by another 180°, which lands back on the glTF's own
 * orientation. Kept as an explicit stop rather than deleted — this is the one place
 * the resting pose is art-directed, and both rotation branches read it.
 */
export const MODEL_ROTATION = [0, deg(0), 0] as const;

// ---------------------------------------------------------------------------
// Mobile spin — below COVER_MAX_WIDTH the cursor tilt is replaced by a turntable.
//
// There is no cursor on a phone, so MOUSE_ROTATION reads as nothing at all there: the
// cloud just sits. A slow drift gives the build life, and gives a horizontal swipe
// something to push against.
//
// A gesture is AXIS-LOCKED once, on the first move that leaves a small deadzone
// around the touchstart. Horizontal is the canvas's: every later move injects spin.
// Vertical is the browser's page scroll: the cloud ignores it until the finger lifts.
// The HeroCanvas wrapper carries `touch-action: pan-y pinch-zoom`, so the browser
// makes the mirror-image call — it claims only vertical pans over the hero and leaves
// horizontal ones to the canvas. Neither side calls preventDefault; the two heuristics
// simply agree on where the split is, and axisRatio biases ours slightly toward the
// scroll so a diagonal near the split goes dead rather than doing both.
//
// The swipe is DIRECTIONAL: it injects a signed angular velocity that decays back to
// zero, so the rate is `baseRate + velocity`. A hard swipe against the drift drives
// that sum negative and the build genuinely reverses for a moment before settling
// back. The reversal falls out of the arithmetic; there is no separate case for it.
//
// Rates in degrees per second, matching MOUSE_ROTATION above: a spin rate in radians
// per second is not a number anyone can picture.
// ---------------------------------------------------------------------------

export const MOBILE_SPIN = {
  /** Resting drift. 13°/s is one turn every ~28 s. */
  baseRate: deg(13),
  /**
   * Spin injected per SCREEN WIDTH of horizontal drag, accumulated over the gesture.
   *
   * Per width rather than per pixel, so a swipe means the same thing on a 360px and a
   * 430px phone. Accumulated from each move's dx rather than sampled as a speed, so a
   * device that fires touchmove at 120Hz does not inject twice what a 60Hz one does.
   */
  swipeGain: deg(345),
  /** Ceiling on the TOTAL rate (drift + injection), so a flick cannot strobe the cloud. */
  maxRate: deg(170),
  /** Exponential decay of the injected velocity back to the resting drift, per second. */
  decay: 1.2,
  /** Drag speed, in screen widths per second, that counts as a full-intensity flick. */
  flickSpeed: 3.0,
  /** Extra uNoiseStrength at full intensity, ADDED to NOISE.noiseStrength. */
  noiseStrengthBoost: 0.05,
  /** Extra uNoisePeriod at full intensity. "A little" — the frequency barely moves. */
  noisePeriodBoost: 1.2,
  /** How fast the noise boost falls back to 0, per second. Faster than the spin decay. */
  noiseDecay: 2.5,
  /**
   * Radius, in CSS px, the finger must leave before the gesture's axis is decided.
   *
   * Sized just above the browsers' own touch slop (8dp on Android, ~10pt on iOS), so
   * the browser has usually committed by the time this fires and the decision here is
   * made on the same displacement the browser acted on.
   */
  axisLockPx: 12,
  /**
   * |dx| must exceed |dy| * axisRatio for the gesture to be the canvas's. 1 is the
   * browser's own 45° split; above 1 hands the ambiguous diagonals to the page scroll,
   * because "scrolls AND spins" is the failure that reads as broken, while "neither"
   * just reads as a swipe that did not take.
   */
  axisRatio: 1.2,
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
