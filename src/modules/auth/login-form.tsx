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
        <label htmlFor="identifier" className="mb-2 block text-sm font-medium">
          Cédula o correo
        </label>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          placeholder="Tu cédula o correo"
          className="h-11"
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
          className="h-11"
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
      <Button className="h-11 w-full" disabled={!configured || pending}>
        {pending ? "Ingresando…" : "Ingresar al espacio"}
      </Button>
    </form>
  );
}
