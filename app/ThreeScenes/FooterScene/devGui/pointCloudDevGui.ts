// Dev-only lil-gui panel for camera, scene offset, and noise tuning.

import type { GUI } from "lil-gui";
import type { Group, PerspectiveCamera, ShaderMaterial } from "three";
import type { MutableRefObject } from "react";
import {
  CAMERA_DEFAULTS,
  CAMERA_POSITION_MARGIN,
  CAMERA_ROTATION_MARGIN,
  CAMERA_SLIDER_STEP,
  SCENE_OFFSET,
  SCENE_OFFSET_MARGIN,
  SCENE_OFFSET_STEP,
  type CameraSettings,
  type NoiseSettings,
  type SceneOffset,
} from "../footerSceneDefaults";
import { addLogButton } from "./devGuiHelpers";

const CAMERA_SLIDER_CONFIG: Record<keyof CameraSettings, { margin: number; label: string }> = {
  posX: { margin: CAMERA_POSITION_MARGIN, label: "Position X" },
  posY: { margin: CAMERA_POSITION_MARGIN, label: "Position Y" },
  posZ: { margin: CAMERA_POSITION_MARGIN, label: "Position Z" },
  rotX: { margin: CAMERA_ROTATION_MARGIN, label: "Rotation X" },
  rotY: { margin: CAMERA_ROTATION_MARGIN, label: "Rotation Y" },
  rotZ: { margin: CAMERA_ROTATION_MARGIN, label: "Rotation Z" },
};

const NOISE_UNIFORM_MAP: Record<keyof NoiseSettings, string> = {
  noisePeriod: "uNoisePeriod",
  noiseSpeed: "uNoiseSpeed",
  noiseStrength: "uNoiseStrength",
};

type PointCloudDevGuiRefs = {
  materialRef: MutableRefObject<ShaderMaterial | null>;
  sceneGroupRef: MutableRefObject<Group | null>;
  cameraDebug: MutableRefObject<CameraSettings>;
  sceneOffsetDebug: MutableRefObject<SceneOffset>;
  noiseDebug: MutableRefObject<NoiseSettings>;
};

type PointCloudDevGuiOptions = {
  gui: GUI;
  camera: PerspectiveCamera;
  refs: PointCloudDevGuiRefs;
};

function applyCameraSettings(camera: PerspectiveCamera, settings: CameraSettings) {
  camera.position.set(settings.posX, settings.posY, settings.posZ);
  camera.rotation.set(settings.rotX, settings.rotY, settings.rotZ);
}

function applySceneOffset(group: Group, settings: SceneOffset) {
  group.position.set(settings.offsetX, settings.offsetY, settings.offsetZ);
}

export function setupPointCloudDevGui({ gui, camera, refs }: PointCloudDevGuiOptions) {
  const { materialRef, sceneGroupRef, cameraDebug, sceneOffsetDebug, noiseDebug } = refs;

  const updateCamera = () => {
    applyCameraSettings(camera, cameraDebug.current);
  };

  (Object.keys(CAMERA_SLIDER_CONFIG) as (keyof CameraSettings)[]).forEach((key) => {
    const center = CAMERA_DEFAULTS[key];
    const { margin, label } = CAMERA_SLIDER_CONFIG[key];
    gui
      .add(cameraDebug.current, key, center - margin, center + margin, CAMERA_SLIDER_STEP)
      .name(label)
      .onChange(updateCamera);
  });
  addLogButton(gui, "Camera settings", () => cameraDebug.current);

  const updateSceneOffset = () => {
    if (!sceneGroupRef.current) return;
    applySceneOffset(sceneGroupRef.current, sceneOffsetDebug.current);
  };

  const sceneFolder = gui.addFolder("Scene");
  (["offsetX", "offsetY", "offsetZ"] as const).forEach((key) => {
    const center = SCENE_OFFSET[key];
    sceneFolder
      .add(
        sceneOffsetDebug.current,
        key,
        center - SCENE_OFFSET_MARGIN,
        center + SCENE_OFFSET_MARGIN,
        SCENE_OFFSET_STEP,
      )
      .name(key.replace("offset", "Offset "))
      .onChange(updateSceneOffset);
  });
  addLogButton(sceneFolder, "Scene offset", () => sceneOffsetDebug.current);

  const updateNoiseUniform = (key: keyof NoiseSettings) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms[NOISE_UNIFORM_MAP[key]].value = noiseDebug.current[key];
  };

  const noiseFolder = gui.addFolder("Noise");
  noiseFolder
    .add(noiseDebug.current, "noiseStrength", 0, 0.15, 0.001)
    .name("Strength")
    .onChange(() => updateNoiseUniform("noiseStrength"));
  noiseFolder
    .add(noiseDebug.current, "noiseSpeed", 0, 2, 0.01)
    .name("Speed")
    .onChange(() => updateNoiseUniform("noiseSpeed"));
  noiseFolder
    .add(noiseDebug.current, "noisePeriod", 0.5, 15, 0.1)
    .name("Frequency")
    .onChange(() => updateNoiseUniform("noisePeriod"));
  addLogButton(noiseFolder, "Noise settings", () => noiseDebug.current);
}

export { applyCameraSettings, applySceneOffset };
