import Image from "next/image";
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
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <Image
        src="/login-bg.webp"
        alt="Latar belakang Bright Mandarin"
        fill
        priority
        className="pointer-events-none object-cover object-center"
      />
      <div className="pointer-events-none absolute inset-0 bg-[#FAF9F5]/30 backdrop-blur-[1px]" />

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
