'use client';

import { Points, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend, type ThreeElement, useThree, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRef, useMemo, Children } from 'react';
import { Bloom, EffectComposer, ToneMapping, Noise } from "@react-three/postprocessing";
import { ToneMappingMode } from 'postprocessing';
import { BlendFunction } from "postprocessing";


import vertexShader from './shaders/vert.glsl';
import fragmentShader from "./shaders/frag.glsl";


// Particles Shader Setup
type Uniforms = {
  uTime: number;
  uSize: number;
  uNoisePeriod: number;
  uNoiseSpeed: number;
  uNoiseStrength: number;
};

const DEFAULT_UNIFORMS: Uniforms = { 
  uTime: 0,
  uSize: 10,
  uNoisePeriod: 1,
  uNoiseSpeed: 1,
  uNoiseStrength: 1,
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

const materialRef = useRef<InstanceType<typeof ParticlesShader>>(null);

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
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });
  

  return (
    <>
      <EffectComposer>
        <Bloom luminanceThreshold={0} luminanceSmoothing={0.6} height={300} />
        <Noise opacity={0.3} blendFunction={BlendFunction.OVERLAY} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>

      <points geometry={pointsGeometry}>
        <particlesShader
          ref={materialRef}
          uTime={0}
          uSize={250}
          uNoisePeriod={0.2}
          uNoiseStrength={3}
          uNoiseSpeed={1}
          transparent
          depthWrite={false}
         
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}
