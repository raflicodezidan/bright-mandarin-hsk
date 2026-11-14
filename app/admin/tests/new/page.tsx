import { PageHeader } from "@/components/ui/page-header";
import { TestForm } from "@/components/admin/tests/test-form";

export const metadata = { title: "Buat tes" };

export default function NewTestPage() {
  return (
    <>
      <PageHeader
        title="Buat tes"
        description="Tes baru disimpan sebagai draft."
      />
      <TestForm mode="create" />
    </>
  );
}
