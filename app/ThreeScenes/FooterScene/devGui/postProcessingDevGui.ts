// Dev-only lil-gui panel for bloom, film grain, and exposure tuning.

import type { GUI } from "lil-gui";
import type { MutableRefObject } from "react";
import type { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import type { PostProcessingSettings } from "../footerSceneDefaults";
import { footerGlRef } from "../footerGlRef";
import { addLogButton } from "./devGuiHelpers";

type FilmPassUniforms = {
  intensity: { value: number };
  grayscale: { value: boolean };
};

function getFilmUniforms(filmPass: FilmPass): FilmPassUniforms {
  return filmPass.uniforms as FilmPassUniforms;
}

type PostProcessingDevGuiRefs = {
  bloomRef: MutableRefObject<UnrealBloomPass | null>;
  filmRef: MutableRefObject<FilmPass | null>;
  settings: MutableRefObject<PostProcessingSettings>;
};

type PostProcessingDevGuiOptions = {
  gui: GUI;
  refs: PostProcessingDevGuiRefs;
};

export function setupPostProcessingDevGui({ gui, refs }: PostProcessingDevGuiOptions) {
  const { bloomRef, filmRef, settings } = refs;

  const updatePostProcessing = () => {
    if (bloomRef.current) {
      bloomRef.current.strength = settings.current.bloomStrength;
      bloomRef.current.radius = settings.current.bloomRadius;
      bloomRef.current.threshold = settings.current.bloomThreshold;
    }
    if (filmRef.current) {
      const filmUniforms = getFilmUniforms(filmRef.current);
      filmUniforms.intensity.value = settings.current.filmIntensity;
      filmUniforms.grayscale.value = settings.current.filmGrayscale;
    }
    if (footerGlRef.current) {
      footerGlRef.current.toneMappingExposure = settings.current.exposure;
    }
  };

  gui
    .add(settings.current, "bloomStrength", 0, 2, 0.01)
    .name("Bloom strength")
    .onChange(updatePostProcessing);
  gui
    .add(settings.current, "bloomRadius", 0, 1, 0.01)
    .name("Bloom radius")
    .onChange(updatePostProcessing);
  gui
    .add(settings.current, "bloomThreshold", 0, 1, 0.01)
    .name("Bloom threshold")
    .onChange(updatePostProcessing);
  gui
    .add(settings.current, "filmIntensity", 0, 1, 0.01)
    .name("Film grain")
    .onChange(updatePostProcessing);
  gui
    .add(settings.current, "filmGrayscale")
    .name("Film grayscale")
    .onChange(updatePostProcessing);
  gui
    .add(settings.current, "exposure", 0, 3, 0.01)
    .name("Exposure")
    .onChange(updatePostProcessing);
  addLogButton(gui, "Post-processing settings", () => settings.current);
}
