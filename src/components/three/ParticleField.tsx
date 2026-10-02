import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  acquireHeroInput,
  getHeroInput,
  HERO_INPUT_LAYERS,
  setHeroInputFrozen,
} from "@/lib/hero-input";
import { HERO_SHAPES } from "./HeroShapes";

/** Tempo de exibição de cada modelo 3D da hero (slide). */
const SHAPE_INTERVAL = 15;

/** Perfil adaptativo: menos partículas e menor DPR em telas pequenas / GPUs fracas. */
function useQualityProfile() {
  return useMemo(() => {
    if (typeof window === "undefined") {
      return { count: 900, dpr: [1, 1.5] as [number, number], size: 0.035, mobile: false, fpsCap: 0 };
    }
    const w = window.innerWidth;
    const cores = navigator.hardwareConcurrency ?? 4;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const lowEnd = coarse || cores <= 4 || memory <= 4;

    if (w < 768) {
      return {
        count: lowEnd ? 260 : 360,
        dpr: [1, lowEnd ? 1 : 1.2] as [number, number],
        size: 0.075,
        mobile: true,
        fpsCap: 30,
      };
    }
    if (w < 1280 || lowEnd) {
      return {
        count: lowEnd ? 520 : 750,
        dpr: [1, 1.4] as [number, number],
        size: 0.05,
        mobile: w < 1024,
        fpsCap: lowEnd ? 40 : 0,
      };
    }
    return { count: 1400, dpr: [1, 1.75] as [number, number], size: 0.035, mobile: false, fpsCap: 0 };
  }, []);
}

/** Em mobile/low-end o canvas roda em modo "demand" e é acionado numa cadência fixa. */
function FrameTicker({ fps }: { fps: number }) {
  const { invalidate } = useThree();
  useEffect(() => {
    if (fps <= 0) return;
    const id = window.setInterval(() => invalidate(), 1000 / fps);
    return () => window.clearInterval(id);
  }, [fps, invalidate]);
  return null;
}

/**
 * Governador de performance: mede o FPS real em janelas de ~1s e ajusta
 * dinamicamente a fração de partículas desenhadas e a cadência do render,
 * recuperando qualidade quando o aparelho aguenta.
 */
const MIN_RATIO = 0.35;

function PerfGovernor({
  ratioRef,
  baseFps,
  fps,
  setFps,
}: {
  ratioRef: RefObject<number>;
  baseFps: number;
  fps: number;
  setFps: (v: number) => void;
}) {
  const acc = useRef({ time: 0, frames: 0, good: 0 });

  useFrame((_, delta) => {
    const a = acc.current;
    a.time += Math.min(delta, 0.2);
    a.frames += 1;
    if (a.time < 1) return;

    const measured = a.frames / a.time;
    a.time = 0;
    a.frames = 0;

    const target = fps > 0 ? fps : 60;
    const ratio = ratioRef.current ?? 1;

    if (measured < target * 0.85) {
      a.good = 0;
      const next = Math.max(MIN_RATIO, ratio * 0.78);
      if (next < ratio - 0.01) {
        ratioRef.current = next;
      } else if (fps === 0) {
        setFps(40); // limita a cadência antes de cortar mais partículas
      } else if (fps > 30) {
        setFps(30);
      }
      return;
    }

    if (measured > target * 0.95) {
      a.good += 1;
      if (a.good >= 3) {
        a.good = 0;
        if (ratio < 1) {
          ratioRef.current = Math.min(1, ratio * 1.18);
        } else if (fps > baseFps || (baseFps === 0 && fps > 0)) {
          setFps(baseFps);
        }
      }
    } else {
      a.good = 0;
    }
  });

  return null;
}

const VERT = /* glsl */ `
  attribute float aSpeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    // deslocamento vertical calculado na GPU (sem upload de buffers por frame)
    p.y = mod(p.y + uTime * aSpeed + 6.0, 12.0) - 6.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aSize * (uScale / -mv.z);
    vAlpha = 0.35 + 0.45 * aSize;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float falloff = smoothstep(0.25, 0.0, d);
    gl_FragColor = vec4(uColor, vAlpha * falloff);
  }
`;

