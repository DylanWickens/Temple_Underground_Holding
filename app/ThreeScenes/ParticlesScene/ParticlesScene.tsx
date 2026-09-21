"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, useGLTF } from "@react-three/drei";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import Particles from "./Particles";
import ResponsiveCamera from "./ResponsiveCamera";
import {
  CAMERA_CLIPPING,
  LIFT,
  edgeMaskImage,
  registerEdgeMaskTarget,
  type HoverState,
  type LiftState,
} from "./particlesSceneDefaults";
import { useSceneActivation } from "../shared/useSceneActivation";

const MODEL_URL = "/models/Expanded.gltf";

export default function ParticlesScene() {
  // Mounts in the first idle slot after paint so the context, model and shaders
  // are ready before the footer scrolls into view; renders only while in view.
  const { ref: wrapRef, shouldMount, inView } = useSceneActivation<HTMLDivElement>({
    rootMargin: "50%",
  });

  // Start the model download at page mount, ahead of the canvas. In an effect,
  // not module scope, so it never runs during SSR.
  useEffect(() => {
    useGLTF.preload(MODEL_URL);
  }, []);

  // Hand the wrapper to the defaults module so the dev GUI — which is built inside
  // the <Canvas> subtree — can repaint the mask without a re-render.
  useLayoutEffect(() => {
    registerEdgeMaskTarget(wrapRef.current);
    return () => registerEdgeMaskTarget(null);
  }, [wrapRef]);

  // Lenis lives here, outside <Canvas>: R3F renders into its own React root, so
  // the Lenis context does not reach components inside the canvas.
  const lenis = useLenis();
  // A stable mutable object, not a state value: it changes on every wheel tick
  // and is read in useFrame, so its mutations must never re-render the Canvas.
  // useState only pins the identity across renders.
  const [lift] = useState<LiftState>(() => ({ value: 0 }));
  // Same contract as `lift`: a stable mutable object, read in useFrame.
  const [hover] = useState<HoverState>(() => ({
    clientX: 0,
    clientY: 0,
    active: false,
  }));

  useEffect(() => {
    if (!lenis || !inView) return;

    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleReturn = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        gsap.to(lift, {
          value: 0,
          duration: LIFT.returnDuration,
          ease: LIFT.returnEase,
        });
      }, LIFT.idleMs);
    };

    // virtual-scroll fires on the raw wheel/touch gesture even once Lenis is
    // clamped at its limit, which is what keeps this working past the end of the
    // document. Lenis normalises both input types to positive deltaY = scroll down.
    const off = lenis.on("virtual-scroll", ({ deltaY }) => {
      gsap.killTweensOf(lift);
      const gain = LIFT.maxLift / Math.max(LIFT.effortPx, 1);
      lift.value = Math.min(Math.max(lift.value + deltaY * gain, 0), LIFT.maxLift);
      scheduleReturn();
    });

    return () => {
      off();
      clearTimeout(idleTimer);
      gsap.killTweensOf(lift);
      lift.value = 0;
    };
  }, [lenis, inView, lift]);

  // A window listener rather than R3F's pointer events: the footer carries
  // pointer-events-none below 1396px (page.tsx), so the canvas is not a hit-test
  // target there at all. Same shape as the scroll gesture above — a listener
  // mutates a stable object, the frame loop reads it, nothing re-renders.
  useEffect(() => {
    if (!inView) return;

    const onMove = (e: PointerEvent) => {
      // Mouse only. A hover brush has no meaning on touch, and following a finger
      // would fight the scroll gesture this footer already owns.
      if (e.pointerType !== "mouse") return;
      hover.clientX = e.clientX;
      hover.clientY = e.clientY;
      hover.active = true;
    };
    // Cursor off the page entirely: fade out rather than strand the brush.
    const onLeave = () => {
      hover.active = false;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      hover.active = false;
    };
  }, [inView, hover]);

  // Bloom cannot fall off inside its own render target, so the composite is
  // ramped out at the top edge instead. See EDGE_MASK in the defaults.
  return (
    <div
      ref={wrapRef}
      className="absolute inset-0"
      style={{ maskImage: edgeMaskImage(), WebkitMaskImage: edgeMaskImage() }}>
      {shouldMount ? (
        <Canvas
          // R3F hard-codes `pointerEvents: "auto"` inline on its wrapper div, which would
          // override the pointer-events class on our container. `inherit` hands control back.
          style={{ pointerEvents: "inherit" }}
          frameloop={inView ? "always" : "never"}
          dpr={[1, 1.5]}
          // Debounced so a drag-resize does not reallocate the EffectComposer
          // render targets on every frame.
          resize={{ debounce: { resize: 150, scroll: 50 } }}
          onCreated={({ gl }) => {
            gl.setClearColor(0xff0000, 0);
          }}
          gl={{ antialias: true, alpha: true }}>
          {/* No fov/position props: ResponsiveCamera owns the whole pose, so R3F
              cannot re-assert a stale prop over the solved values. */}
          <PerspectiveCamera
            makeDefault
            near={CAMERA_CLIPPING.near}
            far={CAMERA_CLIPPING.far}
          />
          <ResponsiveCamera />
          <Suspense fallback={null}>
            <Particles
              lift={lift}
              hover={hover}
              hoverEnabled={inView}
              modelUrl={MODEL_URL}
            />
          </Suspense>
        </Canvas>
      ) : null}
    </div>
  );
}
