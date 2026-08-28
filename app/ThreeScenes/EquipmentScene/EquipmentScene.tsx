import { ReactThreeFiber } from "@react-three/fiber";
import { extend, useThree, useFrame } from "@react-three/fiber";
import { GUI } from "lil-gui";

// Particles Shader Setup
type Uniforms = {
  uTime: number;
  uSize: number;
  uNoisePeriod: number;
  uNoiseSpeed: number;
  uNoiseStrength: number;
};

export default function EquipmentScene() {
  /*
   * Debug
  */
  const gui = new GUI();

  return <div></div>;
}
