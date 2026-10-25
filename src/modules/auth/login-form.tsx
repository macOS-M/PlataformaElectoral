"use client";
import { useActionState } from "react";
import { signIn } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(signIn, { error: "" });
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          Correo electrónico
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          disabled={!configured}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          Contraseña
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          disabled={!configured}
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-800">
          {state.error}
        </p>
      )}
      <Button className="w-full" disabled={!configured || pending}>
        {pending ? "Ingresando…" : "Ingresar al espacio"}
      </Button>
    </form>
  );
}
