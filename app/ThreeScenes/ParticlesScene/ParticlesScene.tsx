"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import Particles from "./Particles"
import { PerspectiveCamera } from "@react-three/drei";
import { Perf } from "r3f-perf"; 

function CameraLookAt({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, target]);

  return null;
}

export default function ParticlesScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [shouldMount, setShouldMount] = useState(false);
  const [inView, setInView] = useState(false);

  // Camera
  const cameraSettings = {
    position: [94.5233, 6.8569, -92.4471] as [number, number, number],
    target: [6.629, 66.6245, -3.7087] as [number, number, number],
  };

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
          onCreated={({ gl }) => {
            gl.setClearColor(0xff0000, 0);
          }}
          gl={{ antialias: true, alpha: true }}>
          {/* <OrbitControls /> */}
          {/* Frame monitor */}
          {/* <Perf position="top-left" /> */}
          <PerspectiveCamera makeDefault position={cameraSettings.position} />
          <CameraLookAt target={cameraSettings.target} />
          <Suspense fallback={null}>
            <Particles />
          </Suspense>
        </Canvas>
      ) : null}
    </div>
  );
}
