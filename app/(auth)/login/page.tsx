import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk" };

function LatticeCorner({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      fill="none"
      stroke="#E2DFD7"
      strokeWidth="1"
      className={`pointer-events-none absolute hidden size-[120px] sm:block ${className}`}
    >
      <path d="M0 28h28V0" />
      <path d="M0 56h56V0" />
      <path d="M28 28h28v28H28z" />
      <path d="M28 42h28M42 28v28" />
      <path d="M0 84h12M84 0v12" />
    </svg>
  );
}

export default async function LoginPage() {
  const session = await getSessionProfile();

  if (session) {
    redirect(session.profile.role === "admin" ? "/admin" : "/tests");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F4F3EF] px-4 py-10">
      <LatticeCorner className="left-0 top-0" />
      <LatticeCorner className="right-0 top-0 rotate-90" />
      <LatticeCorner className="bottom-0 right-0 rotate-180" />
      <LatticeCorner className="bottom-0 left-0 -rotate-90" />

      <div className="relative w-full max-w-[400px] overflow-hidden rounded-[3px] border border-[#DCD9D0] bg-[#FAF9F6]">
        <header className="flex flex-col items-center px-7 pb-3 pt-8 text-center">
          <Image
            src="/logo-bright-mandarin.png"
            alt="Bright Mandarin"
            width={512}
            height={512}
            priority
            sizes="160px"
            className="h-auto w-[160px] mix-blend-multiply"
          />
          <p className="mt-3 font-mono text-[10px] font-medium uppercase leading-3 tracking-[0.12em] text-[#71717A]">
            Portal Murid
          </p>

          <h1 className="mt-6 text-[20px] font-bold leading-7 tracking-[-0.02em] text-[#18181B]">
            Masuk ke Akun Murid
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-[#52525B]">
            Masukkan username dan password untuk mulai mengerjakan tes.
          </p>
        </header>

        <LoginForm />
      </div>
    </main>
  );
}