function Dust({
  count,
  size,
  motion,
  ratioRef,
}: {
  count: number;
  size: number;
  motion: number;
  ratioRef: RefObject<number>;
}) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const drift = useRef({ rx: 0, ry: 0, x: 0, y: 0 });
  const { size: canvas, viewport: vp } = useThree();

  const { positions, speeds, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      speeds[i] = 0.06 + Math.random() * 0.1;
      sizes[i] = 0.7 + Math.random() * 0.7;
    }
    return { positions, speeds, sizes };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: size },
      uScale: { value: 1 },
      uColor: { value: new THREE.Color("#cb6ce6") },
    }),
    [size],
  );

  useFrame((state, delta) => {
    if (material.current) {
      material.current.uniforms.uTime.value += delta * motion;
      material.current.uniforms.uScale.value = (canvas.height * vp.dpr) / 2;
    }
    const mesh = points.current;
    if (!mesh) return;
    // densidade adaptativa: desenha só uma fração das partículas e compensa
    // o tamanho para preservar o volume luminoso da cena
    const ratio = Math.min(1, Math.max(MIN_RATIO, ratioRef.current ?? 1));
    const visible = Math.max(60, Math.round(count * ratio));
    const geo = mesh.geometry as THREE.BufferGeometry;
    if (geo.drawRange.count !== visible) geo.setDrawRange(0, visible);
    if (material.current) {
      const target = size * Math.min(1.45, 1 / Math.sqrt(ratio));
      const u = material.current.uniforms.uSize;
      u.value += (target - u.value) * Math.min(1, delta * 3);
    }
    const input = getHeroInput();
    const w = HERO_INPUT_LAYERS.dust * motion;
    const d = Math.min(delta, 0.05);
    // suavização lenta e cinematográfica (parallax de fundo)
    const ease = Math.min(1, d * 1.6);
    // mesma direção do objeto, só com amplitude menor (camada de fundo)
    const targetRY = input.x * 0.31 * w;
    const targetRX = input.y * 0.22 * w;
    const targetX = -input.x * 0.78 * w;
    const targetY = -input.y * 0.56 * w;
    drift.current.rx += (targetRX - drift.current.rx) * ease;
    drift.current.ry += (targetRY - drift.current.ry) * ease;
    drift.current.x += (targetX - drift.current.x) * ease;
    drift.current.y += (targetY - drift.current.y) * ease;
    mesh.rotation.x = drift.current.rx;
    mesh.rotation.y =
      drift.current.ry + state.clock.elapsedTime * 0.006 * motion;
    mesh.position.x = drift.current.x;
    mesh.position.y = drift.current.y;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

type Interaction = {
  dragging: boolean;
  velX: number; // velocidade de giro acumulada pelo arrasto
  velY: number;
  spinX: number;
  spinY: number;
};

function HeroObject({
  motion,
  mobile,
  interaction,
}: {
  motion: number;
  mobile: boolean;
  interaction: RefObject<Interaction>;
}) {
  const group = useRef<THREE.Group>(null);
  const shapeGroup = useRef<THREE.Group>(null);
  const parallax = useRef({ x: 0, y: 0 });
  const [index, setIndex] = useState(0);
  const fade = useRef(1);
  const elapsed = useRef(0);
  const switching = useRef(false);

  const baseY = mobile ? 3.1 : 0;
  const baseX = mobile ? 0 : 3.1;

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const it = interaction.current;
    const d = Math.min(delta, 0.05);

    // slide: troca de modelo a cada 15s com crossfade lento
    elapsed.current += d;
    if (!switching.current && elapsed.current > SHAPE_INTERVAL) switching.current = true;
    if (switching.current) {
      fade.current -= d / 1.1;
      if (fade.current <= 0) {
        fade.current = 0;
        switching.current = false;
        elapsed.current = 0;
        setIndex((i) => (i + 1) % HERO_SHAPES.length);
      }
    } else if (fade.current < 1) {
      fade.current = Math.min(1, fade.current + d / 1.1);
    }

    const sg = shapeGroup.current;
    if (sg) {
      const f = fade.current;
      const s = 0.86 + 0.14 * f;
      sg.scale.setScalar(s);
      sg.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial | undefined;
        if (!mat || !("opacity" in mat)) return;
        if (mesh.userData.baseOpacity === undefined) {
          mesh.userData.baseOpacity = mat.opacity;
        }
        mat.opacity = (mesh.userData.baseOpacity as number) * f;
      });
    }

    // giro contínuo + inércia do arrasto
    it.spinY += (it.dragging ? 0 : d * 0.18 * motion) + it.velY;
    it.spinX += it.velX;
    it.spinX = THREE.MathUtils.clamp(it.spinX, -0.9, 0.9);
    const damping = it.dragging ? 1 : Math.pow(0.92, d * 60);
    it.velX *= damping;
    it.velY *= damping;

    g.rotation.y = it.spinY;
    g.rotation.x =
      it.spinX + Math.sin(state.clock.elapsedTime * 0.2) * 0.18 * motion;

    // parallax suave seguindo a fonte única (ponteiro ou giroscópio)
    const input = getHeroInput();
    const w = HERO_INPUT_LAYERS.object * motion;
    const targetX = input.x * (mobile ? 0.35 : 0.6) * w;
    const targetY = input.y * (mobile ? 0.25 : 0.45) * w;
    parallax.current.x += (targetX - parallax.current.x) * Math.min(1, d * 3);
    parallax.current.y += (targetY - parallax.current.y) * Math.min(1, d * 3);

    g.position.x = baseX + parallax.current.x;
    g.position.y =
      baseY + parallax.current.y + Math.sin(state.clock.elapsedTime * 0.45) * 0.16;
  });

  const position: [number, number, number] = mobile ? [0, 3.1, -5.5] : [3.1, 0, -3.2];
  const scale = mobile ? 0.62 : 1;
  const Shape = HERO_SHAPES[index];

  return (
    <group ref={group} position={position} scale={scale}>
      <group ref={shapeGroup} key={index}>
        <Shape motion={motion} mobile={mobile} />
      </group>
    </group>
  );
}

