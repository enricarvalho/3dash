/**
 * Giroscópio compartilhado (Device Orientation API).
 * Mantém um único listener global e expõe valores normalizados -1..1,
 * já suavizados por rAF. Consumidores leem `getTilt()` no próprio frame.
 */

export type TiltStatus = "unsupported" | "needs-permission" | "active" | "denied";

type Perm = { requestPermission?: () => Promise<"granted" | "denied"> };

const target = { x: 0, y: 0 };
const smooth = { x: 0, y: 0 };

let status: TiltStatus = "unsupported";
let listening = false;
let raf = 0;
let gotEvent = false;
let liveCheck = 0;
let mode: "orientation" | "motion" = "orientation";
let pendingRequest: Promise<TiltStatus> | null = null;
const STORAGE_KEY = "3dc:tilt-permission";
const statusSubs = new Set<(s: TiltStatus) => void>();

function readStored(): "granted" | "denied" | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function storePermission(v: "granted" | "denied") {
  try {
    sessionStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* modo privado: ignora */
  }
}

/** Só iOS/iPadOS Safari expõe requestPermission — e só em contexto seguro (https). */
function permissionApi(): Perm | null {
  if (typeof window === "undefined" || !window.isSecureContext) return null;
  const orient = window.DeviceOrientationEvent as unknown as Perm | undefined;
  if (orient && typeof orient.requestPermission === "function") return orient;
  const motion = window.DeviceMotionEvent as unknown as Perm | undefined;
  if (motion && typeof motion.requestPermission === "function") return motion;
  return null;
}

function needsExplicitPermission(): boolean {
  return permissionApi() !== null;
}

/**
 * Perfil de capacidade: aparelhos mais simples recebem amplitude menor,
 * suavização mais forte e taxa de amostragem reduzida (sensor ruidoso + GPU fraca).
 */
export type TiltProfile = {
  tier: "low" | "mid" | "high";
  /** graus de inclinação que saturam o efeito (amplitude) */
  range: number;
  /** fator de lerp por frame a 60fps */
  smoothing: number;
  /** zona morta em graus, corta micro-tremores */
  deadzone: number;
  /** intervalo mínimo entre amostras do sensor (ms) */
  sampleMs: number;
};

function detectProfile(): TiltProfile {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.min(window.innerWidth, window.innerHeight);

  const score =
    (cores >= 8 ? 2 : cores >= 6 ? 1 : 0) +
    (memory >= 6 ? 2 : memory >= 4 ? 1 : 0) +
    (dpr >= 3 ? 1 : 0) +
    (w >= 390 ? 1 : 0);

  if (score <= 2) {
    return { tier: "low", range: 32, smoothing: 0.035, deadzone: 1.6, sampleMs: 50 };
  }
  if (score <= 4) {
    return { tier: "mid", range: 27, smoothing: 0.055, deadzone: 1.0, sampleMs: 33 };
  }
  return { tier: "high", range: 22, smoothing: 0.08, deadzone: 0.6, sampleMs: 16 };
}

let profile: TiltProfile = {
  tier: "mid",
  range: 27,
  smoothing: 0.055,
  deadzone: 1.0,
  sampleMs: 33,
};

// calibração automática do "neutro": as primeiras amostras definem como
// o usuário realmente segura o aparelho, em vez de assumir beta = 45°.
const neutral = { beta: 45, gamma: 0 };
let calibrationSamples = 0;
const CALIBRATION_TARGET = 12;
let lastSample = 0;
let lastFrame = 0;

