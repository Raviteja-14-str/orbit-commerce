// Synthetic demo code for Nexus Intelligence. Not a real system.

import { restoreEntity, type Entity, type TenantRegistry } from "./registry.ts";

/** Maintenance job name. The run log for a given window is not stored in git. */
export const JOB_NAME = "TEN-CLEAN-2026-11";

/** Service account recorded on DELETE /v2/entities/:id. */
export const ACTOR = "svc-maint-batch";

/**
 * Decommission legacy Loyalty add-on entities during a maintenance window.
 *
 * The id list is read at runtime from TEN_CLEAN_INPUT_URI (supplied by the
 * Loyalty team for that window). The list is not in this repository. The job
 * run log is shipped to the log pipeline and is not in this repository either.
 *
 * DELETE /v2/entities/:id hard-deletes whatever entity id it is given. This
 * job does not check that an id is a loyalty-addon rather than a tenant.
 * Restore needs a backup point the caller already holds; none are stored here.
 */
export function runMaintenance(registry: TenantRegistry, ids: string[], tsFor: (index: number) => string): string[] {
  const audits: string[] = [];
  ids.forEach((id, index) => {
    const result = registry.deleteEntity(id, ACTOR, tsFor(index));
    audits.push(result.audit);
  });
  return audits;
}

export function restoreFromBackup(registry: TenantRegistry, backup: Entity | null): void {
  restoreEntity(registry, backup);
}
