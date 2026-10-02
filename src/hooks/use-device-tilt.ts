import { useEffect, useState } from "react";
import {
  getTiltStatus,
  initDeviceTilt,
  requestDeviceTilt,
  subscribeTiltStatus,
  type TiltStatus,
} from "@/lib/device-tilt";

/** Estado do giroscópio + ação para pedir permissão (iOS). */
export function useDeviceTilt() {
  const [status, setStatus] = useState<TiltStatus>("unsupported");

  useEffect(() => {
    const unsub = subscribeTiltStatus(setStatus);
    setStatus(initDeviceTilt() ?? getTiltStatus());
    return () => {
      unsub();
    };
  }, []);

  return {
    status,
    needsPermission: status === "needs-permission",
    enable: async () => {
      setStatus(await requestDeviceTilt());
    },
  };
}
