"use client";

// Window-width tier, for props that must be set on <Canvas> itself (dpr) and so
// cannot read useThree().size. Inside the canvas, prefer tierForWidth(size.width)
// — that is the real canvas box rather than the window.

import { useEffect, useState } from "react";
import { type Tier, TIER_MAX_WIDTH, tierForWidth } from "./equipmentSceneDefaults";

export function useWindowTier(): Tier | null {
  // null on the server and for the first client render: callers must not mount a
  // canvas until the width has actually been measured, or a phone would create a
  // context and start the model download for one render before being corrected.
  const [tier, setTier] = useState<Tier | null>(null);

  useEffect(() => {
    const queries = [
      window.matchMedia(`(max-width: ${TIER_MAX_WIDTH.mobile - 1}px)`),
      window.matchMedia(`(max-width: ${TIER_MAX_WIDTH.tablet - 1}px)`),
    ];

    const update = () => setTier(tierForWidth(window.innerWidth));
    update();

    queries.forEach((q) => q.addEventListener("change", update));
    return () => queries.forEach((q) => q.removeEventListener("change", update));
  }, []);

  return tier;
}
