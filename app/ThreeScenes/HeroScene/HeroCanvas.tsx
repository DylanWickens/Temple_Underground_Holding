"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Perf } from "r3f-perf";
import HeroParticles from "./HeroParticles";
import PostProcessing from "./PostProcessing";
import ResponsiveCamera from "./ResponsiveCamera";
import { CAMERA, MODEL_URL, POST, TIER_MAX_DPR } from "./heroSceneDefaults";
import { useWindowTier } from "../EquipmentScene/useWindowTier";
import { useSceneActivation } from "../shared/useSceneActivation";

const DEBUG = process.env.NODE_ENV === "development";

export default function HeroCanvas() {
  const tier = useWindowTier();
  // The hero is in view at load, so shouldMount resolves immediately. inView is what
  // earns this hook here: it drops frameloop to "never" once the hero scrolls away,
  // so the bloom chain is not paid for while the user reads About.
  const { ref, shouldMount, inView } = useSceneActivation<HTMLDivElement>();

  // Start the model download at page mount, ahead of the canvas. In an effect, not
  // module scope, so it never runs during SSR.
  useEffect(() => {
    useGLTF.preload(MODEL_URL);
  }, []);

  return (
    // absolute inset-0 so the canvas fills .hero-stage rather than sizing itself.
    <div ref={ref} className="absolute inset-0">
      {shouldMount && tier ? (
        <Canvas
          dpr={[1, TIER_MAX_DPR[tier]]}
          frameloop={inView ? "always" : "never"}
          // Debounced so a drag-resize does not reallocate the post-processing render
          // targets on every frame.
          resize={{ debounce: { resize: 150, scroll: 50 } }}
          // antialias is pointless with post-processing: the composer renders to its
          // own target, so canvas MSAA never applies — it just costs memory and fill rate.
          gl={{ antialias: false, alpha: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = POST.exposure;
            // Transparent, as every other scene here: the page background belongs
            // behind the hero. It also keeps the background out of the bloom
            // highpass entirely rather than relying on it staying under the threshold.
            gl.setClearColor(0x000000, 0);
          }}>
          {/* No position prop: ResponsiveCamera owns the distance, so R3F cannot
              re-assert a stale value over the solved one. */}
          <PerspectiveCamera
            makeDefault
            fov={CAMERA.fov}
            near={CAMERA.near}
            far={CAMERA.far}
          />
          {/* Outside Suspense, so framing does not wait on the model. */}
          <ResponsiveCamera />
          {/* Zoom and pan off: the wheel has to keep scrolling the page. */}
          <OrbitControls enableDamping enableZoom={false} enablePan={false} />

          <Suspense fallback={null}>
            <HeroParticles />
          </Suspense>
          <PostProcessing />
          {/* {DEBUG && <Perf />} */}
        </Canvas>
      ) : null}
    </div>
  );
}
