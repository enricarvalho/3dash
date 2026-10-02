import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const BLUE = "#004aad";
const PURPLE = "#cb6ce6";

/** Material wireframe/aditivo padrão da hero (sem luzes, baixo custo). */
function Glow({
  color,
  opacity,
  wireframe = true,
}: {
  color: string;
  opacity: number;
  wireframe?: boolean;
}) {
  return (
    <meshBasicMaterial
      color={color}
      wireframe={wireframe}
      transparent
      opacity={opacity}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
    />
  );
}

/** 1 — nó toroidal com núcleo (peça abstrata original). */
export function KnotShape({ motion, mobile }: { motion: number; mobile: boolean }) {
  const inner = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (inner.current) inner.current.rotation.z -= Math.min(delta, 0.05) * 0.3 * motion;
  });
  const knotArgs: [number, number, number, number] = mobile
    ? [1.25, 0.3, 64, 6]
    : [1.25, 0.3, 128, 10];
  return (
    <group>
      <mesh>
        <torusKnotGeometry args={knotArgs} />
        <Glow color={BLUE} opacity={0.4} />
      </mesh>
      <mesh ref={inner} scale={0.72}>
        <octahedronGeometry args={[1, 0]} />
        <Glow color={PURPLE} opacity={0.55} />
      </mesh>
      <mesh scale={0.34}>
        <sphereGeometry args={[1, 16, 12]} />
        <Glow color={PURPLE} opacity={0.22} wireframe={false} />
      </mesh>
    </group>
  );
}

