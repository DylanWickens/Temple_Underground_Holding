import type { WebGLRenderer } from "three";

export const footerGlRef: { current: WebGLRenderer | null } = {
  current: null,
};
