"use client";

import { useActionState } from "react";
import { signIn } from "@/app/login/actions";
import { initialFormState } from "@/lib/forms";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    signIn,
    initialFormState,
  );

  return (
    <form action={formAction} className="stack" noValidate>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        {state.fieldErrors?.email ? (
          <p id="email-error" className="field-error">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
        />
        {state.fieldErrors?.password ? (
          <p id="password-error" className="field-error">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      {state.message ? (
        <p className="form-message" role="alert">
          {state.message}
        </p>
      ) : null}

      <button className="button" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
