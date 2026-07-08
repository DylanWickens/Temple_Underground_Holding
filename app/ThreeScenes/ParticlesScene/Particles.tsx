'use client';

import { Points, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend, type ThreeElement, useThree, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRef, useMemo } from 'react';


import vertexShader from './shaders/vert.glsl';
import fragmentShader from "./shaders/frag.glsl";


// Particles Shader Setup
type Uniforms = {
  uTime: number;
  uSize: number;
}

const DEFAULT_UNIFORMS: Uniforms = { 
  uTime: 0,
  uSize: 10,
}

const ParticlesShader = shaderMaterial(
  DEFAULT_UNIFORMS,
  vertexShader,
  fragmentShader
);
extend({ ParticlesShader });

declare module "@react-three/fiber" {
  interface ThreeElements {
    particlesShader: ThreeElement<typeof ParticlesShader>;
  }
}


export default function Particles() {

  //DEBUG 
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
        
  /* <OrbitControls
        ref={controlsRef}
        onEnd={() => {
          const target = controlsRef.current?.target;
          console.log(
            JSON.stringify(
              {
                position: camera.position.toArray().map((n) => +n.toFixed(4)),
                target: target?.toArray().map((n:any) => +n.toFixed(4)),
              },
              null,
              2,
            ),
          );
        }}
      /> */
      

  // Save geometry to the cache
  const { nodes } = useGLTF('./models/Expanded.gltf');

  const landscape = nodes.Landscape as THREE.Mesh;  
  const sourceGeometry = landscape.geometry;


  const pointsGeometry = useMemo(() => {
    const geo = sourceGeometry.clone();

    const count = geo.attributes.position.count;
    const scales = new Float32Array(count);

    for(let i = 0; i < count; i++){ 
      scales[i] = Math.random();
    }
    geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    
    return geo;
}, [sourceGeometry]);


  // Calculate aScale
  const count = landscape.geometry.attributes.position.count;
  const scales = new Float32Array(count);

  for(let i = 0; i < count; i++) {
    scales[i] = Math.random();
  }


  // Animate
  useFrame((state, delta) => {
    // console.log(delta);
    
    // Update Shaders
  });
  

  return (
    <>
      <points geometry={pointsGeometry}>
        <particlesShader
          uTime={0}
          uSize={300}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}
