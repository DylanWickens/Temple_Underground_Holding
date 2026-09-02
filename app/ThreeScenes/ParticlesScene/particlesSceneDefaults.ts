// Single source of truth for footer particles scene tunable values.
//
// Everything responsive here is driven by canvas HEIGHT.
//
// A fixed vertical fov already pins the visible world height, so camera framing
// was never the height problem — particle size was. `gl_PointSize` is in DEVICE
// pixels, and `uSize` used to be the constant 175, so a shorter window shrank the
// terrain with the frame while the points held their absolute pixel size and took
// over the shot. resolveParticleSize is the fix.
//
// The camera is deliberately never dollied. It sits inside the terrain mesh —
// which spans [-300, 0, -300] to [300, 96.36, 300] — only 6.86 units above the
// ground plane, and 138.5 units from its look-at target. Moving away along that
// sightline drives y = 66.62 - 0.4316 * distance, so ~22 units of pullback would
// put the camera underground.
//
// The exported objects are mutated in place by the dev GUI, which is why they are
// objects rather than primitives: lil-gui binds to a property on a stable object.
// Nothing in the production path writes to them.

import type { PerspectiveCamera } from "three";

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

// Pose is applied imperatively by ResponsiveCamera rather than passed to drei's
// <PerspectiveCamera>, so that R3F does not re-assert props over the dev GUI.
export const CAMERA = {
  posX: 94.5233,
  posY: 6.8569,
  posZ: -92.4471,
  targetX: 6.629,
  targetY: 66.6245,
  targetZ: -3.7087,
};

// three's PerspectiveCamera constructor defaults, previously inherited implicitly
// because <PerspectiveCamera> was given no near/far props. The far corner of the
// terrain sits ~446 units out, so 2000 is ample.
export const CAMERA_CLIPPING = { near: 0.1, far: 2000 };

export const CAMERA_POSITION_MARGIN = 40;
export const CAMERA_SLIDER_STEP = 0.01;

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

/**
 * The viewport the shot is composed for. Height is the footer's own box, not the
 * window: the footer is `h-[90vh]`, so a 1920x1080 window yields a 1920x972 canvas.
 */
export const REFERENCE_VIEWPORT = { width: 1920, height: 972 };

export const REFERENCE_ASPECT = REFERENCE_VIEWPORT.width / REFERENCE_VIEWPORT.height;

export const FRAMING = {
  /** Vertical fov, in degrees. Held at every aspect while widthLock is 0. */
  referenceFov: 50,
  /**
   * Optional art-direction knob, off by default.
   *   0 = vertical lock. Visible world HEIGHT is constant; a narrower window
   *       simply reveals more width. This is the long-standing framing.
   *   1 = horizontal lock. Visible world width is constant instead, so a shorter
   *       window crops vertically rather than widening out.
   * Left at 0 so this change is confined to particle scaling.
   */
  widthLock: 0,
  /** Bounds on the solved fov. Only reachable once widthLock is raised above 0. */
  minFov: 35,
  maxFov: 75,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const DEG_TO_HALF_RAD = Math.PI / 360;

/**
 * Vertical fov, in degrees, that holds the composition at `aspect`.
 *
 * Pure, so the camera and the particle sizing can each derive it from their own
 * copy of the canvas size with no ordering dependency between them. Returns
 * referenceFov unchanged while widthLock is 0.
 */
export function solveFov(aspect: number): number {
  if (FRAMING.widthLock === 0) return FRAMING.referenceFov;
  if (!Number.isFinite(aspect) || aspect <= 0) return FRAMING.referenceFov;

  const referenceTangent = Math.tan(FRAMING.referenceFov * DEG_TO_HALF_RAD);
  const widthCorrection = (REFERENCE_ASPECT / aspect) ** FRAMING.widthLock;
  const fov = 2 * Math.atan(referenceTangent * widthCorrection) * (180 / Math.PI);

  return clamp(fov, FRAMING.minFov, FRAMING.maxFov);
}

/** Applies pose plus the solved fov. Shared by ResponsiveCamera and the dev GUI. */
export function applyCameraFraming(
  camera: PerspectiveCamera,
  width: number,
  height: number,
) {
  camera.position.set(CAMERA.posX, CAMERA.posY, CAMERA.posZ);
  // drei's <PerspectiveCamera> also maintains aspect and calls
  // updateProjectionMatrix on every render, but its effect ordering relative to
  // ours is not guaranteed, so set both and flush here.
  camera.aspect = width / height;
  camera.fov = solveFov(camera.aspect);
  camera.lookAt(CAMERA.targetX, CAMERA.targetY, CAMERA.targetZ);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

/**
 * `size` is `uSize` at REFERENCE_VIEWPORT and dpr 1.
 *
 * Calibrated so the shot is unchanged where it was originally tuned: the old
 * constant 175 at a 1336px-tall canvas and dpr 1 gives 175 * 972 / 1336 = 127.
 */
export const PARTICLES = { size: 127 };

export const NOISE_DEFAULTS = {
  noisePeriod: 1,
  noiseSpeed: 0.4,
  noiseStrength: 3,
};

/**
 * `gl_PointSize` is in device pixels while the shader hardcodes its projection
 * scale as `100.0 / -viewPosition.z`, which accounts for neither canvas height nor
 * fov. So `uSize` has to carry both: point size goes as deviceHeight / tan(fov / 2).
 *
 * Height is the term that matters here. The point count is fixed at 16,641, so as
 * the frame gets shorter the points must shrink with it or the ridge stops reading
 * as a ridge and turns into a row of blobs.
 */
export function resolveParticleSize(height: number, dpr: number, fov: number): number {
  const heightFactor = height / REFERENCE_VIEWPORT.height;
  const fovFactor =
    Math.tan(FRAMING.referenceFov * DEG_TO_HALF_RAD) / Math.tan(fov * DEG_TO_HALF_RAD);

  return PARTICLES.size * dpr * heightFactor * fovFactor;
}
