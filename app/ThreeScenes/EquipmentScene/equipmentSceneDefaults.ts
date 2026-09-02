// Single source of truth for equipment scene tunable values.
//
// Composition is expressed as RATIOS of the visible frame, never raw world units.
// `viewport.width` / `viewport.height` from useThree() are the world-space dimensions
// visible at z=0 — the plane the model sits on — so ratios convert straight to world
// units with no fov trig, and the crop holds its proportions at every screen size.
//
// Values are keyed to responsive "stops" and linearly interpolated between them, so
// resizing a desktop window reads as a smooth push rather than a snap at a breakpoint.

// ---------------------------------------------------------------------------
// Tiers — for discrete quality/perf decisions that cannot be interpolated.
// ---------------------------------------------------------------------------

export type Tier = "mobile" | "tablet" | "desktop";

export const TIER_MAX_WIDTH = {
  mobile: 768,
  tablet: 1280,
} as const;

export function tierForWidth(width: number): Tier {
  if (width < TIER_MAX_WIDTH.mobile) return "mobile";
  if (width < TIER_MAX_WIDTH.tablet) return "tablet";
  return "desktop";
}

export type TierQuality = {
  /** Upper bound for the canvas + composer pixel ratio. */
  maxDpr: number;
  /** Keep every Nth vertex of the PLY. 1 = full density. */
  vertexStride: number;
  /** FilmPass is ~1 extra fullscreen pass; not worth it on phones. */
  filmGrain: boolean;
};

export const TIER_QUALITY: Record<Tier, TierQuality> = {
  mobile: { maxDpr: 1.5, vertexStride: 2, filmGrain: false },
  tablet: { maxDpr: 2, vertexStride: 1, filmGrain: true },
  desktop: { maxDpr: 2, vertexStride: 1, filmGrain: true },
};

// ---------------------------------------------------------------------------
// Fixed camera / model framing
// ---------------------------------------------------------------------------

export const CAMERA = {
  fov: 45,
  near: 0.001,
  far: 1000,
  position: [-0.14, 0, 3] as const,
};

export const MODEL_ROTATION = [Math.PI / 3 - 0.05, 0, 0] as const;

export const CONTENT_MAX_WIDTH = 1440;

/** Canvas height (CSS px) the particle size was tuned at. */
export const REFERENCE_HEIGHT = 950;

/** Base gl_PointSize in device px at REFERENCE_HEIGHT, before dpr scaling. */
export const PARTICLE_SIZE = 7;

export const NOISE_DEFAULTS = {
  noisePeriod: 10.5,
  noiseSpeed: 0.8,
  noiseStrength: 0.015,
};

export const RENDERER_EXPOSURE = 0.8;

// ---------------------------------------------------------------------------
// Composition stops
// ---------------------------------------------------------------------------

export type Composition = {

  coverage: number;
  offsetXRatio: number;
  offsetYRatio: number;
};

export type Stop<T> = { width: number; value: T };

export const COMPOSITION_STOPS: Stop<Composition>[] = [
  { width: 390, value: { coverage: 1.3, offsetXRatio: 0, offsetYRatio: 0.04 } },
  { width: 768, value: { coverage: 1.55, offsetXRatio: -0.14, offsetYRatio: 0.02 } },
  { width: 1280, value: { coverage: 1.85, offsetXRatio: -0.26, offsetYRatio: 0 } },
  { width: 1920, value: { coverage: 2.01, offsetXRatio: -0.301, offsetYRatio: 0 } },
  { width: 2560, value: { coverage: 2.1, offsetXRatio: -0.32, offsetYRatio: 0 } },
];

// ---------------------------------------------------------------------------
// Post-processing stops
// ---------------------------------------------------------------------------

export type PostProcessingSettings = {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  filmIntensity: number;
  filmGrayscale: boolean;
  exposure: number;
};

export const POST_PROCESSING_STOPS: Stop<PostProcessingSettings>[] = [
  {
    width: 390,
    value: {
      bloomStrength: 0.9,
      bloomRadius: 0.2,
      bloomThreshold: 0.1,
      filmIntensity: 0.6,
      filmGrayscale: false,
      exposure: RENDERER_EXPOSURE,
    },
  },
  {
    width: 768,
    value: {
      bloomStrength: 1.15,
      bloomRadius: 0.14,
      bloomThreshold: 0.07,
      filmIntensity: 0.8,
      filmGrayscale: false,
      exposure: RENDERER_EXPOSURE,
    },
  },
  {
    width: 1280,
    value: {
      bloomStrength: 1.43,
      bloomRadius: 0.08,
      bloomThreshold: 0.05,
      filmIntensity: 1,
      filmGrayscale: false,
      exposure: RENDERER_EXPOSURE,
    },
  },
  {
    width: 2560,
    value: {
      bloomStrength: 1.5,
      bloomRadius: 0.07,
      bloomThreshold: 0.05,
      filmIntensity: 1,
      filmGrayscale: false,
      exposure: RENDERER_EXPOSURE,
    },
  },
];

// ---------------------------------------------------------------------------
// Stop interpolation
// ---------------------------------------------------------------------------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function resolveStops<T extends Record<string, number | boolean>>(
  stops: Stop<T>[],
  width: number,
): T {
  if (width <= stops[0].width) return { ...stops[0].value };

  const last = stops[stops.length - 1];
  if (width >= last.width) return { ...last.value };

  let upper = 1;
  while (upper < stops.length - 1 && stops[upper].width < width) upper++;

  const from = stops[upper - 1];
  const to = stops[upper];
  const t = (width - from.width) / (to.width - from.width);

  const out = {} as Record<string, number | boolean>;
  for (const key of Object.keys(from.value)) {
    const a = from.value[key];
    const b = to.value[key];
    out[key] =
      typeof a === "number" && typeof b === "number" ? lerp(a, b, t) : t < 0.5 ? a : b;
  }
  return out as T;
}
