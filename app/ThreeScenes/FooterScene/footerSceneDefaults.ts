// Single source of truth for footer scene tunable values.
// Edit these defaults when tuning the look — dev GUI sliders read from here too.

export const PARTICLE_SIZE = 10;

export type CameraSettings = {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
};

export const CAMERA_DEFAULTS: CameraSettings = {
  posX: 0.163952596664429,
  posY: -0.946047403335571,
  posZ: 0.379952596664429,
  rotX: -0.161592653589793,
  rotY: 1.62840734641021,
  rotZ: 0.00840734641020699,
};

export type NoiseSettings = {
  noisePeriod: number;
  noiseSpeed: number;
  noiseStrength: number;
};

export const NOISE_DEFAULTS: NoiseSettings = {
  noisePeriod: 8,
  noiseSpeed: 0.08,
  noiseStrength: 0.032,
};

export type SceneOffset = {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
};

// Nudge model down so it sits at the bottom of the footer frame.
export const SCENE_OFFSET: SceneOffset = {
  offsetX: 0,
  offsetY: -0.35,
  offsetZ: 0,
};

export const SCENE_OFFSET_MARGIN = 2.0;
export const SCENE_OFFSET_STEP = 0.01;

export const CAMERA_POSITION_MARGIN = 2.0;
export const CAMERA_ROTATION_MARGIN = 2.0;
export const CAMERA_SLIDER_STEP = 0.01;

export type PostProcessingSettings = {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  filmIntensity: number;
  filmGrayscale: boolean;
  exposure: number;
};

export const POST_PROCESSING_DEFAULTS: PostProcessingSettings = {
  bloomStrength: 1.8,
  bloomRadius: 0.16,
  bloomThreshold: 0,
  filmIntensity: 1,
  filmGrayscale: false,
  exposure: 0.71,
};

export const RENDERER_EXPOSURE = POST_PROCESSING_DEFAULTS.exposure;

// Shift capture window so the model anchors near the bottom while canvas stays full height.
export const FOOTER_COMPOSITION_OFFSET_Y_RATIO = 0.16;
// Preserve top headroom so upward-moving particles are less likely to clip.
export const FOOTER_PARTICLE_HEADROOM_Y_RATIO = 0.06;
