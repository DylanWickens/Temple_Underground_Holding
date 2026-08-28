"use client";

// Window-width tier, for props that must be set on <Canvas> itself (dpr) and so
// cannot read useThree().size. Inside the canvas, prefer tierForWidth(size.width)
// — that is the real canvas box rather than the window.

import { useEffect, useState } from "react";
import { type Tier, TIER_MAX_WIDTH, tierForWidth } from "./equipmentSceneDefaults";

export function useWindowTier(): Tier {
  // Desktop on the server and for the first paint; corrected on mount before the
  // canvas has produced a frame worth looking at.
  const [tier, setTier] = useState<Tier>("desktop");

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
