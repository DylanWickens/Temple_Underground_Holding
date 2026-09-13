"use client";

// Drives the camera distance from the canvas size, so the build is framed to the window
// rather than to a fixed world position.
//
// Distance, not fov: gl_PointSize is `uSize * aScale^2 / -viewZ`, so pulling back
// shrinks the points along with the model. That is the intended behaviour here, and
// it is why this does not mirror ParticlesScene/ResponsiveCamera, which solves fov.
//
// Width alone decides it from 768px up — a short wide window frames the same as a tall
// one. Below that, solveCameraZ deliberately takes the height too: phones need the build
// to COVER the frame and crop at the sides, and how much of a 390px-wide frame the build
// covers depends entirely on whether that frame is 19.5:9 or 4:3.

import { useFrame } from "@react-three/fiber";
import { solveCameraZ } from "./heroSceneDefaults";

export default function ResponsiveCamera() {
  // useFrame rather than a layout effect so the dev GUI's framing sliders land live.
  //
  // Priority 0, ahead of PostProcessing at 1, so the frame renders through the camera
  // this just solved. Nothing else writes to the camera: the cursor tilt rotates the
  // model group, not the view.
  useFrame(({ camera, size }) => {
    // No fov argument: R3F types this camera as the base THREE.Camera, which has no
    // fov, and nothing here ever moves it off CAMERA.fov — solveCameraZ defaults to it.
    const z = solveCameraZ(size.width, size.height);

    // A camera still at the origin has no direction to preserve, and setLength on a
    // zero vector is a no-op — which would strand it inside the cloud. Seat it on the
    // +Z axis first.
    if (camera.position.lengthSq() < 1e-6) {
      camera.position.set(0, 0, z);
      return;
    }

    // setLength, not position.z: this preserves the sightline whatever it is rather
    // than assuming the camera is still on the +Z axis. Nothing moves it off that axis
    // today, but distance is the thing being solved for here, not a z coordinate.
    camera.position.setLength(z);
  });

  return null;
}
