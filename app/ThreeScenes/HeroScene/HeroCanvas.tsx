"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, useGLTF } from "@react-three/drei";
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
    //
    // touch-pan-y: the browser claims only VERTICAL pans over the hero, so a horizontal
    // swipe belongs to the canvas (the spin in HeroParticles) and cannot drift the
    // page. The listener there makes the mirror-image decision; neither side calls
    // preventDefault. pinch-zoom stays for accessibility.
    //
    // touch-action is TOUCH- AND PEN-ONLY and cannot affect the mouse drag in
    // HeroParticles, so never reach for touch-none to "fix" a mouse-drag problem: that
    // hands the browser nothing over the hero and silently kills vertical page scroll
    // on a phone, which is the whole axis-lock contract documented here and on
    // MOBILE_SPIN. select-none is the mouse half — belt-and-braces for Safari, on top
    // of the preventDefault the drag's pointerdown already does. The logo is a SIBLING
    // of this wrapper, so its own selection is untouched.
    //
    // The resting cursor is here rather than on the canvas, and in JS rather than a
    // Tailwind `md:cursor-grab`: Tailwind v4's `md` is 48rem against the browser's
    // DEFAULT font size, which drifts from tierForWidth's CSS-px 768 the moment a user
    // changes it. useWindowTier calls that same function, so this agrees exactly with
    // the frame loop's own mobile/desktop split. The canvas inherits it; the drag in
    // HeroParticles overrides it with "grabbing" for the length of a gesture.
    <div
      ref={ref}
      style={{ cursor: tier && tier !== "mobile" ? "grab" : undefined }}
      className="absolute inset-0 touch-pan-y touch-pinch-zoom select-none">
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
