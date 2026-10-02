/**
 * Sistema único de entrada do hero.
 *
 * Une mouse/caneta e giroscópio numa mesma fonte normalizada, para que
 * partículas, objeto 3D e cards reajam sempre na MESMA direção e com
 * intensidade proporcional (só muda o peso da camada).
 *
 * Convenção (igual para sensor e ponteiro):
 *   x: -1 = esquerda  ·  +1 = direita
 *   y: -1 = baixo     ·  +1 = cima
 */

import { getTilt, getTiltStatus, initDeviceTilt, subscribeTiltStatus } from "@/lib/device-tilt";

export type HeroInputSource = "none" | "pointer" | "tilt";

export type HeroInput = { x: number; y: number };

/**
 * Pesos por camada: mantêm a hierarquia de profundidade (fundo se move menos
 * que o objeto) sem inverter direção entre elementos.
 */
export const HERO_INPUT_LAYERS = {
  /** partículas de fundo (parallax lento) */
  dust: 0.45,
  /** objeto 3D central */
  object: 1,
  /** cards com tilt 3D */
  card: 0.85,
} as const;

const target: HeroInput = { x: 0, y: 0 };
const value: HeroInput = { x: 0, y: 0 };
/** valor exposto = value * ganho de fallback (objeto estável entre frames) */
const out: HeroInput = { x: 0, y: 0 };

let source: HeroInputSource = "none";
let frozen = false;
let raf = 0;
let lastFrame = 0;
let subscribers = 0;
let pointerRaf = 0;
let pointerX = 0;
let pointerY = 0;
let hasPointerListener = false;
let hasTilt = false;
let hasTouchListener = false;
let tiltUnavailable = false;
let unsubTilt: (() => void) | null = null;
let fallbackEnabled = true;
let gain = 1;

/** suavização única (lerp normalizado por tempo) para todos os consumidores */
const SMOOTHING = 0.09;
/**
 * Compensação quando não há giroscópio (desktop sem sensor, Android sem
 * hardware ou permissão negada no iOS): o parallax de mouse/toque ganha um
 * empurrãozinho para o efeito continuar perceptível — sem exagero.
 */
const FALLBACK_GAIN = 1.35;

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}

function flushPointer() {
  pointerRaf = 0;
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  target.x = clamp((pointerX / w) * 2 - 1);
  target.y = clamp(-((pointerY / h) * 2 - 1)); // y para cima
  source = "pointer";
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
  pointerX = e.clientX;
  pointerY = e.clientY;
  if (!pointerRaf) pointerRaf = requestAnimationFrame(flushPointer);
}

function onTouchMove(e: TouchEvent) {
  const t = e.touches[0];
  if (!t) return;
  pointerX = t.clientX;
  pointerY = t.clientY;
  if (!pointerRaf) pointerRaf = requestAnimationFrame(flushPointer);
}

/** Sem sensor ativo, o toque vira a fonte de parallax nos aparelhos móveis. */
function syncTouchFallback() {
  const needTouch = fallbackEnabled && tiltUnavailable && hasTilt;
  if (needTouch && !hasTouchListener) {
    hasTouchListener = true;
    window.addEventListener("touchmove", onTouchMove, { passive: true });
  } else if (!needTouch && hasTouchListener) {
    window.removeEventListener("touchmove", onTouchMove);
    hasTouchListener = false;
  }
}

function refreshTiltAvailability() {
  const s = getTiltStatus();
  tiltUnavailable = s === "unsupported" || s === "denied";
  syncTouchFallback();
}

function loop(now: number) {
  raf = requestAnimationFrame(loop);

  // giroscópio só assume quando não há arrasto ativo e o sensor está ligado
  if (hasTilt && !frozen && getTiltStatus() === "active") {
    const t = getTilt();
    target.x = clamp(t.x);
    target.y = clamp(-t.y); // sensor usa y para baixo: inverte p/ a convenção
    source = "tilt";
  }

  const dt = lastFrame ? Math.min((now - lastFrame) / 16.67, 4) : 1;
  lastFrame = now;
  const k = frozen ? Math.min(1, SMOOTHING * dt * 0.5) : Math.min(1, SMOOTHING * dt);
  value.x += (target.x - value.x) * k;
  value.y += (target.y - value.y) * k;

  // ganho entra/sai suavemente (ex.: usuário concede a permissão depois)
  const targetGain =
    fallbackEnabled && tiltUnavailable && source !== "tilt" ? FALLBACK_GAIN : 1;
  gain += (targetGain - gain) * Math.min(1, 0.04 * dt);
  out.x = clamp(value.x * gain);
  out.y = clamp(value.y * gain);
}

function start() {
  if (typeof window === "undefined") return;

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse) {
    hasTilt = true;
    initDeviceTilt();
  }
  if (!window.matchMedia("(hover: none)").matches && !hasPointerListener) {
    hasPointerListener = true;
    window.addEventListener("pointermove", onPointerMove, { passive: true });
  }
  refreshTiltAvailability();
  unsubTilt = subscribeTiltStatus(refreshTiltAvailability);
  lastFrame = 0;
  if (!raf) raf = requestAnimationFrame(loop);
}

function stop() {
  if (hasPointerListener) {
    window.removeEventListener("pointermove", onPointerMove);
    hasPointerListener = false;
  }
  if (hasTouchListener) {
    window.removeEventListener("touchmove", onTouchMove);
    hasTouchListener = false;
  }
  unsubTilt?.();
  unsubTilt = null;
  if (pointerRaf) {
    cancelAnimationFrame(pointerRaf);
    pointerRaf = 0;
  }
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  hasTilt = false;
  source = "none";
  target.x = target.y = 0;
  value.x = value.y = 0;
  out.x = out.y = 0;
  gain = 1;
}

/** Liga a fonte única enquanto houver ao menos um consumidor. */
export function acquireHeroInput(): () => void {
  if (typeof window === "undefined") return () => {};
  subscribers++;
  if (subscribers === 1) start();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers === 0) stop();
  };
}

/** Valor suavizado compartilhado (leia dentro do seu próprio frame). */
export function getHeroInput(): HeroInput {
  return out;
}

export function getHeroInputSource(): HeroInputSource {
  return source;
}

/** Congela a fonte automática (usado durante o arrasto manual do objeto). */
export function setHeroInputFrozen(next: boolean) {
  frozen = next;
}

/** Liga/desliga o reforço de parallax por mouse/toque quando não há giroscópio. */
export function setHeroInputFallback(enabled: boolean) {
  fallbackEnabled = enabled;
  syncTouchFallback();
}

/** Ganho atual aplicado (1 = normal, >1 = fallback ativo). */
export function getHeroInputGain() {
  return gain;
}
