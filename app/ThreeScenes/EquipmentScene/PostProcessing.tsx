"use client";

import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  POST_PROCESSING_STOPS,
  type PostProcessingSettings,
  TIER_QUALITY,
  resolveStops,
  tierForWidth,
} from "./equipmentSceneDefaults";

const DEBUG = process.env.NODE_ENV === "development";

type FilmPassUniforms = {
  intensity: { value: number };
  grayscale: { value: boolean };
};

export default function PostProcessing() {
  const { gl, scene, camera, size, viewport } = useThree();

  const composerRef = useRef<EffectComposer | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const filmRef = useRef<FilmPass | null>(null);

  const settings = useRef<PostProcessingSettings>(
    resolveStops(POST_PROCESSING_STOPS, size.width),
  );
  // Once the dev GUI is touched, stop letting resizes overwrite the tweaks.
  const guiOverride = useRef(false);

  const tier = tierForWidth(size.width);
  const { filmGrain } = TIER_QUALITY[tier];

  // Rebuilt only when the pass chain itself changes — never on resize, which
  // would reallocate every render target mid-drag.
  useEffect(() => {
    const composer = new EffectComposer(gl);

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

    if (filmGrain) {
      const filmPass = new FilmPass(
        settings.current.filmIntensity,
        settings.current.filmGrayscale,
      );
      composer.addPass(filmPass);
      filmRef.current = filmPass;
    } else {
      filmRef.current = null;
    }

    composer.addPass(new OutputPass());

    // setPixelRatio internally re-runs setSize with the stored dimensions, so it
    // has to come first or the size is immediately overwritten by a stale one.
    composer.setPixelRatio(viewport.dpr);
    composer.setSize(size.width, size.height);

    composerRef.current = composer;

    return () => {
      composer.dispose();
      composerRef.current = null;
      bloomRef.current = null;
      filmRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, filmGrain]);

  // Resize. composer.setSize already forwards to every pass — including
  // UnrealBloomPass.setSize, which is what actually resizes the mip chain.
  // (Assigning bloomPass.resolution does nothing; it is only read in the ctor.)
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setPixelRatio(viewport.dpr);
    composer.setSize(size.width, size.height);
  }, [size.width, size.height, viewport.dpr]);

  // Width-driven look. Bloom params are plain properties, so this is a cheap
  // mutation — no pass or target reallocation.
  useEffect(() => {
    if (guiOverride.current) return;

    const next = resolveStops(POST_PROCESSING_STOPS, size.width);
    // Mutate in place — lil-gui binds to the object identity, so replacing the
    // ref value would leave the sliders driving a detached object.
    Object.assign(settings.current, next);

    if (bloomRef.current) {
      bloomRef.current.strength = next.bloomStrength;
      bloomRef.current.radius = next.bloomRadius;
      bloomRef.current.threshold = next.bloomThreshold;
    }
    if (filmRef.current) {
      const uniforms = filmRef.current.uniforms as FilmPassUniforms;
      // FilmPass grain is per DEVICE pixel, so at a high dpr it becomes too fine
      // to read. Scale intensity back up as the pixel ratio climbs.
      uniforms.intensity.value = next.filmIntensity * Math.min(viewport.dpr, 2);
      uniforms.grayscale.value = next.filmGrayscale;
    }
    // Exposure is applied in useFrame — assigning to `gl` from an effect trips
    // react-hooks/immutability.
  }, [size.width, viewport.dpr, filmGrain]);

  // ---------------------------------------------------------------------------
  // DEBUG — dev-only tuning GUI. Stripped from production builds.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!DEBUG) return;

    let gui: import("lil-gui").GUI | undefined;
    let cancelled = false;

    import("lil-gui").then(({ GUI }) => {
      if (cancelled) return;
      gui = new GUI();
      const postFolder = gui.addFolder("Post Processing");

      const updatePostProcessing = () => {
        // Resizing would otherwise snap these back to the stop table.
        guiOverride.current = true;

        if (bloomRef.current) {
          bloomRef.current.strength = settings.current.bloomStrength;
          bloomRef.current.radius = settings.current.bloomRadius;
          bloomRef.current.threshold = settings.current.bloomThreshold;
        }
        if (filmRef.current) {
          const filmUniforms = filmRef.current.uniforms as FilmPassUniforms;
          filmUniforms.intensity.value = settings.current.filmIntensity;
          filmUniforms.grayscale.value = settings.current.filmGrayscale;
        }
        gl.toneMappingExposure = settings.current.exposure;
      };

      postFolder
        .add(settings.current, "bloomStrength", 0, 2, 0.01)
        .name("Bloom strength")
        .onChange(updatePostProcessing)
        .listen();
      postFolder
        .add(settings.current, "bloomRadius", 0, 1, 0.01)
        .name("Bloom radius")
        .onChange(updatePostProcessing)
        .listen();
      postFolder
        .add(settings.current, "bloomThreshold", 0, 1, 0.01)
        .name("Bloom threshold")
        .onChange(updatePostProcessing)
        .listen();
      postFolder
        .add(settings.current, "filmIntensity", 0, 1, 0.01)
        .name("Film grain")
        .onChange(updatePostProcessing)
        .listen();
      postFolder
        .add(settings.current, "filmGrayscale")
        .name("Film grayscale")
        .onChange(updatePostProcessing)
        .listen();
      postFolder
        .add(settings.current, "exposure", 0, 3, 0.01)
        .name("Exposure")
        .onChange(updatePostProcessing)
        .listen();

      postFolder
        .add({ reset: () => (guiOverride.current = false) }, "reset")
        .name("Re-enable width tracking");
    });

    return () => {
      cancelled = true;
      gui?.destroy();
    };
  }, [gl]);

  // Priority 1 takes over the render loop from R3F. Exposure is read off the frame
  // state rather than the closed-over `gl` so react-hooks/immutability stays happy.
  useFrame((state) => {
    state.gl.toneMappingExposure = settings.current.exposure;
    composerRef.current?.render();
  }, 1);

  return null;
}
