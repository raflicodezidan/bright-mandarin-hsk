import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { TestForm } from "@/components/admin/tests/test-form";

export const metadata = { title: "Buat tes" };

export default function NewTestPage() {
  return (
    <>
      <PageHeader
        title="Buat tes"
        description="Tes baru disimpan sebagai draft."
        actions={
          <LinkButton href="/admin/tests" variant="secondary">
            <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
            Kembali
          </LinkButton>
        }
      />
      <TestForm mode="create" />
    </>
  );
}
