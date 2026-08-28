"use client";

import { Suspense, useMemo, useRef } from "react";
import {
  Canvas,
  extend,
  type ThreeElement,
  useFrame,
  useLoader,
  useThree,
} from "@react-three/fiber";
import { PerspectiveCamera, shaderMaterial } from "@react-three/drei";
import * as THREE from "three";
import { PLYLoader } from "three-stdlib";
import vertexShader from "./shaders/vert.glsl";
import fragmentShader from "./shaders/frag.glsl";
import PostProcessing from "./PostProcessing";
import { Perf } from "r3f-perf";
import {
  CAMERA,
  COMPOSITION_STOPS,
  CONTENT_MAX_WIDTH,
  MODEL_ROTATION,
  NOISE_DEFAULTS,
  PARTICLE_SIZE,
  REFERENCE_HEIGHT,
  RENDERER_EXPOSURE,
  TIER_QUALITY,
  resolveStops,
  tierForWidth,
} from "./equipmentSceneDefaults";
import { buildEquipmentGeometry } from "./prepareEquipmentGeometry";
import { useWindowTier } from "./useWindowTier";

const DEBUG = process.env.NODE_ENV === "development";

const EquipmentParticlesShader = shaderMaterial(
  {
    uTime: 0,
    uSize: 10,
    uNoisePeriod: NOISE_DEFAULTS.noisePeriod,
    uNoiseSpeed: NOISE_DEFAULTS.noiseSpeed,
    uNoiseStrength: NOISE_DEFAULTS.noiseStrength,
  },
  vertexShader,
  fragmentShader,
);
extend({ EquipmentParticlesShader });

declare module "@react-three/fiber" {
  interface ThreeElements {
    equipmentParticlesShader: ThreeElement<typeof EquipmentParticlesShader>;
  }
}

function EquipmentParticles() {
  const materialRef = useRef<InstanceType<typeof EquipmentParticlesShader>>(null);
  const raw = useLoader(PLYLoader, "/models/PLY-OP-1.ply");
  const { viewport, size } = useThree();

  const tier = tierForWidth(size.width);
  const { vertexStride } = TIER_QUALITY[tier];

  // Expensive: only rebuilt when the source model or the decimation changes.
  const { geometry, maxDim } = useMemo(
    () => buildEquipmentGeometry(raw, vertexStride),
    [raw, vertexStride],
  );

  const { scale, position, pointSize } = useMemo(() => {
    const { coverage, offsetXRatio, offsetYRatio } = resolveStops(
      COMPOSITION_STOPS,
      size.width,
    );

    const modelScale = (viewport.height * coverage) / maxDim;

    const worldPerPx = viewport.height / size.height;
    const contentWidth = Math.min(size.width, CONTENT_MAX_WIDTH);

    const heightFactor = size.height / REFERENCE_HEIGHT;

    return {
      scale: modelScale,
      position: [
        contentWidth * offsetXRatio * worldPerPx,
        viewport.height * offsetYRatio,
        0,
      ] as [number, number, number],
      pointSize: PARTICLE_SIZE * viewport.dpr * heightFactor,
    };
  }, [viewport.height, viewport.dpr, size.width, size.height, maxDim]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points
      geometry={geometry}
      rotation={MODEL_ROTATION as unknown as [number, number, number]}
      position={position}
      scale={scale}>
      <equipmentParticlesShader
        ref={materialRef}
        uTime={0}
        uSize={pointSize}
        uNoisePeriod={NOISE_DEFAULTS.noisePeriod}
        uNoiseSpeed={NOISE_DEFAULTS.noiseSpeed}
        uNoiseStrength={NOISE_DEFAULTS.noiseStrength}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function EquipmentScene() {
  const tier = useWindowTier();

  return (
    // 100svh, not 100vh: the small-viewport unit ignores the mobile URL bar, so the
    // canvas box stops changing as it hides and the resize storm goes away.
    // w-full, not w-screen: 100vw includes the scrollbar and overflows.
    <div className="w-full h-svh pointer-events-none">
      <Canvas
        dpr={[1, TIER_QUALITY[tier].maxDpr]}
        // Debounced so a drag-resize does not reallocate the post-processing
        // render targets on every frame.
        resize={{ debounce: { resize: 150, scroll: 50 } }}
        // Pointless with post-processing: the composer renders to its own target,
        // so canvas MSAA never applies — it just costs memory and fill rate.
        gl={{ antialias: false, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = RENDERER_EXPOSURE;
          gl.setClearColor(0x000000, 0);
        }}>
        <PerspectiveCamera
          makeDefault
          fov={CAMERA.fov}
          near={CAMERA.near}
          far={CAMERA.far}
          position={CAMERA.position as unknown as [number, number, number]}
        />

        <Suspense fallback={null}>
          <EquipmentParticles />
        </Suspense>
        <PostProcessing />
        {DEBUG && <Perf />}
      </Canvas>
    </div>
  );
}
