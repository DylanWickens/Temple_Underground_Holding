"use client";

// Re-applies the camera pose and solved fov whenever the canvas box changes.
// Replaces the old CameraLookAt, which re-ran on every render (its `target` prop
// was a fresh array literal each time) but never on resize.

import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { applyCameraFraming } from "./particlesSceneDefaults";

export default function ResponsiveCamera() {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  useLayoutEffect(() => {
    const perspectiveCamera = camera as PerspectiveCamera;
    if (!perspectiveCamera.isPerspectiveCamera) return;

    applyCameraFraming(perspectiveCamera, width, height);
  }, [camera, width, height]);

  return null;
}
