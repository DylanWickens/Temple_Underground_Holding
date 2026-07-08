"use client";

import { ReactLenis } from 'lenis/react';

type LenisProviderProps = {
    children: React.ReactNode
}

export default function LenisProvider({ children } :LenisProviderProps) {
  return (
   <>
    <ReactLenis root />
    {children}
   </>
  )
}
