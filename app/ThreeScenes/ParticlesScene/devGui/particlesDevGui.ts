// Dev-only lil-gui panel for footer camera pose, responsive framing, and particles.

import type { GUI } from "lil-gui";
import type { PerspectiveCamera, ShaderMaterial } from "three";
import type { MutableRefObject } from "react";
import {
  CAMERA,
  CAMERA_POSITION_MARGIN,
  CAMERA_SLIDER_STEP,
  FRAMING,
  LIFT,
  LIFT_STOPS,
  LIFT_TRACKING,
  NOISE_DEFAULTS,
  RETURN_EASES,
  applyLiftStops,
  PARTICLES,
  applyCameraFraming,
  resolveParticleSize,
  solveFov,
} from "../particlesSceneDefaults";
import { addLogButton } from "../../shared/devGui/devGuiHelpers";

const CAMERA_SLIDER_LABELS: Record<keyof typeof CAMERA, string> = {
  posX: "Position X",
  posY: "Position Y",
  posZ: "Position Z",
  targetX: "Target X",
  targetY: "Target Y",
  targetZ: "Target Z",
};

const NOISE_UNIFORM_MAP: Record<keyof typeof NOISE_DEFAULTS, string> = {
  noisePeriod: "uNoisePeriod",
  noiseSpeed: "uNoiseSpeed",
  noiseStrength: "uNoiseStrength",
};

type ParticlesDevGuiOptions = {
  gui: GUI;
  camera: PerspectiveCamera;
  materialRef: MutableRefObject<ShaderMaterial | null>;
  /** Live canvas box, so the panel solves against the same numbers the scene does. */
  getSize: () => { width: number; height: number; dpr: number };
};

export function setupParticlesDevGui({
  gui,
  camera,
  materialRef,
  getSize,
}: ParticlesDevGuiOptions) {
  const readout = { fov: camera.fov, uSize: 0, canvas: "" };

  const refresh = () => {
    const { width, height, dpr } = getSize();

    applyCameraFraming(camera, width, height);

    const fov = solveFov(width / height);
    const uSize = resolveParticleSize(height, dpr, fov);
    if (materialRef.current) {
      materialRef.current.uniforms.uSize.value = uSize;
    }

    readout.fov = Number(fov.toFixed(2));
    readout.uSize = Number(uSize.toFixed(1));
    readout.canvas = `${Math.round(width)} x ${Math.round(height)} @ ${dpr}`;
    gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  };

  const framingFolder = gui.addFolder("Framing");
  framingFolder
    .add(FRAMING, "referenceFov", 20, 90, 0.5)
    .name("Reference fov")
    .onChange(refresh);
  framingFolder
    .add(FRAMING, "widthLock", 0, 1, 0.01)
    .name("Width lock (0 = vertical)")
    .onChange(refresh);
  framingFolder.add(FRAMING, "minFov", 10, 90, 0.5).name("Min fov").onChange(refresh);
  framingFolder.add(FRAMING, "maxFov", 20, 140, 0.5).name("Max fov").onChange(refresh);
  framingFolder.add(readout, "canvas").name("Canvas").disable();
  framingFolder.add(readout, "fov").name("Solved fov").disable();
  addLogButton(framingFolder, "Framing settings", () => FRAMING);

  const particlesFolder = gui.addFolder("Particles");
  particlesFolder
    .add(PARTICLES, "size", 10, 400, 1)
    .name("Size @ reference")
    .onChange(refresh);
  particlesFolder.add(readout, "uSize").name("Solved uSize").disable();
  addLogButton(particlesFolder, "Particle settings", () => PARTICLES);

  const cameraFolder = gui.addFolder("Camera");
  (Object.keys(CAMERA_SLIDER_LABELS) as (keyof typeof CAMERA)[]).forEach((key) => {
    const center = CAMERA[key];
    cameraFolder
      .add(
        CAMERA,
        key,
        center - CAMERA_POSITION_MARGIN,
        center + CAMERA_POSITION_MARGIN,
        CAMERA_SLIDER_STEP,
      )
      .name(CAMERA_SLIDER_LABELS[key])
      .onChange(refresh);
  });
  addLogButton(cameraFolder, "Camera settings", () => CAMERA);

  const updateNoiseUniform = (key: keyof typeof NOISE_DEFAULTS) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms[NOISE_UNIFORM_MAP[key]].value = NOISE_DEFAULTS[key];
  };

  const noiseFolder = gui.addFolder("Noise");
  noiseFolder
    .add(NOISE_DEFAULTS, "noiseStrength", 0, 10, 0.01)
    .name("Strength")
    .onChange(() => updateNoiseUniform("noiseStrength"));
  noiseFolder
    .add(NOISE_DEFAULTS, "noiseSpeed", 0, 2, 0.01)
    .name("Speed")
    .onChange(() => updateNoiseUniform("noiseSpeed"));
  noiseFolder
    .add(NOISE_DEFAULTS, "noisePeriod", 0.1, 15, 0.1)
    .name("Frequency")
    .onChange(() => updateNoiseUniform("noisePeriod"));
  addLogButton(noiseFolder, "Noise settings", () => NOISE_DEFAULTS);

  refresh();

  return { refresh };
}

