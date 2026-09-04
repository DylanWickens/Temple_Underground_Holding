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
  MODEL_URL,
  NOISE,
  OBJECT_DENSITIES,
  PARTICLE_SIZE,
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
  },
  vertexShader,
  fragmentShader,
);
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
}: {
  geometry: THREE.BufferGeometry;
  pointSize: number;
}) {
  const materialRef = useRef<InstanceType<typeof HeroParticlesShader>>(null);

  // Uniforms are driven here so the dev GUI's mutations land without a re-render.
  useFrame((state) => {
    const uniforms = materialRef.current?.uniforms;
    if (!uniforms) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uSize.value = pointSize * HERO_TUNING.pointSizeMultiplier;
    uniforms.uNoisePeriod.value = NOISE.noisePeriod;
    uniforms.uNoiseSpeed.value = NOISE.noiseSpeed;
    uniforms.uNoiseStrength.value = NOISE.noiseStrength;
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

  const densityScale = TIER_DENSITY_SCALE[tierForWidth(size.width)];

  // The costly half — one MeshSurfaceSampler per mesh. Never redone for a density.
  const model = useMemo(() => prepareHeroModel(modelScene), [modelScene]);

  // Bumped by the density sliders and by Regenerate, to force a re-sample.
  const [rebuildNonce, setRebuildNonce] = useState(0);
  const [meshVerticesIndex, setMeshVerticesIndex] = useState(
    HERO_TUNING.meshVerticesIndex,
  );
  const [hidePointCloud, setHidePointCloud] = useState(HERO_TUNING.hidePointCloud);

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
    });

    return () => {
      cancelled = true;
      if (gui) {
        unregisterDevGui(gui);
        gui.destroy();
      }
    };
  }, [model]);

  // Composition is a ratio of the visible frame, not a world constant, so it holds
  // at any canvas size. Driven from useFrame so the dev GUI slider lands live.
  //
  // Safe to do on the group: the vertex shader samples noise off the `position`
  // ATTRIBUTE, which modelMatrix never touches.
  useFrame(({ size: frame }) => {
    if (groupRef.current) {
      groupRef.current.position.y = viewport.height * solveLift(frame.width);
    }
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
              />
            ),
          )}
      {baseGeometry ? (
        <HeroCloud geometry={baseGeometry} pointSize={pointSize} />
      ) : null}
    </group>
  );
}
