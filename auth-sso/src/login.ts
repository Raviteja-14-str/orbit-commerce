// Synthetic demo code for Nexus Intelligence. Not a real system.

export const TENANT_DOES_NOT_EXIST = "tenant does not exist";

export interface LoginResult {
  ok: boolean;
  error?: string;
}

/** Merchant admin login. A hard-deleted tenant fails closed with this error. */
export function login(tenantExists: boolean, passwordOk: boolean): LoginResult {
  if (!tenantExists) {
    return { ok: false, error: TENANT_DOES_NOT_EXIST };
  }
  if (!passwordOk) {
    return { ok: false, error: "invalid credentials" };
  }
  return { ok: true };
}
