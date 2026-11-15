import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  attemptDurationMinutes,
  ATTEMPT_STATUS_LABEL,
  percentage,
} from "@/lib/attempts";
import { parseResultFilters } from "@/lib/results-filter";
import { searchStudentIds } from "@/lib/results-search";
import { wibDayEnd, wibDayStart } from "@/lib/date";

function csvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET(request: NextRequest) {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const filters = parseResultFilters(request.nextUrl.searchParams);
  const supabase = await createClient();

  const testsResult = await supabase
    .from("tests")
    .select("id, level")
    .order("created_at", { ascending: false });
  const tests = testsResult.data ?? [];

  let query = supabase
    .from("attempts")
    .select(
      "id, status, correct_count, total_count, listening_correct, listening_total, reading_correct, reading_total, started_at, submitted_at, profiles(full_name, username), tests(title, level)",
    );

  if (filters.studentId) query = query.eq("student_id", filters.studentId);
  if (filters.testId) query = query.eq("test_id", filters.testId);
  if (filters.q) {
    const studentSearch = await searchStudentIds(supabase, filters.q);
    if (studentSearch.failed) {
      return NextResponse.json(
        { error: "Gagal membuat CSV." },
        { status: 500 },
      );
    }
    if (studentSearch.ids.length === 0) {
      return csvResponse([], filters);
    }
    query = query.in("student_id", studentSearch.ids);
  }
  if (filters.level) {
    const ids = tests
      .filter((test) => test.level === filters.level)
      .map((test) => test.id);
    if (ids.length === 0) {
      return csvResponse([], filters);
    }
    query = query.in("test_id", ids);
  }
  if (filters.status) query = query.eq("status", filters.status);
  const fromIso = filters.from ? wibDayStart(filters.from) : null;
  const toIso = filters.to ? wibDayEnd(filters.to) : null;
  if (fromIso) query = query.gte("submitted_at", fromIso);
  if (toIso) query = query.lte("submitted_at", toIso);

  const { data, error } = await query.order("started_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Gagal membuat CSV." },
      { status: 500 },
    );
  }

  return csvResponse(data ?? [], filters);
}

function csvResponse(
  rows: {
    status: string;
    correct_count: number | null;
    total_count: number | null;
    listening_correct: number | null;
    listening_total: number | null;
    reading_correct: number | null;
    reading_total: number | null;
    started_at: string;
    submitted_at: string | null;
    profiles: { full_name: string; username: string } | null;
    tests: { title: string; level: number } | null;
  }[],
  filters: { level: number | null },
): NextResponse {
  const header = [
    "Nama murid",
    "Username",
    "Tes",
    "Level",
    "Mulai (WIB)",
    "Selesai (WIB)",
    "Durasi (menit)",
    "Benar",
    "Total soal",
    "Persentase",
    "Listening benar",
    "Listening total",
    "Reading benar",
    "Reading total",
    "Status",
  ];

  const lines = [header.map(csvCell).join(",")];

  for (const row of rows) {
    const percent = percentage(row.correct_count, row.total_count);
    const duration = attemptDurationMinutes(row.started_at, row.submitted_at);
    lines.push(
      [
        row.profiles?.full_name ?? "",
        row.profiles?.username ?? "",
        row.tests?.title ?? "",
        row.tests?.level ?? (filters.level ?? ""),
        formatDateTime(row.started_at),
        row.submitted_at ? formatDateTime(row.submitted_at) : "",
        duration ?? "",
        row.correct_count ?? "",
        row.total_count ?? "",
        percent ?? "",
        row.listening_correct ?? "",
        row.listening_total ?? "",
        row.reading_correct ?? "",
        row.reading_total ?? "",
        ATTEMPT_STATUS_LABEL[row.status] ?? row.status,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const body = `\uFEFF${lines.join("\r\n")}\r\n`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hasil-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
