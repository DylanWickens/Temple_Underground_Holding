"use client";

// Drives the camera distance from the canvas WIDTH, so a narrower window pulls back
// and the build never crops at the sides.
//
// Distance, not fov: gl_PointSize is `uSize * aScale^2 / -viewZ`, so pulling back
// shrinks the points along with the model. That is the intended behaviour here, and
// it is why this does not mirror ParticlesScene/ResponsiveCamera, which solves fov.

import { useFrame } from "@react-three/fiber";
import { solveCameraZ } from "./heroSceneDefaults";

export default function ResponsiveCamera() {
  // useFrame rather than a layout effect so the dev GUI's framing sliders land live.
  //
  // Ordering works out on its own: drei's OrbitControls updates at priority -1, this
  // runs at 0, PostProcessing renders at 1. OrbitControls.update() re-derives its
  // spherical from the live camera position every frame, so overwriting the radius
  // after it has run is safe — and zoom is disabled, so nothing else touches radius.
  useFrame(({ camera, size }) => {
    const z = solveCameraZ(size.width);

    // A camera still at the origin has no direction to preserve, and setLength on a
    // zero vector is a no-op — which would strand it inside the cloud. Seat it on the
    // +Z axis first.
    if (camera.position.lengthSq() < 1e-6) {
      camera.position.set(0, 0, z);
      return;
    }

    // setLength, not position.z: once the user has orbited, the camera is off the +Z
    // axis, and setting z alone would swing it. Length is the orbit radius, and
    // OrbitControls targets the origin.
    camera.position.setLength(z);
  });

  return null;
}
