"use client";

import { useLayoutEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import Particles from "./Particles"
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Perf } from "r3f-perf"; 


export default function ParticlesScene() {
  // Camera
  const cameraSettings = {
    position: [94.5233, 6.8569, -92.4471] as [number, number, number],
    target: [6.629, 66.6245, -3.7087] as [number, number, number],
  };

  function CameraLookAt({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, target]);

  return null;
}

  return (
    <Canvas

      dpr={[1, 2]}
      onCreated={({ gl }) => {
        gl.setClearColor(0xff0000, 0);
        gl.autoClear = false;
        gl.clearDepth();
      }}
      gl={{ antialias: true, alpha: true }}>
      {/* <OrbitControls /> */}
      <Perf position="top-left" />
      <PerspectiveCamera makeDefault position={cameraSettings.position} />
      <CameraLookAt target={cameraSettings.target} />
      <Particles />
    </Canvas>
  );
}
