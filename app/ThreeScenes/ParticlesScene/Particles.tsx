'use client';

import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend, type ThreeElement, useThree, useFrame } from "@react-three/fiber";
import { useGLTF } from '@react-three/drei';
import { useRef, useMemo } from 'react';
import { Bloom, EffectComposer, ToneMapping, Noise } from "@react-three/postprocessing";
import { ToneMappingMode } from 'postprocessing';
import { BlendFunction } from "postprocessing";

import {
  NOISE_DEFAULTS,
  PARTICLES,
  resolveParticleSize,
  solveFov,
} from "./particlesSceneDefaults";
import { useParticlesDevGui } from "./devGui/useParticlesDevGui";
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
  uSize: PARTICLES.size,
  uNoisePeriod: NOISE_DEFAULTS.noisePeriod,
  uNoiseSpeed: NOISE_DEFAULTS.noiseSpeed,
  uNoiseStrength: NOISE_DEFAULTS.noiseStrength,
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

  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const dpr = useThree((state) => state.viewport.dpr);

  // Save geometry to the cache
  const { nodes } = useGLTF("/models/Expanded.gltf");

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

  // Height is the term that matters: gl_PointSize is in device pixels, so without
  // this the points hold their absolute size while the frame shrinks around them.
  const pointSize = useMemo(
    () => resolveParticleSize(height, dpr, solveFov(width / height)),
    [width, height, dpr],
  );

  useParticlesDevGui({ materialRef, camera, width, height, dpr });

  // Animate
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });
  
  return (
    <>
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0} luminanceSmoothing={0.6} intensity={1} />
        <Noise opacity={0.3} blendFunction={BlendFunction.OVERLAY} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>

      <points geometry={pointsGeometry}>
        <particlesShader
          ref={materialRef}
          uTime={0}
          uSize={pointSize}
          uNoisePeriod={NOISE_DEFAULTS.noisePeriod}
          uNoiseStrength={NOISE_DEFAULTS.noiseStrength}
          uNoiseSpeed={NOISE_DEFAULTS.noiseSpeed}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}
