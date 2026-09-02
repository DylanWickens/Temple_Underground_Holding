// Shared lil-gui lifecycle — async import, stack registration, and cleanup.
// Used by scene-specific dev hooks; not imported by production scene components directly.

import { useEffect } from "react";
import type { GUI } from "lil-gui";
import { registerDevGui, SHOW_DEV_GUI, unregisterDevGui } from "./devGuiStack";

type UseDevGuiPanelOptions = {
  title: string;
  order: number;
  setup: (gui: GUI) => void;
  deps?: unknown[];
};

export function useDevGuiPanel({ title, order, setup, deps = [] }: UseDevGuiPanelOptions) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !SHOW_DEV_GUI) return;

    let gui: GUI | undefined;
    let cancelled = false;

    import("lil-gui").then(({ default: GUIClass }) => {
      if (cancelled) return;

      gui = new GUIClass({ title });
      registerDevGui(gui, order);
      setup(gui);
    });

    return () => {
      cancelled = true;
      if (gui) {
        unregisterDevGui(gui);
        gui.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
