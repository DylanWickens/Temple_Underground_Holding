"use client";

// The viewer's prefers-reduced-motion setting, for gating the WebGL scenes.
// Same shape as useWindowTier: null until it has actually been measured, so a
// caller never mounts a canvas on a guess.

import { useEffect, useState } from "react";

export function usePrefersReducedMotion(): boolean | null {
  // null on the server and for the first client render. Guessing false here would
  // create a WebGL context and start a model download for one render before being
  // corrected — the exact cost this preference exists to avoid.
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();

    // Tracked live: the setting can be toggled mid-session, and on macOS it is
    // also flipped by Low Power Mode.
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}
