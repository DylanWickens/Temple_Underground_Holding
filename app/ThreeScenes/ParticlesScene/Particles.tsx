'use client';

import { Points } from '@react-three/drei';
import * as THREE from 'three';
import { useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRef } from 'react';

import vertexShader from './shaders/vert.glsl';
import fragmentShader from "./shaders/frag.glsl";

type Uniforms = {
  uTime: number
}


export default function Particles() {

  //DEBUG 
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
        
   /* <OrbitControls
        ref={controlsRef}
        onEnd={() => {
          const target = controlsRef.current?.target;
          console.log(
            JSON.stringify(
              {
                position: camera.position.toArray().map((n) => +n.toFixed(4)),
                target: target?.toArray().map((n:any) => +n.toFixed(4)),
              },
              null,
              2,
            ),
          );
        }}
      /> */
        

   // Save geometry to the cache
   const { nodes } = useGLTF('./models/Expanded.gltf');

   const landscape = nodes.Landscape as THREE.Mesh; 
   console.log(nodes);
   console.log(landscape.geometry)

  const positions = landscape.geometry.attributes.position
  .clone()
  .array as Float32Array; // de-interleaves automatically

  return (
    <>
      <Points positions={positions} scale={1}>
        <pointsMaterial />
      </Points>
    </>
  );
}
