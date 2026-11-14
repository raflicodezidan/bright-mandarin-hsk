import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { logoutAction } from "@/app/(auth)/login/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <ToastProvider>
      <AdminShell
        logout={
          <form action={logoutAction}>
            <Button type="submit" variant="danger" size="sm">
              Keluar
            </Button>
          </form>
        }
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