/** 2 — vaso impresso camada a camada (lathe + anéis de filamento subindo). */
export function VaseShape({ motion, mobile }: { motion: number; mobile: boolean }) {
  const layers = mobile ? 10 : 16;
  const height = 2.6;
  const profile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const steps = mobile ? 12 : 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = 0.55 + Math.sin(t * Math.PI * 1.15) * 0.55 - t * 0.12;
      pts.push(new THREE.Vector2(Math.max(0.12, r), t * height - height / 2));
    }
    return pts;
  }, [mobile, height]);

  const rings = useRef<THREE.Group>(null);
  const progress = useRef(0);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05) * motion;
    progress.current = (progress.current + d * 0.18) % 1;
    const g = rings.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const t = i / layers;
      const on = t <= progress.current;
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const target = on ? 0.7 - t * 0.25 : 0.05;
      mat.opacity += (target - mat.opacity) * Math.min(1, delta * 4);
    });
  });

  const radiusAt = (t: number) => 0.55 + Math.sin(t * Math.PI * 1.15) * 0.55 - t * 0.12;

  return (
    <group>
      <mesh>
        <latheGeometry args={[profile, mobile ? 18 : 28]} />
        <Glow color={BLUE} opacity={0.34} />
      </mesh>
      <group ref={rings}>
        {Array.from({ length: layers }).map((_, i) => {
          const t = i / layers;
          const r = Math.max(0.14, radiusAt(t));
          return (
            <mesh
              key={i}
              position={[0, t * height - height / 2, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[r, 0.035, 6, mobile ? 20 : 32]} />
              <meshBasicMaterial
                color={PURPLE}
                transparent
                opacity={0.05}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** 3 — impressora 3D trabalhando: pórtico, bico que percorre a mesa e peça crescendo. */
export function PrinterShape({ motion, mobile }: { motion: number; mobile: boolean }) {
  const gantry = useRef<THREE.Group>(null);
  const nozzle = useRef<THREE.Group>(null);
  const part = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05) * motion;
    t.current += d;
    const cycle = (t.current * 0.09) % 1; // altura de impressão
    if (gantry.current) gantry.current.position.y = -1.05 + cycle * 1.9;
    if (nozzle.current) nozzle.current.position.x = Math.sin(t.current * 1.8) * 0.75;
    if (part.current) {
      const h = Math.max(0.05, cycle * 1.85);
      part.current.scale.y = h;
      part.current.position.y = -1.05 + h / 2;
    }
  });

  const seg = mobile ? 1 : 1;

  return (
    <group scale={1.15}>
      {/* estrutura / frame */}
      <mesh>
        <boxGeometry args={[2.4, 2.6, 2.4, seg, seg, seg]} />
        <Glow color={BLUE} opacity={0.4} />
      </mesh>
      {/* mesa de impressão */}
      <mesh position={[0, -1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.0, 2.0, mobile ? 4 : 8, mobile ? 4 : 8]} />
        <Glow color={PURPLE} opacity={0.3} />
      </mesh>
      {/* pórtico + bico */}
      <group ref={gantry} position={[0, -1.05, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 2.4, 6]} />
          <Glow color={PURPLE} opacity={0.5} wireframe={false} />
        </mesh>
        <group ref={nozzle}>
          <mesh position={[0, -0.16, 0]}>
            <coneGeometry args={[0.13, 0.3, 8]} />
            <Glow color={PURPLE} opacity={0.7} wireframe={false} />
          </mesh>
          <mesh position={[0, -0.32, 0]} scale={0.16}>
            <sphereGeometry args={[1, 10, 8]} />
            <Glow color={PURPLE} opacity={0.5} wireframe={false} />
          </mesh>
        </group>
      </group>
      {/* peça sendo impressa */}
      <mesh ref={part} position={[0, -1.05, 0]}>
        <cylinderGeometry args={[0.5, 0.6, 1, mobile ? 8 : 14, 1, true]} />
        <Glow color={PURPLE} opacity={0.45} />
      </mesh>
    </group>
  );
}

/** 4 — protótipo mecânico: engrenagem com dentes e eixo, girando em contrapasso. */
export function GearShape({ motion, mobile }: { motion: number; mobile: boolean }) {
  const teeth = mobile ? 12 : 18;
  const gear = useRef<THREE.Group>(null);
  const small = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05) * motion;
    if (gear.current) gear.current.rotation.z += d * 0.5;
    if (small.current) small.current.rotation.z -= d * 1.1;
  });

  const teethArr = useMemo(() => Array.from({ length: teeth }), [teeth]);

  return (
    <group rotation={[0.5, 0, 0]}>
      <group ref={gear}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.15, 1.15, 0.3, mobile ? 18 : 32, 1, true]} />
          <Glow color={BLUE} opacity={0.55} />
        </mesh>
        {teethArr.map((_, i) => {
          const a = (i / teeth) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0]}
              rotation={[0, 0, a]}
            >
              <boxGeometry args={[0.28, 0.18, 0.3]} />
              <Glow color={PURPLE} opacity={0.6} />
            </mesh>
          );
        })}
        <mesh>
          <torusGeometry args={[0.42, 0.06, 6, mobile ? 16 : 24]} />
          <Glow color={PURPLE} opacity={0.5} wireframe={false} />
        </mesh>
      </group>
      <group ref={small} position={[0, 0, 0.45]} scale={0.45}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.15, 1.15, 0.4, mobile ? 12 : 20, 1, true]} />
          <Glow color={PURPLE} opacity={0.4} />
        </mesh>
      </group>
    </group>
  );
}

/** 5 — carretel de filamento girando com fio se desenrolando. */
export function SpoolShape({ motion, mobile }: { motion: number; mobile: boolean }) {
  const spool = useRef<THREE.Group>(null);
  const strand = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05) * motion;
    t.current += d;
    if (spool.current) spool.current.rotation.y += d * 0.6;
    if (strand.current) strand.current.rotation.z = -t.current * 0.9;
  });

  const seg = mobile ? 18 : 32;

  return (
    <group rotation={[0.35, 0, 0.15]}>
      <group ref={spool}>
        {[-0.45, 0.45].map((z) => (
          <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.25, 1.25, 0.08, seg, 1, true]} />
            <Glow color={BLUE} opacity={0.45} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.95, 0.95, 0.86, seg, 1, true]} />
          <Glow color={PURPLE} opacity={0.4} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 1.1, mobile ? 10 : 16, 1, true]} />
          <Glow color={PURPLE} opacity={0.3} wireframe={false} />
        </mesh>
      </group>
      <mesh ref={strand} position={[1.05, -0.6, 0]}>
        <torusGeometry args={[0.55, 0.03, 5, mobile ? 20 : 34]} />
        <Glow color={PURPLE} opacity={0.5} wireframe={false} />
      </mesh>
    </group>
  );
}