/**
 * Standalone panel for the scroll-driven lift. Every field is read live (in
 * useFrame, or when the gesture handler / return tween fires), so no onChange
 * plumbing is needed beyond switching off width tracking: once a slider is
 * touched, resizes stop overwriting the tweak until "Re-enable" is pressed.
 * Sliders `.listen()` so they show the interpolated values while tracking.
 */
export function setupScrollLiftDevGui(gui: GUI, getWidth: () => number) {
  const readout = { width: 0, tracking: "" };
  const refreshReadout = () => {
    readout.width = Math.round(getWidth());
    readout.tracking = LIFT_TRACKING.enabled ? "tracking width" : "GUI override";
  };
  const takeOver = () => {
    LIFT_TRACKING.enabled = false;
    refreshReadout();
  };

  gui.add(readout, "width").name("Canvas width").listen().disable();
  gui.add(readout, "tracking").name("Mode").listen().disable();
  gui
    .add(
      {
        reset: () => {
          LIFT_TRACKING.enabled = true;
          applyLiftStops(getWidth());
          refreshReadout();
        },
      },
      "reset",
    )
    .name("Re-enable width tracking");

  const gesture = gui.addFolder("Gesture");
  gesture.add(LIFT, "effortPx", 200, 20000, 50).name("Scroll effort (px to max)");
  gesture.add(LIFT, "riseSmoothing", 0.5, 30, 0.25).name("Rise velocity");
  gesture.add(LIFT, "riseCurve", 0, 1, 0.01).name("Rise curve (0 linear → 1 smooth)");

  const fall = gui.addFolder("Return");
  fall.add(LIFT, "idleMs", 0, 3000, 10).name("Air time before fall (ms)");
  fall.add(LIFT, "returnDuration", 0.1, 6, 0.05).name("Fall duration (s)");
  fall.add(LIFT, "returnEase", [...RETURN_EASES]).name("Fall ease");

  const shape = gui.addFolder("Shape");
  shape.add(LIFT, "maxLift", 0, 600, 1).name("Magnitude (world units)");
  shape.add(LIFT, "radiusX", 0.05, 2, 0.01).name("Width (ndc)");
  shape.add(LIFT, "radiusY", 0.05, 8, 0.01).name("Height (ndc)");
  shape.add(LIFT, "power", 0.25, 6, 0.05).name("Falloff");
  shape.add(LIFT, "variance", 0, 1, 0.01).name("Height variance");
  shape.add(LIFT, "scatter", 0, 1.5, 0.01).name("Scatter");
  shape.add(LIFT, "sizeScale", 0, 4, 0.01).name("Lifted size scale");
  shape.add(LIFT, "centerX", -1, 1, 0.01).name("Centre X (ndc)");
  shape.add(LIFT, "centerY", -1, 1, 0.01).name("Centre Y (ndc)");
  shape.add(LIFT, "nearDistance", 0, 400, 1).name("Near distance");
  shape.add(LIFT, "nearFade", 1, 200, 1).name("Near fade");

  const look = gui.addFolder("Look");
  look.add(LIFT, "glow", 0, 0.5, 0.005).name("Glow (all widths)");
  look.add(LIFT, "edgeFadeStart", -1, 1, 0.01).name("Top fade start (ndc y)");
  look.add(LIFT, "debugLift", 0, 600, 1).name("Hold lift (0 = off)");

  // Responsive fields take over width tracking when touched and mirror resizes
  // while tracking. glow / debugLift / returnEase sit outside the stop table.
  const stopKeys = new Set(Object.keys(LIFT_STOPS[0].value));
  gui.controllersRecursive().forEach((controller) => {
    if (!stopKeys.has(controller.property)) return;
    controller.onChange(takeOver).listen();
  });

  // Logged in stop form so a tuned width can be pasted straight into LIFT_STOPS.
  addLogButton(gui, "Lift stop", () => ({
    width: Math.round(getWidth()),
    value: Object.fromEntries([...stopKeys].map((key) => [key, LIFT[key as keyof typeof LIFT]])),
    glow: LIFT.glow,
  }));

  refreshReadout();
}
