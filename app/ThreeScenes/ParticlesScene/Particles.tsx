'use client';

import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend, type ThreeElement, useThree, useFrame } from "@react-three/fiber";
import { useGLTF } from '@react-three/drei';
import { useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import { Bloom, EffectComposer, ToneMapping, Noise } from "@react-three/postprocessing";
import { ToneMappingMode } from 'postprocessing';
import { BlendFunction } from "postprocessing";

import {
  HOVER,
  LIFT,
  applyLiftStops,
  NOISE_DEFAULTS,
  PARTICLES,
  resolveParticleSize,
  resolveSubdivisions,
  solveFov,
  type HoverState,
  type LiftState,
} from "./particlesSceneDefaults";
import { buildLandscapePoints } from "./prepareLandscapePoints";
import { useParticlesDevGui } from "./devGui/useParticlesDevGui";
import vertexShader from './shaders/vert.glsl';
import fragmentShader from "./shaders/frag.glsl";


// Particles Shader Setup
type Uniforms = {
  uTime: number;
  uSize: number;
  uNoisePeriod: number;
  uNoiseSpeed: number;
  uNoiseStrength: number;
  uLift: number;
  uLiftCenter: THREE.Vector2;
  uLiftRadius: THREE.Vector2;
  uLiftPower: number;
  uLiftGlow: number;
  uLiftNear: number;
  uLiftFade: number;
  uLiftVariance: number;
  uLiftScatter: number;
  uLiftSize: number;
  uEdgeFadeStart: number;
  uIntensity: number;
  uPointer: THREE.Vector2;
  uHoverRadius: THREE.Vector2;
  uHoverStrength: number;
  uHoverSize: number;
  uHoverPower: number;
};

const DEFAULT_UNIFORMS: Uniforms = {
  uTime: 0,
  uSize: PARTICLES.size,
  uNoisePeriod: NOISE_DEFAULTS.noisePeriod,
  uNoiseSpeed: NOISE_DEFAULTS.noiseSpeed,
  uNoiseStrength: NOISE_DEFAULTS.noiseStrength,
  uLift: 0,
  uLiftCenter: new THREE.Vector2(LIFT.centerX, LIFT.centerY),
  uLiftRadius: new THREE.Vector2(LIFT.radiusX, LIFT.radiusY),
  uLiftPower: LIFT.power,
  uLiftGlow: 0,
  uLiftNear: LIFT.nearDistance,
  uLiftFade: LIFT.nearFade,
  uLiftVariance: LIFT.variance,
  uLiftScatter: LIFT.scatter,
  uLiftSize: 0,
  uEdgeFadeStart: LIFT.edgeFadeStart,
  uIntensity: PARTICLES.intensity,
  // Parked off-screen with zero strength, so nothing hovers until a mouse moves.
  uPointer: new THREE.Vector2(0, -2),
  uHoverRadius: new THREE.Vector2(HOVER.radius, HOVER.radius),
  uHoverStrength: 0,
  uHoverSize: HOVER.sizeScale,
  uHoverPower: HOVER.power,
}

const ParticlesShader = shaderMaterial(
  DEFAULT_UNIFORMS,
  vertexShader,
  fragmentShader
);
extend({ ParticlesShader });

declare module "@react-three/fiber" {
  interface ThreeElements {
    particlesShader: ThreeElement<typeof ParticlesShader>;
  }
}

type ParticlesProps = {
  /** Scroll-gesture lift target, owned and mutated by ParticlesScene. */
  lift: LiftState;
  /** Mouse-hover brush, owned and mutated by ParticlesScene. Desktop mouse only. */
  hover: HoverState;
  /** Mirrors the scene's inView: the fade resets on the falling edge. */
  hoverEnabled: boolean;
  /** Same URL ParticlesScene preloads, so the fetch is already in flight or cached. */
  modelUrl: string;
};

export default function Particles({
  lift,
  hover,
  hoverEnabled,
  modelUrl,
}: ParticlesProps) {
  const materialRef = useRef<InstanceType<typeof ParticlesShader>>(null);
  const smoothedLift = useRef(0);
  // The eased brush centre, so it trails the cursor rather than snapping to it.
  const smoothedPointer = useRef(new THREE.Vector2(0, -2));
  const smoothedHover = useRef(0);

  // frameloop goes to "never" off screen and R3F resets the clock on resume, so
  // delta does not cover the gap and a frozen fade would thaw as a stale blob at
  // a stale position. Zero it while nothing is rendering instead.
  useEffect(() => {
    if (!hoverEnabled) smoothedHover.current = 0;
  }, [hoverEnabled]);

  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const advance = useThree((state) => state.advance);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const dpr = useThree((state) => state.viewport.dpr);

  // Save geometry to the cache
  const { nodes } = useGLTF(modelUrl);

  const landscape = nodes.Landscape as THREE.Mesh;  
  const sourceGeometry = landscape.geometry;


  // Tiered by canvas width: a phone gets a coarser lattice than a desktop.
  const subdivisions = resolveSubdivisions(width);

  const pointsGeometry = useMemo(
    () => buildLandscapePoints(sourceGeometry, subdivisions),
    [sourceGeometry, subdivisions],
  );

  // A resize across a tier rebuilds the geometry; release the old buffers.
  useEffect(() => {
    return () => pointsGeometry.dispose();
  }, [pointsGeometry]);

  // Height is the term that matters: gl_PointSize is in device pixels, so without
  // this the points hold their absolute size while the frame shrinks around them.
  const pointSize = useMemo(
    () => resolveParticleSize(height, dpr, solveFov(width / height), subdivisions),
    [width, height, dpr, subdivisions],
  );

  // Warm-up while still off-screen: compile the material in parallel, then render
  // one frame so the EffectComposer allocates its targets and compiles its passes.
  // frameloop is "never" until the footer is in view, so this is the only frame
  // until then, and the first visible frame is a plain render.
  useEffect(() => {
    let cancelled = false;
    gl.compileAsync(scene, camera)
      .then(() => {
        if (!cancelled) advance(performance.now());
      })
      .catch(() => {
        // A failed parallel compile just means the first visible frame compiles.
      });
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, advance, pointsGeometry]);

  // Responsive lift values, interpolated between LIFT_STOPS by canvas width.
  useLayoutEffect(() => {
    applyLiftStops(width);
  }, [width]);

  useParticlesDevGui({
    materialRef,
    camera,
    width,
    height,
    dpr,
    pointCount: pointsGeometry.attributes.position.count,
  });

  // Animate
  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;

    material.uniforms.uTime.value = state.clock.elapsedTime;

    // debugLift lets the look be tuned from the dev GUI without scrolling.
    const raw = Math.max(lift.value, LIFT.debugLift);
    // Response curve: linear → smoothstep, so the onset is gentle rather than a
    // step on the first wheel tick. Applied to the tween on the way down too.
    const max = Math.max(LIFT.maxLift, 1e-3);
    const p = Math.min(raw / max, 1);
    const eased = p * p * (3 - 2 * p);
    const target = max * (p + (eased - p) * LIFT.riseCurve);
    // Frame-rate independent lerp, so the rise reads the same at 30 and 120 fps.
    smoothedLift.current +=
      (target - smoothedLift.current) * (1 - Math.exp(-LIFT.riseSmoothing * delta));
    const lifted = smoothedLift.current;

    material.uniforms.uLift.value = lifted;
    material.uniforms.uLiftGlow.value = (lifted / max) * LIFT.glow;
    material.uniforms.uLiftSize.value = (lifted / max) * LIFT.sizeScale;
    // Read live so the dev GUI sliders take effect without onChange plumbing.
    material.uniforms.uLiftCenter.value.set(LIFT.centerX, LIFT.centerY);
    material.uniforms.uLiftRadius.value.set(LIFT.radiusX, LIFT.radiusY);
    material.uniforms.uLiftPower.value = LIFT.power;
    material.uniforms.uLiftNear.value = LIFT.nearDistance;
    material.uniforms.uLiftFade.value = LIFT.nearFade;
    material.uniforms.uLiftVariance.value = LIFT.variance;
    material.uniforms.uLiftScatter.value = LIFT.scatter;
    material.uniforms.uEdgeFadeStart.value = LIFT.edgeFadeStart;
    material.uniforms.uIntensity.value = PARTICLES.intensity;

    // --- Pointer hover -----------------------------------------------------
    // Clamped because the warm-up advance() above passes a millisecond timestamp
    // into a zeroed seconds clock, so the first frame's delta is in the hundreds.
    const step = Math.min(delta, 0.1);
    const hoverK = 1 - Math.exp(-HOVER.smoothing * step);

    // debugHover holds the brush on at canvas centre for tuning without a mouse.
    const held = HOVER.debugHover > 0;
    let inside = false;

    if (held) {
      smoothedPointer.current.set(0, 0);
    } else if (hover.active) {
      // The canvas box, read per frame rather than cached on pointermove: a wheel
      // scroll moves the footer under a stationary cursor, and pointermove does
      // not fire for that. getBoundingClientRect is already viewport-relative, so
      // it composes with clientX/clientY with no scroll term — which is also what
      // keeps it correct under Lenis.
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const px = (hover.clientX - rect.left) / rect.width;
        const py = (hover.clientY - rect.top) / rect.height;
        inside = px >= 0 && px <= 1 && py >= 0 && py <= 1;
        if (inside) {
          // NDC y is +1 at the top, hence the flip: this is compared against
          // baseClip.xy / baseClip.w in the shader, not used as a raw tilt.
          const ndcX = px * 2 - 1;
          const ndcY = 1 - py * 2;
          // Jump rather than ease while the brush is still invisible, so it does
          // not sweep across the terrain to where the cursor actually entered.
          if (smoothedHover.current < 0.01) {
            smoothedPointer.current.set(ndcX, ndcY);
          } else {
            smoothedPointer.current.x += (ndcX - smoothedPointer.current.x) * hoverK;
            smoothedPointer.current.y += (ndcY - smoothedPointer.current.y) * hoverK;
          }
        }
      }
    }

    // Written every frame, never inside the branch above, so an exit always fades.
    const hoverTarget = held ? HOVER.debugHover : inside ? 1 : 0;
    smoothedHover.current += (hoverTarget - smoothedHover.current) * hoverK;

    // NDC spans 2.0 on both axes, so a brush of radius*height pixels is 2*radius
    // in y; x shrinks by the aspect to keep it a circle rather than an ellipse.
    const radiusY = 2 * HOVER.radius;
    material.uniforms.uPointer.value.copy(smoothedPointer.current);
    material.uniforms.uHoverRadius.value.set(radiusY * (height / Math.max(width, 1)), radiusY);
    material.uniforms.uHoverStrength.value = smoothedHover.current;
    material.uniforms.uHoverSize.value = HOVER.sizeScale;
    material.uniforms.uHoverPower.value = HOVER.power;
  });
  
  return (
    <>
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0} luminanceSmoothing={0.6} intensity={1} />
        <Noise opacity={0.3} blendFunction={BlendFunction.OVERLAY} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>

      <points geometry={pointsGeometry}>
        <particlesShader
          ref={materialRef}
          uTime={0}
          uSize={pointSize}
          uNoisePeriod={NOISE_DEFAULTS.noisePeriod}
          uNoiseStrength={NOISE_DEFAULTS.noiseStrength}
          uNoiseSpeed={NOISE_DEFAULTS.noiseSpeed}
          uIntensity={PARTICLES.intensity}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}
