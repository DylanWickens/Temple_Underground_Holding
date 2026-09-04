"use client";

import { useCallback, useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  CAMERA_Z_STOPS,
  LIFT_STOPS,
  HERO_TUNING,
  NOISE,
  OBJECT_DENSITIES,
  POST,
  POST_SCALE_STOPS,
  SHOW_HERO_DEV_GUI,
  resolvePostScale,
  solveCameraZ,
  type PostScale,
} from "./heroSceneDefaults";
import {
  DEV_GUI_ORDER,
  registerDevGui,
  unregisterDevGui,
} from "../shared/devGui/devGuiStack";

const DEBUG = process.env.NODE_ENV === "development";

type FilmPassUniforms = {
  intensity: { value: number };
  grayscale: { value: boolean };
};

export default function PostProcessing() {
  const { gl, scene, camera, size, viewport } = useThree();

  const composerRef = useRef<EffectComposer | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const filmRef = useRef<FilmPass | null>(null);

  // Per-parameter multipliers for the current canvas width. Read in useFrame, so a ref.
  const postScaleRef = useRef<PostScale>(resolvePostScale(size.width));
  // The GUI closure needs the live canvas width without size.width becoming one of its
  // dependencies — that would tear down and rebuild the whole panel on every resize.
  const widthRef = useRef(size.width);
  // Lets the resize path refresh the dev panel's readouts, which is the whole point of
  // them: the curve is tuned by resizing the window and watching where it lands.
  const refreshReadoutRef = useRef<(() => void) | null>(null);

  // Rebuilt only when the pass chain itself changes — never on resize, which would
  // reallocate every render target mid-drag.
  useEffect(() => {
    const composer = new EffectComposer(gl);

    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      POST.bloomStrength,
      POST.bloomRadius,
      POST.bloomThreshold,
    );
    composer.addPass(bloomPass);
    bloomRef.current = bloomPass;

    // Grain is per DEVICE pixel and the sketch applied no dpr compensation, so this
    // is left uncompensated to match it.
    const filmPass = new FilmPass(POST.filmIntensity, POST.filmGrayscale);
    composer.addPass(filmPass);
    filmRef.current = filmPass;

    // Last, so bloom and grain run in linear HDR and the ACES curve is applied once,
    // here, at the end. Three skips tone mapping when rendering into a render target,
    // and the points use a raw ShaderMaterial with no tonemapping include anyway.
    composer.addPass(new OutputPass());

    // setPixelRatio internally re-runs setSize with the stored dimensions, so it has
    // to come first or the size is immediately overwritten by a stale one.
    composer.setPixelRatio(viewport.dpr);
    composer.setSize(size.width, size.height);

    composerRef.current = composer;

    return () => {
      composer.dispose();
      composerRef.current = null;
      bloomRef.current = null;
      filmRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  // Resize. composer.setSize already forwards to every pass — including
  // UnrealBloomPass.setSize, which is what actually resizes the mip chain.
  // (Assigning bloomPass.resolution does nothing; it is only read in the ctor.)
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setPixelRatio(viewport.dpr);
    composer.setSize(size.width, size.height);
  }, [size.width, size.height, viewport.dpr]);

  // Bloom strength, film grain and exposure follow the model's on-screen size, so the
  // glow and grain stay proportional to the subject rather than swamping a smaller
  // one. Bloom RADIUS is deliberately left unscaled: it is a screen fraction already.
  //
  // The GUI sliders hold the BASE values — what the parameter is at the reference
  // framing — and the scale is derived from them, so the two never fight.
  const applyScaledPost = useCallback(() => {
    const scale = postScaleRef.current;

    if (bloomRef.current) {
      bloomRef.current.strength = POST.bloomStrength * scale.bloomStrength;
      bloomRef.current.radius = POST.bloomRadius * scale.bloomRadius;
      // Threshold is not scaled: it is a luminance cut, not a magnitude, and moving it
      // with size changes WHAT blooms rather than how much.
      bloomRef.current.threshold = POST.bloomThreshold;
    }
    if (filmRef.current) {
      const u = filmRef.current.uniforms as FilmPassUniforms;
      u.intensity.value = POST.filmIntensity * scale.filmIntensity;
      u.grayscale.value = POST.filmGrayscale;
    }
  }, []);

  useEffect(() => {
    widthRef.current = size.width;
    postScaleRef.current = resolvePostScale(size.width);
    applyScaledPost();
    refreshReadoutRef.current?.();
  }, [size.width, applyScaledPost]);

  // ---------------------------------------------------------------------------
  // DEBUG — dev-only tuning GUI. lil-gui is imported inside the effect so it never
  // enters the production bundle.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!DEBUG || !SHOW_HERO_DEV_GUI) return;

    let gui: import("lil-gui").GUI | undefined;
    let cancelled = false;

    import("lil-gui").then(({ GUI }) => {
      if (cancelled) return;
      gui = new GUI({ title: "Hero — Post" });
      registerDevGui(gui, DEV_GUI_ORDER.heroPostProcessing);

      const apply = () => applyScaledPost();

      gui
        .add(HERO_TUNING, "bypassPost")
        .name("Bypass post (raw scene)")
        .listen();
      gui
        .add(HERO_TUNING, "pointSizeMultiplier", 0, 8, 0.05)
        .name("Point size x")
        .listen();
      const framing = gui.addFolder("Framing");

      const readout = {
        canvasWidth: Math.round(widthRef.current),
        solvedZ: Number(solveCameraZ(widthRef.current).toFixed(2)),
      };

      const reframe = () => {
        postScaleRef.current = resolvePostScale(widthRef.current);
        applyScaledPost();
        readout.canvasWidth = Math.round(widthRef.current);
        readout.solvedZ = Number(solveCameraZ(widthRef.current).toFixed(2));
        widthController?.updateDisplay();
        zController?.updateDisplay();

        Object.assign(resolved, postScaleRef.current);
        resolvedControllers.forEach((c) => c.updateDisplay());
      };
      refreshReadoutRef.current = reframe;

      // One slider per stop, so the curve can be shaped where it needs shaping
      // rather than being forced through a single exponent.
      CAMERA_Z_STOPS.forEach((stop) => {
        framing
          .add(stop.value, "z", 2, 40, 0.1)
          .name(`z @ ${stop.width}px`)
          .onChange(reframe)
          .listen();
      });

      // Vertical placement, per width band. Only 390 is lifted, to clear the logo.
      LIFT_STOPS.forEach((stop) => {
        framing
          .add(stop.value, "y", -0.5, 0.8, 0.01)
          .name(`lift @ ${stop.width}px`)
          .listen();
      });

      const widthController = framing.add(readout, "canvasWidth").name("Canvas width").disable();
      const zController = framing.add(readout, "solvedZ").name("Solved z").disable();

      // Multipliers on the base POST values below, one set per width band. 1 leaves a
      // parameter alone. Sub-folders start closed so the panel stays readable.
      const scaling = gui.addFolder("Post scaling");
      POST_SCALE_STOPS.forEach((stop) => {
        const band = scaling.addFolder(`@ ${stop.width}px`);
        band.add(stop.value, "bloomStrength", 0, 2, 0.01).name("Bloom strength x").onChange(reframe).listen();
        band.add(stop.value, "bloomRadius", 0, 2, 0.01).name("Bloom radius x").onChange(reframe).listen();
        band.add(stop.value, "filmIntensity", 0, 2, 0.01).name("Film grain x").onChange(reframe).listen();
        band.close();
      });

      const resolved: PostScale = { ...postScaleRef.current };
      const resolvedControllers = [
        scaling.add(resolved, "bloomStrength").name("→ bloom strength x").disable(),
        scaling.add(resolved, "bloomRadius").name("→ bloom radius x").disable(),
        scaling.add(resolved, "filmIntensity").name("→ film grain x").disable(),
      ];

      const post = gui.addFolder("Post Processing");
      post.add(POST, "bloomStrength", 0, 3, 0.01).name("Bloom strength").onChange(apply).listen();
      post.add(POST, "bloomRadius", 0, 1, 0.01).name("Bloom radius").onChange(apply).listen();
      post.add(POST, "bloomThreshold", 0, 1, 0.01).name("Bloom threshold").onChange(apply).listen();
      post.add(POST, "filmIntensity", 0, 1, 0.01).name("Film grain").onChange(apply).listen();
      post.add(POST, "filmGrayscale").name("Film grayscale").onChange(apply).listen();
      post.add(POST, "exposure", 0, 3, 0.01).name("Exposure").listen();

      // Prints the block back out as pasteable source, which is how the sketch's
      // numbers were found in the first place.
      gui
        .add(
          {
            log: () =>
              console.log(
                `export const NOISE = ${JSON.stringify(NOISE, null, 2)};\n\n` +
                  `export const POST = ${JSON.stringify(POST, null, 2)};\n\n` +
                  `export const OBJECT_DENSITIES = [${OBJECT_DENSITIES.join(", ")}];\n\n` +
                  `export const CAMERA_Z_STOPS = ${JSON.stringify(CAMERA_Z_STOPS)};\n\n` +
                  `export const LIFT_STOPS = ${JSON.stringify(LIFT_STOPS)};\n\n` +
                  `export const POST_SCALE_STOPS = ${JSON.stringify(POST_SCALE_STOPS)};\n\n` +
                  `HERO_TUNING = ${JSON.stringify(HERO_TUNING, null, 2)}`,
              ),
          },
          "log",
        )
        .name("Log config");
    });

    return () => {
      cancelled = true;
      refreshReadoutRef.current = null;
      if (gui) {
        unregisterDevGui(gui);
        gui.destroy();
      }
    };
  }, [applyScaledPost]);

  // Priority 1 takes over the render loop from R3F. Exposure is read off the frame
  // state rather than the closed-over `gl` so react-hooks/immutability stays happy.
  useFrame((state) => {
    // Not scaled: exposure is a constant of the look, not a function of model size.
    state.gl.toneMappingExposure = POST.exposure;

    if (HERO_TUNING.bypassPost) {
      // R3F does not auto-render at priority > 0, so the bypass has to draw itself.
      state.gl.setRenderTarget(null);
      state.gl.render(state.scene, state.camera);
      return;
    }

    composerRef.current?.render();
  }, 1);

  return null;
}
