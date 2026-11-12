"use client";
import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function SkullWireframe() {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (outerRef.current) {
      outerRef.current.rotation.y = t * 0.22;
      outerRef.current.rotation.x = Math.sin(t * 0.35) * 0.1;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.14;
      innerRef.current.scale.setScalar(1 + Math.sin(t * 0.7) * 0.025);
    }
  });

  return (
    <group>
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1.7, 2]} />
        <meshBasicMaterial color="#00D4FF" wireframe opacity={0.30} transparent />
      </mesh>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshBasicMaterial color="#7B61FF" wireframe opacity={0.16} transparent />
      </mesh>
    </group>
  );
}

function Particles() {
  const count = 100;
  const [positions, colors] = React.useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
      if (i % 2 === 0) { col[i*3]=0; col[i*3+1]=0.83; col[i*3+2]=1; }
      else             { col[i*3]=0.48; col[i*3+1]=0.38; col[i*3+2]=1; }
    }
    return [pos, col];
  }, []);

  const geo = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.04;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.042} vertexColors transparent opacity={0.5} />
    </points>
  );
}

export default function HeroCanvas() {
  return (
    <Canvas camera={{ position: [0, 0, 5.5], fov: 42 }}>
      <SkullWireframe />
      <Particles />
    </Canvas>
  );
}
