import { EmptyState } from "@/components/ui/empty-state";
import { ReloadBar } from "@/components/student/reload-bar";
import {
  TestActions,
  type TestActionMode,
} from "@/components/student/test-actions";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { formatDuration, formatTime } from "@/lib/format";

export const metadata = { title: "Tes" };

type StatusMeta = { label: string; dot: string; mode: TestActionMode };

const STATUS: Record<"open" | "in_progress" | "done", StatusMeta> = {
  open: { label: "Terbuka", dot: "bg-[#1B5E3A]", mode: "start" },
  in_progress: {
    label: "Sedang dikerjakan",
    dot: "bg-[#D97706]",
    mode: "resume",
  },
  done: { label: "Selesai", dot: "bg-[#71717A]", mode: "done" },
};

function Meta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
        {label}
      </span>
      <span className="text-[11px] font-medium tabular text-[#52525B]">
        {value}
      </span>
    </span>
  );
}

export default async function StudentTestsPage() {
  await requireStudent();
  const supabase = await createClient();

  await supabase.rpc("finalize_expired_attempts");

  const [testsResult, attemptsResult] = await Promise.all([
    supabase
      .from("tests")
      .select("id, title, level, duration_minutes, status")
      .order("updated_at", { ascending: false }),
    supabase.from("student_attempt_status").select("*"),
  ]);

  const attemptsByTest = new Map(
    (attemptsResult.data ?? []).map((attempt) => [attempt.test_id, attempt]),
  );

  const visible = (testsResult.data ?? []).filter((test) => {
    if (test.status === "open") return true;
    const attempt = attemptsByTest.get(test.id);
    return attempt?.status === "in_progress";
  });

  const summaries = await Promise.all(
    visible.map(async (test) => {
      const { data } = await supabase.rpc("get_test_summary", {
        p_test_id: test.id,
      });
      return { test, summary: data?.[0] };
    }),
  );

  return (
    <>
      <header className="flex flex-col gap-1 pb-6">
        <h1 className="text-[24px] font-bold leading-8 tracking-[-0.02em] text-[#18181B]">
          Tes
        </h1>
        <p className="text-[13px] text-[#52525B]">
          Daftar evaluasi yang tersedia untuk dikerjakan.
        </p>
      </header>

      {summaries.length === 0 ? (
        <EmptyState
          title="Belum ada tes"
          description="Tes yang dibuka admin akan muncul di halaman ini."
        />
      ) : (
        <ul className="divide-y divide-[#DCD9D0] border-y border-[#DCD9D0] bg-[#FAF9F6]">
          {summaries.map(({ test, summary }) => {
            const attempt = attemptsByTest.get(test.id);
            const status =
              attempt?.status === "in_progress"
                ? STATUS.in_progress
                : attempt
                  ? STATUS.done
                  : STATUS.open;

            return (
              <li
                key={test.id}
                className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex min-w-0 flex-col gap-2.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span
                      aria-hidden="true"
                      className={`size-[6px] shrink-0 rounded-[1px] ${status.dot}`}
                    />
                    <h2 className="truncate text-[15px] font-semibold text-[#18181B]">
                      {test.title}
                    </h2>
                    <span className="text-[12px] font-medium text-[#52525B]">
                      {status.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono">
                    <Meta label="Level" value={`HSK ${test.level}`} />
                    <Meta
                      label="Soal"
                      value={String(summary?.total_count ?? 0)}
                    />
                    <Meta
                      label="Durasi"
                      value={formatDuration(test.duration_minutes)}
                    />
                  </div>
                </div>
                <div className="shrink-0 sm:pl-4">
                  <TestActions
                    testId={test.id}
                    title={test.title}
                    level={test.level}
                    durationMinutes={test.duration_minutes}
                    questionCount={summary?.total_count ?? 0}
                    description={summary?.description}
                    mode={status.mode}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ReloadBar checkedAt={formatTime(new Date())} />
    </>
  );
}
