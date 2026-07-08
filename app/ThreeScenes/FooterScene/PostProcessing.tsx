"use client";

// Footer post-processing — bloom, film grain, and tone mapping via EffectComposer.
// Tune defaults in footerSceneDefaults.ts.

import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { POST_PROCESSING_DEFAULTS } from "./footerSceneDefaults";
import { footerGlRef } from "./footerGlRef";
import { usePostProcessingDevGui } from "./devGui/usePostProcessingDevGui";

export default function PostProcessing() {
  const { gl, scene, camera, size, viewport } = useThree();

  const composerRef = useRef<EffectComposer | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const filmRef = useRef<FilmPass | null>(null);
  const settings = useRef({ ...POST_PROCESSING_DEFAULTS });

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(size.width, size.height);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      settings.current.bloomStrength,
      settings.current.bloomRadius,
      settings.current.bloomThreshold,
    );
    composer.addPass(bloomPass);
    bloomRef.current = bloomPass;

    const filmPass = new FilmPass(
      settings.current.filmIntensity,
      settings.current.filmGrayscale,
    );
    composer.addPass(filmPass);
    filmRef.current = filmPass;

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    composerRef.current = composer;

    return () => {
      composer.dispose();
      composerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    if (!composerRef.current) return;
    composerRef.current.setSize(size.width, size.height);
    composerRef.current.setPixelRatio(viewport.dpr);
    if (bloomRef.current) {
      bloomRef.current.resolution.set(size.width, size.height);
    }
  }, [size, viewport.dpr]);

  usePostProcessingDevGui({ bloomRef, filmRef, settings });

  useFrame(() => {
    const renderer = footerGlRef.current;
    if (renderer) {
      renderer.toneMappingExposure = settings.current.exposure;
    }
    composerRef.current?.render();
  }, 1);

  return null;
}
