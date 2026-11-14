export { todayWibRange } from "@/lib/date";

export function attemptDurationMinutes(
  startedAt: string,
  finishedAt: string | null,
): number | null {
  if (!finishedAt) return null;
  return Math.max(
    0,
    Math.round(
      (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000,
    ),
  );
}

export function percentage(correct: number | null, total: number | null): number | null {
  if (correct === null || total === null || total === 0) return null;
  return Math.round((correct / total) * 100);
}

export const ATTEMPT_STATUS_LABEL: Record<string, string> = {
  in_progress: "Sedang berlangsung",
  submitted: "Selesai",
  expired: "Waktu habis",
};
