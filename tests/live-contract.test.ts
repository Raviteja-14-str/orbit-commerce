// Synthetic demo code for Nexus Intelligence. Not a real system.

import assert from "node:assert/strict";
import test from "node:test";
import { formatBuilderLog, columnQuery } from "../risk-feature-builder/src/build-features.ts";
import { emptyFaults, featureCount, nex28Phase } from "../live/lib/faults.ts";
import { ansibleRecap, fleetBuildInfo } from "../live/lib/fleet.ts";

test("NEX-28 phase fails for the first half of each 5 minute cycle", () => {
  const faults = emptyFaults();
  const start = Date.parse("2026-11-06T11:28:00.000Z");
  faults["NEX-28"].active = true;
  faults["NEX-28"].activatedAt = new Date(start).toISOString();
  faults["NEX-28"].periodMs = 300_000;
  faults["NEX-28"].failMs = 150_000;
  assert.equal(nex28Phase(faults["NEX-28"], start + 1_000), "failing");
  assert.equal(featureCount(faults["NEX-28"], start + 1_000), 412);
  assert.equal(nex28Phase(faults["NEX-28"], start + 150_000), "healthy");
  assert.equal(featureCount(faults["NEX-28"], start + 150_000), 189);
  assert.equal(nex28Phase(faults["NEX-28"], start + 300_000), "failing");
  assert.equal(nex28Phase(faults["NEX-28"], start), "failing");
});

test("NEX-32 fleet leaves only or-router-07 on 5.5.3 and reports a successful recap", () => {
  const hosts = fleetBuildInfo(true);
  assert.equal(hosts.length, 8);
  assert.deepEqual(
    hosts.map((host) => [host.host, host.build_info.version, host.reachable]),
    [
      ["or-router-01", "5.6.0", true],
      ["or-router-02", "5.6.0", true],
      ["or-router-03", "5.6.0", true],
      ["or-router-04", "5.6.0", true],
      ["or-router-05", "5.6.0", true],
      ["or-router-06", "5.6.0", true],
      ["or-router-07", "5.5.3", false],
      ["or-router-08", "5.6.0", true],
    ],
  );
  const recap = ansibleRecap(true);
  assert.equal(recap.recap, "PLAY RECAP ok=7 changed=7 unreachable=1 failed=0");
  assert.equal(recap.status, "SUCCESS");
  const line = formatBuilderLog(
    "11:28:00Z",
    7730,
    "wh-1",
    columnQuery(),
    412,
    79_312,
  );
  assert.equal(
    line,
    "11:28:00Z gen=7730 node=wh-1 query='SELECT name, type FROM system.columns WHERE table = ''txn_features'' ORDER BY name' rows=412 file_bytes=79,312",
  );
});
