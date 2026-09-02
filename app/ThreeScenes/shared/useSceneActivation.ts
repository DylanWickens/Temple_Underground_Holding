"use client";

// Mount-on-idle plus in-view tracking for the Three scenes.
//
// Mounting early lets a scene fetch its model, compile shaders and allocate its
// render targets while the user is still on the hero, so it is ready by the time
// it scrolls into view. `inView` then decides whether it actually renders — a
// mounted scene with frameloop "never" costs a WebGL context and nothing else.

import { useEffect, useRef, useState } from "react";

type SceneActivationOptions = {
  /** IntersectionObserver rootMargin: how far outside the viewport still counts as in view. */
  rootMargin?: string;
};

export function useSceneActivation<T extends HTMLElement = HTMLDivElement>({
  rootMargin = "25%",
}: SceneActivationOptions = {}) {
  const ref = useRef<T>(null);
  const [idleReached, setIdleReached] = useState(false);
  const [inView, setInView] = useState(false);

  // Mount after first paint, in the browser's first idle slot, so the hero's LCP
  // does not compete with a WebGL context and a shader compile.
  useEffect(() => {
    const mount = () => setIdleReached(true);

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(mount, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    // Safari has no requestIdleCallback.
    const id = window.setTimeout(mount, 1000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  // If the user outruns the idle slot, intersection mounts it as before.
  const shouldMount = idleReached || inView;

  return { ref, shouldMount, inView };
}
