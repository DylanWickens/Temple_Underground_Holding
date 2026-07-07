"use client";

import { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree, useLoader, extend, type ThreeElement } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  PerspectiveCamera,
  ShaderMaterial,
  Vector3,
} from "three";
import { shaderMaterial } from "@react-three/drei";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import vertShader from "./shaders/vert.glsl";
import fragShader from "./shaders/frag.glsl";
import { registerDevGui, unregisterDevGui } from "./devGuiStack";

// ─── Geometry helpers (ported from vanilla) ───────────────────────────────────

function extractPositionsFromPLY(geometry: BufferGeometry): Float32Array {
  const pos = geometry.getAttribute("position");
  return new Float32Array(pos.array);
}

function getCenteredPositions(positions: Float32Array): Float32Array {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.computeBoundingBox();
  geo.center();
  const centered = new Float32Array(geo.getAttribute("position").array);
  geo.dispose();
  return centered;
}

function rotatePositions(positions: Float32Array, axis: "x" | "y" | "z", angle: number): Float32Array {
  const rotated = new Float32Array(positions.length);
  const point = new Vector3();
  const matrix = new Matrix4();
  if (axis === "x") matrix.makeRotationX(angle);
  else if (axis === "y") matrix.makeRotationY(angle);
  else matrix.makeRotationZ(angle);
  for (let i = 0; i < positions.length; i += 3) {
    point.set(positions[i], positions[i + 1], positions[i + 2]);
    point.applyMatrix4(matrix);
    rotated[i] = point.x;
    rotated[i + 1] = point.y;
    rotated[i + 2] = point.z;
  }
  return rotated;
}

function preparePositions(positions: Float32Array): Float32Array {
  // Polycam PLY is Z-up; rotate to Three.js Y-up then center.
  const rotated = rotatePositions(positions, "x", -Math.PI / 2);
  return getCenteredPositions(rotated);
}

// Nudge model down in world space so it sits at the bottom of the footer frame.
const SCENE_OFFSET_DEFAULTS = {
  offsetX: 0,
  offsetY: -0.35,
  offsetZ: 0,
};

const SCENE_OFFSET_MARGIN = 2.0;
const SCENE_OFFSET_STEP = 0.01;

type SceneOffsetDebug = typeof SCENE_OFFSET_DEFAULTS;

function getDeterministicScale(index: number): number {
  let hash = (index + 1) | 0;
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 4294967295;
}

// Shader material ────────────────────────────────────────────────────────── 
const ParticlesMaterial = shaderMaterial(
  {
    uSize: 10.0,
    uTime: 0,
    uNoisePeriod: 3.8,
    uNoiseSpeed: 0.08,
    uNoiseStrength: 0.026,
  },
  vertShader,
  fragShader,
);
extend({ ParticlesMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    particlesMaterial: ThreeElement<typeof ParticlesMaterial>;
  }
}

// ─── Debug defaults ───────────────────────────────────────────────────────────

const DEBUG_DEFAULTS = {
  noiseAmp: 3.8,
  noiseSpeed: 0.08,
  noiseStrength: 0.026,
};

type CameraDebug = {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
};

function applyCameraSettings(camera: PerspectiveCamera, settings: CameraDebug) {
  camera.position.set(settings.posX, settings.posY, settings.posZ);
  camera.rotation.set(settings.rotX, settings.rotY, settings.rotZ);
}

const CAMERA_DEFAULTS: CameraDebug = {
  posX: 0.183952596664429,
  posY: -0.686047403335571,
  posZ: 0.0499525966644288,
  rotX: -0.0015926535897929917,
  rotY: 2.62840734641021,
  rotZ: 0.00840734641020699,
};

const CAMERA_POSITION_MARGIN = 2.0;
const CAMERA_ROTATION_MARGIN = 2.0;
const CAMERA_SLIDER_STEP = 0.01;

const CAMERA_SLIDER_CONFIG: Record<keyof CameraDebug, { margin: number; label: string }> = {
  posX: { margin: CAMERA_POSITION_MARGIN, label: "Position X" },
  posY: { margin: CAMERA_POSITION_MARGIN, label: "Position Y" },
  posZ: { margin: CAMERA_POSITION_MARGIN, label: "Position Z" },
  rotX: { margin: CAMERA_ROTATION_MARGIN, label: "Rotation X" },
  rotY: { margin: CAMERA_ROTATION_MARGIN, label: "Rotation Y" },
  rotZ: { margin: CAMERA_ROTATION_MARGIN, label: "Rotation Z" },
};

function getInitialCameraSettings(): CameraDebug {
  return { ...CAMERA_DEFAULTS };
}

// Inner component (useLoader must live inside Canvas context) ──────────────

function applySceneOffset(group: Group, settings: SceneOffsetDebug) {
  group.position.set(settings.offsetX, settings.offsetY, settings.offsetZ);
}

