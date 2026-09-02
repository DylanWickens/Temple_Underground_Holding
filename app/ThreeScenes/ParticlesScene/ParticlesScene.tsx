"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import Particles from "./Particles";
import ResponsiveCamera from "./ResponsiveCamera";
import { CAMERA_CLIPPING } from "./particlesSceneDefaults";

export default function ParticlesScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [shouldMount, setShouldMount] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setShouldMount(true);
      },
      { rootMargin: "25%" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0">
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
            <Particles />
          </Suspense>
        </Canvas>
      ) : null}
    </div>
  );
}
