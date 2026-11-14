"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { duplicateTestAction } from "@/app/admin/tests/actions";

export function DuplicateTestButton({
  testId,
  title,
}: {
  testId: string;
  title: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateTestAction(testId);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast(`Tes "${title}" diduplikat.`);
      router.push(`/admin/tests/${result.data.id}`);
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={duplicate}
      icon={<Copy size={14} strokeWidth={1.5} aria-hidden="true" />}
    >
      Duplikat
    </Button>
  );
}
