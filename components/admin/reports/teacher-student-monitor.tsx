"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  GraduationCap,
  User,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  TeacherMonitorData,
  StudentMonitorData,
  StudentAttemptSummary,
} from "@/app/admin/monitoring/page";

// Baris progress mini/indikator visual nilai
function ScoreBar({ percentage }: { percentage: number }) {
  const isGood = percentage >= 75;
  const isMedium = percentage >= 60 && percentage < 75;

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-[2px] bg-[#E2DFD5]">
        <div
          className={cn(
            "h-full rounded-[2px]",
            isGood
              ? "bg-[#1B5E3A]"
              : isMedium
                ? "bg-[#D97706]"
                : "bg-[#A62626]",
          )}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
      <span
        className={cn(
          "font-mono text-xs font-semibold tabular",
          isGood
            ? "text-[#1B5E3A]"
            : isMedium
              ? "text-[#D97706]"
              : "text-[#A62626]",
        )}
      >
        {percentage}%
      </span>
    </div>
  );
}

// Grafik SVG Sparkline / Trend Nilai Murid
function ScoreTrendChart({ attempts }: { attempts: StudentAttemptSummary[] }) {
  if (attempts.length === 0) {
    return (
      <span className="font-mono text-xs text-[#71717A]">Belum ada data</span>
    );
  }

  // Attempts diurutkan dari yang paling lama ke yang terbaru untuk grafik
  const chronological = [...attempts].reverse();
  const width = 160;
  const height = 36;
  const paddingX = 8;
  const paddingY = 6;

  const points = chronological.map((att, i) => {
    const x =
      chronological.length === 1
        ? width / 2
        : paddingX + (i / (chronological.length - 1)) * (width - 2 * paddingX);
    // Y terbalik (0 di atas, 100 di bawah)
    const y = height - paddingY - (att.percentage / 100) * (height - 2 * paddingY);
    return { x, y, pct: att.percentage, title: att.testTitle };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  return (
    <div className="flex items-center gap-2" title={`Riwayat ${attempts.length} tes terakhir`}>
      <svg
        width={width}
        height={height}
        className="rounded-[2px] border border-[#DCD9D0] bg-[#F8F7F3]"
      >
        {/* Garis batas kelulusan 60% */}
        <line
          x1={paddingX}
          y1={height - paddingY - 0.6 * (height - 2 * paddingY)}
          x2={width - paddingX}
          y2={height - paddingY - 0.6 * (height - 2 * paddingY)}
          stroke="#DCD9D0"
          strokeDasharray="2 2"
          strokeWidth={1}
        />

        {/* Garis trend */}
        {points.length > 1 && (
          <path
            d={pathD}
            fill="none"
            stroke="#18181B"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Titik data */}
        {points.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r={idx === points.length - 1 ? 3 : 2}
            className={cn(
              pt.pct >= 60 ? "fill-[#1B5E3A]" : "fill-[#A62626]",
            )}
            stroke="#FFFFFF"
            strokeWidth={0.75}
          />
        ))}
      </svg>
      <span className="font-mono text-[11px] text-[#71717A]">
        ({attempts.length} tes)
      </span>
    </div>
  );
}

// Baris Detail Murid
function StudentRowView({ student }: { student: StudentMonitorData }) {
  const [showAttempts, setShowAttempts] = React.useState(false);

  return (
    <div className="flex flex-col border-b border-[#DCD9D0] last:border-b-0">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-[#F8F7F3] transition-colors">
        {/* Identitas Murid */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-[2px] bg-[#ECEAE3] text-[#52525B]">
            <User size={14} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#18181B]">
                {student.fullName}
              </span>
              {!student.isActive && (
                <Badge tone="muted">Nonaktif</Badge>
              )}
            </div>
            <span className="font-mono text-xs text-[#71717A]">
              @{student.username}
            </span>
          </div>
        </div>

        {/* Grafik Tren */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#71717A]">
            Tren Nilai
          </span>
          <ScoreTrendChart attempts={student.attempts} />
        </div>

        {/* Rata-rata & Terkini */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#71717A]">
              Rata-rata
            </span>
            {student.averageScore !== null ? (
              <ScoreBar percentage={student.averageScore} />
            ) : (
              <span className="font-mono text-xs text-[#71717A]">-</span>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#71717A]">
              Terakhir
            </span>
            {student.latestScore !== null ? (
              <ScoreBar percentage={student.latestScore} />
            ) : (
              <span className="font-mono text-xs text-[#71717A]">-</span>
            )}
          </div>

          {/* Tombol Expand Riwayat */}
          {student.attempts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAttempts((v) => !v)}
              className="flex items-center gap-1 rounded-[2px] border border-[#DCD9D0] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#18181B] hover:bg-[#F4F3EF] transition-colors"
            >
              <span>{showAttempts ? "Tutup" : "Riwayat"}</span>
              {showAttempts ? (
                <ChevronDown size={13} strokeWidth={1.5} />
              ) : (
                <ChevronRight size={13} strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabel Riwayat Attempt Murid */}
      {showAttempts && student.attempts.length > 0 && (
        <div className="bg-[#ECEAE3]/40 px-6 py-3 border-t border-[#DCD9D0]">
          <p className="mb-2 text-xs font-semibold text-[#52525B]">
            Riwayat Evaluasi ({student.attempts.length} pengerjaan)
          </p>
          <div className="flex flex-col gap-1.5">
            {student.attempts.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between rounded-[2px] border border-[#DCD9D0] bg-[#FFFFFF] px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#18181B]">
                    {att.testTitle}
                  </span>
                  <Badge tone="neutral">HSK {att.testLevel}</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono tabular text-[#71717A]">
                    {att.correctCount}/{att.totalCount} benar
                  </span>
                  <ScoreBar percentage={att.percentage} />
                  <span className="font-mono text-[11px] text-[#71717A]">
                    {att.submittedAt ? formatDateTime(att.submittedAt) : "-"}
                  </span>
                  <Link
                    href={`/admin/results/${att.id}`}
                    className="text-primary underline-offset-2 hover:underline font-medium"
                  >
                    Detail
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Kartu Guru beserta daftar muridnya
function TeacherCard({ teacher }: { teacher: TeacherMonitorData }) {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <div className="rounded-[3px] border border-[#DCD9D0] bg-[#FFFFFF] overflow-hidden">
      {/* Header Guru */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-[#F8F7F3] px-4 py-3 text-left transition-colors hover:bg-[#ECEAE3]/60 border-b border-[#DCD9D0]"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[2px] bg-[#18181B] text-[#FFFFFF]">
            <GraduationCap size={16} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-[#18181B]">
                {teacher.fullName}
              </span>
              {teacher.isActive ? (
                <Badge tone="success">Aktif</Badge>
              ) : (
                <Badge tone="muted">Nonaktif</Badge>
              )}
            </div>
            <span className="font-mono text-xs text-[#71717A]">
              @{teacher.username} · {teacher.studentCount} murid
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#71717A]">
              Rata-rata Kelas
            </span>
            <span className="font-mono text-sm font-bold text-[#18181B]">
              {teacher.overallAverage !== null
                ? `${teacher.overallAverage}%`
                : "-"}
            </span>
          </div>

          {teacher.weakStudentCount > 0 && (
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#A62626]">
                Perlu Bantuan
              </span>
              <span className="font-mono text-sm font-bold text-[#A62626]">
                {teacher.weakStudentCount} murid
              </span>
            </div>
          )}

          <div className="text-[#52525B]">
            {isOpen ? (
              <ChevronDown size={18} strokeWidth={1.5} />
            ) : (
              <ChevronRight size={18} strokeWidth={1.5} />
            )}
          </div>
        </div>
      </button>

      {/* Daftar Murid dalam Guru ini */}
      {isOpen && (
        <div>
          {teacher.students.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#71717A]">
              Belum ada murid yang ditugaskan kepada guru ini.
            </div>
          ) : (
            <div className="divide-y divide-[#DCD9D0]">
              {teacher.students.map((student) => (
                <StudentRowView key={student.id} student={student} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TeacherStudentMonitor({
  data,
}: {
  data: TeacherMonitorData[];
}) {
  const [search, setSearch] = React.useState("");

  const filteredData = React.useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data
      .map((teacher) => {
        const teacherMatch =
          teacher.fullName.toLowerCase().includes(q) ||
          teacher.username.toLowerCase().includes(q);

        const matchedStudents = teacher.students.filter(
          (s) =>
            s.fullName.toLowerCase().includes(q) ||
            s.username.toLowerCase().includes(q),
        );

        if (teacherMatch) return teacher;
        if (matchedStudents.length > 0) {
          return {
            ...teacher,
            students: matchedStudents,
          };
        }
        return null;
      })
      .filter((t): t is TeacherMonitorData => t !== null);
  }, [data, search]);

  return (
    <div className="flex flex-col gap-4">
      {/* Kontrol Pencarian */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari guru atau nama murid..."
            className="pl-9 text-xs"
          />
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]"
          />
        </div>
        <span className="text-xs text-[#71717A]">
          Menampilkan {filteredData.length} guru
        </span>
      </div>

      {/* Hierarki Guru -> Murid */}
      <div className="flex flex-col gap-4">
        {filteredData.length === 0 ? (
          <div className="rounded-[3px] border border-[#DCD9D0] bg-[#FFFFFF] p-8 text-center text-sm text-[#71717A]">
            Tidak ditemukan guru atau murid dengan kata kunci &quot;{search}&quot;.
          </div>
        ) : (
          filteredData.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} />
          ))
        )}
      </div>
    </div>
  );
}
