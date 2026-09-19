import assert from "node:assert/strict";
import test from "node:test";
import { BACKUP_INTERVALS, backupIntervalLabel, resolveBackupMinutes } from "./backup.ts";
import { backupDue } from "./ops.ts";

test("backup intervals cover 10m through 1d", () => {
  assert.deepEqual(
    BACKUP_INTERVALS.map((i) => i.minutes),
    [10, 60, 360, 720, 1440],
  );
  assert.equal(backupIntervalLabel(10), "Every 10 minutes");
  assert.equal(backupIntervalLabel(1440), "Every day");
});

test("resolveBackupMinutes prefers minutes over hours", () => {
  assert.equal(resolveBackupMinutes({ scheduleBackupMinutes: 10, scheduleBackupHours: 6 }), 10);
  assert.equal(resolveBackupMinutes({ scheduleBackupHours: 6 }), 360);
  assert.equal(resolveBackupMinutes({}), 360);
});

test("backupDue uses minutes", () => {
  assert.equal(backupDue(null, 10), true);
  assert.equal(backupDue(new Date().toISOString(), 10), false);
  const hourAgo = new Date(Date.now() - 61 * 60 * 1000).toISOString();
  assert.equal(backupDue(hourAgo, 60), true);
});
