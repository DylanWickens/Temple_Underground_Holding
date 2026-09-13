"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { extend, useFrame, useThree, type ThreeElement } from "@react-three/fiber";
import { shaderMaterial, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import vertexShader from "./shaders/vert.glsl";
import fragmentShader from "./shaders/frag.glsl";
import {
  buildBaseVertexGeometry,
  prepareHeroModel,
  sampleHeroObject,
} from "./prepareHeroGeometry";
import {
  DENSITY_RANGE,
  HERO_TUNING,
  MESH_VERTICES_ALL,
  MESH_VERTICES_OFF,
  MOBILE_SPIN,
  MODEL_ROTATION,
  MODEL_URL,
  MOUSE_ROTATION,
  NOISE,
  OBJECT_DENSITIES,
  PARTICLE_SIZE,
  REVEAL,
  SHOW_HERO_DEV_GUI,
  solveLift,
  TIER_DENSITY_SCALE,
} from "./heroSceneDefaults";
import { tierForWidth } from "../EquipmentScene/equipmentSceneDefaults";
import {
  DEV_GUI_ORDER,
  registerDevGui,
  unregisterDevGui,
} from "../shared/devGui/devGuiStack";

const DEBUG = process.env.NODE_ENV === "development";

// extend() writes into a GLOBAL catalogue, so this key has to stay unique across the
// app. Taken so far: particlesShader, equipmentParticlesShader, particlesMaterial.
const HeroParticlesShader = shaderMaterial(
  {
    uTime: 0,
    uSize: 10,
    uNoisePeriod: NOISE.noisePeriod,
    uNoiseSpeed: NOISE.noiseSpeed,
    uNoiseStrength: NOISE.noiseStrength,
    uReveal: 0,
    uRevealDuration: REVEAL.duration,
    uRevealTwinkle: REVEAL.twinkle,
    uRevealFlash: REVEAL.flash,
  },
  vertexShader,
  fragmentShader,
);

// A frame longer than this advances the reveal by only this much, so a compile or
// target-allocation stall pauses the twinkle rather than jumping past most of it.
const MAX_REVEAL_STEP = 1 / 30;

const TAU = Math.PI * 2;

/**
 * Which owner a single-finger drag resolved to. Decided once per gesture, on the
 * first move that leaves MOBILE_SPIN.axisLockPx of the touchstart, never revisited.
 */
type SwipeAxis = "pending" | "x" | "y";

/**
 * Live swipe state: written by the touch listeners, decayed by the frame loop, read by
 * both the group rotation and every cloud's noise uniforms.
 *
 * One mutable object rather than state or a context — it changes on every touchmove,
 * and a render per touch event is precisely what must not happen here.
 */
type SwipeState = {
  /** Angular velocity injected ON TOP of MOBILE_SPIN.baseRate, rad/s. Signed. */
  velocity: number;
  /** 0..1 agitation driving the noise boost. Unsigned: a flick either way stirs it. */
  intensity: number;
  /**
   * The axis lock for the live drag, or null when no single-finger drag is live.
   * "pending": still inside the deadzone, undecided. "x": the canvas's — every move
   * injects spin. "y": the browser's page scroll — every move is ignored until the
   * finger lifts.
   */
  axis: SwipeAxis | null;
  /** clientX/Y of the sample the next move is measured against. Meaningful only while axis is non-null. */
  lastX: number;
  lastY: number;
  /** timeStamp of that sample, for the flick speed. */
  lastTime: number;
};

extend({ HeroParticlesShader });

declare module "@react-three/fiber" {
  interface ThreeElements {
    heroParticlesShader: ThreeElement<typeof HeroParticlesShader>;
  }
}

// One per object in the build. The sketch shared a single material across all ten;
// here each owns its own so the uniforms can be plain JSX props and be driven through
// a ref — mutating a memoised or state-held material trips react-hooks/immutability.
// Same shader source, so three still compiles one program.
function HeroCloud({
  geometry,
  pointSize,
  revealNonce,
  swipe,
}: {
  geometry: THREE.BufferGeometry;
  pointSize: number;
  /** Bumping this restarts the twinkle-in from dark. */
  revealNonce: number;
  /**
   * The ref itself rather than its contents, so nothing reads `.current` during
   * render — it is unwrapped inside useFrame below.
   */
  swipe: { current: SwipeState };
}) {
  const materialRef = useRef<InstanceType<typeof HeroParticlesShader>>(null);

  // Seconds of drawn frames since this cloud (or its latest re-sample) appeared. A ref,
  // not state: it moves every frame.
  const revealRef = useRef(0);
  useEffect(() => {
    revealRef.current = 0;
  }, [geometry, revealNonce]);

  // Uniforms are driven here so the dev GUI's mutations land without a re-render.
  useFrame((state, delta) => {
    const uniforms = materialRef.current?.uniforms;
    if (!uniforms) return;
    revealRef.current += Math.min(delta, MAX_REVEAL_STEP);
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uSize.value = pointSize * HERO_TUNING.pointSizeMultiplier;
    uniforms.uNoiseSpeed.value = NOISE.noiseSpeed;

    // The swipe boost is ADDED to the NOISE values rather than replacing them, the
    // same relationship PostProcessing has with POST: the dev GUI sliders hold the
    // base look and the gesture is derived from them, so the two never fight. Writing
    // the gesture into NOISE itself would make the panel twitch as a swipe decayed.
    //
    // Read straight off the shared object here rather than being handed a number by
    // the parent. Children mount first in R3F, so this useFrame runs BEFORE the
    // parent's — a value the parent computed would arrive a frame late. On desktop
    // intensity is never raised at all, so these stay bit-identical to the base.
    const { intensity } = swipe.current;
    uniforms.uNoiseStrength.value =
      NOISE.noiseStrength + MOBILE_SPIN.noiseStrengthBoost * intensity;
    uniforms.uNoisePeriod.value =
      NOISE.noisePeriod + MOBILE_SPIN.noisePeriodBoost * intensity;
    uniforms.uReveal.value = revealRef.current;
    uniforms.uRevealDuration.value = REVEAL.duration;
    uniforms.uRevealTwinkle.value = REVEAL.twinkle;
    uniforms.uRevealFlash.value = REVEAL.flash;
  });

  return (
    <points geometry={geometry}>
      {/* `transparent` is deliberately unset, as in the sketch: additive blending
          still composites, and the points render in the opaque pass. */}
      <heroParticlesShader
        ref={materialRef}
        uTime={0}
        uSize={pointSize}
        uNoisePeriod={NOISE.noisePeriod}
        uNoiseSpeed={NOISE.noiseSpeed}
        uNoiseStrength={NOISE.noiseStrength}
        uReveal={0}
        uRevealDuration={REVEAL.duration}
        uRevealTwinkle={REVEAL.twinkle}
        uRevealFlash={REVEAL.flash}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function HeroParticles() {
  const { scene: modelScene } = useGLTF(MODEL_URL);
  const { viewport, size, gl, scene, camera, advance } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  // Cursor position in the window, -1..1 on each axis and 0 at the centre, plus the
  // smoothed tilt derived from it. Refs, not state: a pointer move must not render.
  const pointerRef = useRef({ x: 0, y: 0 });
  const tiltRef = useRef({ x: 0, y: 0 });

  // Accumulated spin, in radians, offset from MODEL_ROTATION's resting pose.
  const spinRef = useRef(0);
  // A ref, not state: this is mutated on every touchmove and every frame, and
  // react-hooks/immutability rightly refuses that on a useState value.
  const swipeRef = useRef<SwipeState>({
    velocity: 0,
    intensity: 0,
    axis: null,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
  });
  // DEBUG readout of the axis lock and the turntable rate, bound by the dev GUI
  // below. A ref so the GUI effect can bind it without listing it as a dependency.
  const spinReadoutRef = useRef({ rate: 0, axis: "-" });

  const densityScale = TIER_DENSITY_SCALE[tierForWidth(size.width)];

  // The costly half — one MeshSurfaceSampler per mesh. Never redone for a density.
  const model = useMemo(() => prepareHeroModel(modelScene), [modelScene]);

  // Bumped by the density sliders and by Regenerate, to force a re-sample.
  const [rebuildNonce, setRebuildNonce] = useState(0);
  const [meshVerticesIndex, setMeshVerticesIndex] = useState(
    HERO_TUNING.meshVerticesIndex,
  );
  const [hidePointCloud, setHidePointCloud] = useState(HERO_TUNING.hidePointCloud);
  // Bumped by the dev GUI's Replay, so the twinkle-in can be watched again.
  const [revealNonce, setRevealNonce] = useState(0);

  // The cheap half. HERO_TUNING.seed is read here rather than being a dep, so
  // Regenerate advances it and bumps the nonce together.
  const geometries = useMemo(
    () =>
      model.objects.map((object, i) =>
        sampleHeroObject(
          object,
          model.transform,
          (OBJECT_DENSITIES[i] ?? 750) * densityScale,
          // Per-object stream, so moving one slider leaves its neighbours alone.
          HERO_TUNING.seed + i * 0x9e3779b1,
        ),
      ),
    // rebuildNonce is the re-sample trigger itself — the GUI mutates OBJECT_DENSITIES
    // and HERO_TUNING.seed in place, so nothing else here would change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, densityScale, rebuildNonce],
  );

  useEffect(() => {
    return () => geometries.forEach((geometry) => geometry.dispose());
  }, [geometries]);

  // The raw mesh vertices for one object, or the whole build, or nothing.
  const baseGeometry = useMemo(() => {
    if (meshVerticesIndex === MESH_VERTICES_OFF) return null;

    const vertices =
      meshVerticesIndex === MESH_VERTICES_ALL
        ? model.baseVertices
        : model.objects[meshVerticesIndex]?.vertices;

    return vertices ? buildBaseVertexGeometry(vertices, HERO_TUNING.seed) : null;
  }, [model, meshVerticesIndex]);

  useEffect(() => {
    return () => baseGeometry?.dispose();
  }, [baseGeometry]);

  // uSize = 10 * dpr, exactly as main.js:343 — no viewport term.
  const pointSize = PARTICLE_SIZE * viewport.dpr;

  // Warm-up: compile in parallel, then render one frame so the composer's targets are
  // allocated and its passes compiled before the scene is first shown.
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
  }, [gl, scene, camera, advance, geometries]);

  // ---------------------------------------------------------------------------
  // DEBUG — the sketch's Point Generators and Noise folders. lil-gui is imported
  // inside the effect so it never enters the production bundle.
  // ---------------------------------------------------------------------------

  // Read by the Total points readout without making it a GUI dependency.
  const geometriesRef = useRef(geometries);
  useEffect(() => {
    geometriesRef.current = geometries;
  }, [geometries]);

  useEffect(() => {
    if (!DEBUG || !SHOW_HERO_DEV_GUI) return;

    let gui: import("lil-gui").GUI | undefined;
    let cancelled = false;

    import("lil-gui").then(({ GUI }) => {
      if (cancelled) return;
      gui = new GUI({ title: "Hero — Cloud" });
      registerDevGui(gui, DEV_GUI_ORDER.heroCloud);

      const readout = { totalPoints: 0 };
      const refreshTotal = () => {
        // A frame late by design: the re-sample happens in the render that the
        // setState below schedules.
        requestAnimationFrame(() => {
          readout.totalPoints = geometriesRef.current.reduce(
            (sum, geometry) => sum + geometry.attributes.position.count,
            0,
          );
          totalController?.updateDisplay();
        });
      };

      const regenerate = () => {
        setRebuildNonce((n) => n + 1);
        refreshTotal();
      };

      // Off / the whole build / any single object, so one part can be inspected on
      // its own rather than lost in the other nine.
      const meshVertexOptions: Record<string, number> = {
        Off: MESH_VERTICES_OFF,
        "All objects": MESH_VERTICES_ALL,
      };
      model.objects.forEach((object, i) => {
        meshVertexOptions[object.label] = i;
      });

      gui
        .add(HERO_TUNING, "meshVerticesIndex", meshVertexOptions)
        .name("Mesh vertices")
        .onChange((value: number) => setMeshVerticesIndex(Number(value)))
        .listen();
      gui
        .add(HERO_TUNING, "hidePointCloud")
        .name("Hide sampled cloud")
        .onChange((value: boolean) => setHidePointCloud(value))
        .listen();

      // Labels and areas depend only on the glTF, so this folder is built once and
      // never torn down underneath a slider being dragged.
      const generators = gui.addFolder("Point Generators");

      // lil-gui binds object[key]; an array indexes fine at runtime, but its keyof
      // type does not admit numeric strings, hence the cast.
      const densities = OBJECT_DENSITIES as unknown as Record<string, number>;

      model.objects.forEach((object, i) => {
        generators
          .add(densities, `${i}`, DENSITY_RANGE.min, DENSITY_RANGE.max, DENSITY_RANGE.step)
          .name(`${object.label} (${object.area.toFixed(1)} m²)`)
          // On release, not during the drag: a re-sample redoes every object, which
          // is fine once but not sixty times a second.
          .onFinishChange(regenerate)
          .listen();
      });

      const all = { density: OBJECT_DENSITIES[0] ?? 750 };
      generators
        .add(all, "density", DENSITY_RANGE.min, DENSITY_RANGE.max, DENSITY_RANGE.step)
        .name("All densities")
        .onFinishChange((value: number) => {
          OBJECT_DENSITIES.fill(value);
          regenerate();
        });

      generators
        .add(
          {
            run: () => {
              // Advance the seed: re-sampling on the same seed would hand back an
              // identical cloud.
              HERO_TUNING.seed = (HERO_TUNING.seed + 0x6d2b79f5) | 0;
              regenerate();
            },
          },
          "run",
        )
        .name("Regenerate");

      const totalController = generators
        .add(readout, "totalPoints")
        .name("Total points")
        .disable();
      refreshTotal();

      const noise = gui.addFolder("Noise");
      // Uniforms are read live in useFrame, so these need no onChange plumbing.
      noise.add(NOISE, "noiseStrength", 0, 0.15, 0.001).name("Strength").listen();
      noise.add(NOISE, "noiseSpeed", 0, 2, 0.01).name("Speed").listen();
      // The sketch's naming quirk, kept: "Frequency" drives what the uniform calls
      // uNoisePeriod. Three names, one number.
      noise.add(NOISE, "noisePeriod", 0.5, 15, 0.1).name("Frequency").listen();

      // Degrees on the panel, radians in the object — MOBILE_SPIN authors its rates
      // with deg() for exactly this reason, and a rad/s slider is unreadable.
      const spin = gui.addFolder("Mobile spin");
      const spinDegrees = {
        baseRate: (MOBILE_SPIN.baseRate * 180) / Math.PI,
        swipeGain: (MOBILE_SPIN.swipeGain * 180) / Math.PI,
        maxRate: (MOBILE_SPIN.maxRate * 180) / Math.PI,
      };
      const rate = (key: keyof typeof spinDegrees, name: string, max: number) =>
        spin
          .add(spinDegrees, key, 0, max, 1)
          .name(name)
          .onChange((value: number) => {
            MOBILE_SPIN[key] = (value * Math.PI) / 180;
          });

      rate("baseRate", "Base drift (°/s)", 180);
      rate("swipeGain", "Swipe gain (°/width)", 1080);
      rate("maxRate", "Max rate (°/s)", 720);
      spin.add(MOBILE_SPIN, "decay", 0.1, 6, 0.05).name("Spin decay /s").listen();
      spin.add(MOBILE_SPIN, "flickSpeed", 0.5, 10, 0.1).name("Flick speed").listen();
      spin
        .add(MOBILE_SPIN, "noiseStrengthBoost", 0, 0.2, 0.001)
        .name("Noise boost")
        .listen();
      spin
        .add(MOBILE_SPIN, "noisePeriodBoost", 0, 6, 0.1)
        .name("Frequency boost")
        .listen();
      spin.add(MOBILE_SPIN, "noiseDecay", 0.2, 8, 0.05).name("Noise decay /s").listen();
      // The touch listener reads MOBILE_SPIN live, so the lock needs no plumbing.
      spin.add(MOBILE_SPIN, "axisLockPx", 2, 40, 1).name("Axis lock (px)").listen();
      spin.add(MOBILE_SPIN, "axisRatio", 0.5, 3, 0.05).name("Axis ratio (x:y)").listen();
      // Read-only: the only way to watch the lock decide on an actual phone.
      spin.add(spinReadoutRef.current, "rate").name("Rate (°/s)").listen().disable();
      spin.add(spinReadoutRef.current, "axis").name("Axis").listen().disable();

      const reveal = gui.addFolder("Reveal");
      reveal.add(REVEAL, "duration", 0, 6, 0.05).name("Duration (s)").listen();
      reveal.add(REVEAL, "twinkle", 0.05, 2, 0.01).name("Twinkle (s)").listen();
      reveal.add(REVEAL, "flash", 0, 4, 0.05).name("Flash").listen();
      reveal
        .add({ run: () => setRevealNonce((n) => n + 1) }, "run")
        .name("Replay");
    });

    return () => {
      cancelled = true;
      if (gui) {
        unregisterDevGui(gui);
        gui.destroy();
      }
    };
  }, [model]);

  // A window listener rather than R3F's state.pointer: the canvas sits under the
  // pointer-events-none logo overlay and the navbar, so it does not see every move —
  // and state.pointer has no notion of the cursor leaving the page at all. Same shape
  // as the scroll gesture in ParticlesScene: a listener mutates a stable object, the
  // frame loop reads it.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Mouse only. On touch a tap would snap the cloud to wherever the finger landed.
      if (e.pointerType !== "mouse") return;
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    // Cursor off the page: ease back to the resting pose rather than freeze mid-tilt.
    const onLeave = () => {
      pointerRef.current.x = 0;
      pointerRef.current.y = 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // Horizontal swipe -> spin; vertical swipe -> the page scrolls and the cloud ignores
  // it. Touch events rather than pointer events: the axis decision below is OURS, and
  // it must not hang on when (or whether) an engine fires pointercancel once it takes
  // a gesture as a scroll. touchmove keeps reporting on both engines while the browser
  // scrolls, and the "y" lock is what makes that harmless. touches.length also gives
  // multi-touch for free.
  //
  // Every listener is passive and nothing calls preventDefault. The other half of the
  // split is CSS: HeroCanvas's wrapper carries touch-action: pan-y, so the browser
  // claims only vertical pans over the hero and leaves horizontal ones to the canvas.
  //
  // On the canvas, not window: a swipe on About or the navbar used to spin a hero that
  // was not even rendering, and the velocity sat undecayed (frameloop "never") until
  // the hero scrolled back into view. Touch events keep targeting the element the
  // touch began on, so a finger that drifts off the hero keeps reporting.
  //
  // Installed unconditionally rather than gated on the mobile width: the frame loop
  // decides whether the state is used, and this way a phone rotating across 768 does
  // not churn its listeners. Nothing accumulates unread — the frame loop decays this
  // state on every branch.
  useEffect(() => {
    const swipe = swipeRef.current;
    // Captured once so the cleanup removes from the same element it added to.
    const canvas = gl.domElement;

    const track = (touch: Touch, time: number) => {
      swipe.lastX = touch.clientX;
      swipe.lastY = touch.clientY;
      swipe.lastTime = time;
    };

    const onStart = (e: TouchEvent) => {
      // Multi-touch is someone pinching or two-finger scrolling, not swiping.
      if (e.touches.length !== 1) {
        swipe.axis = null;
        return;
      }
      // The velocity already in flight is deliberately NOT cleared: catching a
      // coasting build and pushing it again should add to it.
      swipe.axis = "pending";
      track(e.touches[0], e.timeStamp);
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        swipe.axis = null;
        return;
      }
      // The browser's gesture. Nothing until the finger lifts, however it wanders.
      if (swipe.axis === "y") return;

      const touch = e.touches[0];
      // A finger lifted mid-pinch and one remains: a fresh gesture from here.
      if (swipe.axis === null) {
        swipe.axis = "pending";
        track(touch, e.timeStamp);
        return;
      }

      if (swipe.axis === "pending") {
        // Measured from the touchstart sample, which is deliberately NOT advanced
        // while pending: the decision is made on total displacement, not on the
        // jitter of whichever move happened to cross the radius.
        const dx = touch.clientX - swipe.lastX;
        const dy = touch.clientY - swipe.lastY;
        const radius = MOBILE_SPIN.axisLockPx;
        if (dx * dx + dy * dy < radius * radius) return;

        swipe.axis =
          Math.abs(dx) > Math.abs(dy) * MOBILE_SPIN.axisRatio ? "x" : "y";
        if (swipe.axis === "y") return;
        // "x" falls through. lastX/lastTime are still the touchstart sample, so this
        // first injection covers the whole deadzone distance and time — nothing the
        // finger did before the lock is thrown away.
      }

      const width = window.innerWidth || 1;
      // Screen widths dragged since the last sample. Signed: this is what makes the
      // spin directional and lets a swipe against the drift reverse it.
      const widths = (touch.clientX - swipe.lastX) / width;

      // Clamped so the TOTAL rate stays inside maxRate once baseRate is added.
      const injected = swipe.velocity + widths * MOBILE_SPIN.swipeGain;
      swipe.velocity = Math.min(
        Math.max(injected, -MOBILE_SPIN.maxRate - MOBILE_SPIN.baseRate),
        MOBILE_SPIN.maxRate - MOBILE_SPIN.baseRate,
      );

      // Agitation tracks the PEAK speed of the gesture rather than accumulating, so a
      // long slow drag stirs the cloud far less than a flick of the same distance.
      //
      // Floored only, at 1/240 s: two samples inside the same millisecond would
      // otherwise divide out to an enormous speed. There is deliberately no ceiling —
      // capping dt on a stalled sample would INFLATE the speed it reports, which is
      // the opposite of what a stall means.
      const dt = Math.max((e.timeStamp - swipe.lastTime) / 1000, 1 / 240);
      const speed = Math.abs(widths) / dt;
      swipe.intensity = Math.min(
        1,
        Math.max(swipe.intensity, speed / MOBILE_SPIN.flickSpeed),
      );

      track(touch, e.timeStamp);
    };

    // Only the tracking stops. The velocity is left to the frame loop's decay, and
    // that coast is the whole feel of the flick.
    const onEnd = () => {
      swipe.axis = null;
    };

    canvas.addEventListener("touchstart", onStart, { passive: true });
    canvas.addEventListener("touchmove", onMove, { passive: true });
    canvas.addEventListener("touchend", onEnd, { passive: true });
    canvas.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      canvas.removeEventListener("touchstart", onStart);
      canvas.removeEventListener("touchmove", onMove);
      canvas.removeEventListener("touchend", onEnd);
      canvas.removeEventListener("touchcancel", onEnd);
    };
  }, [gl]);

  // Composition is a ratio of the visible frame, not a world constant, so it holds
  // at any canvas size. Driven from useFrame so the dev GUI slider lands live.
  //
  // Safe to do on the group — position and rotation both: the vertex shader samples
  // noise off the `position` ATTRIBUTE, which modelMatrix never touches. The cloud is
  // centred, so it leans in place at whatever height the lift put it.
  useFrame(({ size: frame }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    group.position.y = viewport.height * solveLift(frame.width);

    // delta is capped so a stall — bloom allocating its render targets, a tab coming
    // back — eases rather than snapping in one frame.
    const step = Math.min(delta, 0.1);
    const swipe = swipeRef.current;

    // Decayed on BOTH branches. A touch laptop above 768 still fires the swipe
    // listeners, and an intensity left undecayed there would strand the noise boost
    // on permanently; a velocity left undecayed would lurch on the next resize down.
    swipe.velocity *= Math.exp(-MOBILE_SPIN.decay * step);
    swipe.intensity *= Math.exp(-MOBILE_SPIN.noiseDecay * step);

    if (DEBUG) {
      const readout = spinReadoutRef.current;
      // Degrees, as the panel's sliders are; the turntable rate the mobile branch
      // applies, whichever branch is live.
      readout.rate = Math.round(
        ((MOBILE_SPIN.baseRate + swipe.velocity) * 180) / Math.PI,
      );
      readout.axis = swipe.axis ?? "-";
    }

    if (tierForWidth(frame.width) === "mobile") {
      // Turntable. The injected velocity decays to ZERO, not to baseRate, so the rate
      // is the sum below — which a hard swipe against the drift takes negative, and
      // the build reverses for a moment before settling back. No separate case for it.
      spinRef.current =
        (spinRef.current + (MOBILE_SPIN.baseRate + swipe.velocity) * step) % TAU;

      // Assigned, not merely left alone: a resize down from the desktop band must not
      // strand the tilt it was holding. Vertical gestures reach nothing here.
      group.rotation.x = MODEL_ROTATION[0];
      group.rotation.y = MODEL_ROTATION[1] + spinRef.current;
      group.rotation.z = MODEL_ROTATION[2];

      // So a resize back up starts from the resting pose rather than easing out of a
      // tilt the cursor never set.
      tiltRef.current.x = 0;
      tiltRef.current.y = 0;
      return;
    }

    // Frame-rate-independent ease, the same idiom as the lift smoothing in
    // ParticlesScene.
    const k = 1 - Math.exp(-MOUSE_ROTATION.smoothing * step);
    const { x: pointerX, y: pointerY } = pointerRef.current;
    tiltRef.current.x += (pointerY * MOUSE_ROTATION.maxX - tiltRef.current.x) * k;
    tiltRef.current.y += (pointerX * MOUSE_ROTATION.maxY - tiltRef.current.y) * k;

    // Tilt is an offset on the resting pose, not the pose itself.
    group.rotation.x = MODEL_ROTATION[0] + tiltRef.current.x;
    group.rotation.y = MODEL_ROTATION[1] + tiltRef.current.y;
    group.rotation.z = MODEL_ROTATION[2];
    spinRef.current = 0;
  });

  return (
    <group ref={groupRef}>
      {hidePointCloud
        ? null
        : geometries.map((geometry, i) =>
            // A density of 0 yields an empty buffer; skip it rather than spend a
            // draw call drawing nothing.
            geometry.attributes.position.count === 0 ? null : (
              <HeroCloud
                key={model.objects[i].label}
                geometry={geometry}
                pointSize={pointSize}
                revealNonce={revealNonce}
                swipe={swipeRef}
              />
            ),
          )}
      {baseGeometry ? (
        <HeroCloud
          geometry={baseGeometry}
          pointSize={pointSize}
          revealNonce={revealNonce}
          swipe={swipeRef}
        />
      ) : null}
    </group>
  );
}
