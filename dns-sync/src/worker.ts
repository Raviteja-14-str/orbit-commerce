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
 * dns-sync 2.3.0. Workers in az-a, az-b, and az-c apply plans active-active.
 * Freshness is checked once, when the worker starts a plan. applyEndpoint does
 * not check again, so a worker that was fresh at start can publish a generation
 * that a faster worker has already superseded. cleanup then deletes that plan
 * and the record set it owns, and will not put the newer records back.
 */
export class Worker {
  name: string;
  state: DnsState;
  /** Set after the first freshness check. Later applies do not repeat it. */
  private freshnessChecked = false;

  constructor(name: string, state: DnsState) {
    this.name = name;
    this.state = state;
  }

  start(plan: Plan, ts: string): boolean {
    if (!this.freshnessChecked) {
      if (plan.gen < this.state.latestApplied) {
        this.state.logs.push(
          `${ts} worker=${this.name} plan=${plan.gen} rejected stale (latest_applied=${this.state.latestApplied})`,
        );
        return false;
      }
      this.state.logs.push(
        `${ts} worker=${this.name} plan=${plan.gen} freshness_check=ok (latest_applied=${this.state.latestApplied}) starting`,
      );
      this.freshnessChecked = true;
    }
    this.state.plans.set(plan.gen, plan);
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

  /**
   * Publish one endpoint. The generation is not compared with latestApplied.
   * If cleanup has already removed the plan recorded as active, refuse rather
   * than repair the record set.
   */
  applyEndpoint(plan: Plan, endpoint: string, ts: string): boolean {
    const active = this.state.activePlan.get(endpoint);
    if (active !== undefined && !this.state.plans.has(active)) {
      this.state.logs.push(
        `${ts} worker=${this.name} ERROR cannot apply plan ${plan.gen}: active plan ${active} for ${endpoint} not found; refusing (state inconsistent)`,
      );
      return false;
    }
    if (!this.state.plans.has(plan.gen)) {
      this.state.plans.set(plan.gen, plan);
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
   * Delete every plan older than (newestGen - 8). Record sets those plans own
   * are removed with them, including a record a slower worker just published.
   * The newer plan's addresses are not restored, so the name can go empty.
   */
  cleanup(newestGen: number, ts: string): number[] {
    const threshold = newestGen - 8;
    const deleted: number[] = [];
    const gens = [...this.state.plans.keys()].sort((a, b) => a - b);
    for (const gen of gens) {
      if (gen >= threshold) {
        continue;
      }
      for (const [name, record] of [...this.state.endpoints.entries()]) {
        if (record.ownerGen === gen) {
          this.state.endpoints.delete(name);
        }
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
