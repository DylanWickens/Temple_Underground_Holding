"use client";

import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { registerDevGui, unregisterDevGui } from "./devGuiStack";
import { footerGlRef } from "./footerGlRef";

const DEBUG_DEFAULTS = {
  bloomStrength: 1.8,
  bloomRadius: 0.16,
  bloomThreshold: 0,
  filmIntensity: 1,
  filmGrayscale: false,
  exposure: 2.04,
};

type FilmPassUniforms = {
  intensity: { value: number };
  grayscale: { value: boolean };
};

function getFilmUniforms(filmPass: FilmPass): FilmPassUniforms {
  return filmPass.uniforms as FilmPassUniforms;
}

export default function PostProcessing() {
  const { gl, scene, camera, size, viewport } = useThree();

  const composerRef = useRef<EffectComposer | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const filmRef = useRef<FilmPass | null>(null);
  const debugObject = useRef({ ...DEBUG_DEFAULTS });

  // Build composer once on mount
  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(size.width, size.height);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      debugObject.current.bloomStrength,
      debugObject.current.bloomRadius,
      debugObject.current.bloomThreshold,
    );
    composer.addPass(bloomPass);
    bloomRef.current = bloomPass;

    const filmPass = new FilmPass(
      debugObject.current.filmIntensity,
      debugObject.current.filmGrayscale,
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

  // Resize composer when canvas size changes
  useEffect(() => {
    if (!composerRef.current) return;
    composerRef.current.setSize(size.width, size.height);
    composerRef.current.setPixelRatio(viewport.dpr);
    if (bloomRef.current) {
      bloomRef.current.resolution.set(size.width, size.height);
    }
  }, [size, viewport.dpr]);

  // Dev GUI
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let gui: import("lil-gui").GUI | undefined;
    let cancelled = false;

    import("lil-gui").then(({ default: GUI }) => {
      if (cancelled) return;

      gui = new GUI({ title: "Post Processing" });
      registerDevGui(gui, 1);

      const updatePostProcessing = () => {
        if (bloomRef.current) {
          bloomRef.current.strength = debugObject.current.bloomStrength;
          bloomRef.current.radius = debugObject.current.bloomRadius;
          bloomRef.current.threshold = debugObject.current.bloomThreshold;
        }
        if (filmRef.current) {
          const filmUniforms = getFilmUniforms(filmRef.current);
          filmUniforms.intensity.value = debugObject.current.filmIntensity;
          filmUniforms.grayscale.value = debugObject.current.filmGrayscale;
        }
        if (footerGlRef.current) {
          footerGlRef.current.toneMappingExposure = debugObject.current.exposure;
        }
      };

      gui
        .add(debugObject.current, "bloomStrength", 0, 2, 0.01)
        .name("Bloom strength")
        .onChange(updatePostProcessing);
      gui
        .add(debugObject.current, "bloomRadius", 0, 1, 0.01)
        .name("Bloom radius")
        .onChange(updatePostProcessing);
      gui
        .add(debugObject.current, "bloomThreshold", 0, 1, 0.01)
        .name("Bloom threshold")
        .onChange(updatePostProcessing);
      gui
        .add(debugObject.current, "filmIntensity", 0, 1, 0.01)
        .name("Film grain")
        .onChange(updatePostProcessing);
      gui
        .add(debugObject.current, "filmGrayscale")
        .name("Film grayscale")
        .onChange(updatePostProcessing);
      gui
        .add(debugObject.current, "exposure", 0, 3, 0.01)
        .name("Exposure")
        .onChange(updatePostProcessing);
      gui
        .add(
          {
            logValues: () => {
              console.log(
                "Post-processing settings:",
                JSON.stringify(debugObject.current, null, 2),
              );
            },
          },
          "logValues",
        )
        .name("Log values to console");
    });

    return () => {
      cancelled = true;
      if (gui) {
        unregisterDevGui(gui);
        gui.destroy();
      }
    };
  }, []);

  // Render via composer instead of default R3F render
  useFrame(() => {
    const renderer = footerGlRef.current;
    if (renderer) {
      renderer.toneMappingExposure = debugObject.current.exposure;
    }
    composerRef.current?.render();
  }, 1);

  return null;
}
