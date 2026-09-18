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
  DRAG_SPIN,
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
 * the group rotation.
 *
 * One mutable object rather than state or a context — it changes on every touchmove,
 * and a render per touch event is precisely what must not happen here.
 */
type SwipeState = {
  /** Angular velocity injected ON TOP of MOBILE_SPIN.baseRate, rad/s. Signed. */
  velocity: number;
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
};

/**
 * Live mouse-drag state: the gesture in flight, the pose it has accumulated, and the
 * coast it will leave behind. A ref for the same reason SwipeState is one.
 *
 * `x`/`y` are offsets on MODEL_ROTATION, exactly as the tilt is — the two simply add,
 * so neither has a mode and neither has a discontinuity.
 */
type DragState = {
  /** True between pointerdown and pointerup/cancel. */
  active: boolean;
  /** The captured pointer, so a second device's moves are ignored. */
  pointerId: number;
  /** clientX/Y and timeStamp of the sample the next move is measured against. */
  lastX: number;
  lastY: number;
  lastTime: number;
  /** Accumulated rotation offsets, radians, wrapped at TAU. */
  x: number;
  y: number;
  /** Measured release velocity per axis, rad/s. Integrated only while !active. */
  vx: number;
  vy: number;
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
}: {
  geometry: THREE.BufferGeometry;
  pointSize: number;
  /** Bumping this restarts the twinkle-in from dark. */
  revealNonce: number;
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

    // Straight off NOISE, which the dev GUI mutates live. The spin used to add an
    // agitation boost on top of these; it was removed deliberately — a swipe stirring
    // the cloud read as the build coming apart rather than turning.
    uniforms.uNoiseStrength.value = NOISE.noiseStrength;
    uniforms.uNoisePeriod.value = NOISE.noisePeriod;
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
    axis: null,
    lastX: 0,
    lastY: 0,
  });
  // DEBUG readout of the axis lock and the turntable rate, bound by the dev GUI
  // below. A ref so the GUI effect can bind it without listing it as a dependency.
  const spinReadoutRef = useRef({ rate: 0, axis: "-" });
  const dragRef = useRef<DragState>({
    active: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  });
  // DEBUG readout of the accumulated drag pose, in degrees, bound by the dev GUI.
  const dragReadoutRef = useRef({ x: 0, y: 0 });

  const tier = tierForWidth(size.width);
  const densityScale = TIER_DENSITY_SCALE[tier];
  // Mirrored for the pointer listeners, which are installed once and must not churn
  // across the 768 boundary. Same shape as geometriesRef below.
  const tierRef = useRef(tier);
  useEffect(() => {
    tierRef.current = tier;
  }, [tier]);

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

      // Degrees on the panel, radians in the object — MOBILE_SPIN, MOUSE_ROTATION and
      // DRAG_SPIN all author their angles with deg() for exactly this reason, and a
      // rad/s slider is unreadable. One wrapper, shared by all three folders: `store`
      // holds the degrees the slider binds to, `target` is the radians the frame loop
      // and the listeners read live.
      const degreeRow = (
        folder: import("lil-gui").GUI,
        store: Record<string, number>,
        target: Record<string, number>,
        key: string,
        name: string,
        max: number,
        step = 1,
      ) =>
        folder
          .add(store, key, 0, max, step)
          .name(name)
          .onChange((value: number) => {
            target[key] = (value * Math.PI) / 180;
          });

      const toDegrees = (source: Record<string, number>, keys: string[]) =>
        Object.fromEntries(keys.map((k) => [k, (source[k] * 180) / Math.PI]));

      const spin = gui.addFolder("Mobile spin");
      const mobileSpin = MOBILE_SPIN as unknown as Record<string, number>;
      const spinDegrees = toDegrees(mobileSpin, [
        "baseRate",
        "swipeGain",
        "maxRate",
      ]);

      // 0.1 steps on the drift: at whole degrees the slider snaps the 10.4 resting rate
      // to an integer the first time it is touched, silently undoing the tuning.
      degreeRow(spin, spinDegrees, mobileSpin, "baseRate", "Base drift (°/s)", 180, 0.1);
      degreeRow(spin, spinDegrees, mobileSpin, "swipeGain", "Swipe gain (°/width)", 1080);
      degreeRow(spin, spinDegrees, mobileSpin, "maxRate", "Max rate (°/s)", 720);
      spin.add(MOBILE_SPIN, "decay", 0.1, 6, 0.05).name("Spin decay /s").listen();
      // The touch listener reads MOBILE_SPIN live, so the lock needs no plumbing.
      spin.add(MOBILE_SPIN, "axisLockPx", 2, 40, 1).name("Axis lock (px)").listen();
      spin.add(MOBILE_SPIN, "axisRatio", 0.5, 3, 0.05).name("Axis ratio (x:y)").listen();
      // Read-only: the only way to watch the lock decide on an actual phone.
      spin.add(spinReadoutRef.current, "rate").name("Rate (°/s)").listen().disable();
      spin.add(spinReadoutRef.current, "axis").name("Axis").listen().disable();

      // The desktop counterpart. Both objects are read live — the tilt inside useFrame,
      // the drag gains inside the pointer handlers — so nothing here needs plumbing
      // beyond the degree conversion.
      const desktop = gui.addFolder("Desktop rotation");
      const mouseRotation = MOUSE_ROTATION as unknown as Record<string, number>;
      const dragSpin = DRAG_SPIN as unknown as Record<string, number>;
      const tiltDegrees = toDegrees(mouseRotation, ["maxX", "maxY"]);
      const dragDegrees = toDegrees(dragSpin, [
        "gainPerWidth",
        "gainPerHeight",
        "maxRate",
      ]);

      degreeRow(desktop, tiltDegrees, mouseRotation, "maxX", "Tilt max X (°)", 180);
      degreeRow(desktop, tiltDegrees, mouseRotation, "maxY", "Tilt max Y (°)", 180);
      desktop
        .add(MOUSE_ROTATION, "smoothing", 0.5, 10, 0.1)
        .name("Tilt follow /s")
        .listen();
      degreeRow(desktop, dragDegrees, dragSpin, "gainPerWidth", "Drag gain X (°/width)", 1080);
      degreeRow(desktop, dragDegrees, dragSpin, "gainPerHeight", "Drag gain Y (°/height)", 1080);
      degreeRow(desktop, dragDegrees, dragSpin, "maxRate", "Max coast (°/s)", 720);
      desktop.add(DRAG_SPIN, "decay", 0.1, 6, 0.05).name("Coast decay /s").listen();
      desktop
        .add(DRAG_SPIN, "velocitySmoothing", 0.05, 1, 0.01)
        .name("Throw smoothing")
        .listen();
      // Read-only, the counterpart to the Mobile spin readouts above.
      desktop.add(dragReadoutRef.current, "x").name("Drag X (°)").listen().disable();
      desktop.add(dragReadoutRef.current, "y").name("Drag Y (°)").listen().disable();

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
    const clamp1 = (v: number) => Math.min(Math.max(v, -1), 1);

    const onMove = (e: PointerEvent) => {
      // Mouse only. On touch a tap would snap the cloud to wherever the finger landed.
      if (e.pointerType !== "mouse") return;
      // Clamped because a CAPTURED drag keeps reporting once the cursor leaves the
      // window, and an unclamped ratio would push the tilt past MOUSE_ROTATION.maxY.
      //
      // Deliberately NOT suppressed while a drag is live: the pose is MODEL_ROTATION +
      // drag + tilt on every frame, with no mode for either side to be in. Freezing
      // this mid-drag would remove the (small, ±40°) tilt term from the gesture, at the
      // cost of an 80° jump in the tilt target at the release — which then eases in on
      // top of the coast and reads as the build carrying on after the hand let go. If
      // the two ever do feel like they are fighting, the freeze is this one line:
      // `if (dragRef.current.active) return;`.
      pointerRef.current.x = clamp1((e.clientX / window.innerWidth) * 2 - 1);
      pointerRef.current.y = clamp1((e.clientY / window.innerHeight) * 2 - 1);
    };
    // Cursor off the page: ease back to the resting pose rather than freeze mid-tilt.
    const onLeave = () => {
      // Not mid-drag. Under pointer capture the gesture legitimately continues outside
      // the window, and easing to centre under the user's own hand is not "leaving".
      if (dragRef.current.active) return;
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

    const track = (touch: Touch) => {
      swipe.lastX = touch.clientX;
      swipe.lastY = touch.clientY;
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
      track(e.touches[0]);
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
        track(touch);
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
        // "x" falls through. lastX is still the touchstart sample, so this first
        // injection covers the whole deadzone distance — nothing the finger did before
        // the lock is thrown away.
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

      track(touch);
    };

    // Only the tracking stops. The velocity is left to the frame loop's decay, and
    // that coast is the whole feel of the flick.
    const onEnd = () => {
      swipe.axis = null;
    };

    // Passive, every one of them. The drag effect below registers NON-passive so it
    // can preventDefault; do not copy that registration onto these — a non-passive
    // touch listener here is what breaks vertical page scroll over the hero on iOS.
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

  // Mouse click-and-drag -> an accumulating turn on both axes, with an inertial coast.
  //
  // pointerdown on the CANVAS rather than window, so a press on the navbar (fixed,
  // z-100) is not a drag. The logo overlay is pointer-events-none and so is not a hit
  // target, which leaves the whole hero reading as one draggable surface.
  //
  // setPointerCapture, then every other listener on the canvas too. Capture is what
  // keeps the moves coming once the cursor crosses the navbar or leaves the window —
  // and, the part that actually matters, what guarantees the pointerup. A button
  // released outside the window without capture delivers that event nowhere at all,
  // and the build would stay stuck in "grabbed" forever.
  //
  // Mouse only, for the same reason the tilt listener is: a touch already drives the
  // axis-locked swipe above, and letting it drive this too would turn the build twice
  // per gesture and bypass the axis lock entirely.
  useEffect(() => {
    const canvas = gl.domElement;
    const drag = dragRef.current;
    const clampRate = (v: number) =>
      Math.min(Math.max(v, -DRAG_SPIN.maxRate), DRAG_SPIN.maxRate);

    const endDrag = () => {
      if (!drag.active) return;
      drag.active = false;
      drag.pointerId = -1;
      // vx/vy are deliberately left alone — that coast IS the throw.
      //
      // Cleared rather than set back to "grab": the resting cursor lives on
      // HeroCanvas's wrapper, and the canvas inherits it the moment this override goes.
      canvas.style.cursor = "";
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || !e.isPrimary) return;
      // Below 768 the turntable owns the build. Only the gesture START is gated; the
      // listener itself is installed once, so a phone rotating across the breakpoint
      // does not churn it.
      if (tierRef.current === "mobile") return;

      // Text selection and the native drag-image. This listener is registered
      // NON-passive for exactly this line — see the touch listeners above, which must
      // stay passive.
      e.preventDefault();

      drag.active = true;
      drag.pointerId = e.pointerId;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastTime = e.timeStamp;
      // Catching a coasting build stops it dead, with nothing to clear here: the frame
      // loop integrates vx/vy only while !active, and the residue decays under the held
      // button until a move re-injects it.
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const onMove = (e: PointerEvent) => {
      if (!drag.active || e.pointerId !== drag.pointerId) return;
      // A release the page never saw: an alert, a devtools break, a drop outside.
      if (e.buttons === 0) return endDrag();

      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      // Per screen width/height rather than per pixel, so a drag means the same thing
      // on a 1280 laptop and a 4K display — MOBILE_SPIN.swipeGain's argument. Signed,
      // and in the same sense as the tilt: drag right turns +y, drag down turns +x.
      const stepY = ((e.clientX - drag.lastX) / width) * DRAG_SPIN.gainPerWidth;
      const stepX = ((e.clientY - drag.lastY) / height) * DRAG_SPIN.gainPerHeight;
      drag.x += stepX;
      drag.y += stepY;

      // Measured alongside, only for the throw. The deltas above went STRAIGHT onto the
      // pose rather than being injected as a velocity the way the mobile swipe is: a
      // swipe is a shove at a flywheel, a drag is a hand on the model, and a hand does
      // not lag.
      //
      // dt floored at 1/240 s, exactly as the swipe's speed was — two samples inside
      // one millisecond divide out to an absurd speed. No ceiling, for the same reason:
      // capping dt on a stalled sample would INFLATE the speed it reports.
      const dt = Math.max((e.timeStamp - drag.lastTime) / 1000, 1 / 240);
      const blend = DRAG_SPIN.velocitySmoothing;
      drag.vx = clampRate(drag.vx + (stepX / dt - drag.vx) * blend);
      drag.vy = clampRate(drag.vy + (stepY / dt - drag.vy) * blend);

      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastTime = e.timeStamp;
    };

    // No options object: preventDefault in onDown needs these non-passive.
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("lostpointercapture", endDrag);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("lostpointercapture", endDrag);
      // Or a fast refresh mid-drag leaves the canvas grabbed forever.
      drag.active = false;
      drag.pointerId = -1;
      canvas.style.cursor = "";
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
    // Also the ceiling on what a coast frozen off-screen can do when the hero scrolls
    // back in: frameloop drops to "never" out of view, so delta arrives as one large
    // gap, and this caps it at 0.1 s of motion before the decay below takes over.
    const step = Math.min(delta, 0.1);
    const swipe = swipeRef.current;
    const drag = dragRef.current;

    // Decayed on BOTH branches: a touch laptop above 768 still fires the swipe
    // listeners, and a velocity left undecayed there would lurch on the next resize
    // down.
    swipe.velocity *= Math.exp(-MOBILE_SPIN.decay * step);

    // Decayed on both branches AND while the button is held, all for one reason: this
    // is a measurement of what the hand is doing, so a hand that stops doing it must
    // stop measuring. A drag that stops dead and then releases therefore throws nothing.
    const coast = Math.exp(-DRAG_SPIN.decay * step);
    drag.vx *= coast;
    drag.vy *= coast;

    if (DEBUG) {
      const readout = spinReadoutRef.current;
      // Degrees, as the panel's sliders are; the turntable rate the mobile branch
      // applies, whichever branch is live.
      readout.rate = Math.round(
        ((MOBILE_SPIN.baseRate + swipe.velocity) * 180) / Math.PI,
      );
      readout.axis = swipe.axis ?? "-";
      dragReadoutRef.current.x = Math.round((drag.x * 180) / Math.PI);
      dragReadoutRef.current.y = Math.round((drag.y * 180) / Math.PI);
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
      // tilt the cursor never set — and, same argument, rather than snapping into a
      // drag pose it never set either. A drag cannot START below 768, but one can be
      // COASTING when the window crosses the boundary.
      tiltRef.current.x = 0;
      tiltRef.current.y = 0;
      drag.x = 0;
      drag.y = 0;
      drag.vx = 0;
      drag.vy = 0;
      return;
    }

    // Only once the button is up. While it is down the move handler is already putting
    // the cursor's deltas onto x/y, and integrating the velocity it measured from those
    // same deltas on top would simply double them.
    if (!drag.active) {
      drag.x = (drag.x + drag.vx * step) % TAU;
      drag.y = (drag.y + drag.vy * step) % TAU;
    }

    // Frame-rate-independent ease, the same idiom as the lift smoothing in
    // ParticlesScene.
    const k = 1 - Math.exp(-MOUSE_ROTATION.smoothing * step);
    const { x: pointerX, y: pointerY } = pointerRef.current;
    tiltRef.current.x += (pointerY * MOUSE_ROTATION.maxX - tiltRef.current.x) * k;
    tiltRef.current.y += (pointerX * MOUSE_ROTATION.maxY - tiltRef.current.y) * k;

    // Both are offsets on the resting pose, never a replacement for it: MODEL_ROTATION
    // is where the build loads, drag is where it has been turned to, tilt is the lean
    // toward the cursor. On frame 1 both offsets are 0, so the build loads face first.
    group.rotation.x = MODEL_ROTATION[0] + drag.x + tiltRef.current.x;
    group.rotation.y = MODEL_ROTATION[1] + drag.y + tiltRef.current.y;
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
              />
            ),
          )}
      {baseGeometry ? (
        <HeroCloud
          geometry={baseGeometry}
          pointSize={pointSize}
          revealNonce={revealNonce}
        />
      ) : null}
    </group>
  );
}
