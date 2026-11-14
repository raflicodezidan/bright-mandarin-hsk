import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk" };

export default async function LoginPage() {
  const session = await getSessionProfile();

  if (session) {
    redirect(session.profile.role === "admin" ? "/admin" : "/tests");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-6">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-text">Bright Mandarin</h1>
          <p className="text-sm text-text-muted">Masuk untuk mengerjakan tes.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
