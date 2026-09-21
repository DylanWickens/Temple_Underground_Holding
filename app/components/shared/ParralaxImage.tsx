"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../../ThreeScenes/shared/usePrefersReducedMotion";

interface ParralaxImageProps {
  children: React.ReactNode;
  delay: number;
}

export default function ParralaxImage({ children, delay }: ParralaxImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    // Only watch for the reveal if we are actually going to animate. While the
    // preference is still unmeasured (null) this waits a tick rather than
    // attaching an observer it may immediately have to tear down.
    if (reduced !== false) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("parallaxImage");
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      // The animation is what fades this in, so the element may only start hidden
      // when it is going to run. Under reduced motion it renders at full opacity
      // immediately — skipping the animation without this would leave the image
      // permanently invisible rather than merely still.
      className={reduced ? "w-full" : "opacity-0 w-full"}
      style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