function setStatus(s: TiltStatus) {
  if (status === s) return;
  status = s;
  statusSubs.forEach((cb) => cb(s));
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function applyDeadzone(deg: number) {
  const dz = profile.deadzone;
  if (Math.abs(deg) <= dz) return 0;
  return deg > 0 ? deg - dz : deg + dz;
}

function onOrientation(e: DeviceOrientationEvent) {
  markAlive();
  const now = performance.now();
  if (now - lastSample < profile.sampleMs) return; // throttle adaptativo
  lastSample = now;

  const gamma = e.gamma ?? 0; // esquerda/direita (-90..90)
  const beta = e.beta ?? 0; // frente/trás (-180..180)
  handleAngles(gamma, beta);
}

/**
 * Fallback: alguns aparelhos (e navegadores com DeviceOrientation desativado)
 * só entregam DeviceMotion. Derivamos os ângulos a partir do vetor gravidade.
 */
function onMotion(e: DeviceMotionEvent) {
  const a = e.accelerationIncludingGravity;
  if (!a || (a.x == null && a.y == null && a.z == null)) return;
  markAlive();
  const now = performance.now();
  if (now - lastSample < profile.sampleMs) return;
  lastSample = now;

  const ax = a.x ?? 0;
  const ay = a.y ?? 0;
  const az = a.z ?? 0;
  const deg = 180 / Math.PI;
  const gamma = -Math.atan2(ax, Math.hypot(ay, az)) * deg;
  const beta = Math.atan2(ay, Math.hypot(ax, az)) * deg;
  handleAngles(gamma, beta);
}

function markAlive() {
  if (gotEvent) return;
  gotEvent = true;
  if (liveCheck) {
    clearTimeout(liveCheck);
    liveCheck = 0;
  }
}

function handleAngles(gamma: number, beta: number) {
  // auto-calibração: média das primeiras leituras vira o ponto neutro
  if (calibrationSamples < CALIBRATION_TARGET) {
    calibrationSamples++;
    const k = 1 / calibrationSamples;
    neutral.beta += (beta - neutral.beta) * k;
    neutral.gamma += (gamma - neutral.gamma) * k;
    return;
  }

  let dx = applyDeadzone(gamma - neutral.gamma);
  let dy = applyDeadzone(beta - neutral.beta);

  // respeita a rotação da tela (paisagem inverte/troca os eixos)
  const angle =
    (typeof screen !== "undefined" && screen.orientation?.angle) || 0;
  if (angle === 90) [dx, dy] = [dy, -dx];
  else if (angle === 270) [dx, dy] = [-dy, dx];
  else if (angle === 180) [dx, dy] = [-dx, -dy];

  // no modo acelerômetro o sinal é mais ruidoso: amplitude um pouco menor
  const range = profile.range * (mode === "motion" ? 1.35 : 1);
  target.x = clamp(dx / range, -1, 1);
  target.y = clamp(dy / range, -1, 1);
}

function loop(now: number) {
  raf = requestAnimationFrame(loop);
  // lerp normalizado por tempo: mesma sensação em 30 ou 60 fps
  const dt = lastFrame ? Math.min((now - lastFrame) / 16.67, 4) : 1;
  lastFrame = now;
  const k = Math.min(1, profile.smoothing * dt);
  smooth.x += (target.x - smooth.x) * k;
  smooth.y += (target.y - smooth.y) * k;
}

function detachSensors() {
  window.removeEventListener("deviceorientation", onOrientation);
  window.removeEventListener("devicemotion", onMotion);
}

function teardown() {
  detachSensors();
  window.removeEventListener("orientationchange", recalibrate);
  listening = false;
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  target.x = target.y = 0;
  smooth.x = smooth.y = 0;
}

/** Aguarda o primeiro evento; se não vier, tenta o próximo modo. */
function watchLiveness(onDead: () => void) {
  gotEvent = false;
  if (liveCheck) clearTimeout(liveCheck);
  liveCheck = window.setTimeout(() => {
    liveCheck = 0;
    if (!gotEvent) onDead();
  }, 2000);
}

function attach(next: "orientation" | "motion") {
  mode = next;
  detachSensors();
  calibrationSamples = 0;
  neutral.beta = next === "motion" ? 0 : 45;
  neutral.gamma = 0;
  if (next === "orientation") {
    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    watchLiveness(() => {
      // sem DeviceOrientation utilizável: cai para o acelerômetro
      if (typeof window.DeviceMotionEvent !== "undefined") attach("motion");
      else {
        teardown();
        setStatus("unsupported");
      }
    });
  } else {
    window.addEventListener("devicemotion", onMotion, { passive: true });
    watchLiveness(() => {
      teardown();
      setStatus("unsupported");
    });
  }
}

function start() {
  if (listening) return;
  listening = true;
  profile = detectProfile();
  lastFrame = 0;
  // recalibra ao girar a tela
  window.addEventListener("orientationchange", recalibrate, { passive: true });
  if (!raf) raf = requestAnimationFrame(loop);
  setStatus("active");
  attach(
    typeof window.DeviceOrientationEvent !== "undefined" ? "orientation" : "motion",
  );
}

/** Zera o ponto neutro (recalibra na posição atual do aparelho). */
export function recalibrate() {
  calibrationSamples = 0;
  target.x = 0;
  target.y = 0;
}

export function getTiltProfile() {
  return profile;
}

export function initDeviceTilt(): TiltStatus {
  const hasSensorApi =
    typeof window !== "undefined" &&
    ("DeviceOrientationEvent" in window || "DeviceMotionEvent" in window);
  if (!hasSensorApi) {
    setStatus("unsupported");
    return status;
  }
  const hasSensorPointer = window.matchMedia("(pointer: coarse)").matches;
  if (!hasSensorPointer) {
    setStatus("unsupported"); // desktop usa o mouse
    return status;
  }
  if (status === "active" || status === "denied") return status;

  if (needsExplicitPermission()) {
    const stored = readStored();
    if (stored === "denied") {
      setStatus("denied"); // já recusou nesta sessão: não pede de novo
      return status;
    }
    if (stored === "granted") {
      // permissão já concedida nesta sessão: revalida no primeiro toque, sem botão
      const resume = () => {
        window.removeEventListener("touchend", resume);
        void requestDeviceTilt();
      };
      window.addEventListener("touchend", resume, { once: true, passive: true });
    }
    setStatus("needs-permission");
    return status;
  }
  start(); // Android: ativa direto
  return status;
}

export async function requestDeviceTilt(): Promise<TiltStatus> {
  if (status === "active" || status === "denied") return status;
  if (pendingRequest) return pendingRequest; // evita chamadas simultâneas

  const perm = permissionApi();
  if (!perm) {
    start();
    return status;
  }
  pendingRequest = (async () => {
    try {
      const res = await perm.requestPermission!();
      if (res === "granted") {
        storePermission("granted");
        start();
      } else {
        storePermission("denied");
        setStatus("denied");
      }
    } catch {
      // chamada fora de gesto do usuário: mantém o botão disponível
      if ((status as TiltStatus) !== "active") setStatus("needs-permission");
    } finally {
      pendingRequest = null;
    }
    return status;
  })();

  return pendingRequest;
}

export function getTilt() {
  return smooth;
}

export function getTiltStatus() {
  return status;
}

export function subscribeTiltStatus(cb: (s: TiltStatus) => void) {
  statusSubs.add(cb);
  return () => statusSubs.delete(cb);
}
