const WIB = "Asia/Jakarta";

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: WIB,
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return `${new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: WIB,
  }).format(new Date(value))} WIB`;
}

export function formatTime(value: string | Date): string {
  return `${new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: WIB,
  }).format(new Date(value))} WIB`;
}

export function formatDuration(minutes: number): string {
  return `${minutes} menit`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(value)} ${units[unitIndex]}`;
}
