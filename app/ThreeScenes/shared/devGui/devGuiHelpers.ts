// Shared lil-gui helpers for scene dev panels.

import type { GUI } from "lil-gui";

export function addLogButton(gui: GUI, label: string, getValues: () => unknown) {
  gui
    .add(
      {
        logValues: () => {
          console.log(`${label}:`, JSON.stringify(getValues(), null, 2));
        },
      },
      "logValues",
    )
    .name("Log values to console");
}
