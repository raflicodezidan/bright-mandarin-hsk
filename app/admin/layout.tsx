import { requireStaff } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { logoutAction } from "@/app/(auth)/login/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireStaff();
  const role = profile.role === "teacher" ? "teacher" : "owner";

  return (
    <ToastProvider>
      <AdminShell
        role={role}
        userName={profile.full_name}
        email={profile.username}
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
