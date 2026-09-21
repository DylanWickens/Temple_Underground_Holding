"use client";

// Renders its children only when the viewer has NOT asked for reduced motion.
//
// The three WebGL scenes are continuous animation — a drifting point cloud, a
// scroll-driven lift, a cursor brush — with no meaningful still frame to fall
// back to, so the honest answer to prefers-reduced-motion is not to run them.
// Gating at the element rather than inside each scene also means the WebGL
// context, the model download and the shader compile never happen at all.
//
// It wraps the scenes in page.tsx rather than living inside them so the decision
// sits in one place, next to the markup it removes. page.tsx is a server
// component, so the hook has to be behind a client boundary like this one.

import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export default function MotionGate({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();

  // null — not yet measured — withholds as well. One render without the scene
  // costs nothing: all three already wait for an idle slot before mounting.
  return reduced === false ? <>{children}</> : null;
}
