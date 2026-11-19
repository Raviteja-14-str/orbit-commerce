// Synthetic demo code for Nexus Intelligence. Not a real system.

export const ORDER_ROUTERS = [
  "or-router-01",
  "or-router-02",
  "or-router-03",
  "or-router-04",
  "or-router-05",
  "or-router-06",
  "or-router-07",
  "or-router-08",
] as const;

export const MISSED_ROUTER = "or-router-07";

export interface HostBuild {
  host: string;
  reachable: boolean;
  build_info: { service: "order-router"; version: string };
}

/** 5.6.0 everywhere, unless NEX-32 left or-router-07 on 5.5.3. */
export function fleetBuildInfo(nex32: boolean): HostBuild[] {
  return ORDER_ROUTERS.map((host) => {
    const missed = nex32 && host === MISSED_ROUTER;
    return {
      host,
      reachable: !missed,
      build_info: { service: "order-router", version: missed ? "5.5.3" : "5.6.0" },
    };
  });
}

export function ansibleRecap(nex32: boolean): {
  recap: string;
  ok: number;
  changed: number;
  unreachable: number;
  failed: number;
  status: "SUCCESS";
} {
  if (nex32) {
    return {
      recap: "PLAY RECAP ok=7 changed=7 unreachable=1 failed=0",
      ok: 7,
      changed: 7,
      unreachable: 1,
      failed: 0,
      status: "SUCCESS",
    };
  }
  return {
    recap: "PLAY RECAP ok=8 changed=8 unreachable=0 failed=0",
    ok: 8,
    changed: 8,
    unreachable: 0,
    failed: 0,
    status: "SUCCESS",
  };
}
