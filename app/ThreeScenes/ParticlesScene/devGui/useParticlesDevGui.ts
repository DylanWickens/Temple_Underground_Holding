// Dev-only hook for footer particles tuning GUI.
// Keeps Particles.tsx scene-only.

import { useEffect, useRef, type RefObject } from "react";
import type { PerspectiveCamera, ShaderMaterial } from "three";
import type { Camera } from "@react-three/fiber";
import { setupParticlesDevGui, setupScrollLiftDevGui } from "./particlesDevGui";
import { useDevGuiPanel } from "../../shared/devGui/useDevGuiPanel";
import { DEV_GUI_ORDER } from "../../shared/devGui/devGuiStack";

type UseParticlesDevGuiOptions = {
  materialRef: RefObject<ShaderMaterial | null>;
  camera: Camera;
  width: number;
  height: number;
  dpr: number;
};

export function useParticlesDevGui({
  materialRef,
  camera,
  width,
  height,
  dpr,
}: UseParticlesDevGuiOptions) {
  // Read through a ref so the panel's onChange handlers always solve against the
  // current canvas box rather than whatever it was when the panel was built.
  const sizeRef = useRef({ width, height, dpr });
  sizeRef.current = { width, height, dpr };

  const refreshRef = useRef<(() => void) | null>(null);

  useDevGuiPanel({
    title: "Footer Particles",
    order: DEV_GUI_ORDER.particlesFraming,
    deps: [camera],
    setup: (gui) => {
      const { refresh } = setupParticlesDevGui({
        gui,
        camera: camera as PerspectiveCamera,
        materialRef,
        getSize: () => sizeRef.current,
      });
      refreshRef.current = refresh;
    },
  });

  useDevGuiPanel({
    title: "Scroll Lift",
    order: DEV_GUI_ORDER.particlesScrollLift,
    setup: (gui) => setupScrollLiftDevGui(gui, () => sizeRef.current.width),
  });

  // Keep the panel readouts honest after a resize.
  useEffect(() => {
    refreshRef.current?.();
  }, [width, height, dpr]);
}
