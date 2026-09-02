// Dev-only lil-gui panel for footer camera pose, responsive framing, and particles.

import type { GUI } from "lil-gui";
import type { PerspectiveCamera, ShaderMaterial } from "three";
import type { MutableRefObject } from "react";
import {
  CAMERA,
  CAMERA_POSITION_MARGIN,
  CAMERA_SLIDER_STEP,
  FRAMING,
  NOISE_DEFAULTS,
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
