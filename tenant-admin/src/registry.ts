// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface Entity {
  id: string;
  kind: "tenant" | "loyalty-addon";
}

export interface DeleteResult {
  status: number;
  audit: string;
}

/**
 * Tenant registry. DELETE /v2/entities/:id removes the row permanently.
 * There is no suspend flag on this route. The actor is recorded on the audit line.
 */
export class TenantRegistry {
  private readonly entities = new Map<string, Entity>();

  put(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  deleteEntity(id: string, actor: string, ts: string): DeleteResult {
    this.entities.delete(id);
    return {
      status: 204,
      audit: `${ts} actor=${actor} DELETE /v2/entities/${id} status=204`,
    };
  }
}

/**
 * Restore a single entity from a backup point the caller already has.
 * This repository does not contain backup snapshots or restore-point ids.
 */
export function restoreEntity(registry: TenantRegistry, backup: Entity | null): void {
  if (!backup) {
    throw new Error("restore point not available");
  }
  registry.put(backup);
}
