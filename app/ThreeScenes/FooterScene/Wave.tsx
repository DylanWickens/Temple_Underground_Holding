
import { useEffect, useRef, useMemo } from 'react';
import { useFrame, extend ,type ThreeElement } from "@react-three/fiber";
import * as THREE from "three";
import vertShader from "./shaders/vert.glsl";
import fragShader from "./shaders/frag.glsl";
import { shaderMaterial } from "@react-three/drei";


// Particles Shader
const FooterMaterial = shaderMaterial(
  {
    uTime: 0,
    uSize: 1,
    uNoisePeriod: 1,
    uNoiseSpeed: 0.5,
    uNoiseFreq: 3,
    uNoiseStrength: 1,
    uSinElevation: 1,
    uSinSpeed: 0.5,
    uSinFreq: 2,
  },
  vertShader,
  fragShader,
);
extend({ FooterMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    footerMaterial: ThreeElement<typeof FooterMaterial>;
  }
}

const DEBUG_DEFAULTS = {
  uSize: 20,
  uNoisePeriod: 1,
  uNoiseSpeed: 0.5,
  uNoiseFreq: 3,
  uNoiseStrength: 10,
  uSinElevation: 0.3,
  uSinSpeed: 0.15,
  uSinFreq: 0.3,
};

function getDeterministicScale(index: number): number {
  let hash = (index + 1) | 0;
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 4294967295;
}

export default function Wave() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const debugObject = useRef({ ...DEBUG_DEFAULTS });

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let gui: import("lil-gui").GUI | undefined;

    import("lil-gui").then(({ default: GUI }) => {
      gui = new GUI({ title: "Wave" });

      const updateUniform = (key: keyof typeof DEBUG_DEFAULTS) => {
        if (materialRef.current) {
          materialRef.current.uniforms[key].value = debugObject.current[key];
        }
      };

      gui.add(debugObject.current, "uSize", 0, 50, 0.1).onChange(() => updateUniform("uSize"));

      const noiseFolder = gui.addFolder("Noise");
      noiseFolder.add(debugObject.current, "uNoisePeriod", 0, 5, 0.01).onChange(() => updateUniform("uNoisePeriod"));
      noiseFolder.add(debugObject.current, "uNoiseSpeed", 0, 2, 0.01).onChange(() => updateUniform("uNoiseSpeed"));
      noiseFolder.add(debugObject.current, "uNoiseFreq", 0, 10, 0.1).onChange(() => updateUniform("uNoiseFreq"));
      noiseFolder.add(debugObject.current, "uNoiseStrength", 0, 20, 0.1).onChange(() => updateUniform("uNoiseStrength"));

      const waveFolder = gui.addFolder("Sine Wave");
      waveFolder.add(debugObject.current, "uSinElevation", 0, 2, 0.01).onChange(() => updateUniform("uSinElevation"));
      waveFolder.add(debugObject.current, "uSinSpeed", 0, 1, 0.01).onChange(() => updateUniform("uSinSpeed"));
      waveFolder.add(debugObject.current, "uSinFreq", 0, 2, 0.01).onChange(() => updateUniform("uSinFreq"));
    });

    return () => {
      gui?.destroy();
    };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2, 6, 128, 128);
    const count = geo.getAttribute('position').count

    // Create deterministic scale for each point
    const scales = new Float32Array(count);
    for(let i = 0; i < count; i++) {
        scales[i] = getDeterministicScale(i);
    }
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    return geo;
  }, []);

  //Animation
  useFrame((_, delta) => {
    // Update shaders
    if(materialRef.current){
        materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <points geometry={geometry} rotation-x={Math.PI * -0.47}>
      <footerMaterial
        ref={materialRef}
        uTime={0}
        uSize={DEBUG_DEFAULTS.uSize}
        uNoisePeriod={DEBUG_DEFAULTS.uNoisePeriod}
        uNoiseSpeed={DEBUG_DEFAULTS.uNoiseSpeed}
        uNoiseFreq={DEBUG_DEFAULTS.uNoiseFreq}
        uNoiseStrength={DEBUG_DEFAULTS.uNoiseStrength}
        uSinElevation={DEBUG_DEFAULTS.uSinElevation}
        uSinSpeed={DEBUG_DEFAULTS.uSinSpeed}
        uSinFreq={DEBUG_DEFAULTS.uSinFreq}
        
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
