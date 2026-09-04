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
import { resolveStops, type Stop } from "../EquipmentScene/equipmentSceneDefaults";

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

// ---------------------------------------------------------------------------
// Scroll lift
// ---------------------------------------------------------------------------

/**
 * Accumulated scroll gesture, in world units of Y lift. Owned by ParticlesScene,
 * mutated by the Lenis virtual-scroll handler and the GSAP return tween, read by
 * Particles inside useFrame. Deliberately a plain mutable object rather than
 * React state: it changes on every wheel tick.
 */
export type LiftState = { value: number };

/** The width-responsive subset of LIFT. Numeric only, so every field can be lerped. */
export type LiftStopValues = {
  /** Y displacement, in world units, at the centre of the falloff. */
  maxLift: number;
  /** Pixels of scroll gesture needed to reach maxLift. Higher = more effort. */
  effortPx: number;
  /** View-space distance before the lift starts, and the ramp width after it. */
  nearDistance: number;
  nearFade: number;
  /** Falloff ellipse in NDC, so the band tracks the viewport centre at any aspect. */
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  /** Exponent on the smoothstep falloff. >1 tightens the peak, <1 flattens it. */
  power: number;
  /** Per-particle height variance, as a fraction of the lift, keyed off aScale. */
  variance: number;
  /** Lateral drift, as a fraction of each particle's lift, driven by the animated noise. */
  scatter: number;
  /** Point-size multiplier at full lift: size *= 1 + falloff * sizeScale. */
  sizeScale: number;
  /**
   * NDC y where points start fading toward the top of the canvas (1.0 = edge).
   * Hides the hard clip line where lifted points leave the overflow-hidden footer.
   */
  edgeFadeStart: number;
  /** Per-second lerp rate toward the target on the way up. Lower = lazier. */
  riseSmoothing: number;
  /** Blend from a linear (0) to a smoothstep (1) response over the accumulated gesture. */
  riseCurve: number;
  /** Gesture quiet time before the return tween starts. */
  idleMs: number;
  /** Seconds for the return to zero. */
  returnDuration: number;
};

export type LiftSettings = LiftStopValues & {
  /** GSAP ease name for the return. Options in RETURN_EASES. */
  returnEase: string;
  /** Fragment brightness boost at full lift. Held constant across widths on purpose. */
  glow: number;
  /** Dev GUI only. When > 0 it overrides the gesture so the look can be tuned without scrolling. */
  debugLift: number;
};

// Fields that read the same at every width.
const LIFT_SHARED = {
  nearDistance: 125,
  nearFade: 107,
  centerX: 0,
  centerY: -0.02,
  radiusY: 7.8,
  power: 0.75,
  variance: 0.32,
  scatter: 0.17,
  sizeScale: 0.61,
  edgeFadeStart: 0.55,
  riseSmoothing: 3.5,
  riseCurve: 1,
  idleMs: 150,
  returnDuration: 1.2,
};

/**
 * Linearly interpolated by canvas width, same scheme as the equipment scene.
 *
 * Only the 3840 stop is hand-tuned. The others are scaled from it as starting
 * points: effortPx tracks screen height (a phone has far fewer scroll pixels per
 * gesture than a 4K monitor), radiusX widens as the aspect narrows so the band
 * still covers a useful slice of terrain in portrait, and maxLift eases off on
 * small screens where the band is narrower in world units.
 */
export const LIFT_STOPS: Stop<LiftStopValues>[] = [
  { width: 390, value: { ...LIFT_SHARED, maxLift: 90, effortPx: 1200, radiusX: 0.9 } },
  { width: 768, value: { ...LIFT_SHARED, maxLift: 100, effortPx: 1600, radiusX: 0.8 } },
  { width: 1280, value: { ...LIFT_SHARED, maxLift: 110, effortPx: 2200, radiusX: 0.7 } },
  { width: 2560, value: { ...LIFT_SHARED, maxLift: 120, effortPx: 3200, radiusX: 0.65 } },
  { width: 3840, value: { ...LIFT_SHARED, maxLift: 120, effortPx: 4000, radiusX: 0.63 } },
];

