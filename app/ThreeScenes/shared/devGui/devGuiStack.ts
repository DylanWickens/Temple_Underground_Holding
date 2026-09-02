import type { GUI } from "lil-gui";

const GAP = 10;
const RIGHT = 15;
const TOP = 10;

// Top-to-bottom order of the stacked panels. Every panel must register here so
// the stack can lay them out without overlapping.
export const DEV_GUI_ORDER = {
  equipmentPostProcessing: 0,
  particlesFraming: 10,
  footerPointCloud: 20,
  footerPostProcessing: 30,
} as const;

type StackEntry = {
  gui: GUI;
  order: number;
};

const stack: StackEntry[] = [];

export function layoutDevGuiStack() {
  requestAnimationFrame(() => {
    let offset = TOP;

    for (const { gui } of stack) {
      const { style } = gui.domElement;
      style.position = "fixed";
      style.right = `${RIGHT}px`;
      style.left = "auto";
      style.top = `${offset}px`;
      offset += gui.domElement.offsetHeight + GAP;
    }
  });
}

export function registerDevGui(gui: GUI, order: number) {
  stack.push({ gui, order });
  stack.sort((a, b) => a.order - b.order);
  layoutDevGuiStack();
}

export function unregisterDevGui(gui: GUI) {
  const index = stack.findIndex((entry) => entry.gui === gui);
  if (index === -1) return;
  stack.splice(index, 1);
  layoutDevGuiStack();
}
