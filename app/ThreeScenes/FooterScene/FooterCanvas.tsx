"use client";

import { Canvas, } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import Wave from "./Wave";

export default function FooterCanvas() {

  return (
    <Canvas 
    dpr={[ 1,2 ]}
    onCreated={({ gl }) => {
        gl.setClearColor(0xFF0000, 0)
        gl.autoClear = false
        gl.clearDepth()
    }}
    gl={{antialias: true, alpha: true}}
    >
      <OrbitControls />
      <ambientLight intensity={10}/>
      <Wave />
    </Canvas>
  );
}
