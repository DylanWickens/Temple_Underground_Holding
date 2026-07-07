"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from '@react-three/drei';

// Create box
function Box() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="white" />
    </mesh>
  );
}

export default function HeroCanvas() {
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
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Box />
    </Canvas>
  );
}
