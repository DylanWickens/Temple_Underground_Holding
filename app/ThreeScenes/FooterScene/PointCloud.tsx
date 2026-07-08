"use client";

// Footer point cloud — loads the PLY model and renders animated particles.
// Tune defaults in footerSceneDefaults.ts.

import { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree, useLoader } from "@react-three/fiber";
import { AdditiveBlending, Group, ShaderMaterial } from "three";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { NOISE_DEFAULTS, PARTICLE_SIZE, SCENE_OFFSET } from "./footerSceneDefaults";
import { buildPointCloudGeometry } from "./preparePointCloudGeometry";
import "./particlesMaterial";
import { usePointCloudDevGui } from "./devGui/usePointCloudDevGui";

export default function PointCloud() {
  const materialRef = useRef<ShaderMaterial>(null);
  const sceneGroupRef = useRef<Group>(null);
  const { viewport, camera } = useThree();
  const rawGeometry = useLoader(PLYLoader, "/models/cloud.ply");

  const pointsGeometry = useMemo(
    () => buildPointCloudGeometry(rawGeometry),
    [rawGeometry],
  );

  usePointCloudDevGui({ materialRef, sceneGroupRef, camera, pointsGeometry });

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uSize.value = PARTICLE_SIZE * viewport.dpr;
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
      position={[SCENE_OFFSET.offsetX, SCENE_OFFSET.offsetY, SCENE_OFFSET.offsetZ]}
    >
      <points geometry={pointsGeometry}>
        <particlesMaterial
          ref={materialRef}
          uSize={PARTICLE_SIZE * viewport.dpr}
          uTime={0}
          uNoisePeriod={NOISE_DEFAULTS.noisePeriod}
          uNoiseSpeed={NOISE_DEFAULTS.noiseSpeed}
          uNoiseStrength={NOISE_DEFAULTS.noiseStrength}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}
