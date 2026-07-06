"use client";

import { useMemo, useRef } from "react";
import { Canvas, extend, useFrame, type ThreeElement } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, shaderMaterial } from "@react-three/drei";
import vertShader from "./shaders/vert.glsl";
import fragShader from "./shaders/frag.glsl";

const FooterMaterial = shaderMaterial(
  {
    uTime: 0,
    uSize: 1,
  },
  vertShader,
  fragShader
);
extend({ FooterMaterial });

// Tell TypeScript about the lowercase JSX tag created by extend({ FooterMaterial })
declare module "@react-three/fiber" {
  interface ThreeElements {
    footerMaterial: ThreeElement<typeof FooterMaterial>;
  }
}

function ParticlesPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const geometry = useMemo(() => {

    const geo = new THREE.PlaneGeometry(2, 1, 128, 128);

    const count = geo.attributes.position.count;
    const scales = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      scales[i] = Math.random();
    }
    geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

    return geo;
  }, []);

  return (
    <points rotation-x={Math.PI / 2 + 0.05} geometry={geometry}>
      <footerMaterial
        ref={materialRef}
        uSize={30}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function FooterCanvas() {
  return (
    <Canvas
      gl={{ alpha: true }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(0x000000, 0); // clear alpha = 0
        scene.background = null;
      }}>
      <OrbitControls />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <ParticlesPlane />
    </Canvas>
  );
}
