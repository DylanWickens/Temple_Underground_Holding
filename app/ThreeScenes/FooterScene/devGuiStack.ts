import type { GUI } from "lil-gui";

const GAP = 10;
const RIGHT = 15;
const TOP = 10;

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