function PointCloudMesh() {
  const materialRef = useRef<ShaderMaterial>(null);
  const sceneGroupRef = useRef<Group>(null);
  const { viewport, camera } = useThree();
  const rawGeometry = useLoader(PLYLoader, "/models/cloud.ply");
  const debugObject = useRef({ ...DEBUG_DEFAULTS });
  const cameraDebug = useRef<CameraDebug>({ ...CAMERA_DEFAULTS });
  const sceneOffsetDebug = useRef<SceneOffsetDebug>({ ...SCENE_OFFSET_DEFAULTS });

  const pointsGeometry = useMemo(() => {
    const positions = preparePositions(extractPositionsFromPLY(rawGeometry));
    const count = positions.length / 3;
    const scales = new Float32Array(count);
    for (let i = 0; i < count; i++) scales[i] = getDeterministicScale(i);
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geo.setAttribute("aScale", new BufferAttribute(scales, 1));
    return geo;
  }, [rawGeometry]);

  // Apply camera defaults once geometry is ready
  useEffect(() => {
    cameraDebug.current = getInitialCameraSettings();
    applyCameraSettings(camera as PerspectiveCamera, cameraDebug.current);
  }, [pointsGeometry, camera]);

  // Dev GUI — fine-tune sliders; guarded against async Strict Mode double-mount
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let gui: import("lil-gui").GUI | undefined;
    let cancelled = false;

    import("lil-gui").then(({ default: GUI }) => {
      if (cancelled) return;

      gui = new GUI({ title: "Camera" });
      registerDevGui(gui, 0);

      const updateCamera = () => {
        applyCameraSettings(camera as PerspectiveCamera, cameraDebug.current);
      };

      (Object.keys(CAMERA_SLIDER_CONFIG) as (keyof CameraDebug)[]).forEach((key) => {
        const center = CAMERA_DEFAULTS[key];
        const { margin, label } = CAMERA_SLIDER_CONFIG[key];
        gui!
          .add(
            cameraDebug.current,
            key,
            center - margin,
            center + margin,
            CAMERA_SLIDER_STEP,
          )
          .name(label)
          .onChange(updateCamera);
      });
      gui
        .add(
          {
            logValues: () => {
              console.log("Camera settings:", JSON.stringify(cameraDebug.current, null, 2));
            },
          },
          "logValues",
        )
        .name("Log values to console");

      const updateSceneOffset = () => {
        if (!sceneGroupRef.current) return;
        applySceneOffset(sceneGroupRef.current, sceneOffsetDebug.current);
      };

      const sceneFolder = gui.addFolder("Scene");
      (["offsetX", "offsetY", "offsetZ"] as const).forEach((key) => {
        const center = SCENE_OFFSET_DEFAULTS[key];
        sceneFolder
          .add(
            sceneOffsetDebug.current,
            key,
            center - SCENE_OFFSET_MARGIN,
            center + SCENE_OFFSET_MARGIN,
            SCENE_OFFSET_STEP,
          )
          .name(key.replace("offset", "Offset "))
          .onChange(updateSceneOffset);
      });
      sceneFolder
        .add(
          {
            logValues: () => {
              console.log("Scene offset:", JSON.stringify(sceneOffsetDebug.current, null, 2));
            },
          },
          "logValues",
        )
        .name("Log values to console");

      const updateUniform = (key: "noiseAmp" | "noiseSpeed" | "noiseStrength") => {
        if (!materialRef.current) return;
        const map: Record<string, string> = {
          noiseAmp: "uNoisePeriod",
          noiseSpeed: "uNoiseSpeed",
          noiseStrength: "uNoiseStrength",
        };
        materialRef.current.uniforms[map[key]].value = debugObject.current[key];
      };

      const noiseFolder = gui.addFolder("Noise");
      noiseFolder
        .add(debugObject.current, "noiseStrength", 0, 0.15, 0.001)
        .name("Strength")
        .onChange(() => updateUniform("noiseStrength"));
      noiseFolder
        .add(debugObject.current, "noiseSpeed", 0, 2, 0.01)
        .name("Speed")
        .onChange(() => updateUniform("noiseSpeed"));
      noiseFolder
        .add(debugObject.current, "noiseAmp", 0.5, 15, 0.1)
        .name("Frequency")
        .onChange(() => updateUniform("noiseAmp"));
      noiseFolder
        .add(
          {
            logValues: () => {
              console.log("Noise settings:", JSON.stringify(debugObject.current, null, 2));
            },
          },
          "logValues",
        )
        .name("Log values to console");
    });

    return () => {
      cancelled = true;
      if (gui) {
        unregisterDevGui(gui);
        gui.destroy();
      }
    };
  }, [pointsGeometry, camera]);

  // Set uSize based on device pixel ratio
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uSize.value = 10.0 * viewport.dpr;
      materialRef.current.alphaTest = 0.001;
    }
  }, [viewport.dpr]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group
      ref={sceneGroupRef}
      position={[
        SCENE_OFFSET_DEFAULTS.offsetX,
        SCENE_OFFSET_DEFAULTS.offsetY,
        SCENE_OFFSET_DEFAULTS.offsetZ,
      ]}
    >
      <points geometry={pointsGeometry}>
        <particlesMaterial
          ref={materialRef}
          uSize={10.0 * viewport.dpr}
          uTime={0}
          uNoisePeriod={DEBUG_DEFAULTS.noiseAmp}
          uNoiseSpeed={DEBUG_DEFAULTS.noiseSpeed}
          uNoiseStrength={DEBUG_DEFAULTS.noiseStrength}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function PointCloud() {
  return <PointCloudMesh />;
}
