// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface Plan {
  gen: number;
  endpoints: Record<string, string[]>;
}

export interface EndpointRecord {
  addrs: string[];
  ownerGen: number;
}

export class DnsState {
  latestApplied = 0;
  plans = new Map<number, Plan>();
  endpoints = new Map<string, EndpointRecord>();
  activePlan = new Map<string, number>();
  logs: string[] = [];
}

/**
 * dns-sync 2.2.0. One active worker. Freshness is checked again at apply time,
 * and cleanup will not delete a plan that still owns a live record set.
 */
export class Worker {
  name: string;
  state: DnsState;

  constructor(name: string, state: DnsState) {
    this.name = name;
    this.state = state;
  }

  start(plan: Plan, ts: string): boolean {
    if (plan.gen < this.state.latestApplied) {
      this.state.logs.push(
        `${ts} worker=${this.name} plan=${plan.gen} rejected stale (latest_applied=${this.state.latestApplied})`,
      );
      return false;
    }
    this.state.plans.set(plan.gen, plan);
    this.state.logs.push(
      `${ts} worker=${this.name} plan=${plan.gen} freshness_check=ok (latest_applied=${this.state.latestApplied}) starting`,
    );
    return true;
  }

  conflict(endpoint: string, retry: number, ts: string): void {
    this.state.logs.push(`${ts} worker=${this.name} endpoint=${endpoint} txn_conflict retry=${retry}`);
  }

  private publish(plan: Plan, endpoint: string): boolean {
    const addrs = plan.endpoints[endpoint];
    if (!addrs) {
      return false;
    }
    this.state.endpoints.set(endpoint, { addrs: [...addrs], ownerGen: plan.gen });
    this.state.activePlan.set(endpoint, plan.gen);
    if (plan.gen > this.state.latestApplied) {
      this.state.latestApplied = plan.gen;
    }
    return true;
  }

  /** Re-checks freshness. A plan that lost the race is not written. */
  applyEndpoint(plan: Plan, endpoint: string, ts: string): boolean {
    if (!this.state.plans.has(plan.gen)) {
      this.state.plans.set(plan.gen, plan);
    }
    if (plan.gen < this.state.latestApplied) {
      this.state.logs.push(`${ts} worker=${this.name} plan=${plan.gen} skipped stale endpoint=${endpoint}`);
      return false;
    }
    if (!this.publish(plan, endpoint)) {
      return false;
    }
    this.state.logs.push(`${ts} worker=${this.name} plan=${plan.gen} applied endpoint=${endpoint}`);
    return true;
  }

  applyAll(plan: Plan, ts: string): number {
    if (!this.start(plan, ts)) {
      return 0;
    }
    const names = Object.keys(plan.endpoints);
    let applied = 0;
    for (const name of names) {
      if (plan.gen < this.state.latestApplied) {
        continue;
      }
      if (this.publish(plan, name)) {
        applied += 1;
      }
    }
    this.state.logs.push(`${ts} worker=${this.name} plan=${plan.gen} applied endpoints=${applied}/${names.length}`);
    return applied;
  }

  /**
   * Delete plan objects older than (newestGen - 8) when they do not own a live endpoint.
   * Live record sets are left in place.
   */
  cleanup(newestGen: number, ts: string): number[] {
    const threshold = newestGen - 8;
    const deleted: number[] = [];
    const gens = [...this.state.plans.keys()].sort((a, b) => a - b);
    for (const gen of gens) {
      if (gen >= threshold) {
        continue;
      }
      let ownsLive = false;
      for (const record of this.state.endpoints.values()) {
        if (record.ownerGen === gen) {
          ownsLive = true;
        }
      }
      if (ownsLive) {
        continue;
      }
      this.state.plans.delete(gen);
      deleted.push(gen);
    }
    if (deleted.length > 0) {
      this.state.logs.push(
        `${ts} worker=${this.name} cleanup deleted_plans=[${deleted[0]}..${deleted[deleted.length - 1]}]`,
      );
    }
    return deleted;
  }
}
