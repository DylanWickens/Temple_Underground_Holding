import type { GUI } from "lil-gui";

// Flip to true to show the stacked lil-gui panels. Instrumentation in each
// scene (framing, particle size, post stops) keeps running either way.
export const SHOW_DEV_GUI = false;

const GAP = 10;
const RIGHT = 15;
const TOP = 10;
const BOTTOM = 10;

// Top-to-bottom order of the stacked panels. Every panel must register here so
// the stack can lay them out without overlapping.
export const DEV_GUI_ORDER = {
  heroCloud: 0,
  heroPostProcessing: 1,
  equipmentPostProcessing: 5,
  particlesFraming: 10,
  particlesScrollLift: 15,
  footerPointCloud: 20,
  footerPostProcessing: 30,
} as const;

type StackEntry = {
  gui: GUI;
  order: number;
};

const stack: StackEntry[] = [];

let container: HTMLDivElement | undefined;

// The panels live inside one fixed, scrollable column rather than each being
// fixed-positioned at its own top offset — on a short window the tail of the
// stack used to fall off the bottom of the viewport with no way to reach it.
function ensureContainer() {
  if (container) return container;

  container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    top: `${TOP}px`,
    right: `${RIGHT}px`,
    maxHeight: `calc(100vh - ${TOP + BOTTOM}px)`,
    zIndex: "1001",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: `${GAP}px`,
    overflowY: "auto",
    overflowX: "hidden",
    overscrollBehavior: "contain",
    scrollbarWidth: "thin",
    // Only the panels themselves should swallow clicks; the gaps between them
    // stay transparent to the canvas underneath.
    pointerEvents: "none",
  });

  document.body.appendChild(container);
  return container;
}

export function layoutDevGuiStack() {
  requestAnimationFrame(() => {
    const parent = ensureContainer();

    for (const { gui } of stack) {
      const { style } = gui.domElement;
      // Undo lil-gui's autoPlace fixed positioning and its 100%-of-viewport cap
      // so each panel sits at its natural height in the scrolling column.
      style.position = "relative";
      style.top = "auto";
      style.right = "auto";
      style.left = "auto";
      style.maxHeight = "none";
      style.flex = "0 0 auto";
      style.pointerEvents = "auto";

      const children = gui.domElement.querySelector<HTMLElement>(
        ":scope > .lil-children, :scope > .children"
      );
      if (children) {
        children.style.maxHeight = "none";
        children.style.overflowY = "visible";
      }

      // Re-append in sorted order so DOM order matches the stack order.
      parent.appendChild(gui.domElement);
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

  if (stack.length === 0 && container) {
    container.remove();
    container = undefined;
    return;
  }

  layoutDevGuiStack();
}
