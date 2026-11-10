"use client";

import { useActionState } from "react";
import { RiErrorWarningFill, RiLockLine, RiMailLine } from "@remixicon/react";

import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <Input name="email" type="email" label="Email" isRequired autoComplete="email" autoFocus leadingIcon={RiMailLine} placeholder="you@example.com" />
      <Input name="password" type="password" label="Password" isRequired autoComplete="current-password" leadingIcon={RiLockLine} />

      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-status-rose-background px-3 py-2 text-body-regular text-status-rose-text">
          <RiErrorWarningFill className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
