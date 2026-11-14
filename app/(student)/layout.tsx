import { requireStudent } from "@/lib/auth";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(auth)/login/actions";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireStudent();

  return (
    <StudentShell
      userName={profile.full_name}
      logout={
        <form action={logoutAction}>
          <Button type="submit" variant="danger" size="sm">
            Keluar
          </Button>
        </form>
      }
    >
      {children}
    </StudentShell>
  );
}
