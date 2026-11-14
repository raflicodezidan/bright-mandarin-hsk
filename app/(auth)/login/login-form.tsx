"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field label="Username" htmlFor="username" required>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={pending}
        />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </Field>
      <Button type="submit" loading={pending} className="mt-2 w-full">
        Masuk
      </Button>
    </form>
  );
}
