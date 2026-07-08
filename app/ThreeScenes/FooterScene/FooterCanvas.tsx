"use client";

// Footer 3D canvas — render order: camera offset → point cloud → post-processing.
// Scene-wide defaults live in footerSceneDefaults.ts.

import { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PerspectiveCamera } from "@react-three/drei";
import PointCloud from "./PointCloud";
import PostProcessing from "./PostProcessing";
import { footerGlRef } from "./footerGlRef";
import {
  FOOTER_COMPOSITION_OFFSET_Y_RATIO,
  FOOTER_PARTICLE_HEADROOM_Y_RATIO,
  RENDERER_EXPOSURE,
} from "./footerSceneDefaults";

function FooterViewOffset() {
  const { camera, size } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const shiftY = Math.round(
      size.height * (FOOTER_COMPOSITION_OFFSET_Y_RATIO + FOOTER_PARTICLE_HEADROOM_Y_RATIO),
    );

    cam.setViewOffset(size.width, size.height, 0, shiftY, size.width, size.height);
    cam.updateProjectionMatrix();

    return () => {
      cam.clearViewOffset();
      cam.updateProjectionMatrix();
    };
  }, [camera, size.width, size.height]);

  return null;
}

export default function FooterCanvas() {
  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl, scene }) => {
        footerGlRef.current = gl;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = RENDERER_EXPOSURE;
        gl.setClearColor(0x000000, 0);
        scene.background = null;
      }}
    >
      <PerspectiveCamera makeDefault fov={45} near={0.001} far={1000} />
      <FooterViewOffset />
      <ambientLight intensity={0.1} />
      <directionalLight position={[1, -3, -2]} intensity={1} />
      <Suspense fallback={null}>
        <PointCloud />
      </Suspense>
      <PostProcessing />
    </Canvas>
  );
}
