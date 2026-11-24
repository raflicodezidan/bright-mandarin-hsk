"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { setTestAssignmentsAction } from "@/app/admin/tests/actions";

export type AssignmentTeacher = {
  id: string;
  fullName: string;
  isActive: boolean;
};

export function TestAssignmentsCard({
  testId,
  teachers,
  assignedIds,
}: {
  testId: string;
  teachers: AssignmentTeacher[];
  assignedIds: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<string[]>(assignedIds);
  const [error, setError] = React.useState<string | null>(null);

  const sorted = React.useMemo(
    () =>
      [...teachers].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.fullName.localeCompare(b.fullName);
      }),
    [teachers],
  );

  function toggle(teacherId: string) {
    setSelected((current) =>
      current.includes(teacherId)
        ? current.filter((id) => id !== teacherId)
        : [...current, teacherId],
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await setTestAssignmentsAction({
        testId,
        teacherIds: selected,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Penugasan tes diperbarui.");
      router.refresh();
    });
  }

  if (teachers.length === 0) {
    return (
      <EmptyState
        title="Belum ada guru"
        description="Tambahkan akun guru terlebih dahulu untuk menugaskan tes."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Pilih guru yang dapat mengelola dan memberikan tes ini. Tes milik owner
        tanpa penugasan berlaku sebagai tes global; tes milik guru tanpa
        penugasan tetap terlihat oleh murid guru tersebut.
      </p>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {sorted.map((teacher) => {
          const checked = selected.includes(teacher.id);
          return (
            <li key={teacher.id}>
              <label className="flex cursor-pointer items-center gap-3 px-1 py-3 text-sm hover:bg-surface-muted">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(teacher.id)}
                  disabled={pending}
                  className="size-4 accent-[#18181B]"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-text">
                    {teacher.fullName}
                  </span>
                  {!teacher.isActive ? (
                    <span className="text-xs text-text-muted">
                      Nonaktif
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-text-muted">
          {selected.length} guru dipilih
        </span>
        <Button onClick={save} loading={pending}>
          Simpan penugasan
        </Button>
      </div>
    </div>
  );
}
