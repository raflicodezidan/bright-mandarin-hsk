"use client";

import * as React from "react";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

const fieldClass =
  "w-full rounded-[2px] border border-[#DCD9D0] bg-[#F8F7F3] px-3 py-2.5 text-[13px] text-[#18181B] placeholder:text-[#71717A] transition-colors duration-150 focus:border-[#18181B] focus:bg-[#FFFFFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export function LoginForm() {
  const [state, action, pending] = React.useActionState(
    loginAction,
    initialState,
  );
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <form action={action} className="flex flex-col gap-4 p-7">
      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[2px] border border-[#DEC4C0] bg-[#F2E6E4] px-3 py-2.5 text-[12px] leading-5 text-[#8F2020]"
        >
          <AlertTriangle
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="username"
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#52525B]"
        >
          Username <span className="text-[#A62626]">*</span>
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={pending}
          placeholder="Masukkan username"
          className={`${fieldClass} font-mono placeholder:font-sans`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#52525B]"
        >
          Password <span className="text-[#A62626]">*</span>
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending}
            placeholder="Masukkan password"
            className={`${fieldClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            disabled={pending}
            aria-pressed={showPassword}
            aria-label={
              showPassword ? "Sembunyikan password" : "Tampilkan password"
            }
            className="absolute inset-y-0 right-0 flex items-center px-3 text-[#52525B] transition-colors duration-150 hover:text-[#18181B] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#18181B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {showPassword ? (
              <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-[2px] border border-[#154B2E] bg-[#1B5E3A] py-2.5 text-[13px] font-semibold text-[#F8F7F3] transition-colors duration-150 hover:bg-[#14472C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18181B] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-[1px] border-2 border-current border-t-transparent"
          />
        ) : null}
        Masuk
      </button>

      <p className="text-center text-[12px] leading-4 text-[#71717A]">
        Hubungi pengajar jika lupa password.
      </p>
    </form>
  );
}
