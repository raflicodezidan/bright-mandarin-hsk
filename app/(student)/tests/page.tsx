import { ReloadBar } from "@/components/student/reload-bar";
import {
  TestActions,
  type TestActionMode,
} from "@/components/student/test-actions";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { formatDuration, formatTime } from "@/lib/format";

export const metadata = { title: "Tes" };

type StatusMeta = { label: string; dot: string; color: string; mode: TestActionMode };

const STATUS: Record<"open" | "in_progress" | "done", StatusMeta> = {
  open: { label: "Terbuka", dot: "bg-[#1B5E3A]", color: "text-[#1B5E3A]", mode: "start" },
  in_progress: {
    label: "Sedang dikerjakan",
    dot: "bg-[#D97706]",
    color: "text-[#D97706]",
    mode: "resume",
  },
  done: { label: "Selesai", dot: "bg-[#71717A]", color: "text-[#71717A]", mode: "done" },
};

function Meta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
  <div className="flex flex-col gap-0.5">
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.06em] text-[#71717A]">
        {label}
      </span>
      <span className="font-mono text-[13px] font-medium tabular text-[#18181B]">
        {value}
      </span>
    </div>
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
      <header className="mb-7 flex flex-col gap-1">
        <h1 className="text-[26px] font-bold leading-8 tracking-[-0.02em] text-[#18181B]">
          Tes
        </h1>
        <p className="mt-1 text-[14px] text-[#52525B]">
          Daftar evaluasi yang tersedia untuk dikerjakan.
        </p>
      </header>

      {summaries.length === 0 ? (
        <div className="rounded-[3px] border border-[#DCD9D0] bg-[#FAF9F6] px-8 py-12">
          <p className="text-[16px] font-semibold text-[#18181B]">Belum ada tes</p>
          <p className="mt-1 text-[13px] text-[#52525B]">
            Tes yang dibuka guru akan muncul di halaman ini.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#DCD9D0] rounded-[3px] border border-[#DCD9D0] bg-[#FAF9F6]">
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
                className="flex flex-col gap-4 px-6 py-5 transition-colors hover:bg-[#F1EFE9] sm:px-8 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`size-[6px] shrink-0 rounded-[1px] ${status.dot}`}
                    />
                    <span className={`text-[12px] font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <h2 className="truncate text-[16px] font-semibold text-[#18181B]">
                    {test.title}
                  </h2>
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="flex items-center divide-x divide-[#DCD9D0]">
                    <div className="pr-5">
                      <Meta label="Level" value={`HSK ${test.level}`} />
                    </div>
                    <div className="px-5">
                      <Meta label="Soal" value={String(summary?.total_count ?? 0)} />
                    </div>
                    <div className="pl-5">
                      <Meta label="Durasi" value={formatDuration(test.duration_minutes)} />
                    </div>
                  </div>
                  <div className="shrink-0 lg:ml-6">
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