/** 6 — cubo impresso camada a camada (fatias empilhando e reiniciando). */
export function LayerCubeShape({ motion, mobile }: { motion: number; mobile: boolean }) {
  const layers = mobile ? 12 : 20;
  const height = 2.2;
  const group = useRef<THREE.Group>(null);
  const progress = useRef(0);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05) * motion;
    progress.current = (progress.current + d * 0.16) % 1;
    const g = group.current;
    if (!g) return;
    g.rotation.y += d * 0.25;
    g.children.forEach((child, i) => {
      const t = i / layers;
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const target = t <= progress.current ? 0.6 - t * 0.2 : 0.04;
      mat.opacity += (target - mat.opacity) * Math.min(1, delta * 4);
    });
  });

  return (
    <group>
      <group ref={group}>
        {Array.from({ length: layers }).map((_, i) => {
          const t = i / layers;
          const s = 1.35 - Math.sin(t * Math.PI) * 0.25;
          return (
            <mesh key={i} position={[0, t * height - height / 2, 0]}>
              <boxGeometry args={[s, height / layers - 0.02, s]} />
              <meshBasicMaterial
                color={i % 3 === 0 ? BLUE : PURPLE}
                wireframe
                transparent
                opacity={0.04}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>
      <mesh position={[0, -height / 2 - 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 2.4, mobile ? 4 : 8, mobile ? 4 : 8]} />
        <Glow color={BLUE} opacity={0.28} />
      </mesh>
    </group>
  );
}

/** 7 — hélice/turbina orgânica: pás em espiral girando (peça de decoração). */
export function HelixShape({ motion, mobile }: { motion: number; mobile: boolean }) {
  const blades = mobile ? 16 : 28;
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05) * motion;
    if (group.current) group.current.rotation.y += d * 0.45;
  });

  const items = useMemo(() => Array.from({ length: blades }), [blades]);

  return (
    <group ref={group}>
      {items.map((_, i) => {
        const t = i / blades;
        const a = t * Math.PI * 3;
        const r = 0.5 + Math.sin(t * Math.PI) * 0.75;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * r, t * 2.6 - 1.3, Math.sin(a) * r]}
            rotation={[0, -a, 0.35]}
          >
            <boxGeometry args={[0.6, 0.05, 0.18]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? PURPLE : BLUE}
              transparent
              opacity={0.45}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
      <mesh>
        <cylinderGeometry args={[0.09, 0.09, 2.8, 6]} />
        <Glow color={PURPLE} opacity={0.35} wireframe={false} />
      </mesh>
    </group>
  );
}

/** 8 — scanner 3D: peça poliédrica varrida por um plano de luz. */
export function ScanShape({ motion, mobile }: { motion: number; mobile: boolean }) {
  const scan = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05) * motion;
    t.current += d;
    if (core.current) core.current.rotation.y += d * 0.35;
    if (scan.current) {
      scan.current.position.y = Math.sin(t.current * 0.55) * 1.35;
      const mat = scan.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + Math.abs(Math.cos(t.current * 0.55)) * 0.35;
    }
  });

  return (
    <group>
      <mesh ref={core}>
        <icosahedronGeometry args={[1.35, mobile ? 1 : 2]} />
        <Glow color={BLUE} opacity={0.32} />
      </mesh>
      <mesh scale={0.6}>
        <dodecahedronGeometry args={[1, 0]} />
        <Glow color={PURPLE} opacity={0.4} />
      </mesh>
      <mesh ref={scan} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.35, 1.6, mobile ? 24 : 48]} />
        <meshBasicMaterial
          color={PURPLE}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export const HERO_SHAPES = [
  KnotShape,
  VaseShape,
  PrinterShape,
  GearShape,
  SpoolShape,
  LayerCubeShape,
  HelixShape,
  ScanShape,
];
