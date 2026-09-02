// Dev-only hook for point cloud tuning GUI.
// Owns debug state refs and camera initialization; keeps PointCloud.tsx scene-only.

import { useEffect, useRef, type MutableRefObject } from "react";
import type { BufferGeometry } from "three";
import type { Group, PerspectiveCamera, ShaderMaterial } from "three";
import type { Camera } from "@react-three/fiber";
import {
  CAMERA_DEFAULTS,
  NOISE_DEFAULTS,
  SCENE_OFFSET,
  type CameraSettings,
  type NoiseSettings,
  type SceneOffset,
} from "../footerSceneDefaults";
import { applyCameraSettings, setupPointCloudDevGui } from "./pointCloudDevGui";
import { useDevGuiPanel } from "../../shared/devGui/useDevGuiPanel";
import { DEV_GUI_ORDER } from "../../shared/devGui/devGuiStack";

type UsePointCloudDevGuiOptions = {
  materialRef: MutableRefObject<ShaderMaterial | null>;
  sceneGroupRef: MutableRefObject<Group | null>;
  camera: Camera;
  pointsGeometry: BufferGeometry;
};

export function usePointCloudDevGui({
  materialRef,
  sceneGroupRef,
  camera,
  pointsGeometry,
}: UsePointCloudDevGuiOptions) {
  const noiseDebug = useRef<NoiseSettings>({ ...NOISE_DEFAULTS });
  const cameraDebug = useRef<CameraSettings>({ ...CAMERA_DEFAULTS });
  const sceneOffsetDebug = useRef<SceneOffset>({ ...SCENE_OFFSET });

  useEffect(() => {
    cameraDebug.current = { ...CAMERA_DEFAULTS };
    applyCameraSettings(camera as PerspectiveCamera, cameraDebug.current);
  }, [pointsGeometry, camera]);

  useDevGuiPanel({
    title: "Camera",
    order: DEV_GUI_ORDER.footerPointCloud,
    deps: [pointsGeometry, camera],
    setup: (gui) => {
      setupPointCloudDevGui({
        gui,
        camera: camera as PerspectiveCamera,
        refs: {
          materialRef,
          sceneGroupRef,
          cameraDebug,
          sceneOffsetDebug,
          noiseDebug,
        },
      });
    },
  });
}