/** Width tracking. The dev GUI switches it off the moment a lift slider is touched. */
export const LIFT_TRACKING = { enabled: true };

/**
 * Live values the shader, the gesture handler and the dev GUI all read. Mutated
 * in place by applyLiftStops on resize and by the GUI.
 */
export const LIFT: LiftSettings = {
  ...resolveStops(LIFT_STOPS, REFERENCE_VIEWPORT.width),
  returnEase: "power2.inOut",
  glow: 0.1,
  debugLift: 0,
};

/** Re-solves the responsive fields for `width`, unless the GUI has taken over. */
export function applyLiftStops(width: number) {
  if (!LIFT_TRACKING.enabled) return;
  Object.assign(LIFT, resolveStops(LIFT_STOPS, width));
}

/** GSAP eases offered by the dev GUI for the return-to-zero tween. */
export const RETURN_EASES = [
  "none",
  "power1.inOut",
  "power2.inOut",
  "power3.inOut",
  "power4.inOut",
  "sine.inOut",
  "expo.inOut",
  "circ.inOut",
  "power1.out",
  "power2.out",
  "power3.out",
  "power4.out",
  "sine.out",
  "expo.out",
  "circ.out",
  "back.out(1.7)",
  "elastic.out(1, 0.4)",
  "bounce.out",
] as const;

// ---------------------------------------------------------------------------
// Canvas edge mask
// ---------------------------------------------------------------------------

/**
 * Vertical alpha ramp over the whole composited canvas, top-down.
 *
 * vEdgeFade dissolves the point sprites, but Bloom runs after them and its
 * mipmap blur samples clamp-to-edge, so the halo cannot reach zero at the render
 * target's own boundary — it smears the edge value outward and leaves a hard
 * line where the footer element ends. Measured at the top row of the canvas the
 * step was 10 -> 26 out of 255 with no transition, while the particles were
 * ~500px below. No value of edgeFadeStart can remove that. This ramps the
 * composite instead, so points, bloom and grain fade out together.
 *
 * Safe because the canvas clears to alpha 0 and the page behind is #0a0a0a:
 * masking to transparent reveals the colour the unlit canvas already shows.
 */
export const EDGE_MASK = {
  /** Fraction of canvas height, from the top, over which alpha ramps 0 -> 1. */
  height: 0.35,
  /** 0 = linear ramp, 1 = smoothstep. Higher keeps more of the glow. */
  curve: 1,
};

/**
 * Sampled rather than emitted as two stops so the ramp's slope does not kink
 * where it meets full opacity — the glow underneath is itself rising, and a
 * linear mask against it leaves a visible corner at the end of the band.
 */
const EDGE_MASK_SAMPLES = 8;

/** Pure and deterministic, so SSR and the client agree. */
export function edgeMaskImage(): string {
  const band = EDGE_MASK.height;
  if (!(band > 0)) return "none";

  const stops: string[] = [];
  for (let i = 0; i <= EDGE_MASK_SAMPLES; i++) {
    const t = i / EDGE_MASK_SAMPLES;
    const smooth = t * t * (3 - 2 * t);
    const alpha = t + (smooth - t) * EDGE_MASK.curve;
    stops.push(`rgba(0,0,0,${alpha.toFixed(3)}) ${(t * band * 100).toFixed(2)}%`);
  }

  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

// The masked wrapper, registered by ParticlesScene. The dev GUI is built inside
// the <Canvas> subtree and so has no other route to an element outside it; same
// shape as FooterScene's footerGlRef.
let maskTarget: HTMLElement | null = null;

export function registerEdgeMaskTarget(element: HTMLElement | null) {
  maskTarget = element;
  applyEdgeMask();
}

/** Repaints the mask from the live EDGE_MASK values. Called by the dev GUI. */
export function applyEdgeMask() {
  if (!maskTarget) return;
  const image = edgeMaskImage();
  maskTarget.style.maskImage = image;
  maskTarget.style.webkitMaskImage = image;
}