export default function ParticleField() {
  const { count, dpr, size, mobile, fpsCap } = useQualityProfile();
  const ratioRef = useRef(1);
  const [liveFps, setLiveFps] = useState(fpsCap);
  const wrapper = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const interaction = useRef<Interaction>({
    dragging: false,
    velX: 0,
    velY: 0,
    spinX: 0,
    spinY: 0,
  });

  // pausa o render loop quando o hero sai da tela ou a aba fica oculta
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting && !document.hidden),
      { threshold: 0.01 },
    );
    io.observe(el);
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const motion = reduced ? 0.25 : 1;

  // fonte única de entrada (mouse ou giroscópio) compartilhada por todas as camadas
  useEffect(() => acquireHeroInput(), []);

  const dragOrigin = useRef<{ x: number; y: number } | null>(null);

  const dragRaf = useRef(0);
  const dragPos = useRef({ x: 0, y: 0 });

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragOrigin.current = { x: e.clientX, y: e.clientY };
    interaction.current.dragging = true;
    setHeroInputFrozen(true);
    interaction.current.velX = 0;
    interaction.current.velY = 0;
    setGrabbing(true);
  };

  // throttling do arrasto: acumula no rAF em vez de a cada pointermove
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragOrigin.current) return;
    dragPos.current = { x: e.clientX, y: e.clientY };
    if (dragRaf.current) return;
    dragRaf.current = requestAnimationFrame(() => {
      dragRaf.current = 0;
      const origin = dragOrigin.current;
      if (!origin) return;
      const dx = dragPos.current.x - origin.x;
      const dy = dragPos.current.y - origin.y;
      dragOrigin.current = { ...dragPos.current };
      interaction.current.velY = dx * 0.004;
      interaction.current.velX = dy * 0.003;
    });
  };

  const endDrag = () => {
    if (dragRaf.current) {
      cancelAnimationFrame(dragRaf.current);
      dragRaf.current = 0;
    }
    dragOrigin.current = null;
    interaction.current.dragging = false;
    setHeroInputFrozen(false);
    setGrabbing(false);
  };

  return (
    <div ref={wrapper} className="absolute inset-0">
      <Canvas
        dpr={dpr}
        frameloop={active ? (liveFps > 0 ? "demand" : "always") : "never"}
        camera={{ position: [0, 0, 7], fov: 55 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: false,
        }}
      >
        <FrameTicker fps={active ? liveFps : 0} />
        <PerfGovernor
          ratioRef={ratioRef}
          baseFps={fpsCap}
          fps={liveFps}
          setFps={setLiveFps}
        />
        <Dust count={count} size={size} motion={motion} ratioRef={ratioRef} />
        <HeroObject motion={motion} mobile={mobile} interaction={interaction} />
      </Canvas>

      {/* área de arrasto sobre o objeto 3D (não cobre o texto/CTAs) */}
      <div
        role="presentation"
        aria-hidden
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        style={{ touchAction: "none" }}
        className={`pointer-events-auto absolute right-0 top-0 h-[38%] w-full lg:h-full lg:w-[42%] ${
          grabbing ? "cursor-grabbing" : "cursor-grab"
        }`}
      />
    </div>
  );
}
