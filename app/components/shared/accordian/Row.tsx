"use client";

import { useRef } from "react";
import gsap from 'gsap'; 
import { useGSAP } from "@gsap/react"; 
import clsx from 'clsx';

gsap.registerPlugin(useGSAP);

interface RowProps {
    id: string,
    title: string,
    items: string[],
    isOpen: boolean,
    onToggle: (id: string) => void,
}

export default function Row({ id, title, items, isOpen, onToggle }: RowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);
  const isFirstRun = useRef(true);

  useGSAP(
    () => {
      // Skip the animation on mount so rows settle closed without a visible collapse.
      const instant = isFirstRun.current;
      isFirstRun.current = false;

      gsap.to(panelRef.current, {
        height: isOpen ? "auto" : 0,
        duration: instant ? 0 : 0.4,
        ease: "power2.inOut",
      });
      gsap.to(chevronRef.current, {
        rotation: isOpen ? 180 : 0,
        duration: instant ? 0 : 0.3,
        ease: "power2.out",
      });
    },
    { dependencies: [isOpen], scope: rowRef },
  );

  return (
    <div className="flex flex-col w-full" ref={rowRef}>
      <div
        className={clsx(
          "flex justify-between items-center self-stretch border-b border-current transition-colors duration-300",
          isOpen ? "text-white-100" : "text-white-100/30",
        )}>
        <button
          type="button"
          id={`${id}-trigger`}
          onClick={() => onToggle(id)}
          aria-expanded={isOpen}
          aria-controls={`${id}-panel`}
          className="flex min-w-0 py-7 gap-x-4 justify-between items-center flex-1 text-left cursor-pointer">
          <h5 className="accordian-title">{title}</h5>

          <svg
            ref={chevronRef}
            className="shrink-0 size-6"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true">
            <path d="M6 9L11.9994 16L18 9" stroke="currentColor" strokeWidth="1.33333" />
          </svg>
        </button>
      </div>

      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-trigger`}
        ref={panelRef}
        className="h-0 overflow-hidden">
        <ul className="flex flex-col gap-y-5 pt-9 pb-5 accordian-item text-white-100/80">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
