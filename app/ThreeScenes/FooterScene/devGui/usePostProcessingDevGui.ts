// Dev-only hook for post-processing tuning GUI.
// Keeps PostProcessing.tsx focused on the EffectComposer pipeline.

import type { MutableRefObject } from "react";
import type { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import type { PostProcessingSettings } from "../footerSceneDefaults";
import { setupPostProcessingDevGui } from "./postProcessingDevGui";
import { useDevGuiPanel } from "../../shared/devGui/useDevGuiPanel";
import { DEV_GUI_ORDER } from "../../shared/devGui/devGuiStack";

type UsePostProcessingDevGuiOptions = {
  bloomRef: MutableRefObject<UnrealBloomPass | null>;
  filmRef: MutableRefObject<FilmPass | null>;
  settings: MutableRefObject<PostProcessingSettings>;
};

export function usePostProcessingDevGui({
  bloomRef,
  filmRef,
  settings,
}: UsePostProcessingDevGuiOptions) {
  useDevGuiPanel({
    title: "Post Processing",
    order: DEV_GUI_ORDER.footerPostProcessing,
    setup: (gui) => {
      setupPostProcessingDevGui({
        gui,
        refs: { bloomRef, filmRef, settings },
      });
    },
  });
}
