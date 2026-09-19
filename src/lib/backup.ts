export const BACKUP_INTERVALS = [
  { id: "10m", label: "Every 10 minutes", minutes: 10 },
  { id: "1h", label: "Every hour", minutes: 60 },
  { id: "6h", label: "Every 6 hours", minutes: 360 },
  { id: "12h", label: "Every 12 hours", minutes: 720 },
  { id: "1d", label: "Every day", minutes: 1440 },
] as const;

export type BackupIntervalId = (typeof BACKUP_INTERVALS)[number]["id"];

export function backupIntervalLabel(minutes: number) {
  return BACKUP_INTERVALS.find((i) => i.minutes === minutes)?.label ?? `Every ${minutes} min`;
}

export function resolveBackupMinutes(ops: { scheduleBackupMinutes?: number; scheduleBackupHours?: number } | undefined) {
  if (ops?.scheduleBackupMinutes && ops.scheduleBackupMinutes > 0) return ops.scheduleBackupMinutes;
  if (ops?.scheduleBackupHours && ops.scheduleBackupHours > 0) return Math.round(ops.scheduleBackupHours * 60);
  return 360;
}
