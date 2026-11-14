export type ResultFilters = {
  studentId: string | null;
  testId: string | null;
  level: number | null;
  from: string | null;
  to: string | null;
  status: "in_progress" | "submitted" | "expired" | null;
  page: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseResultFilters(params: URLSearchParams): ResultFilters {
  const studentId = params.get("student");
  const testId = params.get("test");
  const levelRaw = Number.parseInt(params.get("level") ?? "", 10);
  const statusRaw = params.get("status");
  const from = params.get("from");
  const to = params.get("to");
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  return {
    studentId: studentId && UUID.test(studentId) ? studentId : null,
    testId: testId && UUID.test(testId) ? testId : null,
    level: levelRaw >= 1 && levelRaw <= 6 ? levelRaw : null,
    from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null,
    to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : null,
    status:
      statusRaw === "in_progress" ||
      statusRaw === "submitted" ||
      statusRaw === "expired"
        ? statusRaw
        : null,
    page,
  };
}

export function resultFilterQuery(filters: ResultFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.studentId) params.set("student", filters.studentId);
  if (filters.testId) params.set("test", filters.testId);
  if (filters.level) params.set("level", String(filters.level));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.status) params.set("status", filters.status);
  return params;
}

export function hasActiveFilters(filters: ResultFilters): boolean {
  return Boolean(
    filters.studentId ||
      filters.testId ||
      filters.level ||
      filters.from ||
      filters.to ||
      filters.status,
  );
}
