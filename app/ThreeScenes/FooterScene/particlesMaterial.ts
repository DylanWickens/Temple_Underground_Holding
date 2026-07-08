// Particle shader material for the footer point cloud.
// Registers <particlesMaterial> as a React Three Fiber element.

import { extend, type ThreeElement } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import vertShader from "./shaders/vert.glsl";
import fragShader from "./shaders/frag.glsl";
import { NOISE_DEFAULTS, PARTICLE_SIZE } from "./footerSceneDefaults";

export const ParticlesMaterial = shaderMaterial(
  {
    uSize: PARTICLE_SIZE,
    uTime: 0,
    uNoisePeriod: NOISE_DEFAULTS.noisePeriod,
    uNoiseSpeed: NOISE_DEFAULTS.noiseSpeed,
    uNoiseStrength: NOISE_DEFAULTS.noiseStrength,
  },
  vertShader,
  fragShader,
);

extend({ ParticlesMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    particlesMaterial: ThreeElement<typeof ParticlesMaterial>;
  }
}
