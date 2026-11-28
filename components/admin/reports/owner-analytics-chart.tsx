"use client";

import * as React from "react";
import { BarChart3, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeacherMonitorData } from "@/app/admin/monitoring/page";

type ViewMode = "comparison" | "timeline";

export function OwnerAnalyticsChart({
  teachers,
}: {
  teachers: TeacherMonitorData[];
}) {
  const [mode, setMode] = React.useState<ViewMode>("comparison");

  // 1. Data untuk Mode Perbandingan Guru (Bar Chart)
  const barData = React.useMemo(() => {
    return teachers.map((t) => ({
      id: t.id,
      name: t.fullName,
      username: t.username,
      studentCount: t.studentCount,
      avg: t.overallAverage ?? 0,
      weakCount: t.weakStudentCount,
    }));
  }, [teachers]);

  // 2. Data untuk Mode Tren Waktu Keseluruhan (Timeline Line Chart)
  // Kumpulkan semua attempt murid dari semua guru
  const timelineData = React.useMemo(() => {
    type AttemptPoint = {
      dateStr: string;
      timestamp: number;
      pct: number;
      teacherName: string;
    };

    const allAttempts: AttemptPoint[] = [];

    for (const t of teachers) {
      for (const s of t.students) {
        for (const att of s.attempts) {
          if (!att.submittedAt) continue;
          const d = new Date(att.submittedAt);
          const dateStr = d.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
          });
          allAttempts.push({
            dateStr,
            timestamp: d.getTime(),
            pct: att.percentage,
            teacherName: t.fullName,
          });
        }
      }
    }

    if (allAttempts.length === 0) return [];

    // Urutkan kronologis
    allAttempts.sort((a, b) => a.timestamp - b.timestamp);

    // Kelompokkan per tanggal
    const grouped = new Map<
      string,
      { date: string; sum: number; count: number; timestamp: number }
    >();

    for (const item of allAttempts) {
      const entry = grouped.get(item.dateStr) ?? {
        date: item.dateStr,
        sum: 0,
        count: 0,
        timestamp: item.timestamp,
      };
      entry.sum += item.pct;
      entry.count += 1;
      grouped.set(item.dateStr, entry);
    }

    return Array.from(grouped.values()).map((g) => ({
      date: g.date,
      avg: Math.round(g.sum / g.count),
      count: g.count,
    }));
  }, [teachers]);

  return (
    <div className="rounded-[3px] border border-[#DCD9D0] bg-[#FFFFFF] p-5">
      {/* Header Grafik & Toggle Mode */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#DCD9D0] pb-4">
        <div>
          <h2 className="text-base font-semibold text-[#18181B]">
            {mode === "comparison"
              ? "Perbandingan Rata-rata Nilai Antar Guru"
              : "Tren Perkembangan Nilai Keseluruhan Murid"}
          </h2>
          <p className="text-xs text-[#71717A]">
            {mode === "comparison"
              ? "Komparasi capaian kelas tiap guru secara berdampingan."
              : "Pergerakan performa hasil ujian seluruh murid dari waktu ke waktu."}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-[2px] border border-[#DCD9D0] bg-[#F4F3EF] p-0.5">
          <button
            type="button"
            onClick={() => setMode("comparison")}
            className={cn(
              "flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "comparison"
                ? "bg-[#FFFFFF] text-[#18181B] shadow-xs"
                : "text-[#52525B] hover:text-[#18181B]",
            )}
          >
            <BarChart3 size={14} strokeWidth={1.75} />
            Perbandingan Guru
          </button>
          <button
            type="button"
            onClick={() => setMode("timeline")}
            className={cn(
              "flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "timeline"
                ? "bg-[#FFFFFF] text-[#18181B] shadow-xs"
                : "text-[#52525B] hover:text-[#18181B]",
            )}
          >
            <LineChart size={14} strokeWidth={1.75} />
            Tren Waktu
          </button>
        </div>
      </div>

      {/* Render Grafik Sesuai Mode */}
      {mode === "comparison" ? (
        <TeacherBarComparison data={barData} />
      ) : (
        <TimelineLineChart data={timelineData} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Grafik Batang Perbandingan Guru (SVG)
// ─────────────────────────────────────────────────────────────────────────────
function TeacherBarComparison({
  data,
}: {
  data: Array<{
    id: string;
    name: string;
    username: string;
    studentCount: number;
    avg: number;
    weakCount: number;
  }>;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-[#71717A]">
        Belum ada data guru untuk dibandingkan.
      </div>
    );
  }

  const height = 240;
  const paddingBottom = 40;
  const paddingTop = 30;
  const chartHeight = height - paddingBottom - paddingTop;

  return (
    <div className="flex flex-col gap-4">
      {/* Visual Chart */}
      <div className="relative w-full overflow-x-auto">
        <div className="min-w-[500px]">
          <svg viewBox="0 0 700 240" className="w-full h-60">
            {/* Garis Grid Y (0%, 25%, 50%, 75%, 100%) */}
            {[0, 25, 50, 75, 100].map((val) => {
              const y = paddingTop + chartHeight - (val / 100) * chartHeight;
              return (
                <g key={val}>
                  <line
                    x1="45"
                    y1={y}
                    x2="690"
                    y2={y}
                    stroke="#DCD9D0"
                    strokeDasharray={val === 60 ? "0" : "3 3"}
                    strokeWidth={val === 60 ? 1.5 : 1}
                  />
                  <text
                    x="35"
                    y={y + 3}
                    textAnchor="end"
                    className="font-mono text-[10px] fill-[#71717A] tabular"
                  >
                    {val}%
                  </text>
                </g>
              );
            })}

            {/* Garis batas kelulusan 60% */}
            <line
              x1="45"
              y1={paddingTop + chartHeight - 0.6 * chartHeight}
              x2="690"
              y2={paddingTop + chartHeight - 0.6 * chartHeight}
              stroke="#D97706"
              strokeWidth={1.5}
            />
            <text
              x="690"
              y={paddingTop + chartHeight - 0.6 * chartHeight - 4}
              textAnchor="end"
              className="font-mono text-[10px] font-semibold fill-[#D97706]"
            >
              Standar 60%
            </text>

            {/* Batang per Guru */}
            {data.map((item, idx) => {
              const totalItems = data.length;
              const slotWidth = (690 - 60) / totalItems;
              const barWidth = Math.min(60, slotWidth * 0.55);
              const x = 60 + idx * slotWidth + (slotWidth - barWidth) / 2;
              const barH = (item.avg / 100) * chartHeight;
              const y = paddingTop + chartHeight - barH;

              const isGood = item.avg >= 75;
              const isMedium = item.avg >= 60 && item.avg < 75;
              const fillColor = isGood
                ? "#1B5E3A"
                : isMedium
                  ? "#D97706"
                  : "#A62626";

              return (
                <g key={item.id} className="group cursor-default">
                  {/* Label nilai di atas batang */}
                  <text
                    x={x + barWidth / 2}
                    y={y - 8}
                    textAnchor="middle"
                    className="font-mono text-xs font-bold fill-[#18181B] tabular"
                  >
                    {item.avg}%
                  </text>

                  {/* Batang */}
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx="2"
                    fill={fillColor}
                    className="transition-all hover:opacity-90"
                  />

                  {/* Label Nama Guru di sumbu X */}
                  <text
                    x={x + barWidth / 2}
                    y={height - 18}
                    textAnchor="middle"
                    className="text-xs font-medium fill-[#18181B]"
                  >
                    {item.name.length > 15
                      ? item.name.slice(0, 13) + "…"
                      : item.name}
                  </text>
                  <text
                    x={x + barWidth / 2}
                    y={height - 4}
                    textAnchor="middle"
                    className="font-mono text-[10px] fill-[#71717A]"
                  >
                    {item.studentCount} murid
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Legenda Keterangan */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#DCD9D0] pt-3 text-xs text-[#52525B]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-[#1B5E3A]" />
            <span>Tinggi (≥75%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-[#D97706]" />
            <span>Sedang (60–74%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-[#A62626]" />
            <span>Perlu Perhatian (&lt;60%)</span>
          </div>
        </div>
        <span className="font-mono text-[11px] text-[#71717A]">
          * Diperbarui otomatis dari setiap pengerjaan tes murid terkini
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Grafik Garis Tren Waktu Keseluruhan (Timeline SVG)
// ─────────────────────────────────────────────────────────────────────────────
function TimelineLineChart({
  data,
}: {
  data: Array<{ date: string; avg: number; count: number }>;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-[#71717A]">
        Belum ada riwayat pengerjaan tes yang tercatat untuk tren waktu.
      </div>
    );
  }

  const height = 240;
  const paddingBottom = 40;
  const paddingTop = 30;
  const paddingLeft = 45;
  const paddingRight = 30;
  const chartWidth = 700 - paddingLeft - paddingRight;
  const chartHeight = height - paddingBottom - paddingTop;

  const points = data.map((d, i) => {
    const x =
      data.length === 1
        ? paddingLeft + chartWidth / 2
        : paddingLeft + (i / (data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.avg / 100) * chartHeight;
    return { ...d, x, y };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  // Area di bawah garis
  const areaD =
    points.length > 1
      ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
      : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full overflow-x-auto">
        <div className="min-w-[500px]">
          <svg viewBox="0 0 700 240" className="w-full h-60">
            {/* Grid Horizontal */}
            {[0, 25, 50, 75, 100].map((val) => {
              const y = paddingTop + chartHeight - (val / 100) * chartHeight;
              return (
                <g key={val}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={700 - paddingRight}
                    y2={y}
                    stroke="#DCD9D0"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="font-mono text-[10px] fill-[#71717A] tabular"
                  >
                    {val}%
                  </text>
                </g>
              );
            })}

            {/* Garis Standar 60% */}
            <line
              x1={paddingLeft}
              y1={paddingTop + chartHeight - 0.6 * chartHeight}
              x2={700 - paddingRight}
              y2={paddingTop + chartHeight - 0.6 * chartHeight}
              stroke="#D97706"
              strokeDasharray="2 2"
              strokeWidth={1.5}
            />

            {/* Area Fill Halus */}
            {areaD && (
              <path d={areaD} fill="#18181B" fillOpacity="0.04" />
            )}

            {/* Garis Tren */}
            {points.length > 1 && (
              <path
                d={pathD}
                fill="none"
                stroke="#18181B"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Titik Point & Label Nilai */}
            {points.map((pt, idx) => (
              <g key={idx}>
                {/* Nilai persentase */}
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor="middle"
                  className="font-mono text-[11px] font-bold fill-[#18181B] tabular"
                >
                  {pt.avg}%
                </text>

                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={4.5}
                  className={cn(
                    pt.avg >= 60 ? "fill-[#1B5E3A]" : "fill-[#A62626]",
                  )}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />

                {/* Tanggal di sumbu X */}
                <text
                  x={pt.x}
                  y={height - 18}
                  textAnchor="middle"
                  className="font-mono text-[11px] fill-[#18181B]"
                >
                  {pt.date}
                </text>
                <text
                  x={pt.x}
                  y={height - 4}
                  textAnchor="middle"
                  className="font-mono text-[9px] fill-[#71717A]"
                >
                  ({pt.count} tes)
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between border-t border-[#DCD9D0] pt-3 text-xs text-[#52525B]">
        <span>
          Menampilkan tren rata-rata nilai dari seluruh pengerjaan tes murid.
        </span>
        <span className="font-mono text-[11px] text-[#71717A]">
          Garis putus-putus jingga = Batas kelulusan minimum (60%)
        </span>
      </div>
    </div>
  );
}
