import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * WebGL assistant core (desktop auth panel only — H4). A faceted glass crystal with an inner
 * Electric glow, a counter-rotating wireframe shell and four small nodes orbiting on a tilted
 * ring (the channels). Cheap by design: < 1k triangles, no post-processing, no transmission
 * pass, DPR ≤ 1.5, and the render loop stops when `active` is false.
 */
export default function BrandScene3D({
  active,
  onReady,
  className,
}: {
  active: boolean;
  onReady: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={active ? 'always' : 'never'}
        camera={{ position: [0, 0, 6.2], fov: 34 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          requestAnimationFrame(() => onReady());
        }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 4, 5]} intensity={2.4} color="#c7d6ff" />
        <pointLight position={[-3, -2, 2.5]} intensity={22} color="#2ebbff" />
        <pointLight position={[2.5, 1.5, -2]} intensity={14} color="#8b7bff" />
        <Core />
        <Orbit />
      </Canvas>
    </div>
  );
}

function Core() {
  const group = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y += delta * 0.18;
      group.current.rotation.x = Math.sin(t * 0.35) * 0.12;
      group.current.position.y = Math.sin(t * 0.6) * 0.06;
    }
    if (shell.current) shell.current.rotation.y -= delta * 0.1;
  });
  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1, 1]} />
        <meshPhysicalMaterial
          color="#6f8dff"
          roughness={0.12}
          metalness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.08}
          iridescence={0.55}
          iridescenceIOR={1.35}
          flatShading
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh scale={0.52}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#2ebbff" transparent opacity={0.55} />
      </mesh>
      <mesh ref={shell} scale={1.28}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#9fb4ff" wireframe transparent opacity={0.16} />
      </mesh>
    </group>
  );
}

const NODE_COLORS = ['#2ebbff', '#7c95ff', '#5ccbff', '#8b7bff'];

function Orbit() {
  const ring = useRef<THREE.Group>(null);
  const ringGeometry = useMemo(() => new THREE.TorusGeometry(1.62, 0.006, 8, 160), []);
  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.z += delta * 0.22;
  });
  return (
    <group rotation={[1.2, 0.25, 0]}>
      <mesh geometry={ringGeometry}>
        <meshBasicMaterial color="#9fb4ff" transparent opacity={0.28} />
      </mesh>
      <group ref={ring}>
        {NODE_COLORS.map((color, i) => {
          const a = (i / NODE_COLORS.length) * Math.PI * 2;
          return (
            <mesh key={color} position={[Math.cos(a) * 1.62, Math.sin(a) * 1.62, 0]}>
              <sphereGeometry args={[0.075, 16, 16]} />
              <meshBasicMaterial color={color} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
