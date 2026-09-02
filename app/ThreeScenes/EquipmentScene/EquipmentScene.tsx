"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
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
import { useSceneActivation } from "../shared/useSceneActivation";

const DEBUG = process.env.NODE_ENV === "development";

// Binary, positions-only conversion of PLY-OP-1.ply: the same 183,970 vertices in
// the same order at ~2 MB instead of 19 MB of ASCII with normals, uvs and faces
// that nothing here reads.
const MODEL_URL = "/models/opxy.ply";

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
  const raw = useLoader(PLYLoader, MODEL_URL);
  const { viewport, size, gl, scene, camera, advance } = useThree();

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

  // Warm-up while still off-screen: compile the material in parallel, then render
  // one frame through PostProcessing so the composer's targets are allocated and
  // its passes compiled. frameloop is "never" until in view, so this is the only
  // frame until then.
  useEffect(() => {
    let cancelled = false;
    gl.compileAsync(scene, camera)
      .then(() => {
        if (!cancelled) advance(performance.now());
      })
      .catch(() => {
        // A failed parallel compile just means the first visible frame compiles.
      });
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, advance, geometry]);

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
  // Mounts in the first idle slot after paint; renders only while in view, so the
  // bloom chain is not paid for while the user reads About or the footer.
  const { ref, shouldMount, inView } = useSceneActivation<HTMLDivElement>();

  // The wrapper in page.tsx is `hidden md:block`; mirror that here so a phone never
  // creates the context or downloads the model. null = not measured yet (SSR and
  // first client render), which must not fall through to the desktop path.
  const canvasTier = tier !== null && tier !== "mobile" ? tier : null;

  // Start the model download at page mount, ahead of the canvas.
  useEffect(() => {
    if (!canvasTier) return;
    useLoader.preload(PLYLoader, MODEL_URL);
  }, [canvasTier]);

  return (
    // 100svh, not 100vh: the small-viewport unit ignores the mobile URL bar, so the
    // canvas box stops changing as it hides and the resize storm goes away.
    // w-full, not w-screen: 100vw includes the scrollbar and overflows.
    <div ref={ref} className="w-full h-svh pointer-events-none">
      {shouldMount && canvasTier ? (
        <Canvas
          dpr={[1, TIER_QUALITY[canvasTier].maxDpr]}
          frameloop={inView ? "always" : "never"}
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
      ) : null}
    </div>
  );
}
